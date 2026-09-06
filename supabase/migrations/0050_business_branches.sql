-- Branches: one business, many workshops, one login that can hold a place in
-- several of them.
--
-- 0048 made shop_technicians the grant and demoted profiles.shop_id to "which
-- shop is this login currently looking at". That was already the multi-branch
-- primitive; this migration builds the rest around it.
--
--   organisations  -- the business, what branches are grouped under
--   shops          -- one branch, unchanged in every other respect
--   shop_technicians -- the grant, one row per person per branch
--
-- Two things move. Branch selection becomes per-session rather than per-login,
-- so an owner switching branch on their phone does not drag the workshop
-- tablet along with them. And the selection is resolved inside
-- current_shop_id() again, so the ~60 "shop_id = current_shop_id()" policies
-- still need no edits.

-- ---------------------------------------------------------------------------
-- The business
-- ---------------------------------------------------------------------------

create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shops
  add column if not exists org_id uuid references public.organisations(id) on delete cascade;

-- Every existing shop becomes a one-branch business named after itself. Done
-- row by row rather than as a set insert because each shop needs the id of
-- the org created for it specifically, not just any of them.
do $$
declare
  shop record;
  new_org uuid;
begin
  for shop in select id, name from public.shops where org_id is null loop
    insert into public.organisations(name) values (shop.name) returning id into new_org;
    update public.shops set org_id = new_org where id = shop.id;
  end loop;
end $$;

alter table public.shops alter column org_id set not null;
create index if not exists shops_org_idx on public.shops(org_id);

drop trigger if exists set_organisations_updated_at on public.organisations;
create trigger set_organisations_updated_at before update on public.organisations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Per-session branch selection
-- ---------------------------------------------------------------------------

-- Keyed on the GoTrue session, which Supabase puts in every access token as
-- the session_id claim -- so this is genuinely per-device: the same login on a
-- phone and a workshop tablet holds two sessions and therefore two rows.
--
-- No client ever touches this table directly. It is written by
-- set_session_branch() and read by current_shop_id(), both security definer,
-- so a row can only ever name a shop the caller actually holds a grant in.
create table if not exists public.session_branches (
  session_id uuid primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create index if not exists session_branches_profile_idx on public.session_branches(profile_id);

alter table public.session_branches enable row level security;
revoke all on public.session_branches from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Resolving the current branch
-- ---------------------------------------------------------------------------

-- Order matters: this session's own choice wins, and profiles.shop_id is the
-- fallback for a session that has never chosen (a fresh sign-in, or anyone
-- who only ever holds one branch and is never asked). Either way the answer
-- is only returned if an active roster row still backs it, which is what makes
-- switching safe without a single policy change -- you cannot select your way
-- into a branch you were never granted.
create or replace function public.current_shop_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  with selected as (
    select coalesce(
      (
        select sb.shop_id
        from public.session_branches sb
        where sb.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
          and sb.profile_id = auth.uid()
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

-- Every branch the caller may work in. Backs the switcher list, the branch
-- directory, and the widened select policies below.
create or replace function public.my_shop_ids()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select t.shop_id
  from public.shop_technicians t
  where t.profile_id = auth.uid() and t.active
$$;

create or replace function public.current_org_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select s.org_id from public.shops s where s.id = public.current_shop_id()
$$;

-- Creating a branch is an owner's right, held at the business rather than at
-- one site: an owner of any branch is an owner of the business.
create or replace function public.is_current_org_owner()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_technicians t
    join public.shops s on s.id = t.shop_id
    where t.profile_id = auth.uid()
      and t.active
      and t.role = 'owner'
      and s.org_id = public.current_org_id()
  )
$$;

-- ---------------------------------------------------------------------------
-- Switching branch
-- ---------------------------------------------------------------------------

-- Writes this session's selection. profiles.shop_id is updated alongside it so
-- the caller's *next* new session (a fresh sign-in on another device) starts
-- where they left off rather than back at whichever branch they first joined.
create or replace function public.set_session_branch(target_shop uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  sid uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
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

  -- Sessions that have since expired or been signed out leave rows behind;
  -- clear the caller's dead ones while we are here rather than running a job.
  delete from public.session_branches sb
  where sb.profile_id = auth.uid()
    and not exists (select 1 from auth.sessions s where s.id = sb.session_id);

  if sid is not null then
    insert into public.session_branches(session_id, profile_id, shop_id)
    values (sid, auth.uid(), target_shop)
    on conflict (session_id) do update
      set shop_id = excluded.shop_id, profile_id = excluded.profile_id, updated_at = now();
  end if;

  update public.profiles set shop_id = target_shop, updated_at = now() where id = auth.uid();

  return target_shop;
end;
$$;

revoke all on function public.set_session_branch(uuid) from public, anon;
grant execute on function public.set_session_branch(uuid) to authenticated;

-- Whether THIS device has been told which branch it is at. False means the
-- session is riding on profiles.shop_id, which for someone who holds more than
-- one branch is a guess -- so the app asks them once, here, rather than
-- silently filing their work under wherever they last were.
create or replace function public.has_session_branch()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.session_branches sb
    where sb.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
      and sb.profile_id = auth.uid()
  )
$$;

revoke all on function public.has_session_branch() from public, anon;
grant execute on function public.has_session_branch() to authenticated;

-- ---------------------------------------------------------------------------
-- Creating a branch
-- ---------------------------------------------------------------------------

-- Has to be definer: the new shop has no roster yet, so the caller's own
-- owner row cannot be inserted under a "shop_id = current_shop_id()" policy.
-- Doing both here also makes it atomic -- there is no window in which a branch
-- exists that nobody can administer.
create or replace function public.create_branch(
  p_name text,
  p_phone text default null,
  p_email text default null,
  p_region text default null,
  p_timezone text default null,
  p_auto_assign boolean default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  org uuid := public.current_org_id();
  source public.shops%rowtype;
  me public.shop_technicians%rowtype;
  new_shop uuid;
begin
  if org is null then
    raise exception 'No current workshop' using errcode = '42501';
  end if;
  if not public.is_current_org_owner() then
    raise exception 'Only an Owner can add a branch' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'A branch needs a name' using errcode = '22023';
  end if;

  select * into source from public.shops where id = public.current_shop_id();
  select * into me from public.shop_technicians
    where profile_id = auth.uid() and shop_id = source.id and active
    limit 1;

  insert into public.shops(org_id, name, phone, email, region, timezone, auto_assign_jobs)
  values (
    org,
    trim(p_name),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    coalesce(nullif(trim(coalesce(p_region, '')), ''), source.region),
    coalesce(nullif(trim(coalesce(p_timezone, '')), ''), source.timezone),
    coalesce(p_auto_assign, source.auto_assign_jobs)
  )
  returning id into new_shop;

  -- default_bay_id and default_technician_id are deliberately not carried
  -- over: they point at bays and people that do not exist in a branch which
  -- has just been created empty.
  insert into public.shop_technicians(shop_id, profile_id, first_name, last_name, initials, role, active)
  values (
    new_shop,
    auth.uid(),
    coalesce(me.first_name, split_part(coalesce((select full_name from public.profiles where id = auth.uid()), 'Owner'), ' ', 1)),
    me.last_name,
    me.initials,
    'owner',
    true
  );

  return new_shop;
end;
$$;

revoke all on function public.create_branch(text, text, text, text, text, boolean) from public, anon;
grant execute on function public.create_branch(text, text, text, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Placing an existing person in a second branch
-- ---------------------------------------------------------------------------

-- The alternative would be a second invite, which would mean a second login,
-- which would split one person's work history in two. They already have an
-- account; this just grants it a place in another branch. Definer for the same
-- reason create_branch is: the roster insert policy is pinned to the branch
-- the caller is currently in, and the target branch by definition is not it.
create or replace function public.add_technician_to_branch(
  p_technician_id uuid,
  p_target_shop uuid,
  p_role text default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  source public.shop_technicians%rowtype;
  org uuid := public.current_org_id();
  new_row uuid;
begin
  if not public.is_current_org_owner() then
    raise exception 'Only an Owner can place staff in another branch' using errcode = '42501';
  end if;

  select * into source from public.shop_technicians
  where id = p_technician_id and shop_id = public.current_shop_id();
  if not found then
    raise exception 'Staff member not found in this branch' using errcode = 'P0002';
  end if;
  if source.profile_id is null then
    raise exception 'This person has not joined yet -- they need to redeem their invite first'
      using errcode = '22023';
  end if;

  -- Both branches must belong to the caller's own business. Without this an
  -- owner could name any shop id and write a roster row into someone else's.
  if not exists (select 1 from public.shops where id = p_target_shop and org_id = org) then
    raise exception 'That branch is not part of this business' using errcode = '42501';
  end if;

  -- Already there: reactivate rather than erroring or duplicating, so
  -- "add to branch" is safe to press twice and doubles as an undo for a
  -- previous deactivation.
  update public.shop_technicians
  set active = true, updated_at = now()
  where shop_id = p_target_shop and profile_id = source.profile_id
  returning id into new_row;
  if found then return new_row; end if;

  insert into public.shop_technicians(
    shop_id, profile_id, first_name, last_name, initials, employee_id, role, active, position
  )
  values (
    p_target_shop, source.profile_id, source.first_name, source.last_name,
    source.initials, source.employee_id, coalesce(p_role, source.role::text)::public.shop_role, true,
    coalesce((select max(position) from public.shop_technicians where shop_id = p_target_shop), 0) + 1
  )
  returning id into new_row;

  return new_row;
end;
$$;

revoke all on function public.add_technician_to_branch(uuid, uuid, text) from public, anon;
grant execute on function public.add_technician_to_branch(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Revoking access, now that a person can hold more than one branch
-- ---------------------------------------------------------------------------

-- Deactivating someone at one branch must not sign them out of another where
-- they are still active. Only sessions actually pointed at the branch they
-- lost are dropped: a session that made an explicit choice, or one that never
-- chose and is therefore riding on profiles.shop_id.
create or replace function public.revoke_branch_sessions(target_profile uuid, target_shop uuid)
returns void
language sql security definer
set search_path = ''
as $$
  delete from auth.sessions s
  where s.user_id = target_profile
    and (
      exists (
        select 1 from public.session_branches sb
        where sb.session_id = s.id and sb.shop_id = target_shop
      )
      or (
        not exists (select 1 from public.session_branches sb where sb.session_id = s.id)
        and exists (
          select 1 from public.profiles p
          where p.id = target_profile and p.shop_id = target_shop
        )
      )
    );
$$;

revoke all on function public.revoke_branch_sessions(uuid, uuid) from public, anon, authenticated;

-- Whole-business removal still drops everything, and now takes the branch
-- selections with it so a re-hired login starts with a clean slate.
create or replace function public.revoke_workshop_sessions(target_profile uuid)
returns void
language sql security definer
set search_path = ''
as $$
  delete from public.session_branches where profile_id = target_profile;
  delete from auth.sessions where user_id = target_profile;
$$;

revoke all on function public.revoke_workshop_sessions(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

alter table public.organisations enable row level security;

drop policy if exists org_select on public.organisations;
create policy org_select on public.organisations for select to authenticated
  using (id = public.current_org_id());

drop policy if exists org_update on public.organisations;
create policy org_update on public.organisations for update to authenticated
  using (id = public.current_org_id() and public.is_current_org_owner())
  with check (id = public.current_org_id() and public.is_current_org_owner());

grant select, update on public.organisations to authenticated;

-- A branch directory needs to read every branch you hold a place in, not just
-- the one you are looking at. Editing one still requires an Owner or Admin
-- grant in that specific branch -- an Admin at one site has no authority over
-- another.
drop policy if exists shop_select on public.shops;
create policy shop_select on public.shops for select to authenticated
  using (id in (select public.my_shop_ids()));

-- Two ways in, deliberately. The first clause is the old rule verbatim -- any
-- member may change the branch they are standing in, which is what lets a
-- technician toggle cross-shop repair sharing from Settings. The second is the
-- new one: an Owner or Admin may also edit a branch they are not currently in,
-- which is what the branch directory needs. An Admin at one site still has no
-- authority over another, because the grant is checked against that branch.
drop policy if exists shop_update on public.shops;
create policy shop_update on public.shops for update to authenticated
  using (
    id = public.current_shop_id()
    or exists (
      select 1 from public.shop_technicians t
      where t.profile_id = (select auth.uid())
        and t.shop_id = shops.id
        and t.active
        and t.role in ('owner', 'admin')
    )
  )
  with check (
    id = public.current_shop_id()
    or exists (
      select 1 from public.shop_technicians t
      where t.profile_id = (select auth.uid())
        and t.shop_id = shops.id
        and t.active
        and t.role in ('owner', 'admin')
    )
  );

-- Same widening for the roster, so "also works at" can be answered and each
-- branch in the directory can report its own headcount. Writes stay pinned to
-- the branch you are currently in: managing a roster is done from inside it.
drop policy if exists roster_select_my_branches on public.shop_technicians;
create policy roster_select_my_branches on public.shop_technicians for select to authenticated
  using (shop_id in (select public.my_shop_ids()));

-- profiles.shop_id is now "where this person last was", not "which branch they
-- belong to", so the existing shop_id = current_shop_id() policy would hide the
-- contact details of a colleague who happens to be looking at another branch.
-- The roster is the correct test: you may read the profile of anyone who holds
-- an active place in a branch you also hold a place in.
drop policy if exists profiles_in_my_branches_select on public.profiles;
create policy profiles_in_my_branches_select on public.profiles for select to authenticated
  using (exists (
    select 1 from public.shop_technicians t
    where t.profile_id = profiles.id
      and t.shop_id in (select public.my_shop_ids())
  ));

-- ---------------------------------------------------------------------------
-- Signup
-- ---------------------------------------------------------------------------

-- shops.org_id is now not-null, so creating a workshop has to create the
-- business that holds it. A new owner gets a one-branch business named after
-- their workshop; adding a second branch later is what makes the distinction
-- visible to them. Otherwise unchanged from 0047.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $BODY$
declare
  new_org_id uuid;
  new_shop_id uuid;
  shop_name text;
  resolved_name text;
  first_name text;
  last_name text;
begin
  if exists(select 1 from public.profiles where id = new.id) then return new; end if;
  if coalesce(new.raw_user_meta_data ->> 'join_invite', '') <> '' then return new; end if;

  resolved_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Workshop owner'
  );
  first_name := split_part(resolved_name, ' ', 1);
  last_name := nullif(trim(substr(resolved_name, length(first_name) + 1)), '');
  shop_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'shop_name'), ''), 'My workshop');

  insert into public.organisations(name) values (shop_name) returning id into new_org_id;

  insert into public.shops(org_id, name, phone, email)
  values(
    new_org_id,
    shop_name,
    nullif(trim(new.raw_user_meta_data ->> 'shop_phone'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'shop_email'), '')
  )
  returning id into new_shop_id;

  insert into public.profiles(id, shop_id, full_name, role, phone, email)
  values(new.id, new_shop_id, resolved_name, 'owner', nullif(trim(new.raw_user_meta_data ->> 'owner_phone'), ''), new.email);

  insert into public.shop_technicians(shop_id, profile_id, first_name, last_name, initials, role, active)
  values(
    new_shop_id, new.id, first_name, last_name,
    upper(left(first_name, 1) || coalesce(left(last_name, 1), '')),
    'owner', true
  );

  return new;
end;
$BODY$;

notify pgrst, 'reload schema';
