-- Two fixes that are really the same fix: the UI was stating things the data
-- did not support.

-- ---------------------------------------------------------------------------
-- 1. Branch sharing reads both ways
-- ---------------------------------------------------------------------------
-- 0058 gated this read on the *source* branch's shares_with_branches only,
-- reasoning that reciprocity inside one business would just mean an owner
-- hiding their own work from themselves.
--
-- What that produced in the app was a section headed "Your other branches"
-- with an "Off" badge above a list of repairs. The badge reads the current
-- shop's own (outbound) toggle, while the rows below it were controlled
-- entirely by the *other* branches' toggles -- so a branch with sharing
-- switched off still received everything its siblings sent. Two unrelated
-- facts wearing one label.
--
-- Reciprocity, the same way network_repair_patterns does it: no sharing, no
-- reading. That is what "Off" has to mean for the badge to be true, and it
-- makes one toggle describe one behaviour in both directions. Each branch
-- still decides who it sends to via branch_share_blocks; this only adds the
-- receiving end's own consent on top.
create or replace function public.branch_repair_patterns(target_make text, target_model text)
returns table (
  branch_id uuid,
  branch_name text,
  system text,
  label text,
  vehicle_trim text,
  occurrences integer,
  symptoms text[],
  repairs text[]
)
language plpgsql security definer
set search_path = public
as $$
declare
  target uuid := public.current_shop_id();
  org uuid := public.current_org_id();
  is_sharing boolean;
begin
  if target is null or org is null then return; end if;

  select shares_with_branches into is_sharing from public.shops where id = target;
  if not coalesce(is_sharing, false) then return; end if;

  return query
  select
    s.id,
    s.name,
    coalesce(rr.system, 'other'),
    coalesce(
      nullif(trim(coalesce(rr.cause, '')), ''),
      nullif(trim(coalesce(j.complaint, '')), '')
    ),
    nullif(trim(coalesce(v.trim, '')), ''),
    count(*)::int,
    array_remove(array_agg(distinct nullif(trim(concat_ws(' — ',
      nullif(trim(coalesce(j.complaint, '')), ''),
      nullif(trim(coalesce(j.observations, '')), ''))), '')), null),
    array_remove(array_agg(distinct nullif(trim(concat_ws(' — ',
      nullif(trim(coalesce(rr.work_performed, '')), ''),
      nullif(trim(coalesce(rr.verification_notes, '')), ''))), '')), null)
  from public.jobs j
  join public.shops s on s.id = j.shop_id
  join public.vehicles v on v.id = j.vehicle_id
  join public.repair_records rr on rr.job_id = j.id
  where s.org_id = org
    and s.id <> target
    and s.shares_with_branches
    and not exists (
      select 1 from public.branch_share_blocks b
      where b.source_shop_id = s.id and b.target_shop_id = target
    )
    and j.status = 'resolved'
    and rr.verified = true
    and lower(coalesce(v.make, '')) = lower(trim(target_make))
    and lower(coalesce(v.model, '')) = lower(trim(target_model))
    and coalesce(
      nullif(trim(coalesce(rr.cause, '')), ''),
      nullif(trim(coalesce(j.complaint, '')), '')
    ) is not null
  group by s.id, s.name, coalesce(rr.system, 'other'),
    coalesce(
      nullif(trim(coalesce(rr.cause, '')), ''),
      nullif(trim(coalesce(j.complaint, '')), '')
    ),
    nullif(trim(coalesce(v.trim, '')), '')
  order by count(*) desc, s.name
  limit 60;
end;
$$;

revoke all on function public.branch_repair_patterns(text, text) from public, anon;
grant execute on function public.branch_repair_patterns(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. The library stops advertising empty folders, and says why a car has no
--    repairs yet
-- ---------------------------------------------------------------------------
-- A vehicle_profiles row is created by the sync_vehicles_profile trigger (0014)
-- when a vehicle is inserted, or when an existing vehicle's make/model is
-- edited. Deleting that vehicle -- or correcting its make/model -- leaves the
-- old profile behind with nothing attached to it, and the library listed it
-- anyway as a model with 0 repairs. That is debris, not knowledge.
--
-- Notes keep a profile visible even with no vehicles, deliberately: a note is
-- a mechanic's own typed knowledge about a model and outliving the car it was
-- written against is the point of it. Nothing is deleted here either way --
-- ensure_vehicle_profile is find-or-create, so the same row (and its notes)
-- comes back the moment a matching car is booked in again.
--
-- open_job_count is new. "0 repairs" on a car that is on a hoist right now
-- reads as an empty library; the count of open jobs is what makes that number
-- explicable instead of just disappointing.
drop function if exists public.list_vehicle_profiles();

create or replace function public.list_vehicle_profiles()
returns table (
  id uuid,
  make text,
  model text,
  vehicle_count integer,
  repair_count integer,
  open_job_count integer,
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
  (select count(*) from public.jobs j
     join public.vehicles v on v.id = j.vehicle_id
   where v.profile_id = p.id and j.status = 'open')::int,
  (select count(*) from public.vehicle_profile_notes n where n.profile_id = p.id)::int,
  greatest(
    p.updated_at,
    coalesce((select max(n.created_at) from public.vehicle_profile_notes n where n.profile_id = p.id), p.created_at),
    coalesce((select max(coalesce(j.resolved_at, j.updated_at)) from public.jobs j
       join public.vehicles v on v.id = j.vehicle_id where v.profile_id = p.id), p.created_at)
  ),
  coalesce((
    select jsonb_agg(jsonb_build_object(
             'trim', t.trim_value,
             'vehicle_count', t.vehicle_count,
             'repair_count', t.repair_count,
             'open_job_count', t.open_job_count)
             order by t.repair_count desc, t.vehicle_count desc)
    from (
      select
        -- Aliased away from a bare `trim` (see 0037): this same query calls
        -- trim() as a function, so a bare `trim` alias would be ambiguous.
        nullif(trim(coalesce(v.trim, '')), '') as trim_value,
        count(distinct v.id) as vehicle_count,
        count(*) filter (where j.status = 'resolved' and rr.verified = true) as repair_count,
        count(*) filter (where j.status = 'open') as open_job_count
      from public.vehicles v
      left join public.jobs j on j.vehicle_id = v.id
      left join public.repair_records rr on rr.job_id = j.id
      where v.profile_id = p.id
      group by nullif(trim(coalesce(v.trim, '')), '')
    ) t
  ), '[]'::jsonb)
from public.vehicle_profiles p
where p.shop_id = public.current_shop_id()
  and (
    exists (select 1 from public.vehicles v where v.profile_id = p.id)
    or exists (select 1 from public.vehicle_profile_notes n where n.profile_id = p.id)
  )
order by 8 desc;
$$;

revoke all on function public.list_vehicle_profiles() from public, anon;
grant execute on function public.list_vehicle_profiles() to authenticated;

notify pgrst, 'reload schema';
