drop view if exists public.account_profile_directory;

create or replace view public.account_profile_directory as
select
  profile_id,
  handle,
  gamer_name,
  avatar_key
from public.account_profiles;

revoke all on table public.account_profile_directory from public;
revoke all on table public.account_profile_directory from anon;
revoke all on table public.account_profile_directory from authenticated;
revoke all on table public.account_profile_directory from service_role;

grant select on table public.account_profile_directory to authenticated, service_role;

drop policy if exists "Signed-in accounts can view Account Profiles"
  on public.account_profiles;

drop policy if exists "Account holders can view their own Account Profile"
  on public.account_profiles;
create policy "Account holders can view their own Account Profile"
  on public.account_profiles
  for select
  to authenticated
  using ((select auth.uid()) = account_id);

revoke select, insert, update on table public.account_profiles from authenticated;

grant select (account_id, profile_id, handle, gamer_name, avatar_key)
  on table public.account_profiles
  to authenticated;

grant insert (account_id, profile_id, handle, gamer_name, avatar_key)
  on table public.account_profiles
  to authenticated;

grant update (handle, gamer_name, avatar_key)
  on table public.account_profiles
  to authenticated;
