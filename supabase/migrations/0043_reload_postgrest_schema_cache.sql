-- 0042's DDL left PostgREST's schema cache without the self-referencing
-- foreign key on repair_records (reference_repair_id -> repair_records.id).
-- Every job detail read embeds that relationship by constraint name, so the
-- stale cache turned `GET /api/jobs/:id` into a 500 with PGRST200 even though
-- the constraint itself was never touched.
--
-- Re-assert the constraint so the reload has something to latch onto, then
-- ask PostgREST to rebuild its cache.
do $$ begin
  alter table public.repair_records add constraint repair_records_reference_repair_id_fkey
    foreign key (reference_repair_id) references public.repair_records(id) on delete set null;
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
