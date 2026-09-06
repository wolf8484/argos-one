-- A business is a name that groups sites. It is not a second workshop.
--
-- 0052 gave organisations a phone, an email and an ABN, which duplicated three
-- fields a shop already had. With a single site the two records carry the same
-- name and the interface shows the same entity twice with two different field
-- lists and no way to tell them apart. The deeper problem is that a business
-- has no bays, no staff, no jobs, no region and no suppliers -- presenting it
-- like a workshop asserts something untrue, and "which site am I editing?"
-- stops having an answer as soon as a second branch exists.
--
-- So the business keeps only its name, and every workshop carries its own full
-- detail set, ABN included. A multi-branch business trading under one ABN
-- enters it per site: explicit repetition, rather than an inheritance rule that
-- is invisible from the branch being edited and wrong for branches that are
-- separate legal entities.
--
-- The dropped columns were added earlier today and are null in every row,
-- verified before writing this. They are removed rather than left unused
-- because a dead column named "phone" on organisations is precisely how this
-- duplication would grow back.

alter table public.shops
  add column if not exists abn text;

alter table public.organisations
  drop column if exists phone,
  drop column if exists email,
  drop column if exists abn;

notify pgrst, 'reload schema';
