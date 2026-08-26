-- Aggregated NHTSA owner-complaint trends per make/model, the second source
-- feeding the car profile's "Known issues" section alongside recalls.
--
-- Unlike recalls (walked from a listing page), this is seeded directly from
-- the makes/models catalog, so every catalog car gets a row set -- not just
-- ones that happen to show up in a scraped listing. One row per
-- make/model/component = the aggregated complaint count for that component
-- across the seeded model-year window, not individual complaints (a single
-- model year can have hundreds of raw complaints; storing raw rows would
-- bury the signal a mechanic actually wants).
--
-- Same open-catalog posture as dtc_reference/recalls (0017): global
-- reference data, openly readable, no shop scoping.

create table if not exists public.complaint_trends (
  id uuid primary key default gen_random_uuid(),
  make text not null,
  model text not null,
  component text not null,
  complaint_count int not null,
  sample_summary text,
  source text not null default 'https://api.nhtsa.gov/complaints',
  updated_at timestamptz not null default now(),
  unique (make, model, component)
);

create index if not exists complaint_trends_make_model_idx on public.complaint_trends (lower(make), lower(model));

alter table public.complaint_trends enable row level security;

drop policy if exists "reference read complaint_trends" on public.complaint_trends;
drop policy if exists "reference add complaint_trends" on public.complaint_trends;
drop policy if exists "reference update complaint_trends" on public.complaint_trends;
drop policy if exists "reference delete complaint_trends" on public.complaint_trends;
create policy "reference read complaint_trends" on public.complaint_trends for select using (true);
create policy "reference add complaint_trends" on public.complaint_trends for insert with check (true);
create policy "reference update complaint_trends" on public.complaint_trends for update using (true) with check (true);
create policy "reference delete complaint_trends" on public.complaint_trends for delete using (true);

grant select, insert, update, delete on public.complaint_trends to anon, authenticated;
