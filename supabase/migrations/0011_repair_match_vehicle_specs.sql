-- Expose the candidate vehicle's spec fields so the UI can render trim,
-- drivetrain, engine, transmission and mileage rows on the selected-repair
-- card instead of a single flattened meta string. The return row shape is
-- changing (new columns), so the existing function must be dropped first --
-- create or replace can't alter a function's OUT parameter list.
drop function if exists public.find_similar_repairs(uuid);

create or replace function public.find_similar_repairs(target_job_id uuid)
returns table (
  repair_id uuid,
  job_id uuid,
  vehicle_label text,
  vehicle_trim text,
  vehicle_drivetrain text,
  vehicle_engine text,
  vehicle_transmission text,
  vehicle_mileage integer,
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
    v.trim vehicle_trim, v.drivetrain vehicle_drivetrain, v.engine vehicle_engine,
    v.transmission vehicle_transmission, v.mileage vehicle_mileage,
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
