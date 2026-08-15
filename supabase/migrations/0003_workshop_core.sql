-- Argos One production workshop model.
-- Every operational row is scoped to a shop and protected with RLS.

create extension if not exists pg_trgm;

do $$ begin
  create type public.shop_role as enum ('owner', 'manager', 'technician');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.job_status as enum ('open', 'resolved', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.job_stage as enum ('vehicle', 'assessment', 'similar_repairs', 'repair', 'resolved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.item_kind as enum ('part', 'consumable');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.photo_kind as enum ('arrival', 'repair', 'verification');
exception when duplicate_object then null; end $$;

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Australia/Sydney',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  full_name text not null,
  role public.shop_role not null default 'technician',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  vin text,
  year integer not null check (year between 1886 and 2200),
  make text not null,
  model text not null,
  mileage integer check (mileage is null or mileage >= 0),
  engine text,
  trim text,
  body_style text,
  fuel_type text,
  transmission text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_vin_format check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{17}$')
);

create unique index if not exists vehicles_shop_vin_unique
  on public.vehicles(shop_id, vin) where vin is not null;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  status public.job_status not null default 'open',
  stage public.job_stage not null default 'vehicle',
  bay text,
  complaint text,
  observations text,
  summary text,
  selected_reference_id uuid,
  assigned_to uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.job_dtc_codes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  code text not null,
  description text,
  created_at timestamptz not null default now(),
  unique(job_id, code)
);

create table if not exists public.repair_records (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  cause text,
  work_performed text,
  verification_notes text,
  reference_repair_id uuid references public.repair_records(id) on delete set null,
  verified boolean not null default false,
  completed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.jobs drop constraint if exists jobs_selected_reference_id_fkey;
alter table public.jobs add constraint jobs_selected_reference_id_fkey
  foreign key (selected_reference_id) references public.repair_records(id) on delete set null;

create table if not exists public.repair_steps (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  repair_id uuid not null references public.repair_records(id) on delete cascade,
  position integer not null check (position > 0),
  instruction text not null,
  created_at timestamptz not null default now(),
  unique(repair_id, position)
);

create table if not exists public.repair_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  repair_id uuid not null references public.repair_records(id) on delete cascade,
  kind public.item_kind not null default 'part',
  name text not null,
  part_number text,
  brand text,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit text,
  supplier text,
  price_amount numeric(12,2),
  currency text not null default 'AUD',
  offer_url text,
  offer_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_photos (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  repair_id uuid references public.repair_records(id) on delete cascade,
  kind public.photo_kind not null default 'arrival',
  storage_path text not null unique,
  caption text,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.web_research (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  query text not null,
  synthesis text not null,
  sources jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists jobs_shop_status_updated_idx on public.jobs(shop_id, status, updated_at desc);
create index if not exists vehicles_shop_make_model_idx on public.vehicles(shop_id, make, model);
create index if not exists repair_records_shop_verified_idx on public.repair_records(shop_id, verified, updated_at desc);
create index if not exists job_dtc_codes_job_idx on public.job_dtc_codes(job_id);
create index if not exists job_photos_job_idx on public.job_photos(job_id, created_at);
create index if not exists repair_items_repair_idx on public.repair_items(repair_id, created_at);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['shops','profiles','customers','vehicles','jobs','repair_records','repair_items'] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

create or replace function public.current_shop_id()
returns uuid
language sql stable security definer
set search_path = public
as $$ select shop_id from public.profiles where id = auth.uid() $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare new_shop_id uuid;
begin
  if exists(select 1 from public.profiles where id = new.id) then return new; end if;
  insert into public.shops(name)
  values(coalesce(nullif(trim(new.raw_user_meta_data ->> 'shop_name'), ''), 'My workshop'))
  returning id into new_shop_id;
  insert into public.profiles(id, shop_id, full_name, role)
  values(new.id, new_shop_id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)), 'owner');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.find_similar_repairs(target_job_id uuid)
returns table (
  repair_id uuid,
  job_id uuid,
  vehicle_label text,
  cause text,
  work_performed text,
  verification_notes text,
  repaired_at timestamptz,
  score integer,
  evidence text[]
)
language sql stable security invoker
as $$
with target as (
  select j.id, j.shop_id, j.complaint, j.observations, v.make, v.model
  from public.jobs j join public.vehicles v on v.id = j.vehicle_id
  where j.id = target_job_id and j.shop_id = public.current_shop_id()
), target_codes as (
  select code from public.job_dtc_codes where job_id = target_job_id
), candidates as (
  select rr.id repair_id, j.id job_id,
    concat(v.year, ' ', v.make, ' ', v.model) vehicle_label,
    rr.cause, rr.work_performed, rr.verification_notes, coalesce(j.resolved_at, rr.updated_at) repaired_at,
    (case when lower(v.make) = lower(t.make) then 20 else 0 end
     + case when lower(v.model) = lower(t.model) then 35 else 0 end
     + case when exists(select 1 from public.job_dtc_codes c where c.job_id = j.id and c.code in (select code from target_codes)) then 30 else 0 end
     + round(greatest(similarity(coalesce(j.complaint, ''), coalesce(t.complaint, '')), similarity(coalesce(j.observations, ''), coalesce(t.observations, ''))) * 15)::int) score,
    array_remove(array[
      case when lower(v.model) = lower(t.model) then 'Same model' when lower(v.make) = lower(t.make) then 'Same make' end,
      case when exists(select 1 from public.job_dtc_codes c where c.job_id = j.id and c.code in (select code from target_codes)) then 'Same DTC' end,
      case when greatest(similarity(coalesce(j.complaint, ''), coalesce(t.complaint, '')), similarity(coalesce(j.observations, ''), coalesce(t.observations, ''))) >= .25 then 'Similar symptoms' end
    ], null) evidence
  from target t
  join public.jobs j on j.shop_id = t.shop_id and j.status = 'resolved' and j.id <> t.id
  join public.vehicles v on v.id = j.vehicle_id
  join public.repair_records rr on rr.job_id = j.id and rr.verified = true
)
select * from candidates where score > 0 order by score desc, repaired_at desc limit 20;
$$;

alter table public.shops enable row level security;
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.vehicles enable row level security;
alter table public.jobs enable row level security;
alter table public.job_dtc_codes enable row level security;
alter table public.repair_records enable row level security;
alter table public.repair_steps enable row level security;
alter table public.repair_items enable row level security;
alter table public.job_photos enable row level security;
alter table public.web_research enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','customers','vehicles','jobs','job_dtc_codes','repair_records','repair_steps','repair_items','job_photos','web_research'] loop
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

drop policy if exists shop_select on public.shops;
drop policy if exists shop_update on public.shops;
create policy shop_select on public.shops for select to authenticated
  using (id = public.current_shop_id());
create policy shop_update on public.shops for update to authenticated
  using (id = public.current_shop_id()) with check (id = public.current_shop_id());

-- Catalog remains publicly readable for the vehicle form. Adding shared catalog
-- values now requires an authenticated workshop member.
drop policy if exists "Anyone can insert makes" on public.makes;
drop policy if exists "Anyone can insert models" on public.models;
drop policy if exists "catalog add makes" on public.makes;
drop policy if exists "catalog add models" on public.models;
drop policy if exists catalog_insert_authenticated on public.makes;
drop policy if exists catalog_insert_authenticated on public.models;
create policy catalog_insert_authenticated on public.makes for insert to authenticated with check (true);
create policy catalog_insert_authenticated on public.models for insert to authenticated with check (true);
revoke insert on public.makes, public.models from anon;
grant select on public.makes, public.models to anon;
grant select, insert on public.makes, public.models to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('job-photos', 'job-photos', false, 15728640, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists job_photos_select on storage.objects;
drop policy if exists job_photos_insert on storage.objects;
drop policy if exists job_photos_update on storage.objects;
drop policy if exists job_photos_delete on storage.objects;
create policy job_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'job-photos' and (storage.foldername(name))[1] = public.current_shop_id()::text);
create policy job_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'job-photos' and (storage.foldername(name))[1] = public.current_shop_id()::text);
create policy job_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'job-photos' and (storage.foldername(name))[1] = public.current_shop_id()::text)
  with check (bucket_id = 'job-photos' and (storage.foldername(name))[1] = public.current_shop_id()::text);
create policy job_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'job-photos' and (storage.foldername(name))[1] = public.current_shop_id()::text);

grant usage on schema public to authenticated;
grant select, update on public.shops to authenticated;
grant select, insert, update, delete on public.profiles, public.customers, public.vehicles, public.jobs,
  public.job_dtc_codes, public.repair_records, public.repair_steps, public.repair_items, public.job_photos,
  public.web_research to authenticated;
grant execute on function public.current_shop_id() to authenticated;
grant execute on function public.find_similar_repairs(uuid) to authenticated;
