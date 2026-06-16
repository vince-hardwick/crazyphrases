drop view if exists public.account_profile_directory;

create table if not exists public.account_profile_directory (
  profile_id uuid primary key
    references public.account_profiles (profile_id)
    on update cascade
    on delete cascade,
  handle text not null unique,
  gamer_name text not null,
  avatar_key text not null,
  constraint account_profile_directory_handle_format check (
    handle = lower(handle)
    and char_length(handle) between 3 and 30
    and handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint account_profile_directory_gamer_name_length check (
    char_length(btrim(gamer_name)) between 1 and 40
  ),
  constraint account_profile_directory_avatar_key check (
    avatar_key in ('spark', 'paper', 'moon', 'star', 'comet', 'kite')
  )
);

insert into public.account_profile_directory (
  profile_id,
  handle,
  gamer_name,
  avatar_key
)
select
  profile_id,
  handle,
  gamer_name,
  avatar_key
from public.account_profiles
on conflict (profile_id) do update
set handle = excluded.handle,
    gamer_name = excluded.gamer_name,
    avatar_key = excluded.avatar_key;

alter table public.account_profile_directory enable row level security;

revoke all on table public.account_profile_directory from public;
revoke all on table public.account_profile_directory from anon;
revoke all on table public.account_profile_directory from authenticated;
revoke all on table public.account_profile_directory from service_role;

grant select on table public.account_profile_directory to authenticated, service_role;

drop policy if exists "Signed-in accounts can view Account Profile Directory"
  on public.account_profile_directory;
create policy "Signed-in accounts can view Account Profile Directory"
  on public.account_profile_directory
  for select
  to authenticated
  using (true);

create schema if not exists private;

create or replace function private.sync_account_profile_directory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.account_profile_directory
    where profile_id = old.profile_id;
    return old;
  end if;

  insert into public.account_profile_directory (
    profile_id,
    handle,
    gamer_name,
    avatar_key
  )
  values (
    new.profile_id,
    new.handle,
    new.gamer_name,
    new.avatar_key
  )
  on conflict (profile_id) do update
  set handle = excluded.handle,
      gamer_name = excluded.gamer_name,
      avatar_key = excluded.avatar_key;

  return new;
end;
$$;

revoke all on function private.sync_account_profile_directory() from public;

drop trigger if exists sync_account_profile_directory
  on public.account_profiles;
create trigger sync_account_profile_directory
  after insert or update or delete on public.account_profiles
  for each row
  execute function private.sync_account_profile_directory();
