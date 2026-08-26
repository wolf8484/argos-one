-- A dedicated demo shop, separate from "Argos One Admin".
--
-- 0023 established the no-fabricated-repair-data rule and named the admin
-- shop as "the real/master shop going forward, seeded with genuine data over
-- time". Client walkthroughs still need a dense shop to show, so the invented
-- jobs/repairs live here instead of contaminating admin. Everything below is
-- fabricated demo content and must never be presented as real workshop
-- evidence.
--
-- Two safeguards keep it from leaking:
--   * shares_repair_data = false, so none of it reaches other shops'
--     "Also seen at other shops".
--   * network_read_exempt = true (added below), so the demo can still *read*
--     the network without contributing -- the one deliberate exception to the
--     reciprocity rule in 0022, kept out of the app UI/API on purpose.
--
-- Deterministic md5-derived ids make the whole seed re-runnable.

-- 1. Read-without-contribute exemption.
--
-- 0022 used a single shares_repair_data flag to gate contributing *and*
-- reading. Splitting the read side out lets the demo shop show a populated
-- Network Cases section without publishing fabricated repairs. Deliberately
-- has no UI or API surface: if any shop could set this, it would become a
-- freeloading switch and the reciprocity incentive the network depends on
-- would collapse.
alter table public.shops
  add column if not exists network_read_exempt boolean not null default false;

create or replace function public.refresh_network_contributions()
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  target_shop uuid := public.current_shop_id();
  is_sharing boolean;
  is_exempt boolean;
begin
  if target_shop is null then return; end if;
  select shares_repair_data, network_read_exempt
    into is_sharing, is_exempt
    from public.shops where id = target_shop;

  delete from public.network_repair_contributions where shop_id = target_shop;
  -- Exempt shops never contribute, whatever their sharing flag says.
  if coalesce(is_exempt, false) then return; end if;
  if not coalesce(is_sharing, false) then return; end if;

  insert into public.network_repair_contributions
    (shop_id, make, model, system, label, job_id, symptom_text, repair_text)
  select
    target_shop,
    v.make,
    v.model,
    coalesce(rr.system, 'other'),
    coalesce(
      (select c.code from public.job_dtc_codes c where c.job_id = j.id order by c.created_at limit 1),
      nullif(trim(coalesce(rr.cause, '')), ''),
      nullif(trim(coalesce(j.complaint, '')), '')
    ),
    j.id,
    nullif(trim(concat_ws(' — ', nullif(trim(coalesce(j.complaint, '')), ''), nullif(trim(coalesce(j.observations, '')), ''))), ''),
    nullif(trim(concat_ws(' — ', nullif(trim(coalesce(rr.work_performed, '')), ''), nullif(trim(coalesce(rr.verification_notes, '')), ''))), '')
  from public.jobs j
  join public.vehicles v on v.id = j.vehicle_id
  join public.repair_records rr on rr.job_id = j.id
  where j.shop_id = target_shop
    and j.status = 'resolved'
    and rr.verified = true
    and nullif(trim(coalesce(v.make, '')), '') is not null
    and nullif(trim(coalesce(v.model, '')), '') is not null
    and coalesce(
      (select c.code from public.job_dtc_codes c where c.job_id = j.id order by c.created_at limit 1),
      nullif(trim(coalesce(rr.cause, '')), ''),
      nullif(trim(coalesce(j.complaint, '')), '')
    ) is not null
  on conflict (shop_id, job_id) do update
    set make = excluded.make, model = excluded.model, system = excluded.system,
      label = excluded.label, symptom_text = excluded.symptom_text,
      repair_text = excluded.repair_text, updated_at = now();
end;
$$;

create or replace function public.network_repair_patterns(target_make text, target_model text)
returns table (
  system text,
  label text,
  occurrences integer,
  shop_count integer,
  symptoms text[],
  repairs text[]
)
language plpgsql security definer
set search_path = public
as $$
declare
  target_shop uuid := public.current_shop_id();
  is_sharing boolean;
  is_exempt boolean;
  min_contributing_shops constant integer := 2;
begin
  if target_shop is null then return; end if;
  select shares_repair_data, network_read_exempt
    into is_sharing, is_exempt
    from public.shops where id = target_shop;
  -- Reciprocity: no sharing, no reading -- unless explicitly exempted.
  if not (coalesce(is_sharing, false) or coalesce(is_exempt, false)) then return; end if;

  return query
  select
    c.system,
    c.label,
    count(*)::int,
    count(distinct c.shop_id)::int,
    array_remove(array_agg(distinct c.symptom_text), null),
    array_remove(array_agg(distinct c.repair_text), null)
  from public.network_repair_contributions c
  where c.shop_id <> target_shop
    and lower(c.make) = lower(trim(target_make))
    and lower(c.model) = lower(trim(target_model))
  group by c.system, c.label
  having count(distinct c.shop_id) >= min_contributing_shops
  order by count(*) desc, c.label
  limit 20;
end;
$$;

-- 2. The demo shop itself.
insert into public.shops (id, name, shares_repair_data, network_read_exempt)
values ('00000000-0000-0000-0000-000000000201', 'Argos One Demo', false, true)
on conflict (id) do update
  set name = excluded.name,
      shares_repair_data = false,
      network_read_exempt = true;

-- 3. Customers + vehicles.
--
-- Trims vary within every model on purpose: the car profile's trim filter is
-- only exercisable where one model has several trims behind it (3 Series ->
-- 320i/330i/M340i, Golf -> 110TSI/GTI/R, Civic -> VTi-LX/RS/Type R).
-- Inserting the vehicle is enough to create its profile: sync_vehicles_profile
-- (0014) fires on insert and calls ensure_vehicle_profile.
--
-- Staged through a temp table rather than one chained data-modifying CTE so
-- each insert is its own statement: rows a CTE inserts aren't visible to
-- sibling CTEs, which makes the customer -> vehicle foreign key fragile to
-- reason about. Both staging tables are dropped at the end of the file.
create temporary table argos_demo_vehicle_seed (
  key text primary key, customer text, phone text, year int, make text, model text,
  variant text, engine text, transmission text, drivetrain text, mileage int
);

insert into argos_demo_vehicle_seed (key, customer, phone, year, make, model, variant, engine, transmission, drivetrain, mileage)
values
  ('b3a', 'Marcus Reid',      '0412 664 201', 2019, 'BMW',        '3 Series', '320i',    '2.0L turbo petrol', '8-speed automatic', 'RWD', 82000),
  ('b3b', 'Priya Raman',      '0413 220 887', 2020, 'BMW',        '3 Series', '320i',    '2.0L turbo petrol', '8-speed automatic', 'RWD', 61500),
  ('b3c', 'Tom Whitfield',    '0414 903 115', 2021, 'BMW',        '3 Series', '330i',    '2.0L turbo petrol', '8-speed automatic', 'RWD', 44200),
  ('b3d', 'Elena Kovacs',     '0415 771 340', 2022, 'BMW',        '3 Series', 'M340i',   '3.0L turbo petrol', '8-speed automatic', 'AWD', 31800),
  ('b2a', 'Daniel Osei',      '0416 118 552', 2020, 'BMW',        '2 Series', '220i',    '2.0L turbo petrol', '8-speed automatic', 'RWD', 58300),
  ('b2b', 'Sarah Lindqvist',  '0417 664 908', 2021, 'BMW',        '2 Series', '230i',    '2.0L turbo petrol', '8-speed automatic', 'RWD', 39900),
  ('hca', 'Jordan Mata',      '0418 220 447', 2019, 'Honda',      'Civic',    'VTi-LX',  '1.5L turbo petrol', 'CVT',               'FWD', 91200),
  ('hcb', 'Aisha Bello',      '0419 553 776', 2018, 'Honda',      'Civic',    'VTi-LX',  '1.5L turbo petrol', 'CVT',               'FWD', 78000),
  ('hcc', 'Liam Doherty',     '0420 887 663', 2021, 'Honda',      'Civic',    'RS',      '1.5L turbo petrol', 'CVT',               'FWD', 45000),
  ('hcd', 'Mei Tanaka',       '0421 119 004', 2022, 'Honda',      'Civic',    'Type R',  '2.0L turbo petrol', '6-speed manual',    'FWD', 28400),
  ('hra', 'Grant Fowler',     '0422 446 221', 2019, 'Honda',      'CR-V',     'VTi',     '2.4L petrol',       'CVT',               'FWD', 88700),
  ('hrb', 'Nadia Haddad',     '0423 770 558', 2021, 'Honda',      'CR-V',     'VTi-L7',  '1.5L turbo petrol', 'CVT',               'AWD', 52100),
  ('vga', 'Callum Pierce',    '0424 003 885', 2019, 'Volkswagen', 'Golf',     '110TSI',  '1.4L turbo petrol', '7-speed DSG',       'FWD', 76400),
  ('vgb', 'Ruth Ngata',       '0425 336 112', 2020, 'Volkswagen', 'Golf',     '110TSI',  '1.4L turbo petrol', '7-speed DSG',       'FWD', 63200),
  ('vgc', 'Andre Silva',      '0426 669 449', 2021, 'Volkswagen', 'Golf',     'GTI',     '2.0L turbo petrol', '7-speed DSG',       'FWD', 41800),
  ('vgd', 'Holly Brennan',    '0427 992 776', 2022, 'Volkswagen', 'Golf',     'R',       '2.0L turbo petrol', '7-speed DSG',       'AWD', 27600),
  ('vta', 'Peter Nowak',      '0428 225 003', 2020, 'Volkswagen', 'Tiguan',   '132TSI',  '2.0L turbo petrol', '7-speed DSG',       'AWD', 69300),
  ('vtb', 'Ivy Chandra',      '0429 558 330', 2022, 'Volkswagen', 'Tiguan',   '162TSI',  '2.0L turbo petrol', '7-speed DSG',       'AWD', 33500);

insert into public.customers (id, shop_id, full_name, phone)
select md5('argos-demo-customer-' || key)::uuid,
       '00000000-0000-0000-0000-000000000201',
       customer, phone
from argos_demo_vehicle_seed
on conflict (id) do update set full_name = excluded.full_name, phone = excluded.phone;

insert into public.vehicles (id, shop_id, customer_id, year, make, model, trim, engine, transmission, drivetrain, mileage)
select md5('argos-demo-vehicle-' || key)::uuid,
       '00000000-0000-0000-0000-000000000201',
       md5('argos-demo-customer-' || key)::uuid,
       year, make, model, variant, engine, transmission, drivetrain, mileage
from argos_demo_vehicle_seed
on conflict (id) do update
  set trim = excluded.trim, mileage = excluded.mileage, model = excluded.model;

-- 4. Jobs, DTCs and repair records.
--
-- `cause` is what becomes the case heading (0034: never the raw DTC), so
-- repeated cause strings across vehicles are what create multi-instance
-- cases -- deliberately spread across different trims of the same model so
-- the trim filter has something to narrow.
create temporary table argos_demo_job_seed (
  key text primary key, vehicle_key text, status text, stage text, bay text, days_ago int,
  complaint text, cause text, work_performed text, verification text, system text, dtc text
);

insert into argos_demo_job_seed (key, vehicle_key, status, stage, bay, days_ago, complaint, cause, work_performed, verification, system, dtc)
values
  -- BMW 3 Series
  ('b3a1', 'b3a', 'resolved', 'resolved', 'Bay 01',  12, 'Customer reports shaking at idle, worse on a cold start.', 'Rough idle with cylinder misfire', 'Replaced ignition coil and spark plug on cylinder 2, cleared adaptations.', 'Idle steady over a 20 minute test drive, no misfire counts logged.', 'ignition', 'P0302'),
  ('b3b1', 'b3b', 'resolved', 'resolved', 'Bay 02',  34, 'Engine vibration noticeable at traffic lights.', 'Rough idle with cylinder misfire', 'Replaced all four ignition coils and spark plugs as a set; plugs were at end of service interval.', 'No misfire counts accumulating after a full drive cycle.', 'ignition', 'P0301'),
  ('b3c1', 'b3c', 'resolved', 'resolved', 'Bay 01',  21, 'Coolant warning light coming on intermittently, no puddle on the driveway.', 'Coolant loss with no visible leak', 'Pressure tested the system and found the electric water pump weeping at the seal. Replaced pump and thermostat housing.', 'Pressure held at 1.4 bar for 30 minutes, level stable after two heat cycles.', 'cooling_hvac', null),
  ('b3d1', 'b3d', 'resolved', 'resolved', 'Bay 03',  58, 'Coolant top-up needed every few weeks.', 'Coolant loss with no visible leak', 'Traced a hairline crack in the expansion tank. Replaced tank and cap, refilled and bled the system.', 'No loss over a week of normal driving.', 'cooling_hvac', null),
  ('b3a2', 'b3a', 'resolved', 'resolved', 'Bay 02',  76, 'Burning oil smell after longer drives.', 'Oil leak from valve cover gasket', 'Replaced valve cover gasket and cleaned the surrounding oil residue.', 'No residue after 300 km.', 'engine_fuel_air', null),
  ('b3c2', 'b3c', 'resolved', 'resolved', 'Bay 01',  95, 'Steering wheel shudders when braking from highway speed.', 'Brake judder under heavy braking', 'Machined front discs and fitted new pads.', 'No judder on a staged brake test from 100 km/h.', 'brakes', null),
  ('b3d9', 'b3d', 'open',     'assessment', 'Bay 03', 1, 'Intermittent rattle from the front end over rough roads.', null, null, null, null, null),
  ('b3b9', 'b3b', 'open',     'similar_repairs', 'Bay 02', 3, 'Check engine light on, customer reports slight power loss.', null, null, null, null, null),
  -- BMW 2 Series
  ('b2a1', 'b2a', 'resolved', 'resolved', 'Bay 02',  28, 'Rattle from the engine for a few seconds on cold start.', 'Timing chain rattle on cold start', 'Replaced timing chain, guides and tensioner. Chain had stretched beyond spec.', 'No rattle on cold start over three consecutive mornings.', 'engine_fuel_air', null),
  ('b2b1', 'b2b', 'resolved', 'resolved', 'Bay 01',  64, 'Brief metallic noise when starting in the morning.', 'Timing chain rattle on cold start', 'Replaced chain tensioner; chain and guides measured within spec and were retained.', 'Quiet on cold start, verified over two days.', 'engine_fuel_air', null),
  ('b2a2', 'b2a', 'resolved', 'resolved', 'Bay 03', 110, 'Driver window will not go up.', 'Electric window inoperative', 'Replaced the window regulator and clip assembly.', 'Window cycles fully in both directions.', 'electrical', null),
  ('b2b9', 'b2b', 'open',     'vehicle',  'Bay 01',  2, 'Booked in for a pre-purchase inspection.', null, null, null, null, null),
  -- Honda Civic
  ('hca1', 'hca', 'resolved', 'resolved', 'Bay 01',  10, 'Check-engine light on.', 'Catalytic converter efficiency fault', 'Replaced downstream O2 sensor.', 'Readiness monitor passed on a full drive cycle.', 'emissions', 'P0420'),
  ('hcb1', 'hcb', 'resolved', 'resolved', 'Bay 02',  46, 'Check-engine light on, slight rotten egg smell from the exhaust on the highway.', 'Catalytic converter efficiency fault', 'Replaced catalytic converter and both oxygen sensors, cleared codes and verified with a full drive cycle.', 'No code recurrence after 400 km.', 'emissions', 'P0420'),
  ('hcc1', 'hcc', 'resolved', 'resolved', 'Bay 01',  30, 'Slightly rough idle after a cold start, no warning light.', 'Fuel trim drifting rich at idle', 'Found a vacuum leak at the intake manifold gasket, replaced the gasket and reset adaptive fuel trims.', 'Trims within ±5% on a 20 minute test drive.', 'engine_fuel_air', null),
  ('hcd1', 'hcd', 'resolved', 'resolved', 'Bay 03',  53, 'Shudder when pulling away from a standstill.', 'Clutch judder on take-off', 'Replaced clutch kit and machined the flywheel.', 'Smooth engagement across all gears on road test.', 'transmission', null),
  ('hca2', 'hca', 'resolved', 'resolved', 'Bay 02',  88, 'Engine shaking at idle, settles once warm.', 'Rough idle with cylinder misfire', 'Replaced cylinder 1 coil pack and plugs.', 'No misfire counts after test drive.', 'ignition', 'P0301'),
  ('hcc9', 'hcc', 'open',     'assessment', 'Bay 01', 1, 'Customer reports hesitation when overtaking.', null, null, null, null, null),
  ('hcd9', 'hcd', 'open',     'repair',   'Bay 03',  4, 'Brake fluid change and general service.', null, null, null, null, null),
  -- Honda CR-V
  ('hra1', 'hra', 'resolved', 'resolved', 'Bay 02',  19, 'Air conditioning blowing warm on hot days.', 'Air conditioning not cooling', 'Found a leak at the condenser. Replaced condenser, evacuated and recharged the system.', 'Vent temperature at 6°C after 10 minutes idling.', 'cooling_hvac', null),
  ('hrb1', 'hrb', 'resolved', 'resolved', 'Bay 01',  71, 'Aircon not as cold as it used to be.', 'Air conditioning not cooling', 'System was undercharged with no detectable leak. Evacuated, recharged to spec and dye tested.', 'Vent temperature at 5°C, no dye trace after two weeks.', 'cooling_hvac', null),
  ('hra2', 'hra', 'resolved', 'resolved', 'Bay 03', 102, 'Squealing from the front when braking.', 'Front brake pads worn below spec', 'Replaced front pads and cleaned the carriers.', 'No noise on road test.', 'brakes', null),
  ('hrb9', 'hrb', 'open',     'vehicle',  'Bay 02',  5, 'Scheduled 60,000 km service.', null, null, null, null, null),
  -- Volkswagen Golf
  ('vga1', 'vga', 'resolved', 'resolved', 'Bay 01',  16, 'Hesitation under light acceleration, rough at low revs.', 'Carbon build-up causing hesitation', 'Walnut blasted the intake valves and replaced the intake manifold gasket.', 'Smooth pull through the rev range on road test.', 'engine_fuel_air', null),
  ('vgb1', 'vgb', 'resolved', 'resolved', 'Bay 02',  49, 'Feels flat off the line compared to when it was new.', 'Carbon build-up causing hesitation', 'Walnut blasted intake valves, cleaned throttle body and reset adaptations.', 'Power delivery restored, confirmed on road test.', 'engine_fuel_air', null),
  ('vgc1', 'vgc', 'resolved', 'resolved', 'Bay 03',  25, 'Shudder when moving off in first, especially when cold.', 'DSG clutch pack shudder', 'Replaced the mechatronic clutch packs and performed a DSG basic setting.', 'Smooth engagement from cold across three starts.', 'transmission', null),
  ('vgd1', 'vgd', 'resolved', 'resolved', 'Bay 01',  61, 'Jerky low speed gear changes.', 'DSG clutch pack shudder', 'Replaced clutch packs and completed a full DSG service with adaptation reset.', 'No shudder in stop-start traffic on road test.', 'transmission', null),
  ('vgc2', 'vgc', 'resolved', 'resolved', 'Bay 02',  84, 'Coolant smell after parking up.', 'Water pump leak at housing', 'Replaced water pump and thermostat module.', 'Pressure held, no residue after a week.', 'cooling_hvac', null),
  ('vga2', 'vga', 'resolved', 'resolved', 'Bay 03', 118, 'Warning light and noticeably down on power.', 'Boost pressure below target', 'Replaced a split intercooler hose and the diverter valve.', 'Boost holding to spec on a logged road test.', 'engine_fuel_air', 'P0299'),
  ('vgd9', 'vgd', 'open',     'similar_repairs', 'Bay 01', 2, 'Customer reports a whistling noise under boost.', null, null, null, null, null),
  ('vgb9', 'vgb', 'open',     'assessment', 'Bay 02', 6, 'Intermittent glow plug light on the dash.', null, null, null, null, null),
  -- Volkswagen Tiguan
  ('vta1', 'vta', 'resolved', 'resolved', 'Bay 01',  38, 'AWD warning light after towing.', 'Haldex AWD service overdue', 'Replaced Haldex oil and filter, reset the service interval.', 'No warning light after a loaded test drive.', 'transmission', null),
  ('vtb1', 'vtb', 'resolved', 'resolved', 'Bay 02',  67, 'Boot lid drops down on its own.', 'Rear tailgate strut failure', 'Replaced both gas struts.', 'Tailgate holds at full height.', 'body_interior', null),
  ('vta2', 'vta', 'resolved', 'resolved', 'Bay 03',  93, 'Down on power going up hills.', 'Boost pressure below target', 'Replaced the turbo actuator and recalibrated.', 'Boost to spec on a logged climb.', 'engine_fuel_air', 'P0299'),
  ('vtb9', 'vtb', 'open',     'vehicle',  'Bay 01',  7, 'Booked in for an intermittent infotainment reboot.', null, null, null, null, null);

insert into public.jobs (id, shop_id, vehicle_id, customer_id, status, stage, bay, complaint, created_at, updated_at, resolved_at)
select md5('argos-demo-job-' || key)::uuid,
       '00000000-0000-0000-0000-000000000201',
       md5('argos-demo-vehicle-' || vehicle_key)::uuid,
       md5('argos-demo-customer-' || vehicle_key)::uuid,
       status::public.job_status,
       stage::public.job_stage,
       bay, complaint,
       now() - (days_ago || ' days')::interval,
       now() - (days_ago || ' days')::interval,
       case when status = 'resolved' then now() - (days_ago || ' days')::interval else null end
from argos_demo_job_seed
on conflict (id) do update
  set status = excluded.status, stage = excluded.stage, complaint = excluded.complaint,
      resolved_at = excluded.resolved_at;

insert into public.job_dtc_codes (id, shop_id, job_id, code)
select md5('argos-demo-dtc-' || key)::uuid,
       '00000000-0000-0000-0000-000000000201',
       md5('argos-demo-job-' || key)::uuid,
       dtc
from argos_demo_job_seed where dtc is not null
on conflict (id) do nothing;

insert into public.repair_records (id, shop_id, job_id, cause, work_performed, verification_notes, system, verified, created_at, updated_at)
select md5('argos-demo-repair-' || key)::uuid,
       '00000000-0000-0000-0000-000000000201',
       md5('argos-demo-job-' || key)::uuid,
       cause, work_performed, verification, system, true,
       now() - (days_ago || ' days')::interval,
       now() - (days_ago || ' days')::interval
from argos_demo_job_seed where cause is not null
on conflict (id) do update
  set cause = excluded.cause, work_performed = excluded.work_performed,
      verification_notes = excluded.verification_notes, system = excluded.system, verified = true;

-- 5. A few shop notes, so the profile's notes surface isn't empty either.
insert into public.vehicle_profile_notes (id, shop_id, profile_id, body, vehicle_year, vehicle_trim, vehicle_mileage)
select md5('argos-demo-note-' || n.key)::uuid,
       '00000000-0000-0000-0000-000000000201',
       v.profile_id, n.body, n.year, n.variant, n.mileage
from (values
  ('n1', 'vga', 'Golf 110TSI intakes carbon up early on short-trip cars. Worth quoting a walnut blast at around 70,000 km rather than waiting for the complaint.', 2019, '110TSI', 76400),
  ('n2', 'vgc', 'GTI DSG shudder: do the basic setting after the clutch pack or it comes straight back. Learned that the hard way.', 2021, 'GTI', 41800),
  ('n3', 'b3a', 'These N20/B48 coils fail one at a time. Customer is usually better off doing the set while the engine cover is already off.', 2019, '320i', 82000),
  ('n4', 'hca', 'Civic P0420 is usually the downstream sensor before the cat itself. Test before quoting a converter.', 2019, 'VTi-LX', 91200),
  ('n5', 'hra', 'CR-V condensers pit from stone damage on gravel roads. Check the face before recharging.', 2019, 'VTi', 88700)
) as n(key, vehicle_key, body, year, variant, mileage)
join public.vehicles v on v.id = md5('argos-demo-vehicle-' || n.vehicle_key)::uuid
where v.profile_id is not null
on conflict (id) do update set body = excluded.body;

-- Dropped explicitly rather than via ON COMMIT so this works whether or not
-- the migration runner wraps the file in a single transaction.
drop table if exists argos_demo_vehicle_seed;
drop table if exists argos_demo_job_seed;
