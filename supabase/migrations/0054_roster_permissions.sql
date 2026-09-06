-- Who may see and change the roster.
--
-- Until now shop_technicians carried the generic per-shop policies: select,
-- insert, update and delete all granted to anyone whose current shop matched.
-- The staff screens hide the controls from a technician, but the policies did
-- not, so a technician holding nothing but their own login and the public anon
-- key could call PostgREST directly and promote themselves to Owner, demote
-- the real Owner, or delete them. Verified against a scratch shop before
-- writing this. The API had no role guard either, so this was reachable two
-- ways.
--
-- The rules, which now hold at the database rather than in the interface:
--
--   Owner       sees everyone,          edits everyone
--   Admin       sees everyone,          edits everyone except an Owner
--   Technician  sees Admins and
--               Technicians (not
--               Owners) and their
--               own row,                edits nobody
--
-- Hiding Owners from technicians is a workshop-hierarchy choice rather than a
-- security one, but it is enforced in the same place as the rest so the list a
-- technician can fetch matches the list they are shown.

-- The caller's own active role in a given shop. Definer so the policies below
-- can consult shop_technicians without recursing into their own rules.
create or replace function public.my_role_in_shop(target_shop uuid)
returns text
language sql stable security definer
set search_path = public
as $$
  select t.role::text
  from public.shop_technicians t
  where t.profile_id = auth.uid()
    and t.shop_id = target_shop
    and t.active
  limit 1
$$;

-- The generic policies from 0042 are permissive, and RLS ORs them together, so
-- leaving any of them in place would simply re-grant what is being restricted.
drop policy if exists shop_select on public.shop_technicians;
drop policy if exists shop_insert on public.shop_technicians;
drop policy if exists shop_update on public.shop_technicians;
drop policy if exists shop_delete on public.shop_technicians;
drop policy if exists roster_select_my_branches on public.shop_technicians;

create policy roster_select on public.shop_technicians for select to authenticated
using (
  shop_id in (select public.my_shop_ids())
  and (
    role <> 'owner'
    -- An Owner must always be able to read their own row, or
    -- requireWorkshopUser cannot resolve them at all.
    or profile_id = (select auth.uid())
    or public.my_role_in_shop(shop_id) in ('owner', 'admin')
  )
);

-- Writes stay pinned to the branch the caller is standing in: managing a
-- roster is done from inside that branch, not from the directory.
--
-- USING tests the row as it is, WITH CHECK the row as it would become. Both
-- are needed: the first stops an Admin editing an existing Owner, the second
-- stops an Admin creating one or promoting someone into one.
create policy roster_insert on public.shop_technicians for insert to authenticated
with check (
  shop_id = public.current_shop_id()
  and public.my_role_in_shop(shop_id) in ('owner', 'admin')
  and (role <> 'owner' or public.my_role_in_shop(shop_id) = 'owner')
);

create policy roster_update on public.shop_technicians for update to authenticated
using (
  shop_id = public.current_shop_id()
  and public.my_role_in_shop(shop_id) in ('owner', 'admin')
  and (role <> 'owner' or public.my_role_in_shop(shop_id) = 'owner')
)
with check (
  shop_id = public.current_shop_id()
  and public.my_role_in_shop(shop_id) in ('owner', 'admin')
  and (role <> 'owner' or public.my_role_in_shop(shop_id) = 'owner')
);

create policy roster_delete on public.shop_technicians for delete to authenticated
using (
  shop_id = public.current_shop_id()
  and public.my_role_in_shop(shop_id) in ('owner', 'admin')
  and (role <> 'owner' or public.my_role_in_shop(shop_id) = 'owner')
);

notify pgrst, 'reload schema';
