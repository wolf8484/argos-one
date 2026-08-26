-- Recalls only showed the defect, not the fix. AU recall detail pages also
-- publish an official remedy/action field (what the manufacturer will do to
-- put it right) -- adding it so "Known issues" isn't just a list of
-- problems with no resolution attached.
alter table public.recalls add column if not exists remedy text;
