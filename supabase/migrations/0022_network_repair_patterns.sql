-- Cross-shop repair patterns: opt-in, reciprocal, anonymised.
--
-- Until now every profile surface has been strictly shop-scoped. This adds
-- the first shared layer, under three rules:
--
--   1. Opt-in. shops.shares_repair_data defaults to false, so nothing an
--      existing shop has recorded is shared without them turning it on.
--   2. Reciprocal. A shop can only read the network if it also contributes
--      (enforced in the reader function, not just the UI).
--   3. Anonymised, with a k-anonymity floor. Contributions are stored
--      per-shop so a shop's own rows can be excluded from what it reads,
--      but that table is never directly readable -- only the security
--      definer reader touches it, and it only returns a pattern once at
--      least MIN_CONTRIBUTING_SHOPS *other* shops have logged it. Without
--      that floor, "seen at 1 other shop" would identify that shop's work.
--
-- This never mixes into vehicle_profile_repair_groups: a shop's own
-- "Common symptoms & repairs" stays 100% its own verified work.

alter table public.shops
  add column if not exists shares_repair_data boolean not null default false;

create table if not exists public.network_repair_contributions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  make text not null,
  model text not null,
  system text not null,
  label text not null,
  occurrences integer not null,
  updated_at timestamptz not null default now(),
  unique (shop_id, make, model, system, label)
);

create index if not exists network_repair_contributions_lookup_idx
  on public.network_repair_contributions (lower(make), lower(model));

-- RLS on with no policies at all: this table is deliberately unreadable and
-- unwritable from the client. Only the security definer functions below
-- touch it, which is what keeps a shop from reading another shop's rows.
alter table public.network_repair_contributions enable row level security;
revoke all on public.network_repair_contributions from anon, authenticated;

-- Rebuilds the calling shop's contributions from its own verified repairs.
-- Runs for one shop at a time so it can be called right after a job is
-- resolved without rescanning the whole platform.
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

  insert into public.network_repair_contributions (shop_id, make, model, system, label, occurrences)
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
    count(*)
  from public.jobs j
  join public.vehicles v on v.id = j.vehicle_id
  join public.repair_records rr on rr.job_id = j.id
  where j.shop_id = target_shop
    and j.status = 'resolved'
    and rr.verified = true
    and nullif(trim(coalesce(v.make, '')), '') is not null
    and nullif(trim(coalesce(v.model, '')), '') is not null
  group by 1, 2, 3, 4, coalesce(
      (select c.code from public.job_dtc_codes c where c.job_id = j.id order by c.created_at limit 1),
      nullif(trim(coalesce(rr.cause, '')), ''),
      nullif(trim(coalesce(j.complaint, '')), '')
    )
  having coalesce(
      (select c.code from public.job_dtc_codes c where c.job_id = j.id order by c.created_at limit 1),
      nullif(trim(coalesce(rr.cause, '')), ''),
      nullif(trim(coalesce(j.complaint, '')), '')
    ) is not null
  on conflict (shop_id, make, model, system, label) do update
    set occurrences = excluded.occurrences, updated_at = now();
end;
$$;

-- What another shop is allowed to see: aggregate counts only, this shop's
-- own contributions excluded, and nothing until enough other shops have
-- logged the same pattern.
create or replace function public.network_repair_patterns(target_make text, target_model text)
returns table (
  system text,
  label text,
  occurrences integer,
  shop_count integer
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
  -- Reciprocity: no sharing, no reading.
  if not coalesce(is_sharing, false) then return; end if;

  return query
  select
    c.system,
    c.label,
    sum(c.occurrences)::int,
    count(distinct c.shop_id)::int
  from public.network_repair_contributions c
  where c.shop_id <> target_shop
    and lower(c.make) = lower(trim(target_make))
    and lower(c.model) = lower(trim(target_model))
  group by c.system, c.label
  having count(distinct c.shop_id) >= min_contributing_shops
  order by sum(c.occurrences) desc, c.label
  limit 20;
end;
$$;

grant execute on function public.refresh_network_contributions() to authenticated;
grant execute on function public.network_repair_patterns(text, text) to authenticated;
