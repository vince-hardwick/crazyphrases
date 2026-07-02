alter table public.account_profiles
  add column if not exists email_lookup_key text,
  add column if not exists gamer_tag text;

alter table public.account_profile_directory
  add column if not exists email_lookup_key text,
  add column if not exists gamer_tag text;

do $$
begin
  if exists (select 1 from public.account_profiles)
     or exists (select 1 from public.account_profile_directory) then
    raise exception
      'Private email lookup and Gamer Tag migration requires empty account profile tables; delete hosted legacy Account Profile data before applying this migration.';
  end if;
end;
$$;

alter table public.account_profiles
  alter column gamer_tag set default 'Player';

alter table public.account_profile_directory
  alter column gamer_tag set default 'Player';

alter table public.account_profiles
  alter column gamer_tag set not null;

alter table public.account_profile_directory
  alter column gamer_tag set not null;

alter table public.account_profiles
  drop constraint if exists account_profiles_email_lookup_key_format,
  drop constraint if exists account_profiles_gamer_tag_length;

alter table public.account_profile_directory
  drop constraint if exists account_profile_directory_email_lookup_key_format,
  drop constraint if exists account_profile_directory_gamer_tag_length;

alter table public.account_profiles
  add constraint account_profiles_email_lookup_key_format check (
    email_lookup_key is null
    or (
      email_lookup_key = lower(btrim(email_lookup_key))
      and char_length(email_lookup_key) between 3 and 320
      and email_lookup_key like '%@%'
    )
  ),
  add constraint account_profiles_gamer_tag_length check (
    char_length(btrim(gamer_tag)) between 1 and 40
  );

alter table public.account_profile_directory
  add constraint account_profile_directory_email_lookup_key_format check (
    email_lookup_key is null
    or (
      email_lookup_key = lower(btrim(email_lookup_key))
      and char_length(email_lookup_key) between 3 and 320
      and email_lookup_key like '%@%'
    )
  ),
  add constraint account_profile_directory_gamer_tag_length check (
    char_length(btrim(gamer_tag)) between 1 and 40
  );

create unique index if not exists account_profiles_email_lookup_key_unique_idx
  on public.account_profiles (email_lookup_key)
  where email_lookup_key is not null;

create unique index if not exists account_profiles_gamer_tag_lookup_unique_idx
  on public.account_profiles (lower(gamer_tag));

create unique index if not exists account_profile_directory_email_lookup_key_unique_idx
  on public.account_profile_directory (email_lookup_key)
  where email_lookup_key is not null;

create unique index if not exists account_profile_directory_gamer_tag_lookup_unique_idx
  on public.account_profile_directory (lower(gamer_tag));

create schema if not exists private;

create or replace function private.sync_account_profile_lookup_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  auth_email text;
begin
  select lower(btrim(auth_user.email))
  into auth_email
  from auth.users as auth_user
  where auth_user.id = new.account_id
    and auth_user.email is not null
    and btrim(auth_user.email) <> '';

  new.email_lookup_key = auth_email;

  if tg_op = 'INSERT' then
    new.gamer_tag = left(
      coalesce(
        nullif(btrim(new.gamer_tag), ''),
        nullif(btrim(new.gamer_name), ''),
        'Player'
      ),
      40
    );
  elsif new.gamer_tag is null
     or btrim(new.gamer_tag) = ''
     or new.gamer_name is distinct from old.gamer_name then
    new.gamer_tag = left(
      coalesce(
        nullif(btrim(new.gamer_tag), ''),
        nullif(btrim(new.gamer_name), ''),
        'Player'
      ),
      40
    );
  end if;

  return new;
end;
$$;

revoke all on function private.sync_account_profile_lookup_identity()
  from public;
revoke all on function private.sync_account_profile_lookup_identity()
  from anon;
revoke all on function private.sync_account_profile_lookup_identity()
  from authenticated;

drop trigger if exists sync_account_profile_lookup_identity
  on public.account_profiles;
create trigger sync_account_profile_lookup_identity
  before insert or update of account_id, email_lookup_key, gamer_name, gamer_tag
  on public.account_profiles
  for each row
  execute function private.sync_account_profile_lookup_identity();

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
    gamer_tag,
    email_lookup_key,
    avatar_type,
    avatar_key,
    avatar_object_path
  )
  values (
    new.profile_id,
    new.handle,
    new.gamer_name,
    new.gamer_tag,
    new.email_lookup_key,
    new.avatar_type,
    new.avatar_key,
    new.avatar_object_path
  )
  on conflict (profile_id) do update
  set handle = excluded.handle,
      gamer_name = excluded.gamer_name,
      gamer_tag = excluded.gamer_tag,
      email_lookup_key = excluded.email_lookup_key,
      avatar_type = excluded.avatar_type,
      avatar_key = excluded.avatar_key,
      avatar_object_path = excluded.avatar_object_path;

  return new;
end;
$$;

revoke all on function private.sync_account_profile_directory()
  from public;
revoke all on function private.sync_account_profile_directory()
  from anon;
revoke all on function private.sync_account_profile_directory()
  from authenticated;

revoke select on table public.account_profile_directory
  from authenticated;
grant select (profile_id, handle, gamer_name, gamer_tag, avatar_type, avatar_key, avatar_object_path)
  on table public.account_profile_directory
  to authenticated;

revoke select, insert, update on table public.account_profiles
  from authenticated;
grant select (account_id, profile_id, handle, gamer_name, gamer_tag, avatar_type, avatar_key, avatar_object_path)
  on table public.account_profiles
  to authenticated;
grant insert (account_id, profile_id, handle, gamer_name, gamer_tag, email_lookup_key, avatar_type, avatar_key, avatar_object_path)
  on table public.account_profiles
  to authenticated;
grant update (handle, gamer_name, gamer_tag, email_lookup_key, avatar_type, avatar_key, avatar_object_path)
  on table public.account_profiles
  to authenticated;

create or replace function public.lookup_account_profile(
  lookup_key text,
  lookup_kind text
)
returns table (
  profile_id uuid,
  gamer_tag text,
  avatar_type text,
  avatar_key text,
  avatar_object_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    directory.profile_id,
    directory.gamer_tag,
    directory.avatar_type,
    directory.avatar_key,
    directory.avatar_object_path
  from public.account_profile_directory as directory
  where auth.uid() is not null
    and (
      (
        lookup_kind = 'email'
        and directory.email_lookup_key = lower(btrim(lookup_key))
      )
      or (
        lookup_kind = 'gamer-tag'
        and lower(directory.gamer_tag) = lower(btrim(lookup_key))
      )
    )
  order by directory.profile_id
  limit 1;
$$;

revoke all on function public.lookup_account_profile(text, text)
  from public;
revoke all on function public.lookup_account_profile(text, text)
  from anon;
grant execute on function public.lookup_account_profile(text, text)
  to authenticated;
