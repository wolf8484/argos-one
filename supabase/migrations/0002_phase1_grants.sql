-- Argos One — Phase 1 grants
-- Needed because "Automatically expose new tables" was disabled at project
-- creation. RLS policies already restrict WHAT can be read/written; these grants
-- make the tables reachable via the Data API at all.
--
-- Catalog is shared: the anon (publishable-key) and authenticated roles may
-- read and add makes/models. No update/delete is granted.

grant select, insert on public.makes  to anon, authenticated;
grant select, insert on public.models to anon, authenticated;
