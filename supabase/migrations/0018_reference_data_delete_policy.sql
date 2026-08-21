-- 0017 gave dtc_reference/recalls open read/insert/update but no delete
-- policy, so the seed script's re-run/clear step silently did nothing under
-- RLS. Add delete to match the rest of that open-catalog posture.

drop policy if exists "reference delete dtc_reference" on public.dtc_reference;
create policy "reference delete dtc_reference" on public.dtc_reference for delete using (true);

drop policy if exists "reference delete recalls" on public.recalls;
create policy "reference delete recalls" on public.recalls for delete using (true);

grant delete on public.dtc_reference to anon, authenticated;
grant delete on public.recalls to anon, authenticated;
