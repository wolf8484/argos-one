-- The 0024 dummy rows predate the 0025 schema change (per-job text instead
-- of a bare counter) and no longer carry symptom/repair text. Replace them
-- with fixtures that do, still only touching network_repair_contributions
-- directly -- never real jobs/repair_records -- and using synthetic
-- (unreferenced) job_id values just to satisfy the per-job uniqueness.

delete from public.network_repair_contributions
where shop_id in ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000102');

insert into public.network_repair_contributions (shop_id, make, model, system, label, job_id, symptom_text, repair_text)
values
  ('00000000-0000-0000-0000-000000000101', 'Toyota', 'Corolla', 'ignition', 'P0301 · Cylinder 1 Misfire Detected',
    '00000000-0000-0000-0000-0000000001a1',
    'Customer reported a rough idle and occasional stumble on acceleration. Check engine light on, code read as P0301.',
    'Replaced cylinder 1 ignition coil and spark plug. Cleared codes and test drove 15km with no misfire recurrence.'),
  ('00000000-0000-0000-0000-000000000101', 'Toyota', 'Corolla', 'ignition', 'P0301 · Cylinder 1 Misfire Detected',
    '00000000-0000-0000-0000-0000000001a2',
    'Intermittent misfire under load, worse when engine was cold. P0301 logged.',
    'Coil pack on cylinder 1 tested weak on bench. Swapped coil, retained original plug which tested fine. No misfire on retest.'),
  ('00000000-0000-0000-0000-000000000102', 'Toyota', 'Corolla', 'ignition', 'P0301 · Cylinder 1 Misfire Detected',
    '00000000-0000-0000-0000-0000000001b1',
    'Customer noticed shaking at idle for about a week, getting worse.',
    'Cylinder 1 coil and plug both replaced together. Verified with scan tool, no misfire counts after 20km drive.'),
  ('00000000-0000-0000-0000-000000000101', 'Toyota', 'Corolla', 'cooling_hvac', 'Radiator fan relay failure',
    '00000000-0000-0000-0000-0000000002a1',
    'Engine temp climbing in stop-start traffic, fans not audibly running when hot.',
    'Radiator fan relay tested open. Replaced relay, confirmed both fans engage at operating temperature.'),
  ('00000000-0000-0000-0000-000000000102', 'Toyota', 'Corolla', 'cooling_hvac', 'Radiator fan relay failure',
    '00000000-0000-0000-0000-0000000002b1',
    'Overheating warning after sitting in traffic for 20 minutes, temp gauge climbed to red.',
    'Diagnosed failed cooling fan relay via fuse box test. Replaced relay, fans now cycle correctly.'),
  ('00000000-0000-0000-0000-000000000102', 'Toyota', 'Corolla', 'cooling_hvac', 'Radiator fan relay failure',
    '00000000-0000-0000-0000-0000000002b2',
    'AC blowing warm and engine running hotter than normal on the highway.',
    'Found fan relay contacts corroded and not closing. Replaced relay and cleaned connector, temps back to normal.'),
  ('00000000-0000-0000-0000-000000000101', 'Toyota', 'Corolla', 'brakes', 'Rear brake caliper seized',
    '00000000-0000-0000-0000-0000000003a1',
    'Car pulling to one side under braking, burning smell after a longer drive.',
    'Rear caliper slide pins seized. Replaced caliper, new pads both sides, greased slide pins.'),
  ('00000000-0000-0000-0000-000000000102', 'Toyota', 'Corolla', 'brakes', 'Rear brake caliper seized',
    '00000000-0000-0000-0000-0000000003b1',
    'Customer reported grinding noise and reduced fuel economy, rear wheel warm to touch after driving.',
    'Rear caliper piston stuck. Rebuilt caliper and replaced pads, confirmed free rotation afterwards.')
on conflict (shop_id, job_id) do update
  set symptom_text = excluded.symptom_text, repair_text = excluded.repair_text, updated_at = now();
