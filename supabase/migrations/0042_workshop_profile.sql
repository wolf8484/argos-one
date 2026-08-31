-- Workshop profile: a real bay and technician roster, workshop identity, and
-- job defaults.
--
-- Until now "bay" was only ever a free-text label typed per job, and there was
-- no technician roster at all -- `profiles` holds people with an Argos One
-- login, which is a different (much smaller) set than the people who actually
-- work in the shop. A workshop needs to record its whole crew regardless of
-- who logs in, so technicians get their own table with an optional link to a
-- login when that person does have one.

alter table public.shops
  add column if not exists branch_id text,
  add column if not exists region text not null default 'Australia',
  add column if not exists preferred_supplier text,
  add column if not exists default_bay_id uuid,
  add column if not exists default_technician_id uuid,
  add column if not exists auto_assign_jobs boolean not null default false;

create table if not exists public.shop_bays (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  description text,
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bay names are how a bay is identified on a job card, so two bays in the same
-- shop sharing one name would make the label ambiguous.
create unique index if not exists shop_bays_shop_name_unique
  on public.shop_bays(shop_id, lower(name));

create table if not exists public.shop_technicians (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  -- Set only for crew who also have an Argos One login; most rosters have
  -- people who never sign in, so this stays null for them.
  profile_id uuid references public.profiles(id) on delete set null,
  first_name text not null,
  last_name text,
  initials text,
  employee_id text,
  role public.shop_role not null default 'technician',
  active boolean not null default true,
  default_bay_id uuid references public.shop_bays(id) on delete set null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shop_bays_shop_position_idx on public.shop_bays(shop_id, position);
create index if not exists shop_technicians_shop_position_idx on public.shop_technicians(shop_id, position);

do $$ begin
  alter table public.shops add constraint shops_default_bay_fkey
    foreign key (default_bay_id) references public.shop_bays(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.shops add constraint shops_default_technician_fkey
    foreign key (default_technician_id) references public.shop_technicians(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array['shop_bays','shop_technicians'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists shop_select on public.%I', table_name);
    execute format('drop policy if exists shop_insert on public.%I', table_name);
    execute format('drop policy if exists shop_update on public.%I', table_name);
    execute format('drop policy if exists shop_delete on public.%I', table_name);
    execute format('create policy shop_select on public.%I for select to authenticated using (shop_id = public.current_shop_id())', table_name);
    execute format('create policy shop_insert on public.%I for insert to authenticated with check (shop_id = public.current_shop_id())', table_name);
    execute format('create policy shop_update on public.%I for update to authenticated using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id())', table_name);
    execute format('create policy shop_delete on public.%I for delete to authenticated using (shop_id = public.current_shop_id())', table_name);
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

-- Seed each shop's roster from what it has already been doing: the bay labels
-- typed on existing jobs, and the people who already have logins. Without this
-- every existing shop opens the new screen to an empty list even though its
-- job history clearly shows which bays it runs.
insert into public.shop_bays (shop_id, name, position)
select j.shop_id, j.bay, row_number() over (partition by j.shop_id order by j.bay)
from (select distinct shop_id, trim(bay) as bay from public.jobs where nullif(trim(bay), '') is not null) j
on conflict do nothing;

insert into public.shop_technicians (shop_id, profile_id, first_name, last_name, initials, role)
select p.shop_id, p.id,
  split_part(p.full_name, ' ', 1),
  nullif(trim(substr(p.full_name, length(split_part(p.full_name, ' ', 1)) + 1)), ''),
  upper(left(split_part(p.full_name, ' ', 1), 1) || coalesce(left(nullif(split_part(p.full_name, ' ', 2), ''), 1), '')),
  p.role
from public.profiles p
on conflict do nothing;

grant select, insert, update, delete on public.shop_bays to authenticated;
grant select, insert, update, delete on public.shop_technicians to authenticated;
