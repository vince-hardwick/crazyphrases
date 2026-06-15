create table if not exists public.account_profiles (
  account_id uuid not null references auth.users (id) on delete cascade,
  profile_id uuid not null default gen_random_uuid(),
  handle text not null,
  gamer_name text not null default 'Player',
  avatar_key text not null default 'spark',
  created_at timestamp with time zone not null default pg_catalog.timezone('utc', pg_catalog.now()),
  updated_at timestamp with time zone not null default pg_catalog.timezone('utc', pg_catalog.now()),
  primary key (account_id),
  unique (profile_id),
  unique (handle),
  constraint account_profiles_handle_format check (
    handle = lower(handle)
    and char_length(handle) between 3 and 30
    and handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint account_profiles_gamer_name_length check (
    char_length(btrim(gamer_name)) between 1 and 40
  ),
  constraint account_profiles_avatar_key check (
    avatar_key in ('spark', 'paper', 'moon', 'star', 'comet', 'kite')
  )
);

alter table public.account_profiles enable row level security;

revoke all on table public.account_profiles from anon;
revoke all on table public.account_profiles from authenticated;
revoke all on table public.account_profiles from service_role;

grant select, insert, update on table public.account_profiles to authenticated, service_role;

drop policy if exists "Signed-in accounts can view Account Profiles"
  on public.account_profiles;
create policy "Signed-in accounts can view Account Profiles"
  on public.account_profiles
  for select
  to authenticated
  using (true);

drop policy if exists "Account holders can create their own Account Profile"
  on public.account_profiles;
create policy "Account holders can create their own Account Profile"
  on public.account_profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = account_id);

drop policy if exists "Account holders can update their own Account Profile"
  on public.account_profiles;
create policy "Account holders can update their own Account Profile"
  on public.account_profiles
  for update
  to authenticated
  using ((select auth.uid()) = account_id)
  with check ((select auth.uid()) = account_id);
