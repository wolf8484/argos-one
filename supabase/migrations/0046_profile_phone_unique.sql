-- The mobile number became a sign-in identifier at 0044 (staff are keyed on a
-- placeholder email derived from it, because Supabase's native phone auth
-- refuses password logins until a paid SMS provider is configured). A typed
-- number therefore has to map to exactly one login, which a duplicate would
-- make ambiguous -- /api/auth/resolve picks a single profile by phone.
--
-- Verified no existing profile has a duplicate phone before adding this.
create unique index if not exists profiles_phone_unique
  on public.profiles (phone) where phone is not null;
