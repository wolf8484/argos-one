-- Let a login always read its own profile row.
--
-- profiles is covered by the same shop_select policy as every other table
-- ("shop_id = current_shop_id()"), which was fine while current_shop_id() just
-- returned the column. Since 0048 made it require an active roster row, a
-- suspended or removed person can no longer read even their own row -- so
-- requireWorkshopUser's lookup fails outright and reports "Workshop profile is
-- not configured", which is both wrong and unhelpful: the profile is fine, the
-- membership is not.
--
-- RLS combines permissive policies with OR, so this widens reads by exactly one
-- row -- your own -- and leaves every other table's isolation untouched. It
-- deliberately grants select only: a suspended person may see that their
-- account exists, not edit it back into a shop.

drop policy if exists own_profile_select on public.profiles;
create policy own_profile_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

notify pgrst, 'reload schema';
