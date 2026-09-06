-- Mark a branch as demo so the app can say so on every screen.
--
-- The motivating case is one business holding a real workshop and a
-- demonstration one with fabricated data, both reached from the same tablet by
-- the same person. Nothing about the two looks different once you are inside,
-- so filing a real customer's job into the demo -- or a fake job into the real
-- shop -- is a single wrong tap.
--
-- A flag rather than matching on the branch name: the name is editable, and a
-- safety cue that silently disappears the moment someone renames "Demo" to
-- "Demo shop" is worse than none, because by then it is trusted.

alter table public.shops
  add column if not exists is_demo boolean not null default false;

notify pgrst, 'reload schema';
