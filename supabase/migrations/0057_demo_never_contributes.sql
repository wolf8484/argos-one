-- Demo shops read the network but never feed it.
--
-- 0036 introduced network_read_exempt for exactly this shape, and the demo
-- shop carries it today. But that is one boolean away from being wrong: clear
-- the exemption and fabricated repairs start flowing to real workshops. The
-- guarantee should hang off is_demo itself, which is what the rest of the app
-- already treats as "this content is made up".
--
-- A check constraint (not (is_demo and shares_repair_data)) was the obvious
-- move and is the wrong one: it makes the sharing toggle throw the moment
-- anyone presses it during a demo. Enforcing it inside the two functions
-- instead keeps the toggle working and visibly doing something, while the
-- contribution path stays permanently closed.
--
-- Bodies are 0039's, unchanged except for the two flag reads.
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
  select shares_repair_data, (network_read_exempt or is_demo)
    into is_sharing, is_exempt
    from public.shops where id = target_shop;

  delete from public.network_repair_contributions where shop_id = target_shop;
  -- Exempt and demo shops never contribute, whatever their sharing flag says.
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

-- Reading stays open to demo shops: the whole point is that the network panel
-- has something in it when the toggle goes on in front of a customer.
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
  select shares_repair_data, (network_read_exempt or is_demo)
    into is_sharing, is_exempt
    from public.shops where id = target_shop;
  -- Reciprocity: no sharing, no reading -- unless exempt or a demo shop.
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

-- Belt and braces: if a shop is flagged demo, drop anything it already put in.
delete from public.network_repair_contributions c
  using public.shops s
  where s.id = c.shop_id and s.is_demo;
