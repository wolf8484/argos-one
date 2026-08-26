-- Two fixes surfaced by walking through real mechanic workflows:
--
-- 1. "Common symptoms & repairs" listed a bare label + counter with nothing
--    to tap into, even though every row is backed by a real, ownable job
--    with photos/notes/technician on it. vehicle_profile_repair_groups now
--    also returns the contributing job instances (id, mileage, date) so
--    the UI can link straight to the real repair record instead of a dead
--    end.
--
-- 2. There was no way to search the library by symptom/system, only by
--    make/model -- "Toyota Corolla suspension issues" returned nothing.
--    search_shop_repairs does a shop-scoped, term-matched search across
--    every profile's repair history (system + fault label), independent
--    of the no-threshold change in 0028 -- a single past repair is a
--    valid search hit even if it never becomes a "common" pattern.

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
  max(repaired_at) as last_seen_at,
  jsonb_agg(jsonb_build_object('job_id', job_id, 'mileage', mileage, 'repaired_at', repaired_at) order by repaired_at desc) as instances
from repairs
where label is not null
group by 1, 2
order by 3 desc, 2;
$$;

create or replace function public.search_shop_repairs(search_query text)
returns table (
  profile_id uuid, make text, model text, system text, label text, occurrences integer
)
language sql stable security invoker
as $$
with repairs as (
  select
    vp.id as profile_id, v.make, v.model,
    coalesce(rr.system, 'other') as system,
    coalesce(
      (select c.code || case when nullif(trim(coalesce(c.description, '')), '') is null then '' else ' · ' || c.description end
         from public.job_dtc_codes c where c.job_id = j.id order by c.created_at limit 1),
      nullif(trim(coalesce(rr.cause, '')), ''),
      nullif(trim(coalesce(j.complaint, '')), '')
    ) as label
  from public.jobs j
  join public.vehicles v on v.id = j.vehicle_id
  join public.vehicle_profiles vp on vp.id = v.profile_id
  join public.repair_records rr on rr.job_id = j.id
  where j.shop_id = public.current_shop_id()
    and j.status = 'resolved'
    and rr.verified = true
),
terms as (
  select distinct lower(term) as term
  from unnest(string_to_array(trim(coalesce(search_query, '')), ' ')) as term
  where length(term) >= 3
    and lower(term) not in ('issue', 'issues', 'problem', 'problems', 'with', 'and', 'the', 'for', 'car')
)
select profile_id, make, model, system, label, count(*)::int as occurrences
from repairs
where label is not null
  and not exists (
    select 1 from terms
    where (repairs.make || ' ' || repairs.model || ' ' || repairs.system || ' ' || repairs.label) not ilike '%' || terms.term || '%'
  )
group by 1, 2, 3, 4, 5
order by count(*) desc
limit 40;
$$;

grant execute on function public.search_shop_repairs(text) to authenticated;
