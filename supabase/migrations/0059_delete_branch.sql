-- Deleting a branch, and making demo-ness inherit instead of being a switch.
--
-- Two related changes. The per-branch "this branch holds demo data" toggle is
-- gone from the UI: it was a footgun on a real workshop's settings page (one
-- tap silently stops their verified repairs reaching the network and stamps
-- DEMO across every screen), and it asks a question at the wrong level. Demo
-- is a property of the business, decided once when it is set up, not something
-- an owner flips per site. So create_branch now inherits the flag from the
-- shop it was created from, and nothing in the app writes it any more.

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

  -- is_demo and network_read_exempt are inherited, not defaulted. A branch
  -- added inside a demo business is part of that demo; leaving it to default
  -- false produced a site that looked real, seeded no fixtures, and would
  -- have contributed fabricated repairs to the live network the moment
  -- anyone turned sharing on.
  insert into public.shops(org_id, name, phone, email, region, timezone, auto_assign_jobs, is_demo, network_read_exempt)
  values (
    org,
    trim(p_name),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    coalesce(nullif(trim(coalesce(p_region, '')), ''), source.region),
    coalesce(nullif(trim(coalesce(p_timezone, '')), ''), source.timezone),
    coalesce(p_auto_assign, source.auto_assign_jobs),
    source.is_demo,
    source.network_read_exempt
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

-- ---------------------------------------------------------------------------
-- Deleting a branch
-- ---------------------------------------------------------------------------

-- Definer, and not a plain delete policy, for one specific reason: profiles
-- .shop_id is `on delete cascade` (0003). Deleting a shop row therefore
-- deletes the profile of anyone whose fallback branch was that shop, and
-- handle_new_user only fires on auth-user creation -- so it never rebuilds
-- them. That is a permanent lockout of a real person's login, triggered by
-- an action that reads as "remove a site". Every profile pointed here has to
-- be moved somewhere they can still reach before the row goes.
create or replace function public.delete_branch(target_shop uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  org uuid := public.current_org_id();
  head uuid;
  stranded record;
  fallback uuid;
begin
  if org is null then
    raise exception 'No current workshop' using errcode = '42501';
  end if;
  if not public.is_current_org_owner() then
    raise exception 'Only an Owner can delete a branch' using errcode = '42501';
  end if;
  if not exists (select 1 from public.shops s where s.id = target_shop and s.org_id = org) then
    raise exception 'That branch is not part of your business' using errcode = 'P0002';
  end if;

  select o.primary_shop_id into head from public.organisations o where o.id = org;
  if target_shop = head then
    raise exception 'The head workshop cannot be deleted' using errcode = '42501';
  end if;
  -- Deleting the shop you are standing in would pull current_shop_id() out
  -- from under the request that is doing the deleting.
  if target_shop = public.current_shop_id() then
    raise exception 'Switch to another branch before deleting this one' using errcode = '42501';
  end if;

  -- Re-point anyone whose fallback is this branch, preferring a branch they
  -- still hold an active roster row in and falling back to the head workshop.
  for stranded in
    select p.id from public.profiles p where p.shop_id = target_shop
  loop
    select t.shop_id into fallback
      from public.shop_technicians t
      where t.profile_id = stranded.id and t.active and t.shop_id <> target_shop
      order by (t.shop_id = head) desc
      limit 1;

    update public.profiles set shop_id = coalesce(fallback, head) where id = stranded.id;
  end loop;

  delete from public.shops where id = target_shop;
end;
$$;

revoke all on function public.delete_branch(uuid) from public, anon;
grant execute on function public.delete_branch(uuid) to authenticated;
