-- Vehicle identity enhancements: store drivetrain on workshop vehicles and
-- provide a shared + workshop-specific variant catalogue.

alter table public.vehicles
  add column if not exists drivetrain text;

create table if not exists public.vehicle_variants (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models(id) on delete cascade,
  -- Null is a shared, curated catalogue item. A shop id makes a private
  -- workshop addition without leaking it into another workshop's catalogue.
  shop_id uuid references public.shops(id) on delete cascade,
  name text not null,
  year_start integer check (year_start is null or year_start between 1886 and 2200),
  year_end integer check (year_end is null or year_end between 1886 and 2200),
  engine text,
  drivetrain text,
  transmission text,
  is_custom boolean not null default false,
  created_at timestamptz not null default now(),
  constraint vehicle_variants_year_range check (year_end is null or year_start is null or year_end >= year_start)
);

create unique index if not exists vehicle_variants_shared_model_name_unique
  on public.vehicle_variants(model_id, lower(name)) where shop_id is null;
create unique index if not exists vehicle_variants_shop_model_name_unique
  on public.vehicle_variants(shop_id, model_id, lower(name)) where shop_id is not null;
create index if not exists vehicle_variants_model_lookup_idx
  on public.vehicle_variants(model_id, name);

alter table public.vehicle_variants enable row level security;

drop policy if exists "catalog read vehicle variants" on public.vehicle_variants;
create policy "catalog read vehicle variants" on public.vehicle_variants
  for select using (shop_id is null or shop_id = public.current_shop_id());

drop policy if exists "catalog add workshop vehicle variants" on public.vehicle_variants;
create policy "catalog add workshop vehicle variants" on public.vehicle_variants
  for insert with check (shop_id = public.current_shop_id());

-- High-value Australian workshop defaults. They are deliberately broad; a VIN
-- decode or a technician can still override any field on the active vehicle.
insert into public.vehicle_variants (model_id, name, engine, drivetrain, transmission)
select mdl.id, seed.name, seed.engine, seed.drivetrain, seed.transmission
from (values
  ('Volkswagen', 'Golf', '110TSI', '1.4L turbo', 'FWD', '7-speed DSG'),
  ('Volkswagen', 'Golf', 'GTI', '2.0L turbo', 'FWD', '7-speed DSG'),
  ('Volkswagen', 'Golf', 'R', '2.0L turbo', 'AWD', '7-speed DSG'),
  ('BMW', '3 Series', '320i', '2.0L turbo', 'RWD', '8-speed automatic'),
  ('BMW', '3 Series', '330i', '2.0L turbo', 'RWD', '8-speed automatic'),
  ('BMW', '3 Series', '340i', '3.0L turbo', 'RWD', '8-speed automatic'),
  ('BMW', '3 Series', 'M340i', '3.0L turbo', 'AWD', '8-speed automatic')
) as seed(make, model, name, engine, drivetrain, transmission)
join public.makes mk on lower(mk.name) = lower(seed.make)
join public.models mdl on mdl.make_id = mk.id and lower(mdl.name) = lower(seed.model)
on conflict do nothing;
