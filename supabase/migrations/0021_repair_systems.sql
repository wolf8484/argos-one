-- Categorise repairs so the car profile can group them by system instead of
-- listing every fault flat.
--
-- The mechanic picks the system when closing the job (prefilled from the
-- job's first DTC where there is one). A picker rather than inference
-- because the DTC dataset only covers powertrain -- brakes, suspension,
-- electrical and body work have no code to derive a category from, and
-- those are a large share of what a shop actually does.

alter table public.repair_records
  add column if not exists system text;

alter table public.repair_records drop constraint if exists repair_records_system_check;
alter table public.repair_records add constraint repair_records_system_check
  check (system is null or system in (
    'engine_fuel_air',
    'ignition',
    'transmission',
    'emissions',
    'cooling_hvac',
    'brakes',
    'suspension_steering',
    'electrical',
    'body_interior',
    'other'
  ));

-- Supersedes vehicle_profile_mileage_insights: same underlying data and the
-- same "two occurrences before it counts as a pattern" rule, but grouped by
-- system with the mileage range demoted to a per-row detail rather than
-- being the grouping axis.
--
-- System resolution order: what the mechanic picked, else the SAE system of
-- the job's first DTC mapped onto our vocabulary, else 'other'.
create or replace function public.vehicle_profile_repair_groups(target_profile_id uuid)
returns table (
  system text,
  label text,
  occurrences integer,
  mileage_low integer,
  mileage_high integer,
  last_seen_at timestamptz
)
language sql stable security invoker
as $$
with repairs as (
  select
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
       where c.job_id = j.id
       order by c.created_at
       limit 1),
      'other'
    ) as system,
    v.mileage,
    coalesce(
      (select c.code || case when nullif(trim(coalesce(c.description, '')), '') is null then '' else ' · ' || c.description end
         from public.job_dtc_codes c where c.job_id = j.id order by c.created_at limit 1),
      nullif(trim(coalesce(rr.cause, '')), ''),
      nullif(trim(coalesce(j.complaint, '')), '')
    ) as label,
    coalesce(j.resolved_at, rr.updated_at) as repaired_at
  from public.jobs j
  join public.vehicles v on v.id = j.vehicle_id
  join public.repair_records rr on rr.job_id = j.id
  where v.profile_id = target_profile_id
    and j.shop_id = public.current_shop_id()
    and j.status = 'resolved'
    and rr.verified = true
)
select
  system,
  label,
  count(*)::int as occurrences,
  min(mileage)::int as mileage_low,
  max(mileage)::int as mileage_high,
  max(repaired_at) as last_seen_at
from repairs
where label is not null
group by 1, 2
having count(*) >= 2
order by 3 desc, 2;
$$;

grant execute on function public.vehicle_profile_repair_groups(uuid) to authenticated;
