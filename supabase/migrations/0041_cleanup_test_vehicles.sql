-- Removes four leftover manual test entries from the admin shop (created
-- 2026-08-14 to 2026-08-19, before trim was made mandatory on the vehicle
-- form) that were cluttering the repair library with trim-less or
-- placeholder-trim rows: VW Golf (no trim), Isuzu D-Max (no trim, x2 jobs),
-- Hyundai Kona (trim was literally "Base", not a real Kona grade), and VW
-- Amarok (no trim, no job at all). Equivalent test fixtures with real
-- trims are re-added to app/api/demo-jobs's fixture list in the same
-- commit, so the shop keeps a few open jobs to demo against.
delete from public.job_dtc_codes where job_id in (
  '25c9bc26-da66-4adb-b116-4402886e5090', '684db825-988d-471c-9528-41b949d40ffe',
  '916e2a26-d68f-47a4-9c69-463f015eb8e0', '933f25b2-010f-4ae3-a8ec-794248568376'
);
delete from public.repair_records where job_id in (
  '25c9bc26-da66-4adb-b116-4402886e5090', '684db825-988d-471c-9528-41b949d40ffe',
  '916e2a26-d68f-47a4-9c69-463f015eb8e0', '933f25b2-010f-4ae3-a8ec-794248568376'
);
delete from public.jobs where id in (
  '25c9bc26-da66-4adb-b116-4402886e5090', -- Oliver Huston / Isuzu D-Max (open)
  '684db825-988d-471c-9528-41b949d40ffe', -- Oliver Huston / Isuzu D-Max (cancelled)
  '916e2a26-d68f-47a4-9c69-463f015eb8e0', -- Jorge Galan / VW Golf
  '933f25b2-010f-4ae3-a8ec-794248568376'  -- S T / Hyundai Kona
);
delete from public.vehicles where id in (
  'c53a328e-217e-42ef-89d9-9b00680c2f5d', 'cc56abe0-1d7d-4886-a1b4-e1e730409ec7',
  '56f65a87-84ea-4560-8455-4aff2e020131', 'd09fed38-77ca-4878-955e-8ebb3780d065'
);
delete from public.customers where id in (
  '56e4758e-3dfa-4586-b66a-7e1a5c3cb785', 'fb0f15cf-b71a-464d-8641-dc1fd62a1d6f',
  '38b12e4b-f4e0-4d2b-9281-f67801f0c189', '71dc5c4c-e119-486b-9599-6a073da5b514'
);

-- The Amarok never had a job at all, so it's matched by shop+make+model
-- rather than a known id.
delete from public.vehicles
  where shop_id = '62f359d6-9963-4e0a-8b1d-386571f285f9'
    and make = 'Volkswagen' and model = 'Amarok' and trim is null;

-- Drop the four profiles left with zero vehicles behind them, so they
-- disappear from the library brand list rather than showing as an empty row.
delete from public.vehicle_profile_notes n
  using public.vehicle_profiles p
  where n.profile_id = p.id
    and p.shop_id = '62f359d6-9963-4e0a-8b1d-386571f285f9'
    and p.make = 'Volkswagen' and p.model in ('Golf', 'Amarok')
    and not exists (select 1 from public.vehicles v where v.profile_id = p.id);
delete from public.vehicle_profile_notes n
  using public.vehicle_profiles p
  where n.profile_id = p.id
    and p.shop_id = '62f359d6-9963-4e0a-8b1d-386571f285f9'
    and p.make in ('Isuzu', 'Hyundai') and p.model in ('D-Max', 'Kona')
    and not exists (select 1 from public.vehicles v where v.profile_id = p.id);

delete from public.vehicle_profiles p
  where p.shop_id = '62f359d6-9963-4e0a-8b1d-386571f285f9'
    and ((p.make = 'Volkswagen' and p.model in ('Golf', 'Amarok'))
      or (p.make = 'Isuzu' and p.model = 'D-Max')
      or (p.make = 'Hyundai' and p.model = 'Kona'))
    and not exists (select 1 from public.vehicles v where v.profile_id = p.id);
