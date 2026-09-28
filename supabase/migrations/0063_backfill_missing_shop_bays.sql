-- 0042 seeded shop_bays from whatever bay text existed on jobs at the time it
-- ran, so every shop created (or given jobs with a new bay label) since then
-- never got those bays added to its roster. That makes a job card show a bay
-- ("Bay 06", "Bay 01", ...) that Bay management doesn't know about, and the
-- assign/reassign picker -- which only lists public.shop_bays -- can't ever
-- have offered it. A job can't legitimately have a bay the shop doesn't have.
--
-- Re-run the same backfill 0042 did, but against the current state of
-- public.jobs rather than a one-time snapshot, so any shop (demo or real)
-- that picked up job rows with bay text outside its roster gets those bays
-- added retroactively. Idempotent: the unique index on (shop_id, lower(name))
-- makes this a no-op wherever the bay already exists.
insert into public.shop_bays (shop_id, name, position)
select j.shop_id, j.bay,
  coalesce((select max(position) from public.shop_bays b where b.shop_id = j.shop_id), 0)
    + row_number() over (partition by j.shop_id order by j.bay)
from (select distinct shop_id, trim(bay) as bay from public.jobs where nullif(trim(bay), '') is not null) j
where not exists (
  select 1 from public.shop_bays b
  where b.shop_id = j.shop_id and lower(b.name) = lower(j.bay)
)
on conflict do nothing;
