-- Backfill trim/engine/drivetrain/transmission on the demo fixture vehicles
-- already seeded before app/api/demo-jobs/route.ts started writing them. The
-- seed route only inserts fixtures once per shop, so existing rows never
-- pick up the new fields on their own -- needed so the resolved-report and
-- similar-repair screens can actually be checked with full vehicle specs.

update public.vehicles v
set trim = data.trim, engine = data.engine, drivetrain = data.drivetrain, transmission = data.transmission
from (values
  ('ARGOS_DEMO_FIXTURE::volvo-v60-open', 'T5 Momentum', 'B4204T', 'FWD', '8-speed auto'),
  ('ARGOS_DEMO_FIXTURE::toyota-camry-open', 'SX', '2.5L', 'FWD', '8-speed automatic'),
  ('ARGOS_DEMO_FIXTURE::ford-f150-open', 'XLT', '5.0L V8', '4WD', '10-speed automatic'),
  ('ARGOS_DEMO_FIXTURE::honda-civic-resolved', 'EX', '2.0L', 'FWD', 'CVT automatic')
) as data(note, trim, engine, drivetrain, transmission)
join public.customers c on c.notes = data.note
where v.customer_id = c.id
  and v.trim is null and v.engine is null and v.drivetrain is null and v.transmission is null;
