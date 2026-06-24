insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  true,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.account_profiles
  drop constraint if exists account_profiles_avatar_key;
alter table public.account_profile_directory
  drop constraint if exists account_profile_directory_avatar_key;
alter table public.pending_game_participants
  drop constraint if exists pending_game_participants_avatar_key;
alter table public.game_participants
  drop constraint if exists game_participants_avatar_key;

alter table public.account_profiles
  add column if not exists avatar_type text not null default 'built-in',
  add column if not exists avatar_object_path text;
alter table public.account_profile_directory
  add column if not exists avatar_type text not null default 'built-in',
  add column if not exists avatar_object_path text;
alter table public.pending_game_participants
  add column if not exists avatar_type text not null default 'built-in',
  add column if not exists avatar_object_path text;
alter table public.game_participants
  add column if not exists avatar_type text not null default 'built-in',
  add column if not exists avatar_object_path text;

update public.account_profiles
set avatar_key = case avatar_key
  when 'spark' then 'dice'
  when 'paper' then 'puzzle-piece'
  when 'moon' then 'yin-yang'
  when 'star' then 'user-astronaut'
  when 'comet' then 'hurricane'
  when 'kite' then 'dragon'
  when 'dice' then 'dice'
  when 'hat-wizard' then 'hat-wizard'
  when 'gamepad' then 'gamepad'
  when 'ghost' then 'ghost'
  when 'puzzle-piece' then 'puzzle-piece'
  when 'biohazard' then 'biohazard'
  when 'dragon' then 'dragon'
  when 'hurricane' then 'hurricane'
  when 'jedi' then 'jedi'
  when 'pizza-slice' then 'pizza-slice'
  when 'spaghetti-monster-flying' then 'spaghetti-monster-flying'
  when 'user-astronaut' then 'user-astronaut'
  when 'yin-yang' then 'yin-yang'
  else 'dice'
end;

update public.account_profile_directory
set avatar_key = case avatar_key
  when 'spark' then 'dice'
  when 'paper' then 'puzzle-piece'
  when 'moon' then 'yin-yang'
  when 'star' then 'user-astronaut'
  when 'comet' then 'hurricane'
  when 'kite' then 'dragon'
  when 'dice' then 'dice'
  when 'hat-wizard' then 'hat-wizard'
  when 'gamepad' then 'gamepad'
  when 'ghost' then 'ghost'
  when 'puzzle-piece' then 'puzzle-piece'
  when 'biohazard' then 'biohazard'
  when 'dragon' then 'dragon'
  when 'hurricane' then 'hurricane'
  when 'jedi' then 'jedi'
  when 'pizza-slice' then 'pizza-slice'
  when 'spaghetti-monster-flying' then 'spaghetti-monster-flying'
  when 'user-astronaut' then 'user-astronaut'
  when 'yin-yang' then 'yin-yang'
  else 'dice'
end;

update public.pending_game_participants
set avatar_key = case avatar_key
  when 'spark' then 'dice'
  when 'paper' then 'puzzle-piece'
  when 'moon' then 'yin-yang'
  when 'star' then 'user-astronaut'
  when 'comet' then 'hurricane'
  when 'kite' then 'dragon'
  when 'dice' then 'dice'
  when 'hat-wizard' then 'hat-wizard'
  when 'gamepad' then 'gamepad'
  when 'ghost' then 'ghost'
  when 'puzzle-piece' then 'puzzle-piece'
  when 'biohazard' then 'biohazard'
  when 'dragon' then 'dragon'
  when 'hurricane' then 'hurricane'
  when 'jedi' then 'jedi'
  when 'pizza-slice' then 'pizza-slice'
  when 'spaghetti-monster-flying' then 'spaghetti-monster-flying'
  when 'user-astronaut' then 'user-astronaut'
  when 'yin-yang' then 'yin-yang'
  else 'dice'
end;

update public.game_participants
set avatar_key = case avatar_key
  when 'spark' then 'dice'
  when 'paper' then 'puzzle-piece'
  when 'moon' then 'yin-yang'
  when 'star' then 'user-astronaut'
  when 'comet' then 'hurricane'
  when 'kite' then 'dragon'
  when 'dice' then 'dice'
  when 'hat-wizard' then 'hat-wizard'
  when 'gamepad' then 'gamepad'
  when 'ghost' then 'ghost'
  when 'puzzle-piece' then 'puzzle-piece'
  when 'biohazard' then 'biohazard'
  when 'dragon' then 'dragon'
  when 'hurricane' then 'hurricane'
  when 'jedi' then 'jedi'
  when 'pizza-slice' then 'pizza-slice'
  when 'spaghetti-monster-flying' then 'spaghetti-monster-flying'
  when 'user-astronaut' then 'user-astronaut'
  when 'yin-yang' then 'yin-yang'
  else 'dice'
end;

alter table public.account_profiles
  alter column avatar_key set default 'dice';

alter table public.account_profiles
  add constraint account_profiles_avatar_type check (
    avatar_type in ('built-in', 'uploaded')
  ),
  add constraint account_profiles_avatar_key check (
    avatar_key in ('dice', 'hat-wizard', 'gamepad', 'ghost', 'puzzle-piece', 'biohazard', 'dragon', 'hurricane', 'jedi', 'pizza-slice', 'spaghetti-monster-flying', 'user-astronaut', 'yin-yang')
  ),
  add constraint account_profiles_avatar_object_path check (
    avatar_object_path is null
    or avatar_object_path ~ '^uploaded/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  ),
  add constraint account_profiles_avatar_descriptor check (
    (
      avatar_type = 'built-in'
      and avatar_object_path is null
    )
    or (
      avatar_type = 'uploaded'
      and avatar_object_path is not null
    )
  );

alter table public.account_profile_directory
  add constraint account_profile_directory_avatar_type check (
    avatar_type in ('built-in', 'uploaded')
  ),
  add constraint account_profile_directory_avatar_key check (
    avatar_key in ('dice', 'hat-wizard', 'gamepad', 'ghost', 'puzzle-piece', 'biohazard', 'dragon', 'hurricane', 'jedi', 'pizza-slice', 'spaghetti-monster-flying', 'user-astronaut', 'yin-yang')
  ),
  add constraint account_profile_directory_avatar_object_path check (
    avatar_object_path is null
    or avatar_object_path ~ '^uploaded/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  ),
  add constraint account_profile_directory_avatar_descriptor check (
    (
      avatar_type = 'built-in'
      and avatar_object_path is null
    )
    or (
      avatar_type = 'uploaded'
      and avatar_object_path is not null
    )
  );

alter table public.pending_game_participants
  add constraint pending_game_participants_avatar_type check (
    avatar_type in ('built-in', 'uploaded')
  ),
  add constraint pending_game_participants_avatar_key check (
    avatar_key in ('dice', 'hat-wizard', 'gamepad', 'ghost', 'puzzle-piece', 'biohazard', 'dragon', 'hurricane', 'jedi', 'pizza-slice', 'spaghetti-monster-flying', 'user-astronaut', 'yin-yang')
  ),
  add constraint pending_game_participants_avatar_object_path check (
    avatar_object_path is null
    or avatar_object_path ~ '^uploaded/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  ),
  add constraint pending_game_participants_avatar_descriptor check (
    (
      avatar_type = 'built-in'
      and avatar_object_path is null
    )
    or (
      avatar_type = 'uploaded'
      and avatar_object_path is not null
    )
  );

alter table public.game_participants
  add constraint game_participants_avatar_type check (
    avatar_type in ('built-in', 'uploaded')
  ),
  add constraint game_participants_avatar_key check (
    avatar_key in ('dice', 'hat-wizard', 'gamepad', 'ghost', 'puzzle-piece', 'biohazard', 'dragon', 'hurricane', 'jedi', 'pizza-slice', 'spaghetti-monster-flying', 'user-astronaut', 'yin-yang')
  ),
  add constraint game_participants_avatar_object_path check (
    avatar_object_path is null
    or avatar_object_path ~ '^uploaded/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  ),
  add constraint game_participants_avatar_descriptor check (
    (
      avatar_type = 'built-in'
      and avatar_object_path is null
    )
    or (
      avatar_type = 'uploaded'
      and avatar_object_path is not null
    )
  );

create table if not exists public.uploaded_avatar_objects (
  object_path text primary key,
  bucket_id text not null default 'avatars',
  account_id uuid not null references auth.users (id) on delete cascade,
  profile_id uuid not null references public.account_profiles (profile_id) on delete cascade,
  content_type text not null,
  byte_size integer not null,
  width integer not null,
  height integer not null,
  lifecycle_status text not null default 'pending',
  created_at timestamp with time zone not null default pg_catalog.timezone('utc', pg_catalog.now()),
  updated_at timestamp with time zone not null default pg_catalog.timezone('utc', pg_catalog.now()),
  constraint uploaded_avatar_objects_bucket check (bucket_id = 'avatars'),
  constraint uploaded_avatar_objects_path check (
    object_path ~ '^uploaded/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  ),
  constraint uploaded_avatar_objects_content_type check (
    content_type in ('image/jpeg', 'image/png', 'image/webp')
  ),
  constraint uploaded_avatar_objects_byte_size check (
    byte_size between 1 and 1048576
  ),
  constraint uploaded_avatar_objects_dimensions check (
    width between 128 and 1024
    and height between 128 and 1024
  ),
  constraint uploaded_avatar_objects_lifecycle_status check (
    lifecycle_status in ('pending', 'live', 'historical', 'abandoned')
  )
);

create index if not exists uploaded_avatar_objects_profile_status_idx
  on public.uploaded_avatar_objects (profile_id, lifecycle_status);
create index if not exists uploaded_avatar_objects_account_status_idx
  on public.uploaded_avatar_objects (account_id, lifecycle_status);

alter table public.uploaded_avatar_objects enable row level security;

revoke all on table public.uploaded_avatar_objects from public;
revoke all on table public.uploaded_avatar_objects from anon;
revoke all on table public.uploaded_avatar_objects from authenticated;
revoke all on table public.uploaded_avatar_objects from service_role;

grant select, insert, delete on table public.uploaded_avatar_objects
  to authenticated;
grant select, insert, update, delete on table public.uploaded_avatar_objects
  to service_role;

drop policy if exists "Account holders can view their Uploaded Avatar metadata"
  on public.uploaded_avatar_objects;
create policy "Account holders can view their Uploaded Avatar metadata"
  on public.uploaded_avatar_objects
  for select
  to authenticated
  using (account_id = (select auth.uid()));

drop policy if exists "Account holders can create Uploaded Avatar metadata"
  on public.uploaded_avatar_objects;
create policy "Account holders can create Uploaded Avatar metadata"
  on public.uploaded_avatar_objects
  for insert
  to authenticated
  with check (
    account_id = (select auth.uid())
    and exists (
      select 1
      from public.account_profiles as profile
      where profile.profile_id = uploaded_avatar_objects.profile_id
        and profile.account_id = (select auth.uid())
    )
  );

drop policy if exists "Account holders can delete pending Uploaded Avatar metadata"
  on public.uploaded_avatar_objects;
create policy "Account holders can delete pending Uploaded Avatar metadata"
  on public.uploaded_avatar_objects
  for delete
  to authenticated
  using (
    account_id = (select auth.uid())
    and lifecycle_status = 'pending'
  );

drop policy if exists "Account holders can upload registered Uploaded Avatar objects"
  on storage.objects;
create policy "Account holders can upload registered Uploaded Avatar objects"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and name ~ '^uploaded/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
    and exists (
      select 1
      from public.uploaded_avatar_objects as avatar_object
      where avatar_object.bucket_id = storage.objects.bucket_id
        and avatar_object.object_path = storage.objects.name
        and avatar_object.account_id = (select auth.uid())
        and avatar_object.lifecycle_status = 'pending'
    )
  );

drop policy if exists "Account holders can delete pending Uploaded Avatar objects"
  on storage.objects;
create policy "Account holders can delete pending Uploaded Avatar objects"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and exists (
      select 1
      from public.uploaded_avatar_objects as avatar_object
      where avatar_object.bucket_id = storage.objects.bucket_id
        and avatar_object.object_path = storage.objects.name
        and avatar_object.account_id = (select auth.uid())
        and avatar_object.lifecycle_status = 'pending'
    )
  );

create schema if not exists private;

create or replace function private.set_uploaded_avatar_objects_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.timezone('utc', pg_catalog.now());
  return new;
end;
$$;

revoke all on function private.set_uploaded_avatar_objects_updated_at()
  from public;

drop trigger if exists set_uploaded_avatar_objects_updated_at
  on public.uploaded_avatar_objects;
create trigger set_uploaded_avatar_objects_updated_at
  before update on public.uploaded_avatar_objects
  for each row
  execute function private.set_uploaded_avatar_objects_updated_at();

create or replace function private.sync_uploaded_avatar_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.avatar_type = 'uploaded'
     and old.avatar_object_path is not null
     and old.avatar_object_path is distinct from new.avatar_object_path then
    update public.uploaded_avatar_objects
    set lifecycle_status = 'historical',
        updated_at = pg_catalog.timezone('utc', pg_catalog.now())
    where object_path = old.avatar_object_path
      and account_id = old.account_id
      and profile_id = old.profile_id
      and lifecycle_status = 'live';
  end if;

  if new.avatar_type = 'uploaded'
     and new.avatar_object_path is not null then
    update public.uploaded_avatar_objects
    set lifecycle_status = 'live',
        updated_at = pg_catalog.timezone('utc', pg_catalog.now())
    where object_path = new.avatar_object_path
      and account_id = new.account_id
      and profile_id = new.profile_id;
  end if;

  return new;
end;
$$;

revoke all on function private.sync_uploaded_avatar_lifecycle()
  from public;
revoke all on function private.sync_uploaded_avatar_lifecycle()
  from anon;
revoke all on function private.sync_uploaded_avatar_lifecycle()
  from authenticated;

drop trigger if exists sync_uploaded_avatar_lifecycle
  on public.account_profiles;
create trigger sync_uploaded_avatar_lifecycle
  after insert or update of avatar_type, avatar_object_path
  on public.account_profiles
  for each row
  execute function private.sync_uploaded_avatar_lifecycle();

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
    avatar_type,
    avatar_key,
    avatar_object_path
  )
  values (
    new.profile_id,
    new.handle,
    new.gamer_name,
    new.avatar_type,
    new.avatar_key,
    new.avatar_object_path
  )
  on conflict (profile_id) do update
  set handle = excluded.handle,
      gamer_name = excluded.gamer_name,
      avatar_type = excluded.avatar_type,
      avatar_key = excluded.avatar_key,
      avatar_object_path = excluded.avatar_object_path;

  return new;
end;
$$;

revoke all on function private.sync_account_profile_directory()
  from public;

insert into public.account_profile_directory (
  profile_id,
  handle,
  gamer_name,
  avatar_type,
  avatar_key,
  avatar_object_path
)
select
  profile_id,
  handle,
  gamer_name,
  avatar_type,
  avatar_key,
  avatar_object_path
from public.account_profiles
on conflict (profile_id) do update
set handle = excluded.handle,
    gamer_name = excluded.gamer_name,
    avatar_type = excluded.avatar_type,
    avatar_key = excluded.avatar_key,
    avatar_object_path = excluded.avatar_object_path;

revoke select, insert, update on table public.account_profiles
  from authenticated;
grant select (account_id, profile_id, handle, gamer_name, avatar_type, avatar_key, avatar_object_path)
  on table public.account_profiles
  to authenticated;
grant insert (account_id, profile_id, handle, gamer_name, avatar_type, avatar_key, avatar_object_path)
  on table public.account_profiles
  to authenticated;
grant update (handle, gamer_name, avatar_type, avatar_key, avatar_object_path)
  on table public.account_profiles
  to authenticated;

create or replace function private.create_pending_game_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.pending_game_participants (
    pending_game_id,
    profile_id,
    account_id,
    handle,
    gamer_name,
    avatar_type,
    avatar_key,
    avatar_object_path,
    participant_role,
    invite_status
  )
  select
    new.id,
    directory.profile_id,
    new.creator_account_id,
    directory.handle,
    directory.gamer_name,
    directory.avatar_type,
    directory.avatar_key,
    directory.avatar_object_path,
    'creator',
    'accepted'
  from public.account_profile_directory as directory
  where directory.profile_id = new.creator_profile_id;

  insert into public.pending_game_participants (
    pending_game_id,
    profile_id,
    account_id,
    handle,
    gamer_name,
    avatar_type,
    avatar_key,
    avatar_object_path,
    participant_role,
    invite_status
  )
  select
    new.id,
    directory.profile_id,
    null,
    directory.handle,
    directory.gamer_name,
    directory.avatar_type,
    directory.avatar_key,
    directory.avatar_object_path,
    'invitee',
    'pending'
  from public.account_profile_directory as directory
  where directory.profile_id = new.invitee_profile_id;

  return new;
end;
$$;

revoke all on function private.create_pending_game_participants()
  from public;
revoke all on function private.create_pending_game_participants()
  from anon;
revoke all on function private.create_pending_game_participants()
  from authenticated;

create or replace function private.create_started_game_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.game_participants (
    game_id,
    profile_id,
    account_id,
    handle,
    gamer_name,
    avatar_type,
    avatar_key,
    avatar_object_path,
    participant_role,
    participant_kind
  )
  select
    new.id,
    participant.profile_id,
    participant.account_id,
    participant.handle,
    participant.gamer_name,
    participant.avatar_type,
    participant.avatar_key,
    participant.avatar_object_path,
    participant.participant_role,
    'human'
  from public.pending_game_participants as participant
  where participant.pending_game_id = new.pending_game_id;

  update public.pending_games
  set status = 'started',
      updated_at = pg_catalog.timezone('utc', pg_catalog.now())
  where id = new.pending_game_id
    and status = 'pending';

  return new;
end;
$$;

revoke all on function private.create_started_game_participants()
  from public;
revoke all on function private.create_started_game_participants()
  from anon;
revoke all on function private.create_started_game_participants()
  from authenticated;
