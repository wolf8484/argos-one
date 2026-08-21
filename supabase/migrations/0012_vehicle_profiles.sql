-- Car profiles for the repair library.
--
-- A profile is the bucket a mechanic browses: make + model + generation/engine.
-- Deliberately coarser than the vehicle row so notes and repairs pool into
-- something dense enough to be worth opening. Every individual vehicle keeps
-- its own year/trim/transmission/mileage, so specificity is never lost -- it
-- just lives on the records inside the profile rather than in the key.

create table if not exists public.vehicle_profiles (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  make text not null,
  model text not null,
  generation text,
  engine text,
  -- Normalised identity used for find-or-create. Kept as a stored column so a
  -- unique index can enforce one profile per bucket per shop.
  match_key text generated always as (
    lower(trim(make)) || '|' || lower(trim(model)) || '|' ||
    lower(coalesce(trim(generation), '')) || '|' || lower(coalesce(trim(engine), ''))
  ) stored,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists vehicle_profiles_shop_key_unique
  on public.vehicle_profiles(shop_id, match_key);
create index if not exists vehicle_profiles_shop_make_model_idx
  on public.vehicle_profiles(shop_id, make, model);

-- Freeform, shop-wide quick notes. No form, no required structure: the body is
-- the only thing a mechanic has to supply. The vehicle_* columns are captured
-- automatically from context when the note is added from a job.
create table if not exists public.vehicle_profile_notes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  profile_id uuid not null references public.vehicle_profiles(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  vehicle_year integer check (vehicle_year is null or vehicle_year between 1886 and 2200),
  vehicle_trim text,
  vehicle_transmission text,
  vehicle_mileage integer check (vehicle_mileage is null or vehicle_mileage >= 0),
  source_job_id uuid references public.jobs(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vehicle_profile_notes_profile_idx
  on public.vehicle_profile_notes(profile_id, created_at desc);

alter table public.vehicles
  add column if not exists profile_id uuid references public.vehicle_profiles(id) on delete set null;

create index if not exists vehicles_profile_idx on public.vehicles(profile_id);

-- Find-or-create the profile bucket for a vehicle's identity.
create or replace function public.ensure_vehicle_profile(
  target_shop_id uuid,
  target_make text,
  target_model text,
  target_generation text,
  target_engine text,
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

  normalised_key := lower(trim(target_make)) || '|' || lower(trim(target_model)) || '|' ||
    lower(coalesce(trim(target_generation), '')) || '|' || lower(coalesce(trim(target_engine), ''));

  select id into resolved_id from public.vehicle_profiles
  where shop_id = target_shop_id and match_key = normalised_key;
  if resolved_id is not null then return resolved_id; end if;

  insert into public.vehicle_profiles(shop_id, make, model, generation, engine, created_by)
  values (
    target_shop_id, trim(target_make), trim(target_model),
    nullif(trim(coalesce(target_generation, '')), ''),
    nullif(trim(coalesce(target_engine, '')), ''),
    target_created_by
  )
  on conflict (shop_id, match_key) do update set updated_at = now()
  returning id into resolved_id;

  return resolved_id;
end;
$$;

-- Keep vehicles attached to their profile automatically. Intake never has to
-- ask the mechanic which profile a car belongs to.
create or replace function public.sync_vehicle_profile()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  new.profile_id := public.ensure_vehicle_profile(
    new.shop_id, new.make, new.model, new.trim, new.engine, new.created_by
  );
  return new;
end;
$$;

drop trigger if exists sync_vehicles_profile on public.vehicles;
create trigger sync_vehicles_profile
  before insert or update of make, model, trim, engine on public.vehicles
  for each row execute function public.sync_vehicle_profile();

-- Backfill existing vehicles into profiles.
update public.vehicles v
set profile_id = public.ensure_vehicle_profile(v.shop_id, v.make, v.model, v.trim, v.engine, v.created_by)
where v.profile_id is null;

alter table public.vehicle_profiles enable row level security;
alter table public.vehicle_profile_notes enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['vehicle_profiles','vehicle_profile_notes'] loop
    execute format('drop policy if exists shop_select on public.%I', table_name);
    execute format('drop policy if exists shop_insert on public.%I', table_name);
    execute format('drop policy if exists shop_update on public.%I', table_name);
    execute format('drop policy if exists shop_delete on public.%I', table_name);
    execute format('create policy shop_select on public.%I for select to authenticated using (shop_id = public.current_shop_id())', table_name);
    execute format('create policy shop_insert on public.%I for insert to authenticated with check (shop_id = public.current_shop_id())', table_name);
    execute format('create policy shop_update on public.%I for update to authenticated using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id())', table_name);
    execute format('create policy shop_delete on public.%I for delete to authenticated using (shop_id = public.current_shop_id())', table_name);
  end loop;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array['vehicle_profiles','vehicle_profile_notes'] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

grant select, insert, update, delete on public.vehicle_profiles, public.vehicle_profile_notes to authenticated;
grant execute on function public.ensure_vehicle_profile(uuid, text, text, text, text, uuid) to authenticated;
