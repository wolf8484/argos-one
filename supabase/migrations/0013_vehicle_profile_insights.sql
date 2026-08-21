-- Aggregated views behind the car profile screen.
--
-- Both functions read only structured job data (DTC codes, verified repair
-- causes, mileage at service). Freeform quick notes are deliberately excluded:
-- they are too unstructured to bucket reliably, and a wrong claim here would
-- cost more trust than the feature earns.

-- Library list: one row per profile with enough counts to decide what to open.
create or replace function public.list_vehicle_profiles()
returns table (
  id uuid,
  make text,
  model text,
  generation text,
  engine text,
  vehicle_count integer,
  repair_count integer,
  note_count integer,
  last_activity_at timestamptz
)
language sql stable security invoker
as $$
select p.id, p.make, p.model, p.generation, p.engine,
  (select count(*) from public.vehicles v where v.profile_id = p.id)::int,
  (select count(*) from public.jobs j
     join public.vehicles v on v.id = j.vehicle_id
     join public.repair_records rr on rr.job_id = j.id
   where v.profile_id = p.id and j.status = 'resolved' and rr.verified = true)::int,
  (select count(*) from public.vehicle_profile_notes n where n.profile_id = p.id)::int,
  greatest(
    p.updated_at,
    coalesce((select max(n.created_at) from public.vehicle_profile_notes n where n.profile_id = p.id), p.created_at),
    coalesce((select max(coalesce(j.resolved_at, j.updated_at)) from public.jobs j
       join public.vehicles v on v.id = j.vehicle_id where v.profile_id = p.id), p.created_at)
  )
from public.vehicle_profiles p
where p.shop_id = public.current_shop_id()
order by 8 desc;
$$;

-- Common failures grouped into mileage bands.
--
-- A single occurrence is an anecdote, not a pattern, so only labels seen at
-- least twice inside a band are returned. Bands are 25,000km wide and only
-- appear when they actually contain data.
create or replace function public.vehicle_profile_mileage_insights(target_profile_id uuid)
returns table (
  bucket_start integer,
  bucket_end integer,
  label text,
  occurrences integer,
  last_seen_at timestamptz
)
language sql stable security invoker
as $$
with repairs as (
  select v.mileage,
    coalesce(
      (select c.code || case when nullif(trim(coalesce(c.description, '')), '') is null then '' else ' · ' || c.description end
         from public.job_dtc_codes c where c.job_id = j.id order by c.created_at limit 1),
      nullif(trim(coalesce(rr.cause, '')), ''),
      nullif(trim(coalesce(j.complaint, '')), '')
    ) label,
    coalesce(j.resolved_at, rr.updated_at) repaired_at
  from public.jobs j
  join public.vehicles v on v.id = j.vehicle_id
  join public.repair_records rr on rr.job_id = j.id
  where v.profile_id = target_profile_id
    and j.shop_id = public.current_shop_id()
    and j.status = 'resolved'
    and rr.verified = true
    and v.mileage is not null
)
select (floor(mileage / 25000.0) * 25000)::int bucket_start,
  ((floor(mileage / 25000.0) * 25000) + 25000)::int bucket_end,
  label,
  count(*)::int occurrences,
  max(repaired_at) last_seen_at
from repairs
where label is not null
group by 1, 2, 3
having count(*) >= 2
order by 1, 4 desc;
$$;

grant execute on function public.list_vehicle_profiles() to authenticated;
grant execute on function public.vehicle_profile_mileage_insights(uuid) to authenticated;
