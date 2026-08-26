-- Upgrades the cross-shop network layer from a bare occurrence counter to
-- actual shared knowledge: what the symptom was and how it was fixed.
--
-- network_repair_contributions now stores one row per qualifying job
-- (previously one row per shop+label with just a count), carrying the
-- job's symptom text (complaint + observations) and repair text (work
-- performed + verification notes). This is the same trust level already
-- applied to cause/complaint elsewhere in the app -- no extra scrubbing,
-- since the table itself stays unreadable except through the security
-- definer functions below, which still enforce the k-anonymity floor
-- (>=2 *other* contributing shops) before anything aggregates out.
--
-- network_pattern_summaries caches the AI-generated "most common issue /
-- symptoms / repair" card per (make, model, system, label), keyed with a
-- source_hash so it only regenerates when the underlying contributions
-- actually change -- summarization happens in the Next.js server layer
-- (Groq), not in Postgres.

drop function if exists public.network_repair_patterns(text, text);

alter table public.network_repair_contributions
  drop column if exists occurrences,
  add column if not exists job_id uuid,
  add column if not exists symptom_text text,
  add column if not exists repair_text text;

alter table public.network_repair_contributions
  drop constraint if exists network_repair_contributions_shop_id_make_model_system_lab_key;

alter table public.network_repair_contributions
  add constraint network_repair_contributions_shop_job_key unique (shop_id, job_id);

create or replace function public.refresh_network_contributions()
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  target_shop uuid := public.current_shop_id();
  is_sharing boolean;
begin
  if target_shop is null then return; end if;
  select shares_repair_data into is_sharing from public.shops where id = target_shop;

  delete from public.network_repair_contributions where shop_id = target_shop;
  if not coalesce(is_sharing, false) then return; end if;

  insert into public.network_repair_contributions
    (shop_id, make, model, system, label, job_id, symptom_text, repair_text)
  select
    target_shop,
    v.make,
    v.model,
    coalesce(rr.system, 'other'),
    coalesce(
      (select c.code from public.job_dtc_codes c where c.job_id = j.id order by c.created_at limit 1),
      nullif(trim(coalesce(rr.cause, '')), ''),
      nullif(trim(coalesce(j.complaint, '')), '')
    ),
    j.id,
    nullif(trim(concat_ws(' — ', nullif(trim(coalesce(j.complaint, '')), ''), nullif(trim(coalesce(j.observations, '')), ''))), ''),
    nullif(trim(concat_ws(' — ', nullif(trim(coalesce(rr.work_performed, '')), ''), nullif(trim(coalesce(rr.verification_notes, '')), ''))), '')
  from public.jobs j
  join public.vehicles v on v.id = j.vehicle_id
  join public.repair_records rr on rr.job_id = j.id
  where j.shop_id = target_shop
    and j.status = 'resolved'
    and rr.verified = true
    and nullif(trim(coalesce(v.make, '')), '') is not null
    and nullif(trim(coalesce(v.model, '')), '') is not null
    and coalesce(
      (select c.code from public.job_dtc_codes c where c.job_id = j.id order by c.created_at limit 1),
      nullif(trim(coalesce(rr.cause, '')), ''),
      nullif(trim(coalesce(j.complaint, '')), '')
    ) is not null
  on conflict (shop_id, job_id) do update
    set make = excluded.make, model = excluded.model, system = excluded.system,
      label = excluded.label, symptom_text = excluded.symptom_text,
      repair_text = excluded.repair_text, updated_at = now();
end;
$$;

-- Returns aggregated (system, label) groups for a make/model, each with the
-- raw symptom/repair text from every qualifying job so the caller can
-- summarize them -- but only once >=2 other shops share that same label,
-- same anonymity floor as before.
create or replace function public.network_repair_patterns(target_make text, target_model text)
returns table (
  system text,
  label text,
  occurrences integer,
  shop_count integer,
  symptoms text[],
  repairs text[]
)
language plpgsql security definer
set search_path = public
as $$
declare
  target_shop uuid := public.current_shop_id();
  is_sharing boolean;
  min_contributing_shops constant integer := 2;
begin
  if target_shop is null then return; end if;
  select shares_repair_data into is_sharing from public.shops where id = target_shop;
  if not coalesce(is_sharing, false) then return; end if;

  return query
  select
    c.system,
    c.label,
    count(*)::int,
    count(distinct c.shop_id)::int,
    array_remove(array_agg(distinct c.symptom_text), null),
    array_remove(array_agg(distinct c.repair_text), null)
  from public.network_repair_contributions c
  where c.shop_id <> target_shop
    and lower(c.make) = lower(trim(target_make))
    and lower(c.model) = lower(trim(target_model))
  group by c.system, c.label
  having count(distinct c.shop_id) >= min_contributing_shops
  order by count(*) desc, c.label
  limit 20;
end;
$$;

grant execute on function public.network_repair_patterns(text, text) to authenticated;

create table if not exists public.network_pattern_summaries (
  make text not null,
  model text not null,
  system text not null,
  label text not null,
  source_hash text not null,
  most_common_issue text not null,
  symptoms_summary text not null,
  repair_summary text not null,
  updated_at timestamptz not null default now(),
  primary key (make, model, system, label)
);

alter table public.network_pattern_summaries enable row level security;

create policy "network_pattern_summaries_read" on public.network_pattern_summaries
  for select using (true);

create policy "network_pattern_summaries_write" on public.network_pattern_summaries
  for insert with check (true);

create policy "network_pattern_summaries_update" on public.network_pattern_summaries
  for update using (true) with check (true);

grant select, insert, update on public.network_pattern_summaries to authenticated;
