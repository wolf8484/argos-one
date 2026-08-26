-- search_shop_repairs used a bare coalesce(rr.system, 'other'), but most
-- real repairs never had a mechanic pick a system (that field only became
-- mandatory this round) -- they rely on the DTC-code fallback mapping that
-- vehicle_profile_repair_groups already does. Without matching that same
-- resolution, a search like "Civic emissions" against a P0420 job (system
-- null, category only known via the DTC map) silently returned nothing.
create or replace function public.search_shop_repairs(search_query text)
returns table (
  profile_id uuid, make text, model text, system text, label text, occurrences integer
)
language sql stable security invoker
as $$
with repairs as (
  select
    vp.id as profile_id, v.make, v.model,
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
    where (repairs.make || ' ' || repairs.model || ' ' || replace(repairs.system, '_', ' ') || ' ' || repairs.label) not ilike '%' || terms.term || '%'
  )
group by 1, 2, 3, 4, 5
order by count(*) desc
limit 40;
$$;
