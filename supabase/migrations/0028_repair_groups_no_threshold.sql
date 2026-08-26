-- "Common symptoms & repairs" previously required the exact same fault
-- label to be verified-fixed twice before it would show anything, which
-- meant a brand-new car profile stayed empty for a long time even with
-- real repair history on file. This is the shop's own verified work (not
-- a cross-shop pattern needing corroboration), so the trust bar is lower:
-- a system category now appears as soon as it has one verified repair,
-- with individual fault labels inside it each carrying their own
-- occurrence count that grows independently as they recur.
create or replace function public.vehicle_profile_repair_groups(target_profile_id uuid)
returns table (
  system text, label text, occurrences integer,
  mileage_low integer, mileage_high integer, last_seen_at timestamptz
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
    coalesce(j.resolved_at, rr.updated_at) as repaired_at
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
  max(repaired_at) as last_seen_at
from repairs
where label is not null
group by 1, 2
order by 3 desc, 2;
$$;
