-- Sample contributions from the two dummy test shops (0023) so the
-- "Also seen at other shops" section has something to render while it's
-- being verified against Toyota Corolla profiles. Inserted directly into
-- the aggregate table -- no fabricated jobs/repair_records involved.
-- Safe to delete once real shops start sharing.

insert into public.network_repair_contributions (shop_id, make, model, system, label, occurrences)
values
  ('00000000-0000-0000-0000-000000000101', 'Toyota', 'Corolla', 'ignition', 'P0301 · Cylinder 1 Misfire Detected', 4),
  ('00000000-0000-0000-0000-000000000102', 'Toyota', 'Corolla', 'ignition', 'P0301 · Cylinder 1 Misfire Detected', 2),
  ('00000000-0000-0000-0000-000000000101', 'Toyota', 'Corolla', 'cooling_hvac', 'Radiator fan relay failure', 3),
  ('00000000-0000-0000-0000-000000000102', 'Toyota', 'Corolla', 'cooling_hvac', 'Radiator fan relay failure', 5),
  ('00000000-0000-0000-0000-000000000101', 'Toyota', 'Corolla', 'brakes', 'Rear brake caliper seized', 2),
  ('00000000-0000-0000-0000-000000000102', 'Toyota', 'Corolla', 'brakes', 'Rear brake caliper seized', 3)
on conflict (shop_id, make, model, system, label) do update
  set occurrences = excluded.occurrences, updated_at = now();
