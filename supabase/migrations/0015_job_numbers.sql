-- Human-readable job numbers.
--
-- The UI has been showing a hardcoded "AO-260809-04" on every job. Mechanics
-- quote a job number on paperwork and over the phone, so it has to be real,
-- stable and unique per workshop. Format: AO-YYMMDD-NN, where NN counts jobs
-- created by that shop on that date.

alter table public.jobs add column if not exists job_number text;

create unique index if not exists jobs_shop_number_unique
  on public.jobs(shop_id, job_number) where job_number is not null;

create or replace function public.next_job_number(target_shop_id uuid, created timestamptz)
returns text
language plpgsql stable security definer
set search_path = public
as $$
declare
  day_prefix text;
  taken integer;
begin
  day_prefix := 'AO-' || to_char(created at time zone 'Australia/Sydney', 'YYMMDD') || '-';
  -- Count from existing numbers rather than row count so a deleted job never
  -- causes a later job to reuse its number.
  select coalesce(max(substring(job_number from '([0-9]+)$')::int), 0)
  into taken
  from public.jobs
  where shop_id = target_shop_id and job_number like day_prefix || '%';

  return day_prefix || lpad((taken + 1)::text, 2, '0');
end;
$$;

create or replace function public.set_job_number()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if new.job_number is null then
    new.job_number := public.next_job_number(new.shop_id, coalesce(new.created_at, now()));
  end if;
  return new;
end;
$$;

drop trigger if exists set_jobs_number on public.jobs;
create trigger set_jobs_number
  before insert on public.jobs
  for each row execute function public.set_job_number();

-- Backfill in creation order so existing jobs get sensible sequential numbers.
do $$
declare row_record record;
begin
  for row_record in
    select id, shop_id, created_at from public.jobs where job_number is null order by shop_id, created_at
  loop
    update public.jobs
    set job_number = public.next_job_number(row_record.shop_id, row_record.created_at)
    where id = row_record.id;
  end loop;
end $$;

grant execute on function public.next_job_number(uuid, timestamptz) to authenticated;
