-- Devices, not sessions, decide which branch you are looking at.
--
-- 0050 keyed branch selection on the GoTrue session_id and called it "this
-- device". It never was. A session dies at sign-out, so every fresh login on a
-- multi-branch account re-asked "which branch are you at?", and a shared
-- workshop tablet held no branch of its own -- it held one row per person who
-- had ever signed in on it. Two people on one tablet could sit in two branches,
-- and a technician standing at Blacktown could file a job into Penrith by
-- answering the prompt wrong. The copy promised device behaviour the schema
-- did not implement.
--
-- The device now carries an identity of its own: a long-lived opaque token in
-- an httpOnly cookie, minted by the Next proxy and hashed before it is ever
-- sent to Postgres (the DB stores and compares sha256 hex, never the token, so
-- a database read cannot mint a working cookie). Three tables hang off it:
--
--   shop_devices        -- owner-registered hardware. Answers for EVERYONE who
--                          signs in on it. The front-counter tablet is Blacktown.
--   device_branches     -- a personal choice on a personal device, and the
--                          owner/admin override on a registered one. Keyed per
--                          person as well as per device, so an owner peeking at
--                          another branch on the shop tablet cannot leave it
--                          pointing somewhere wrong for the next technician.
--   device_pairing_codes -- how a branch 500km away gets its tablet registered
--                          without the owner flying there.
--
-- Resolution order below is deliberate and is the whole design: personal choice
-- beats device registration beats home branch. Registration therefore never
-- traps an owner, and an override never escapes the person who made it.
--
-- Existing session_branches rows are NOT migrated. There is no device token to
-- migrate them onto -- every current session predates the cookie -- so everyone
-- falls back to profiles.shop_id once and answers the prompt one final time.
-- That is the same "first time on this device" moment they would get on new
-- hardware, and it is the last one they will ever see on that browser.

-- ---------------------------------------------------------------------------
-- Device identity
-- ---------------------------------------------------------------------------

-- PostgREST exposes the request headers as a JSON GUC. Missing GUC, missing
-- header, or a non-PostgREST caller all return null, and every lookup below
-- coalesces past null -- so a request with no device simply behaves the way
-- the app did before this migration.
create or replace function public.current_device_hash()
returns text
language sql stable
set search_path = public
as $$
  select nullif(
    coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-argos-device',
    ''
  )
$$;

revoke all on function public.current_device_hash() from public, anon;

-- Owner-registered hardware. token_hash is unique rather than the key so the
-- API can name a device by id when revoking it without ever handling the hash.
create table if not exists public.shop_devices (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  shop_id uuid not null references public.shops(id) on delete cascade,
  label text,
  registered_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  active boolean not null default true
);

create index if not exists shop_devices_shop_idx on public.shop_devices(shop_id);

-- One person's choice on one device. Composite key is the point: the same
-- tablet holds a separate answer per login, so nobody inherits anybody's.
create table if not exists public.device_branches (
  token_hash text not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (token_hash, profile_id)
);

create index if not exists device_branches_profile_idx on public.device_branches(profile_id);

create table if not exists public.device_pairing_codes (
  code text primary key,
  shop_id uuid not null references public.shops(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_token_hash text
);

create index if not exists device_pairing_codes_shop_idx on public.device_pairing_codes(shop_id);

-- No client touches any of these directly. Every read and write goes through a
-- security-definer function below, which is what stops a device claiming a
-- branch its user was never granted. shop_id on shops is `on delete cascade`,
-- so delete_branch (0059) already takes a branch's devices and overrides with
-- it -- a deleted branch cannot leave tablets pointing at a dead shop.
alter table public.shop_devices enable row level security;
alter table public.device_branches enable row level security;
alter table public.device_pairing_codes enable row level security;
revoke all on public.shop_devices from public, anon, authenticated;
revoke all on public.device_branches from public, anon, authenticated;
revoke all on public.device_pairing_codes from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Resolving the current branch
-- ---------------------------------------------------------------------------

-- Order matters, and each step exists for a reason:
--
--   1. device_branches -- an explicit answer from THIS person on THIS device.
--      Owner/admin switching writes here, as does the once-ever prompt on an
--      unregistered personal phone. It is per-person, so it cannot leak.
--   2. shop_devices    -- what the hardware says it is. Anyone signing in on a
--      registered tablet lands here without being asked anything.
--   3. profiles.shop_id -- home branch, for a login on an unregistered device
--      that has not chosen yet, and for everyone at a single-branch business.
--
-- The trailing roster check is unchanged from 0050 and does more work than it
-- looks like it does: it is what makes a stolen pairing code worthless. A
-- device registered to Blacktown shows Blacktown data only to someone who
-- holds an active Blacktown roster row -- otherwise this returns null and the
-- app has nothing to render, which the client turns into an explicit "you are
-- not assigned to this branch" screen rather than an empty dashboard.
create or replace function public.current_shop_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  with dev as (select public.current_device_hash() as token_hash),
  selected as (
    select coalesce(
      (
        select db.shop_id
        from public.device_branches db, dev
        where db.token_hash = dev.token_hash and db.profile_id = auth.uid()
      ),
      (
        select sd.shop_id
        from public.shop_devices sd, dev
        where sd.token_hash = dev.token_hash and sd.active
      ),
      (select p.shop_id from public.profiles p where p.id = auth.uid())
    ) as shop_id
  )
  select s.shop_id
  from selected s
  where s.shop_id is not null
    and exists (
      select 1
      from public.shop_technicians t
      where t.profile_id = auth.uid()
        and t.shop_id = s.shop_id
        and t.active
    )
$$;

-- What the profile sheet and the branch prompt both need, in one round trip.
-- registered_shop_id is what the hardware says; pinned is whether this person
-- has answered on this device. The prompt fires only when neither is true and
-- the caller holds more than one branch -- so a registered tablet never asks,
-- and a personal phone asks exactly once and remembers it past sign-out.
create or replace function public.device_context()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  with dev as (select public.current_device_hash() as token_hash)
  select jsonb_build_object(
    'known', (select token_hash is not null from dev),
    'pinned', exists (
      select 1 from public.device_branches db, dev
      where db.token_hash = dev.token_hash and db.profile_id = auth.uid()
    ),
    'registeredShopId', (
      select sd.shop_id from public.shop_devices sd, dev
      where sd.token_hash = dev.token_hash and sd.active
    ),
    -- Definer, so this reads a branch the caller may have no grant in. That is
    -- the point: the one time it matters is when someone signs in on a tablet
    -- registered somewhere they are not rostered, and "you are not assigned to
    -- Blacktown" is a far more useful dead end than "access deactivated".
    'registeredShopName', (
      select s.name
      from public.shop_devices sd
      join public.shops s on s.id = sd.shop_id
      where sd.token_hash = (select token_hash from dev) and sd.active
    )
  )
$$;

revoke all on function public.device_context() from public, anon;
grant execute on function public.device_context() to authenticated;

-- Kept so nothing that still calls it breaks mid-deploy, and redefined to mean
-- the same thing it always claimed to: does this device know where it is.
create or replace function public.has_session_branch()
returns boolean
language sql stable security definer
set search_path = public
as $$
  with dev as (select public.current_device_hash() as token_hash)
  select exists (
    select 1 from public.device_branches db, dev
    where db.token_hash = dev.token_hash and db.profile_id = auth.uid()
  ) or exists (
    select 1 from public.shop_devices sd, dev
    where sd.token_hash = dev.token_hash and sd.active
  )
$$;

-- ---------------------------------------------------------------------------
-- Switching branch
-- ---------------------------------------------------------------------------

-- Writes this person's choice on this device. Survives sign-out, because the
-- cookie does -- that is the whole reason this is not keyed on a session any
-- more. On a registered tablet this shadows the registration for the caller
-- alone, which is what lets an owner look at another branch without leaving
-- the front counter pointing at it.
create or replace function public.set_device_branch(target_shop uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  dev text := public.current_device_hash();
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.shop_technicians t
    where t.profile_id = auth.uid() and t.shop_id = target_shop and t.active
  ) then
    raise exception 'You do not have access to that branch' using errcode = '42501';
  end if;

  -- Silently doing nothing would leave the caller believing they had switched.
  if dev is null then
    raise exception 'This device is not set up -- reload the app and try again' using errcode = '42501';
  end if;

  insert into public.device_branches(token_hash, profile_id, shop_id)
  values (dev, auth.uid(), target_shop)
  on conflict (token_hash, profile_id) do update
    set shop_id = excluded.shop_id, updated_at = now();

  return target_shop;
end;
$$;

revoke all on function public.set_device_branch(uuid) from public, anon;
grant execute on function public.set_device_branch(uuid) to authenticated;

-- Old name, new mechanism, so a client running against a half-deployed backend
-- still switches correctly instead of erroring.
create or replace function public.set_session_branch(target_shop uuid)
returns uuid
language sql security definer
set search_path = public
as $$ select public.set_device_branch(target_shop) $$;

-- Drop back to whatever the hardware says. An owner who overrode the front
-- counter tablet uses this to put it back rather than having to guess which
-- branch it was registered to.
create or replace function public.clear_device_branch()
returns void
language sql security definer
set search_path = public
as $$
  delete from public.device_branches
  where token_hash = public.current_device_hash() and profile_id = auth.uid()
$$;

revoke all on function public.clear_device_branch() from public, anon;
grant execute on function public.clear_device_branch() to authenticated;

-- ---------------------------------------------------------------------------
-- Pairing a device
-- ---------------------------------------------------------------------------

-- Short, single-use, hour-long. Deliberately readable down a phone line: no
-- O/0 or I/1, and short enough to say twice without anyone writing it down.
--
-- It is safe for it to be this weak because redeeming it grants no access to
-- anything. It registers hardware; current_shop_id() still requires an active
-- roster row before that hardware shows a single job. The worst a leaked code
-- buys is a junk row in the owner's device list, which they can see and revoke.
create or replace function public.create_pairing_code(target_shop uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  attempt int := 0;
begin
  if not exists (
    select 1 from public.shop_technicians t
    where t.profile_id = auth.uid()
      and t.shop_id = target_shop
      and t.active
      and t.role in ('owner', 'admin')
  ) then
    raise exception 'Only an Owner or Admin of that branch can set up a device for it'
      using errcode = '42501';
  end if;

  loop
    attempt := attempt + 1;
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
    end loop;
    exit when not exists (
      select 1 from public.device_pairing_codes c
      where c.code = candidate and c.consumed_at is null and c.expires_at > now()
    );
    if attempt > 20 then
      raise exception 'Could not generate a pairing code, try again' using errcode = '55000';
    end if;
  end loop;

  -- A code that was used or expired can be handed out again; only live ones
  -- have to be unique, which is what keeps six characters enough forever.
  delete from public.device_pairing_codes where code = candidate;

  insert into public.device_pairing_codes(code, shop_id, created_by, expires_at)
  values (candidate, target_shop, auth.uid(), now() + interval '1 hour');

  return jsonb_build_object(
    'code', candidate,
    'expiresAt', now() + interval '1 hour',
    'branchName', (select s.name from public.shops s where s.id = target_shop)
  );
end;
$$;

revoke all on function public.create_pairing_code(uuid) from public, anon;
grant execute on function public.create_pairing_code(uuid) to authenticated;

-- Callable signed-out, and it has to be: a brand-new branch may have nobody
-- with an account yet, let alone an admin. The hardware identifies itself
-- before any human authenticates on it. Rate limiting lives in the API route,
-- since this is the only endpoint in the app with no login behind it.
create or replace function public.redeem_pairing_code(
  p_code text,
  p_token_hash text,
  p_label text default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  entry public.device_pairing_codes%rowtype;
begin
  if coalesce(trim(p_token_hash), '') = '' then
    raise exception 'This device could not be identified' using errcode = '22023';
  end if;

  select * into entry from public.device_pairing_codes
  where code = upper(trim(p_code)) for update;

  if not found or entry.consumed_at is not null or entry.expires_at <= now() then
    -- One message for all three cases: a wrong code and an expired code should
    -- not be distinguishable to someone guessing at them.
    raise exception 'That code is not valid any more. Ask for a new one.' using errcode = '42501';
  end if;

  insert into public.shop_devices(token_hash, shop_id, label, registered_by)
  values (p_token_hash, entry.shop_id, nullif(trim(coalesce(p_label, '')), ''), entry.created_by)
  on conflict (token_hash) do update
    set shop_id = excluded.shop_id,
        label = coalesce(excluded.label, public.shop_devices.label),
        active = true,
        registered_by = excluded.registered_by;

  -- Re-registering a tablet to a different branch must not leave yesterday's
  -- personal overrides on it silently winning over the new registration.
  delete from public.device_branches where token_hash = p_token_hash;

  update public.device_pairing_codes
  set consumed_at = now(), consumed_token_hash = p_token_hash
  where code = entry.code;

  return jsonb_build_object(
    'branchName', (select s.name from public.shops s where s.id = entry.shop_id),
    'shopId', entry.shop_id
  );
end;
$$;

revoke all on function public.redeem_pairing_code(text, text, text) from public;
grant execute on function public.redeem_pairing_code(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Managing registered devices
-- ---------------------------------------------------------------------------

create or replace function public.list_shop_devices()
returns table (
  id uuid,
  shop_id uuid,
  shop_name text,
  label text,
  created_at timestamptz,
  last_seen_at timestamptz,
  is_this_device boolean
)
language sql stable security definer
set search_path = public
as $$
  select d.id, d.shop_id, s.name, d.label, d.created_at, d.last_seen_at,
         d.token_hash = public.current_device_hash()
  from public.shop_devices d
  join public.shops s on s.id = d.shop_id
  where d.active
    and exists (
      select 1 from public.shop_technicians t
      where t.profile_id = auth.uid()
        and t.shop_id = d.shop_id
        and t.active
        and t.role in ('owner', 'admin')
    )
  order by s.name, d.created_at
$$;

revoke all on function public.list_shop_devices() from public, anon;
grant execute on function public.list_shop_devices() to authenticated;

create or replace function public.revoke_shop_device(device_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  target public.shop_devices%rowtype;
begin
  select * into target from public.shop_devices where id = device_id;
  if not found then
    raise exception 'That device is not registered' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.shop_technicians t
    where t.profile_id = auth.uid()
      and t.shop_id = target.shop_id
      and t.active
      and t.role in ('owner', 'admin')
  ) then
    raise exception 'Only an Owner or Admin of that branch can remove its devices'
      using errcode = '42501';
  end if;

  delete from public.device_branches where token_hash = target.token_hash;
  delete from public.shop_devices where id = device_id;
end;
$$;

revoke all on function public.revoke_shop_device(uuid) from public, anon;
grant execute on function public.revoke_shop_device(uuid) to authenticated;

-- Cheap enough to run on every branch listing, and it is the only way an owner
-- can tell a tablet still in use from one that was replaced months ago.
create or replace function public.touch_current_device()
returns void
language sql security definer
set search_path = public
as $$
  update public.shop_devices
  set last_seen_at = now()
  where token_hash = public.current_device_hash()
$$;

revoke all on function public.touch_current_device() from public, anon;
grant execute on function public.touch_current_device() to authenticated;

-- ---------------------------------------------------------------------------
-- Revoking access
-- ---------------------------------------------------------------------------

-- Losing one branch is no longer a reason to be signed out everywhere. Clearing
-- the overrides that point at the lost branch is enough: current_shop_id() then
-- re-resolves to the hardware's branch or the home branch, both of which are
-- still checked against the roster. The exception is someone who has just lost
-- their last branch -- there is nothing left to re-resolve to, so their
-- sessions go.
create or replace function public.revoke_branch_sessions(target_profile uuid, target_shop uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  delete from public.device_branches
  where profile_id = target_profile and shop_id = target_shop;

  if not exists (
    select 1 from public.shop_technicians t
    where t.profile_id = target_profile and t.active
  ) then
    delete from auth.sessions where user_id = target_profile;
  end if;
end;
$$;

revoke all on function public.revoke_branch_sessions(uuid, uuid) from public, anon, authenticated;

create or replace function public.revoke_workshop_sessions(target_profile uuid)
returns void
language sql security definer
set search_path = ''
as $$
  delete from public.device_branches where profile_id = target_profile;
  delete from public.session_branches where profile_id = target_profile;
  delete from auth.sessions where user_id = target_profile;
$$;

revoke all on function public.revoke_workshop_sessions(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';
