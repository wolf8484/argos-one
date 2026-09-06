-- Which workshop is the head one.
--
-- The settings structure collapses to a single page: a Business row that is
-- the head workshop, then the branches opened under it, each row identical in
-- shape and each opening the same profile. For that the business has to know
-- which of its shops is the head one, or the row has nothing to point at and
-- the head workshop would appear twice -- once as the business and again in
-- the branch list, which is the duplication this whole rework exists to remove.
--
-- Stored rather than inferred from created_at: two shops can share a
-- timestamp, and more importantly "which site is head office" is a decision an
-- owner may want to change when they move, not a fact about insert order.

alter table public.organisations
  add column if not exists primary_shop_id uuid references public.shops(id) on delete set null;

-- Existing businesses: the shop they were created around, which for every
-- business that exists today is their only one.
update public.organisations o
set primary_shop_id = (
  select s.id from public.shops s
  where s.org_id = o.id
  order by s.created_at, s.id
  limit 1
)
where o.primary_shop_id is null;

-- Signup creates the business and its head workshop together, so the link is
-- set there rather than left for the first page load to repair.
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

  update public.organisations set primary_shop_id = new_shop_id where id = new_org_id;

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
