-- Sharing repairs between a business's own branches, separately from the
-- anonymised platform-wide network.
--
-- These are two different things wearing the same word. The network is
-- strangers: opt-in both ways, anonymised, no shop ever named, and routed
-- through network_repair_contributions so a shop's own rows can be excluded
-- from what it reads. Branches are one owner's own sites: there is nobody to
-- anonymise from, so a branch case is attributed by name, shows the real job
-- text, and counts from the first occurrence.
--
-- That difference is why this needs no contributions table and no refresh
-- step. The rows already live in this database under one org, so a definer
-- function reads jobs directly and is never stale.

alter table public.shops
  add column if not exists shares_with_branches boolean not null default false;

-- Exclusions, not grants.
--
-- Default-deny is the right posture between strangers and the wrong one here.
-- "Share across branches" reads as all of my sites, so the per-branch switches
-- start on and store only the ones turned off. It also settles two cases that
-- a grant table gets wrong: a branch created later is included automatically
-- rather than silently missing, and switching the master toggle off and on
-- again restores the owner's previous choices instead of re-granting the lot.
create table if not exists public.branch_share_blocks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  source_shop_id uuid not null references public.shops(id) on delete cascade,
  target_shop_id uuid not null references public.shops(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (source_shop_id, target_shop_id),
  check (source_shop_id <> target_shop_id)
);

create index if not exists branch_share_blocks_target_idx
  on public.branch_share_blocks (target_shop_id);

-- Same posture as network_repair_contributions: RLS on with no policies at
-- all, so the table is unreachable from the client and only the definer
-- functions below touch it.
alter table public.branch_share_blocks enable row level security;
revoke all on public.branch_share_blocks from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Who may change it
-- ---------------------------------------------------------------------------

-- Deliberately stricter than the network toggle, which every role can flip.
-- That one only ever exposes anonymised patterns; this one moves a branch's
-- named work to another site, which is an owner's call, not a technician's.
create or replace function public.can_manage_branch_sharing()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.my_role_in_shop(public.current_shop_id()) in ('owner', 'admin')
$$;

create or replace function public.set_branch_sharing(p_enabled boolean)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  target uuid := public.current_shop_id();
begin
  if target is null then
    raise exception 'No current workshop' using errcode = '42501';
  end if;
  if not public.can_manage_branch_sharing() then
    raise exception 'Only an Owner or Admin can change branch sharing' using errcode = '42501';
  end if;

  update public.shops set shares_with_branches = coalesce(p_enabled, false) where id = target;
  return coalesce(p_enabled, false);
end;
$$;

create or replace function public.set_branch_share_target(target_shop uuid, p_shared boolean)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  source uuid := public.current_shop_id();
  org uuid := public.current_org_id();
  ok boolean;
begin
  if source is null or org is null then
    raise exception 'No current workshop' using errcode = '42501';
  end if;
  if not public.can_manage_branch_sharing() then
    raise exception 'Only an Owner or Admin can change branch sharing' using errcode = '42501';
  end if;
  if target_shop = source then
    raise exception 'A branch cannot share with itself' using errcode = '22023';
  end if;

  -- Confine this to the caller's own business: without it, a uuid from
  -- anywhere on the platform could be written into the table.
  select exists (select 1 from public.shops s where s.id = target_shop and s.org_id = org) into ok;
  if not ok then
    raise exception 'That branch is not part of your business' using errcode = 'P0002';
  end if;

  if coalesce(p_shared, false) then
    delete from public.branch_share_blocks
      where source_shop_id = source and target_shop_id = target_shop;
  else
    insert into public.branch_share_blocks(org_id, source_shop_id, target_shop_id)
      values (org, source, target_shop)
      on conflict (source_shop_id, target_shop_id) do nothing;
  end if;

  return coalesce(p_shared, false);
end;
$$;

-- The per-branch switch list. Every sibling branch, with the current shop's
-- own row excluded -- there is nothing to decide about sharing with yourself.
create or replace function public.list_branch_share_targets()
returns table (shop_id uuid, name text, shared boolean)
language plpgsql security definer
set search_path = public
as $$
declare
  source uuid := public.current_shop_id();
  org uuid := public.current_org_id();
begin
  if source is null or org is null then return; end if;

  return query
  select
    s.id,
    s.name,
    not exists (
      select 1 from public.branch_share_blocks b
      where b.source_shop_id = source and b.target_shop_id = s.id
    )
  from public.shops s
  where s.org_id = org and s.id <> source
  order by s.name;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------

-- No reciprocity check, unlike the network reader. Reciprocity exists to stop
-- a stranger taking without giving; inside one business it would only mean an
-- owner hiding their own work from themselves. Direction is still controlled,
-- because each branch decides who it shares out to.
--
-- No k-anonymity floor either, and no aggregation across branches: which site
-- saw the fault is the useful part, so a single repair at one branch shows,
-- named. Output column is vehicle_trim, not trim -- see 0039 for why that
-- position is a hard syntax error.
create or replace function public.branch_repair_patterns(target_make text, target_model text)
returns table (
  branch_id uuid,
  branch_name text,
  system text,
  label text,
  vehicle_trim text,
  occurrences integer,
  symptoms text[],
  repairs text[]
)
language plpgsql security definer
set search_path = public
as $$
declare
  target uuid := public.current_shop_id();
  org uuid := public.current_org_id();
begin
  if target is null or org is null then return; end if;

  return query
  select
    s.id,
    s.name,
    coalesce(rr.system, 'other'),
    coalesce(
      nullif(trim(coalesce(rr.cause, '')), ''),
      nullif(trim(coalesce(j.complaint, '')), '')
    ),
    nullif(trim(coalesce(v.trim, '')), ''),
    count(*)::int,
    array_remove(array_agg(distinct nullif(trim(concat_ws(' — ',
      nullif(trim(coalesce(j.complaint, '')), ''),
      nullif(trim(coalesce(j.observations, '')), ''))), '')), null),
    array_remove(array_agg(distinct nullif(trim(concat_ws(' — ',
      nullif(trim(coalesce(rr.work_performed, '')), ''),
      nullif(trim(coalesce(rr.verification_notes, '')), ''))), '')), null)
  from public.jobs j
  join public.shops s on s.id = j.shop_id
  join public.vehicles v on v.id = j.vehicle_id
  join public.repair_records rr on rr.job_id = j.id
  where s.org_id = org
    and s.id <> target
    and s.shares_with_branches
    and not exists (
      select 1 from public.branch_share_blocks b
      where b.source_shop_id = s.id and b.target_shop_id = target
    )
    and j.status = 'resolved'
    and rr.verified = true
    and lower(coalesce(v.make, '')) = lower(trim(target_make))
    and lower(coalesce(v.model, '')) = lower(trim(target_model))
    and coalesce(
      nullif(trim(coalesce(rr.cause, '')), ''),
      nullif(trim(coalesce(j.complaint, '')), '')
    ) is not null
  group by s.id, s.name, coalesce(rr.system, 'other'),
    coalesce(
      nullif(trim(coalesce(rr.cause, '')), ''),
      nullif(trim(coalesce(j.complaint, '')), '')
    ),
    nullif(trim(coalesce(v.trim, '')), '')
  order by count(*) desc, s.name
  limit 60;
end;
$$;

revoke all on function public.can_manage_branch_sharing() from public, anon;
revoke all on function public.set_branch_sharing(boolean) from public, anon;
revoke all on function public.set_branch_share_target(uuid, boolean) from public, anon;
revoke all on function public.list_branch_share_targets() from public, anon;
revoke all on function public.branch_repair_patterns(text, text) from public, anon;

grant execute on function public.can_manage_branch_sharing() to authenticated;
grant execute on function public.set_branch_sharing(boolean) to authenticated;
grant execute on function public.set_branch_share_target(uuid, boolean) to authenticated;
grant execute on function public.list_branch_share_targets() to authenticated;
grant execute on function public.branch_repair_patterns(text, text) to authenticated;
