-- Same rule as 0034 applied to the network side: refresh_network_contributions
-- picked the DTC code as `label` before falling back to cause/complaint --
-- if the AI-generated `mostCommonIssue` summary is ever missing, the sheet
-- falls back to raw `label`, which must never be a bare code.
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
    set make = excluded.make, model = excluded.model, system = excluded.system,
      label = excluded.label, symptom_text = excluded.symptom_text,
      repair_text = excluded.repair_text, updated_at = now();
end;
$$;
