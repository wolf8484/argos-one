-- Two changes for the repair-case sheet redesign:
--
-- 1. Instances now carry the vehicle year and split, unconcatenated
--    complaint/work_performed fields (previously "symptom_text" blended
--    complaint+observations with an em dash, which read as paraphrased
--    even though it was verbatim -- the sheet now shows the exact same
--    field, under the exact same label, as the full repair report).
-- 2. A profile is make+model only, so a single profile's repair history
--    can span many individual vehicles of different model years -- the
--    year lets a multi-instance case picker distinguish "2018 F-150" from
--    "2021 F-150" rather than showing identical-looking rows.
drop function if exists public.vehicle_profile_repair_groups(uuid);

create or replace function public.vehicle_profile_repair_groups(target_profile_id uuid)
returns table (
  system text, label text, occurrences integer,
  mileage_low integer, mileage_high integer, last_seen_at timestamptz,
  instances jsonb
)
language sql stable security invoker
as $$
with repairs as (
  select
    j.id as job_id,
    v.year,
    coalesce(
      rr.system,
      (select case dr.system
         when 'Fuel and Air Metering' then 'engine_fuel_air'
         when 'Fuel and Air Metering (Injector Circuit)' then 'engine_fuel_air'
         when 'Vehicle Speed Controls and Idle Control System' then 'engine_fuel_air'
         when 'Ignition System or Misfire' then 'ignition'
         when 'Transmission' then 'transmission'
         when 'Auxiliary Emissions Controls' then 'emissions'
         when 'Computer Output Circuit' then 'electrical'
         else 'other'
       end
       from public.job_dtc_codes c
       join public.dtc_reference dr on dr.code = upper(trim(c.code))
       where c.job_id = j.id order by c.created_at limit 1),
      'other'
    ) as system,
    v.mileage,
    coalesce(
      (select c.code || case when nullif(trim(coalesce(c.description, '')), '') is null then '' else ' · ' || c.description end
         from public.job_dtc_codes c where c.job_id = j.id order by c.created_at limit 1),
      nullif(trim(coalesce(rr.cause, '')), ''),
      nullif(trim(coalesce(j.complaint, '')), '')
    ) as label,
    coalesce(j.resolved_at, rr.updated_at) as repaired_at,
    nullif(trim(coalesce(j.complaint, '')), '') as symptom_text,
    nullif(trim(coalesce(rr.work_performed, '')), '') as repair_text
  from public.jobs j
  join public.vehicles v on v.id = j.vehicle_id
  join public.repair_records rr on rr.job_id = j.id
  where v.profile_id = target_profile_id
    and j.shop_id = public.current_shop_id()
    and j.status = 'resolved'
    and rr.verified = true
)
select system, label, count(*)::int as occurrences,
  min(mileage)::int as mileage_low, max(mileage)::int as mileage_high,
  max(repaired_at) as last_seen_at,
  jsonb_agg(jsonb_build_object(
    'job_id', job_id, 'year', year, 'mileage', mileage, 'repaired_at', repaired_at,
    'symptom_text', symptom_text, 'repair_text', repair_text
  ) order by repaired_at desc) as instances
from repairs
where label is not null
group by 1, 2
order by 3 desc, 2;
$$;
