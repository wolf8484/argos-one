-- Network Cases becomes trim-specific instead of model-wide, per the shop:
-- a mechanic already knows the exact trim in front of them, so a
-- model-wide pattern is the wrong grain. This also drops the 2-shop floor
-- entirely (was: `having count(distinct shop_id) >= 2`) -- the shop that
-- reported a case is never exposed, and neither is how many shops are in
-- the network at all, so a single contributing shop is not identifiable at
-- this stage. A case now shows as soon as one *other* shop has it.
--
-- Fixes a regression along the way: 0036 rebased refresh_network_contributions
-- on 0025's definition and lost 0035's "never DTC as heading" fix, so the
-- function had gone back to using a bare DTC code as `label` when one was
-- present. Restored here (cause/complaint first, no DTC fallback) while the
-- function is being touched anyway for trim.

alter table public.network_repair_contributions add column if not exists trim text;

-- Backfill the two dummy shops' existing demo rows (0038) so the new
-- per-trim demo profiles have something to show instead of going blank now
-- that patterns are grouped by trim. Trims chosen to match the demo
-- vehicles seeded in 0036.
update public.network_repair_contributions set trim = 'GTI'
  where job_id in ('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-0000000003b1',
                    '00000000-0000-0000-0000-0000000004a1', '00000000-0000-0000-0000-0000000004b1');
update public.network_repair_contributions set trim = 'VTi-LX'
  where job_id in ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000005b1');
update public.network_repair_contributions set trim = 'RS'
  where job_id in ('00000000-0000-0000-0000-0000000006a1', '00000000-0000-0000-0000-0000000006b1');
update public.network_repair_contributions set trim = '320i'
  where job_id in ('00000000-0000-0000-0000-0000000007a1', '00000000-0000-0000-0000-0000000007b1');
update public.network_repair_contributions set trim = '220i'
  where job_id in ('00000000-0000-0000-0000-0000000008a1', '00000000-0000-0000-0000-0000000008b1');

create or replace function public.refresh_network_contributions()
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  target_shop uuid := public.current_shop_id();
  is_sharing boolean;
  is_exempt boolean;
begin
  if target_shop is null then return; end if;
  select shares_repair_data, network_read_exempt
    into is_sharing, is_exempt
    from public.shops where id = target_shop;

  delete from public.network_repair_contributions where shop_id = target_shop;
  -- Exempt shops never contribute, whatever their sharing flag says.
  if coalesce(is_exempt, false) then return; end if;
  if not coalesce(is_sharing, false) then return; end if;

  insert into public.network_repair_contributions
    (shop_id, make, model, trim, system, label, job_id, symptom_text, repair_text)
  select
    target_shop,
    v.make,
    v.model,
    nullif(trim(coalesce(v.trim, '')), ''),
    coalesce(rr.system, 'other'),
    coalesce(
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
      nullif(trim(coalesce(rr.cause, '')), ''),
      nullif(trim(coalesce(j.complaint, '')), '')
    ) is not null
  on conflict (shop_id, job_id) do update
    set make = excluded.make, model = excluded.model, trim = excluded.trim, system = excluded.system,
      label = excluded.label, symptom_text = excluded.symptom_text,
      repair_text = excluded.repair_text, updated_at = now();
end;
$$;

drop function if exists public.network_repair_patterns(text, text);

-- Output column named vehicle_trim, not trim: `returns table (trim text, ...)`
-- is a hard syntax error (SQLSTATE 42601) -- TRIM is a reserved keyword in
-- that specific position, unlike as a plain table column (network_repair_
-- contributions.trim, added above, parses fine) or an insert column list.
create or replace function public.network_repair_patterns(target_make text, target_model text)
returns table (
  system text,
  label text,
  vehicle_trim text,
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
  is_exempt boolean;
begin
  if target_shop is null then return; end if;
  select shares_repair_data, network_read_exempt
    into is_sharing, is_exempt
    from public.shops where id = target_shop;
  -- Reciprocity: no sharing, no reading -- unless explicitly exempted.
  if not (coalesce(is_sharing, false) or coalesce(is_exempt, false)) then return; end if;

  return query
  select
    c.system,
    c.label,
    c.trim as vehicle_trim,
    count(*)::int,
    count(distinct c.shop_id)::int,
    array_remove(array_agg(distinct c.symptom_text), null),
    array_remove(array_agg(distinct c.repair_text), null)
  from public.network_repair_contributions c
  where c.shop_id <> target_shop
    and lower(c.make) = lower(trim(target_make))
    and lower(c.model) = lower(trim(target_model))
  group by c.system, c.label, c.trim
  order by count(*) desc, c.label
  limit 40;
end;
$$;

-- The AI-summary cache was keyed (make, model, system, label) -- too coarse
-- now that two different trims can share the same fault label, which would
-- have them overwrite each other's cached summary.
alter table public.network_pattern_summaries add column if not exists trim text not null default '';
alter table public.network_pattern_summaries drop constraint if exists network_pattern_summaries_pkey;
alter table public.network_pattern_summaries add primary key (make, model, trim, system, label);
