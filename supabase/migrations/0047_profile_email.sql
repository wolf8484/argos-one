-- Staff details need to show a technician's phone and email, but email was
-- never stored anywhere shop-scoped -- only in auth.users, which the app
-- can't read without the service role. Mirrors the phone column added in
-- 0044: real value when one exists, synthesised placeholder addresses (see
-- staffAuthEmail) are never written here.
alter table public.profiles add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and p.email is null
  and u.email is not null
  and u.email not like '%@staff.argosone.internal';

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

  insert into public.profiles(id, shop_id, full_name, role, phone, email)
  values(new.id, new_shop_id, resolved_name, 'owner', nullif(trim(new.raw_user_meta_data ->> 'owner_phone'), ''), new.email);

  insert into public.shop_technicians(shop_id, profile_id, first_name, last_name, initials, role, active)
  values(
    new_shop_id, new.id, first_name, last_name,
    upper(left(first_name, 1) || coalesce(left(last_name, 1), '')),
    'owner', true
  );

  return new;
end;
$$;
