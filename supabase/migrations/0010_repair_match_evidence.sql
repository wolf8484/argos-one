-- Sharpen find_similar_repairs evidence from generic booleans ("Same DTC",
-- "Similar symptoms") to specific, mechanic-readable reasons: the actual
-- fault code, and a mileage-range comparison. Text-similarity based
-- "Similar symptoms" stays as a rule-based fallback; AI-authored, pairing-
-- specific reasons are generated separately and cached in
-- repair_match_insights below.
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
  select j.id, j.shop_id, j.complaint, j.observations, v.make, v.model, v.mileage
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
     + case when v.mileage is not null and t.mileage is not null and abs(v.mileage - t.mileage) <= greatest(t.mileage * 0.2, 15000) then 5 else 0 end
     + round(greatest(similarity(coalesce(j.complaint, ''), coalesce(t.complaint, '')), similarity(coalesce(j.observations, ''), coalesce(t.observations, ''))) * 15)::int) score,
    array_remove(array[
      case when lower(v.model) = lower(t.model) then 'Same model' when lower(v.make) = lower(t.make) then 'Same make' end,
      (select 'Same fault code (' || c.code || ')' from public.job_dtc_codes c where c.job_id = j.id and c.code in (select code from target_codes) limit 1),
      case when v.mileage is not null and t.mileage is not null and abs(v.mileage - t.mileage) <= greatest(t.mileage * 0.2, 15000) then 'Similar mileage range' end,
      case when greatest(similarity(coalesce(j.complaint, ''), coalesce(t.complaint, '')), similarity(coalesce(j.observations, ''), coalesce(t.observations, ''))) >= .25 then 'Similar symptoms' end
    ], null) evidence
  from target t
  join public.jobs j on j.shop_id = t.shop_id and j.status = 'resolved' and j.id <> t.id
  join public.vehicles v on v.id = j.vehicle_id
  join public.repair_records rr on rr.job_id = j.id and rr.verified = true
)
select * from candidates where score > 0 order by score desc, repaired_at desc limit 20;
$$;

grant execute on function public.find_similar_repairs(uuid) to authenticated;

-- Cache for AI-authored match reasons (e.g. "Similar warm-idle symptoms",
-- "Same engine/PCV system") derived from comparing the target job's
-- complaint/observations against a candidate repair's cause/notes. Keyed by
-- the (job, repair) pairing since the phrasing is specific to that
-- comparison, not to the repair alone. Computed on demand and cached so the
-- LLM call only runs once per pairing.
create table if not exists public.repair_match_insights (
  job_id uuid not null references public.jobs(id) on delete cascade,
  repair_id uuid not null references public.repair_records(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  insights text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (job_id, repair_id)
);

alter table public.repair_match_insights enable row level security;

drop policy if exists shop_select on public.repair_match_insights;
drop policy if exists shop_insert on public.repair_match_insights;
create policy shop_select on public.repair_match_insights for select to authenticated
  using (shop_id = public.current_shop_id());
create policy shop_insert on public.repair_match_insights for insert to authenticated
  with check (shop_id = public.current_shop_id());

grant select, insert on public.repair_match_insights to authenticated;
