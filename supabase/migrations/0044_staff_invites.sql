-- Staff invites: let a workshop owner put a second person into their shop.
--
-- Until now every signup created its own new shop and made that person its
-- owner, so two logins could never share a workshop -- which also meant the
-- per-technician job permissions had nobody to apply to. An owner now creates
-- a roster row plus a short invite code, hands the code over in person, and
-- the invitee redeems it to get a login attached to that same shop.

-- 'manager' is renamed rather than replaced so existing rows carry over: the
-- workshop vocabulary is Owner / Admin / Technician, where Owner is whoever
-- created the shop and Admin is the invitable equivalent.
do $$ begin
  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'shop_role' and e.enumlabel = 'manager'
  ) then
    alter type public.shop_role rename value 'manager' to 'admin';
  end if;
end $$;

-- Workshop signup now collects how to reach the business and its owner, which
-- had nowhere to live: shops had no contact details at all, and a profile held
-- only a name (the login's own email/phone sit in auth.users, which the app
-- cannot read for other people).
alter table public.shops
  add column if not exists phone text,
  add column if not exists email text;

alter table public.profiles
  add column if not exists phone text;

create table if not exists public.shop_invites (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  -- One live invite per roster row: regenerating replaces the code in place
  -- rather than leaving a trail of codes that would all still resolve.
  technician_id uuid not null unique references public.shop_technicians(id) on delete cascade,
  code text not null,
  -- Whatever contact the admin knew at invite time. Prefilled on the join
  -- screen and editable there, since the invitee is the authority on their
  -- own number -- these are a convenience, not the eventual credential.
  email text,
  mobile text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Codes are looked up by an unauthenticated caller with no shop context, so
-- they have to be unique across every shop, not just within one.
create unique index if not exists shop_invites_code_unique on public.shop_invites(upper(code));
create index if not exists shop_invites_shop_idx on public.shop_invites(shop_id);

alter table public.shop_invites enable row level security;
drop policy if exists shop_select on public.shop_invites;
drop policy if exists shop_insert on public.shop_invites;
drop policy if exists shop_update on public.shop_invites;
drop policy if exists shop_delete on public.shop_invites;
create policy shop_select on public.shop_invites for select to authenticated using (shop_id = public.current_shop_id());
create policy shop_insert on public.shop_invites for insert to authenticated with check (shop_id = public.current_shop_id());
create policy shop_update on public.shop_invites for update to authenticated using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id());
create policy shop_delete on public.shop_invites for delete to authenticated using (shop_id = public.current_shop_id());

drop trigger if exists set_shop_invites_updated_at on public.shop_invites;
create trigger set_shop_invites_updated_at before update on public.shop_invites
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.shop_invites to authenticated;

-- Redeeming an invite also inserts into auth.users, which fires this trigger.
-- Without the join_invite guard that signup would spawn a brand new shop and
-- make the invitee its owner -- the exact opposite of joining an existing one.
-- The join endpoint creates that profile itself, against the inviting shop.
--
-- The other change is the roster row: a new owner previously got a shop and a
-- profile but no shop_technicians row, so nothing could be assigned to them
-- and they never appeared on their own staff list.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  new_shop_id uuid;
  resolved_name text;
  first_name text;
  last_name text;
begin
  if exists(select 1 from public.profiles where id = new.id) then return new; end if;
  if coalesce(new.raw_user_meta_data ->> 'join_invite', '') <> '' then return new; end if;

  resolved_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Workshop owner'
  );
  first_name := split_part(resolved_name, ' ', 1);
  last_name := nullif(trim(substr(resolved_name, length(first_name) + 1)), '');

  insert into public.shops(name, phone, email)
  values(
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'shop_name'), ''), 'My workshop'),
    nullif(trim(new.raw_user_meta_data ->> 'shop_phone'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'shop_email'), '')
  )
  returning id into new_shop_id;

  insert into public.profiles(id, shop_id, full_name, role, phone)
  values(new.id, new_shop_id, resolved_name, 'owner', nullif(trim(new.raw_user_meta_data ->> 'owner_phone'), ''));

  insert into public.shop_technicians(shop_id, profile_id, first_name, last_name, initials, role, active)
  values(
    new_shop_id, new.id, first_name, last_name,
    upper(left(first_name, 1) || coalesce(left(last_name, 1), '')),
    'owner', true
  );

  return new;
end;
$$;

-- Existing shops predate the roster row above. Link any owner roster row that
-- was created without a login (or add one where it is missing entirely), or
-- those shops stay unable to assign jobs to their own owner.
update public.shop_technicians t
set profile_id = p.id
from public.profiles p
where t.profile_id is null
  and t.shop_id = p.shop_id
  and t.role = 'owner'
  and p.role = 'owner'
  and not exists (select 1 from public.shop_technicians x where x.profile_id = p.id);

insert into public.shop_technicians (shop_id, profile_id, first_name, last_name, initials, role, active)
select p.shop_id, p.id,
  split_part(p.full_name, ' ', 1),
  nullif(trim(substr(p.full_name, length(split_part(p.full_name, ' ', 1)) + 1)), ''),
  upper(left(split_part(p.full_name, ' ', 1), 1) || coalesce(left(nullif(split_part(p.full_name, ' ', 2), ''), 1), '')),
  'owner', true
from public.profiles p
where p.role = 'owner'
  and not exists (select 1 from public.shop_technicians x where x.profile_id = p.id);
