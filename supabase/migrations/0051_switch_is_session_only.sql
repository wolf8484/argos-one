-- Switching branch must not follow the login onto other devices.
--
-- 0050 had set_session_branch write profiles.shop_id alongside the session
-- row, so a brand-new session would "start where you left off". That quietly
-- reintroduced the exact problem per-session selection exists to solve:
-- current_shop_id() falls back to profiles.shop_id for any session that has
-- not chosen, so an owner switching branch on their phone also moved the
-- workshop tablet -- as long as the tablet had never been asked. The prompt
-- added in the same release makes that window small, but small is not none,
-- and a job filed into the wrong branch is not something anyone notices until
-- much later.
--
-- profiles.shop_id now means one thing only: the branch this login belongs to
-- when nothing else says otherwise. It is set at signup, repaired when someone
-- is deactivated out of it, and cleared on delete. Switching does not touch
-- it, so a session either made a choice or is on the home branch, and no
-- device can move another.

create or replace function public.set_session_branch(target_shop uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  sid uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.shop_technicians t
    where t.profile_id = auth.uid() and t.shop_id = target_shop and t.active
  ) then
    raise exception 'You do not have access to that branch' using errcode = '42501';
  end if;

  -- A session with no id cannot record a choice, and silently doing nothing
  -- would leave the caller believing they had switched.
  if sid is null then
    raise exception 'This device cannot switch branch -- sign in again' using errcode = '42501';
  end if;

  delete from public.session_branches sb
  where sb.profile_id = auth.uid()
    and not exists (select 1 from auth.sessions s where s.id = sb.session_id);

  insert into public.session_branches(session_id, profile_id, shop_id)
  values (sid, auth.uid(), target_shop)
  on conflict (session_id) do update
    set shop_id = excluded.shop_id, profile_id = excluded.profile_id, updated_at = now();

  return target_shop;
end;
$$;

notify pgrst, 'reload schema';
