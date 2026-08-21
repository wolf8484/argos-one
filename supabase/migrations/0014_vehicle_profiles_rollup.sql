-- Roll car profiles up to Make + Model only.
--
-- The original make|model|generation|engine key fragmented the moment a
-- vehicle's trim/engine was blank (a common VIN-decode gap in AU), splitting
-- one car's history across two profiles. Trim/engine now live as attributes
-- on the vehicle/repair rows and are filtered *inside* a profile instead of
-- defining a separate bucket.

-- 1. Pick one surviving profile per shop+make+model -- the one with the most
--    vehicles already attached, oldest as the tiebreaker -- and repoint every
--    vehicle and note from its siblings onto it before the old key is gone.
with ranked as (
  select id, shop_id, make, model,
    row_number() over (
      partition by shop_id, lower(trim(make)), lower(trim(model))
      order by (select count(*) from public.vehicles v where v.profile_id = vehicle_profiles.id) desc,
        created_at asc
    ) as rank
  from public.vehicle_profiles
), survivors as (
  select shop_id, lower(trim(make)) as make_key, lower(trim(model)) as model_key,
    (array_agg(id order by rank))[1] as survivor_id
  from ranked
  group by shop_id, lower(trim(make)), lower(trim(model))
), remap as (
  select r.id as old_id, s.survivor_id
  from ranked r
  join survivors s on s.shop_id = r.shop_id
    and s.make_key = lower(trim(r.make)) and s.model_key = lower(trim(r.model))
  where r.id <> s.survivor_id
)
update public.vehicles v set profile_id = remap.survivor_id
from remap where v.profile_id = remap.old_id;

with ranked as (
  select id, shop_id, make, model,
    row_number() over (
      partition by shop_id, lower(trim(make)), lower(trim(model))
      order by (select count(*) from public.vehicles v where v.profile_id = vehicle_profiles.id) desc,
        created_at asc
    ) as rank
  from public.vehicle_profiles
), survivors as (
  select shop_id, lower(trim(make)) as make_key, lower(trim(model)) as model_key,
    (array_agg(id order by rank))[1] as survivor_id
  from ranked
  group by shop_id, lower(trim(make)), lower(trim(model))
), remap as (
  select r.id as old_id, s.survivor_id
  from ranked r
  join survivors s on s.shop_id = r.shop_id
    and s.make_key = lower(trim(r.make)) and s.model_key = lower(trim(r.model))
  where r.id <> s.survivor_id
)
update public.vehicle_profile_notes n set profile_id = remap.survivor_id
from remap where n.profile_id = remap.old_id;

-- 2. Drop everything that referenced the old 4-column key.
drop trigger if exists sync_vehicles_profile on public.vehicles;
drop function if exists public.sync_vehicle_profile();
drop function if exists public.ensure_vehicle_profile(uuid, text, text, text, text, uuid);
drop function if exists public.list_vehicle_profiles();

-- 3. Delete the now-orphaned duplicate profiles, then rebuild the key on
--    make + model only.
delete from public.vehicle_profiles p
where exists (
  select 1 from public.vehicle_profiles other
  where other.shop_id = p.shop_id
    and lower(trim(other.make)) = lower(trim(p.make))
    and lower(trim(other.model)) = lower(trim(p.model))
    and other.id <> p.id
    and (
      (select count(*) from public.vehicles v where v.profile_id = other.id) >
      (select count(*) from public.vehicles v where v.profile_id = p.id)
      or (
        (select count(*) from public.vehicles v where v.profile_id = other.id) =
        (select count(*) from public.vehicles v where v.profile_id = p.id)
        and other.created_at < p.created_at
      )
    )
);

drop index if exists vehicle_profiles_shop_key_unique;
alter table public.vehicle_profiles drop column if exists match_key;
alter table public.vehicle_profiles drop column if exists generation;
alter table public.vehicle_profiles drop column if exists engine;
alter table public.vehicle_profiles
  add column match_key text generated always as (lower(trim(make)) || '|' || lower(trim(model))) stored;

create unique index if not exists vehicle_profiles_shop_key_unique
  on public.vehicle_profiles(shop_id, match_key);

-- 4. Recreate find-or-create and the trigger on the simpler key. Vehicles
--    only need to move profile when make/model itself changes -- editing
--    trim/engine no longer moves the vehicle's history.
create or replace function public.ensure_vehicle_profile(
  target_shop_id uuid,
  target_make text,
  target_model text,
  target_created_by uuid default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  resolved_id uuid;
  normalised_key text;
begin
  if target_shop_id is null or nullif(trim(coalesce(target_make, '')), '') is null
    or nullif(trim(coalesce(target_model, '')), '') is null then
    return null;
  end if;

  normalised_key := lower(trim(target_make)) || '|' || lower(trim(target_model));

  select id into resolved_id from public.vehicle_profiles
  where shop_id = target_shop_id and match_key = normalised_key;
  if resolved_id is not null then return resolved_id; end if;

  insert into public.vehicle_profiles(shop_id, make, model, created_by)
  values (target_shop_id, trim(target_make), trim(target_model), target_created_by)
  on conflict (shop_id, match_key) do update set updated_at = now()
  returning id into resolved_id;

  return resolved_id;
end;
$$;

create or replace function public.sync_vehicle_profile()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  new.profile_id := public.ensure_vehicle_profile(new.shop_id, new.make, new.model, new.created_by);
  return new;
end;
$$;

create trigger sync_vehicles_profile
  before insert or update of make, model on public.vehicles
  for each row execute function public.sync_vehicle_profile();

update public.vehicles v
set profile_id = public.ensure_vehicle_profile(v.shop_id, v.make, v.model, v.created_by)
where v.profile_id is null;

create or replace function public.list_vehicle_profiles()
returns table (
  id uuid,
  make text,
  model text,
  vehicle_count integer,
  repair_count integer,
  note_count integer,
  last_activity_at timestamptz
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
  )
from public.vehicle_profiles p
where p.shop_id = public.current_shop_id()
order by 7 desc;
$$;

grant execute on function public.ensure_vehicle_profile(uuid, text, text, uuid) to authenticated;
grant execute on function public.list_vehicle_profiles() to authenticated;
