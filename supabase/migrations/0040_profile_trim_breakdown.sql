-- Repair library navigation moves the trim picker out of the car profile
-- page (a chip row inside it) and up into the brand drill-in list: Brand ->
-- Golf TSI / Golf GTI / Golf R -> a profile page already scoped to that
-- trim. That list needs each profile's trim breakdown up front, in the same
-- request as the rest of the brand list, rather than one request per model.
--
-- Only trims the shop has actually seen (i.e. has a vehicle for) are
-- listed, never every possible trim for the model -- matching how the
-- library has always only shown cars/models this shop has worked on.
drop function if exists public.list_vehicle_profiles();

create or replace function public.list_vehicle_profiles()
returns table (
  id uuid,
  make text,
  model text,
  vehicle_count integer,
  repair_count integer,
  note_count integer,
  last_activity_at timestamptz,
  trims jsonb
)
language sql stable security invoker
as $$
select p.id, p.make, p.model,
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
  ),
  coalesce((
    select jsonb_agg(jsonb_build_object('trim', t.trim_value, 'vehicle_count', t.vehicle_count, 'repair_count', t.repair_count)
             order by t.repair_count desc, t.vehicle_count desc)
    from (
      select
        -- Aliased away from a bare `trim` (see 0037): this same query calls
        -- trim() as a function, so a bare `trim` alias would be ambiguous.
        nullif(trim(coalesce(v.trim, '')), '') as trim_value,
        count(distinct v.id) as vehicle_count,
        count(*) filter (where j.status = 'resolved' and rr.verified = true) as repair_count
      from public.vehicles v
      left join public.jobs j on j.vehicle_id = v.id
      left join public.repair_records rr on rr.job_id = j.id
      where v.profile_id = p.id
      group by nullif(trim(coalesce(v.trim, '')), '')
    ) t
  ), '[]'::jsonb)
from public.vehicle_profiles p
where p.shop_id = public.current_shop_id()
order by 7 desc;
$$;
