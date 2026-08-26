-- The case heading must never be the raw DTC code -- a code says nothing on
-- its own, and the mechanic explicitly wants distinct complaint phrasing
-- kept as distinct headings rather than merged under a generic code (see
-- 0033's note on unique symptom-derived labels). The code still surfaces as
-- a reference via the dtc_code column already added in 0033; it's just no
-- longer eligible to become the label itself.
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
      nullif(trim(coalesce(rr.cause, '')), ''),
      nullif(trim(coalesce(j.complaint, '')), '')
    ) as label,
    coalesce(j.resolved_at, rr.updated_at) as repaired_at,
    nullif(trim(coalesce(j.complaint, '')), '') as symptom_text,
    nullif(trim(coalesce(rr.work_performed, '')), '') as repair_text,
    (select c.code from public.job_dtc_codes c where c.job_id = j.id order by c.created_at limit 1) as dtc_code
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
    'symptom_text', symptom_text, 'repair_text', repair_text, 'dtc_code', dtc_code
  ) order by repaired_at desc) as instances
from repairs
where label is not null
group by 1, 2
order by 3 desc, 2;
$$;
