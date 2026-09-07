-- A branch's Registration ID: permanent, printed on its own profile, and the
-- only thing a new device ever needs.
--
-- 0060 issued one-time pairing codes. They were sized for a threat that does
-- not exist and they left a hole that does. Redeeming a code grants no access
-- to anything -- current_shop_id() still demands an active roster row before a
-- device shows a single job -- so an hour-long single-use secret bought
-- nothing. Meanwhile the only place a code could be issued was branch
-- creation, which meant an existing branch (the head workshop above all, which
-- is never "created") had no way to set up a tablet at all.
--
-- So the code stops being an event and becomes a property. Every shop carries
-- one from the moment it exists, an owner reads it off the branch profile
-- whenever a device needs setting up, and there is nothing to issue, expire or
-- re-issue. Eight characters rather than six because this one is long-lived:
-- the payoff for guessing it is still only a device row that sees nothing, but
-- it is now exposed to months of attempts instead of an hour.
--
-- Rotation is deliberately possible (rotate_registration_code below) even
-- though nothing calls it yet. A permanent identifier with no way to change it
-- is the thing you regret the first time one leaks.

-- ---------------------------------------------------------------------------
-- The code itself
-- ---------------------------------------------------------------------------

-- No O/0, I/1 or similar: this gets read down a phone line to a workshop floor.
create or replace function public.generate_registration_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  attempt int := 0;
begin
  loop
    attempt := attempt + 1;
    candidate := '';
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.shops s where s.registration_code = candidate);
    if attempt > 20 then
      raise exception 'Could not generate a registration code' using errcode = '55000';
    end if;
  end loop;
  return candidate;
end;
$$;

alter table public.shops add column if not exists registration_code text;

-- Backfill before the not-null and unique constraints land, so every existing
-- branch -- including every head workshop, which could never have been handed
-- a pairing code -- has one immediately.
do $$
declare
  shop record;
begin
  for shop in select id from public.shops where registration_code is null loop
    update public.shops set registration_code = public.generate_registration_code() where id = shop.id;
  end loop;
end $$;

alter table public.shops alter column registration_code set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shops_registration_code_key') then
    alter table public.shops add constraint shops_registration_code_key unique (registration_code);
  end if;
end $$;

-- A trigger rather than a column default: the default cannot see the table it
-- is checking uniqueness against at the time it runs.
create or replace function public.set_registration_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.registration_code is null then
    new.registration_code := public.generate_registration_code();
  end if;
  return new;
end;
$$;

drop trigger if exists shops_set_registration_code on public.shops;
create trigger shops_set_registration_code before insert on public.shops
  for each row execute function public.set_registration_code();

-- Nothing calls this yet. It exists so that a leaked ID is a five-minute fix
-- rather than a migration.
create or replace function public.rotate_registration_code(target_shop uuid)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  fresh text;
begin
  if not exists (
    select 1 from public.shop_technicians t
    where t.profile_id = auth.uid() and t.shop_id = target_shop and t.active
      and t.role in ('owner', 'admin')
  ) then
    raise exception 'Only an Owner or Admin of that branch can change its Registration ID'
      using errcode = '42501';
  end if;
  fresh := public.generate_registration_code();
  update public.shops set registration_code = fresh where id = target_shop;
  return fresh;
end;
$$;

revoke all on function public.rotate_registration_code(uuid) from public, anon;
grant execute on function public.rotate_registration_code(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Registering a device
-- ---------------------------------------------------------------------------

-- Signed out, because a branch that has just been created may have no accounts
-- yet -- the hardware has to be able to say what it is before any human
-- authenticates on it.
--
-- Refuses if this device is already registered. The setup screen is hidden once
-- a device is set up, so this should be unreachable; it is here so that being
-- unreachable is a property of the server and not just of the UI. Until there
-- is an unpair flow, a registered tablet cannot be repointed by anyone holding
-- it, which is the whole reason the screen is hidden in the first place.
create or replace function public.register_device(p_code text, p_token_hash text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  target public.shops%rowtype;
begin
  if coalesce(trim(p_token_hash), '') = '' then
    raise exception 'This device could not be identified' using errcode = '22023';
  end if;

  if exists (select 1 from public.shop_devices d where d.token_hash = p_token_hash and d.active) then
    raise exception 'This device is already set up. Ask an Owner to remove it first.'
      using errcode = '42501';
  end if;

  select * into target from public.shops
  where registration_code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));

  if not found then
    raise exception 'That Registration ID is not valid. Check it and try again.' using errcode = '42501';
  end if;

  insert into public.shop_devices(token_hash, shop_id)
  values (p_token_hash, target.id)
  on conflict (token_hash) do update
    set shop_id = excluded.shop_id, active = true;

  -- Any personal override left on this device would otherwise silently win
  -- over the registration it was just given.
  delete from public.device_branches where token_hash = p_token_hash;

  return jsonb_build_object('branchName', target.name, 'shopId', target.id);
end;
$$;

revoke all on function public.register_device(text, text) from public;
grant execute on function public.register_device(text, text) to anon, authenticated;

-- What the signed-out setup screen needs in order to hide itself once this
-- device is set up. Returns the branch name so the screen can say which.
create or replace function public.device_registration(p_token_hash text)
returns jsonb
language sql security definer
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_build_object('registered', true, 'branchName', s.name)
      from public.shop_devices d
      join public.shops s on s.id = d.shop_id
      where d.token_hash = p_token_hash and d.active
    ),
    jsonb_build_object('registered', false)
  )
$$;

revoke all on function public.device_registration(text) from public;
grant execute on function public.device_registration(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Retiring one-time codes
-- ---------------------------------------------------------------------------

drop function if exists public.create_pairing_code(uuid);
drop function if exists public.redeem_pairing_code(text, text, text);
drop table if exists public.device_pairing_codes;

notify pgrst, 'reload schema';
