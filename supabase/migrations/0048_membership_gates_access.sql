-- Roster membership, not the profile row, decides what a login may reach.
--
-- Until now access was resolved purely from profiles.shop_id: current_shop_id()
-- returned that column, every RLS policy compared against it, and the API's
-- requireWorkshopUser read the same field. Nothing anywhere consulted the staff
-- roster. So deleting someone from Staff -- or merely switching them to
-- Inactive -- took them off the directory while leaving their session, and
-- their password, working against the shop's data indefinitely. They could sign
-- out and sign back in afterwards.
--
-- shop_technicians already records exactly the right fact: one row per person
-- per shop, carrying an active flag. It becomes the grant. profiles.shop_id
-- stays but is demoted to "which shop is this login currently looking at" -- a
-- selection that only counts while an active roster row backs it.
--
-- Doing it inside current_shop_id() rather than in each policy means the ~60
-- existing "shop_id = current_shop_id()" policies need no edits: the function
-- returns null once membership lapses, null never equals a shop_id, and every
-- table stops matching at once. It is also the primitive multi-branch needs
-- later, when one profile holds roster rows in several shops and switching
-- branch is just re-pointing this selection at another shop it holds a grant
-- for.

-- A login with no workshop is now a real state -- someone removed from a roster
-- keeps their account and lands on the join screen -- so the column has to
-- accept null.
alter table public.profiles alter column shop_id drop not null;

create or replace function public.current_shop_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select p.shop_id
  from public.profiles p
  where p.id = auth.uid()
    and exists (
      select 1
      from public.shop_technicians t
      where t.profile_id = p.id
        and t.shop_id = p.shop_id
        and t.active
    )
$$;

-- Dropping the grant is what actually ends access, but an already-open tablet
-- would keep its session and only discover that on its next request. Deleting
-- the GoTrue session makes auth.getUser() fail outright, so the device is
-- signed out rather than sitting on a logged-in app that can reach nothing.
-- auth.sessions is not reachable through PostgREST, hence the definer function;
-- execute is left to service_role only, never to a signed-in user.
create or replace function public.revoke_workshop_sessions(target_profile uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.sessions where user_id = target_profile;
$$;

revoke all on function public.revoke_workshop_sessions(uuid) from public, anon, authenticated;

-- Safety net before the cleanup below: a shop whose only Owner somehow has no
-- active roster row would be left with nobody able to administer it and no way
-- back in. Give that row back rather than locking the workshop.
insert into public.shop_technicians (shop_id, profile_id, first_name, last_name, initials, role, active)
select
  p.shop_id,
  p.id,
  parts.first_name,
  parts.last_name,
  upper(left(parts.first_name, 1) || coalesce(left(parts.last_name, 1), '')),
  'owner',
  true
from public.profiles p
cross join lateral (
  select
    split_part(coalesce(nullif(trim(p.full_name), ''), 'Owner'), ' ', 1) as first_name,
    nullif(trim(substr(
      coalesce(nullif(trim(p.full_name), ''), 'Owner'),
      length(split_part(coalesce(nullif(trim(p.full_name), ''), 'Owner'), ' ', 1)) + 1
    )), '') as last_name
) parts
where p.shop_id is not null
  and p.role = 'owner'
  and not exists (
    select 1 from public.shop_technicians t
    where t.profile_id = p.id and t.shop_id = p.shop_id and t.active
  )
  and not exists (
    select 1 from public.shop_technicians t
    where t.shop_id = p.shop_id and t.role = 'owner' and t.active
  );

-- Anyone already removed from a roster has been holding live access this whole
-- time. Clear the stale selection so the fix applies to them too, instead of
-- only to staff deleted from here on.
update public.profiles p
set shop_id = null, updated_at = now()
where p.shop_id is not null
  and not exists (
    select 1 from public.shop_technicians t
    where t.profile_id = p.id and t.shop_id = p.shop_id and t.active
  );

notify pgrst, 'reload schema';
