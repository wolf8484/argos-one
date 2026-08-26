-- Expose each repair instance's trim so the car profile can filter by it.
--
-- The profile bucket stays make+model (0014 rolled it up from
-- make|model|generation|engine precisely because a blank trim fragmented one
-- car's history across two profiles -- a common AU VIN-decode gap). Trim is a
-- filter *inside* the profile instead, exactly as 0014's note anticipated:
-- "Trim/engine now live as attributes on the vehicle/repair rows and are
-- filtered inside a profile instead of defining a separate bucket."
--
-- Only this shop's own verified repairs and its notes can honour that filter.
-- Recalls (no trim column), complaint trends (unique on make+model+component)
-- and network patterns (keyed make+model, and splitting them would drop most
-- below the 2-shop k-anonymity floor in 0022) all stay model-wide, and the UI
-- labels them as such rather than implying they were narrowed.
--
-- Grouping is unchanged: the client recomputes occurrence counts from the
-- filtered instance list, so no second round trip is needed to re-group.
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
    -- Aliased away from the bare column name: `trim` is a SQL keyword and this
    -- same query calls trim() as a function, so a bare `trim` reference below
    -- would be ambiguous to parse.
    v.trim as vehicle_trim,
    -- Engine rides along so these instances key on the same trim|engine
    -- "variant" the Repair history tab already filters by (repairVariantKey in
    -- app.js) -- one variant concept across the profile, not two.
    v.engine as vehicle_engine,
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
    'job_id', job_id, 'year', year, 'trim', vehicle_trim,
    'engine', vehicle_engine, 'mileage', mileage,
    'repaired_at', repaired_at, 'symptom_text', symptom_text,
    'repair_text', repair_text, 'dtc_code', dtc_code
  ) order by repaired_at desc) as instances
from repairs
where label is not null
group by 1, 2
order by 3 desc, 2;
$$;
