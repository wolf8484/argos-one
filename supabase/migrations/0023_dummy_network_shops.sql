-- Test fixtures for the cross-shop network feature: two dummy shops that
-- contribute directly to network_repair_contributions (never real
-- jobs/repair_records, per the no-fabricated-repair-data rule) so the
-- "Also seen at other shops" section has something to satisfy its
-- 2-other-shops k-anonymity floor while it's being verified in the app.
--
-- Also renames the shop we're actively developing against to
-- "Argos One Admin" -- this is the real/master shop going forward, seeded
-- with genuine data over time; the two below are throwaway test fixtures
-- only and can be deleted once real shops start sharing.

update public.shops
set name = 'Argos One Admin', shares_repair_data = true
where id = (select shop_id from public.profiles order by created_at asc limit 1);

insert into public.shops (id, name, shares_repair_data)
values
  ('00000000-0000-0000-0000-000000000101', 'Dummy Shop A (test)', true),
  ('00000000-0000-0000-0000-000000000102', 'Dummy Shop B (test)', true)
on conflict (id) do update set shares_repair_data = true, name = excluded.name;
