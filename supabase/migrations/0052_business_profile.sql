-- The business is the head-office record, not just a label.
--
-- 0050 gave organisations a name and nothing else, on the assumption that
-- every real detail belonged to a branch. That is wrong for the way an owner
-- actually thinks about it: the business is the entity with an ABN, a main
-- phone number and an accounts email, and each branch is a site under it that
-- may or may not have its own. Giving it the same shape as a branch is what
-- makes "Business profile" a page worth opening rather than a rename dialog.
--
-- Nothing is copied down to branches: a branch that leaves a field blank means
-- "use the business's", and that resolution belongs in the UI, not in
-- duplicated columns that immediately drift.

alter table public.organisations
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists abn text;

notify pgrst, 'reload schema';
