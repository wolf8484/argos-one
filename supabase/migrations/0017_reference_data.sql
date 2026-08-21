-- Reference data layer: DTC code definitions + AU vehicle recalls.
--
-- Both tables are global lookup/reference data, not shop-scoped -- same
-- posture as makes/models in 0001_phase1_catalog.sql (openly readable,
-- openly insertable so the seed script can run with the anon key, no
-- per-shop RLS). Neither table is ever written to from job/repair/note
-- flows; only the seed script and read-only lookups touch them.

create table if not exists public.dtc_reference (
  code text primary key,
  description text not null,
  system text,
  source text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.recalls (
  id uuid primary key default gen_random_uuid(),
  make text not null,
  model text not null,
  year_from int,
  year_to int,
  defect_description text not null,
  source_url text not null,
  recall_date date,
  -- Natural-key hash for idempotent upserts: the source has no stable
  -- external recall id we can rely on for dedupe, so this is derived from
  -- make+model+recall_date+defect_description at ingestion time.
  dedupe_key text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists recalls_make_model_idx on public.recalls (lower(make), lower(model));

alter table public.dtc_reference enable row level security;
alter table public.recalls enable row level security;

drop policy if exists "reference read dtc_reference" on public.dtc_reference;
drop policy if exists "reference add dtc_reference" on public.dtc_reference;
create policy "reference read dtc_reference" on public.dtc_reference for select using (true);
create policy "reference add dtc_reference" on public.dtc_reference for insert with check (true);
create policy "reference update dtc_reference" on public.dtc_reference for update using (true) with check (true);

drop policy if exists "reference read recalls" on public.recalls;
drop policy if exists "reference add recalls" on public.recalls;
create policy "reference read recalls" on public.recalls for select using (true);
create policy "reference add recalls" on public.recalls for insert with check (true);
create policy "reference update recalls" on public.recalls for update using (true) with check (true);

grant select, insert, update on public.dtc_reference to anon, authenticated;
grant select, insert, update on public.recalls to anon, authenticated;
