create table if not exists public.pending_games (
  id uuid primary key default gen_random_uuid(),
  creator_account_id uuid not null references auth.users (id) on delete cascade,
  creator_profile_id uuid not null
    references public.account_profile_directory (profile_id)
    on update cascade
    on delete restrict,
  invitee_profile_id uuid not null
    references public.account_profile_directory (profile_id)
    on update cascade
    on delete restrict,
  template_id text not null default 'default-adjective-noun-noun',
  row_count integer not null,
  status text not null default 'pending',
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  constraint pending_games_default_template check (
    template_id = 'default-adjective-noun-noun'
  ),
  constraint pending_games_row_count check (
    row_count in (10, 15, 20, 25, 30)
  ),
  constraint pending_games_status check (
    status in ('pending', 'cancelled')
  ),
  constraint pending_games_distinct_profiles check (
    creator_profile_id <> invitee_profile_id
  )
);

create table if not exists public.pending_game_participants (
  id uuid primary key default gen_random_uuid(),
  pending_game_id uuid not null
    references public.pending_games (id)
    on delete cascade,
  profile_id uuid not null
    references public.account_profile_directory (profile_id)
    on update cascade
    on delete restrict,
  account_id uuid references auth.users (id) on delete set null,
  handle text not null,
  gamer_name text not null,
  avatar_key text not null,
  participant_role text not null,
  invite_status text not null,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  unique (pending_game_id, profile_id),
  constraint pending_game_participants_role check (
    participant_role in ('creator', 'invitee')
  ),
  constraint pending_game_participants_invite_status check (
    invite_status in ('accepted', 'pending')
  ),
  constraint pending_game_participants_role_status check (
    (
      participant_role = 'creator'
      and invite_status = 'accepted'
      and account_id is not null
    )
    or (
      participant_role = 'invitee'
      and invite_status = 'pending'
      and account_id is null
    )
  ),
  constraint pending_game_participants_handle_format check (
    handle = lower(handle)
    and char_length(handle) between 3 and 30
    and handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint pending_game_participants_gamer_name_length check (
    char_length(btrim(gamer_name)) between 1 and 40
  ),
  constraint pending_game_participants_avatar_key check (
    avatar_key in ('spark', 'paper', 'moon', 'star', 'comet', 'kite')
  )
);

create index if not exists pending_games_creator_account_id_idx
  on public.pending_games (creator_account_id);
create index if not exists pending_games_creator_profile_id_idx
  on public.pending_games (creator_profile_id);
create index if not exists pending_games_invitee_profile_id_idx
  on public.pending_games (invitee_profile_id);
create index if not exists pending_game_participants_pending_game_id_idx
  on public.pending_game_participants (pending_game_id);
create index if not exists pending_game_participants_profile_id_idx
  on public.pending_game_participants (profile_id);
create index if not exists pending_game_participants_account_id_idx
  on public.pending_game_participants (account_id);

alter table public.pending_games enable row level security;
alter table public.pending_game_participants enable row level security;

revoke all on table public.pending_games from public;
revoke all on table public.pending_games from anon;
revoke all on table public.pending_games from authenticated;
revoke all on table public.pending_games from service_role;
revoke all on table public.pending_game_participants from public;
revoke all on table public.pending_game_participants from anon;
revoke all on table public.pending_game_participants from authenticated;
revoke all on table public.pending_game_participants from service_role;

grant select, insert on table public.pending_games to authenticated;
grant select, insert on table public.pending_games to service_role;
grant select on table public.pending_game_participants to authenticated;
grant select, insert on table public.pending_game_participants to service_role;

drop policy if exists "Account holders can view their created Pending Games"
  on public.pending_games;
create policy "Account holders can view their created Pending Games"
  on public.pending_games
  for select
  to authenticated
  using ((select auth.uid()) = creator_account_id);

drop policy if exists "Account holders can create their Pending Games"
  on public.pending_games;
create policy "Account holders can create their Pending Games"
  on public.pending_games
  for insert
  to authenticated
  with check (
    (select auth.uid()) = creator_account_id
    and status = 'pending'
    and exists (
      select 1
      from public.account_profiles
      where account_id = (select auth.uid())
        and profile_id = creator_profile_id
    )
  );

drop policy if exists
  "Account holders can view participant rows for their created Pending Games"
  on public.pending_game_participants;
create policy
  "Account holders can view participant rows for their created Pending Games"
  on public.pending_game_participants
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.pending_games
      where id = pending_game_id
        and creator_account_id = (select auth.uid())
    )
  );

create schema if not exists private;

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
    avatar_key,
    participant_role,
    invite_status
  )
  select
    new.id,
    directory.profile_id,
    new.creator_account_id,
    directory.handle,
    directory.gamer_name,
    directory.avatar_key,
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
    avatar_key,
    participant_role,
    invite_status
  )
  select
    new.id,
    directory.profile_id,
    null,
    directory.handle,
    directory.gamer_name,
    directory.avatar_key,
    'invitee',
    'pending'
  from public.account_profile_directory as directory
  where directory.profile_id = new.invitee_profile_id;

  return new;
end;
$$;

revoke all on function private.create_pending_game_participants() from public;

drop trigger if exists create_pending_game_participants
  on public.pending_games;
create trigger create_pending_game_participants
  after insert on public.pending_games
  for each row
  execute function private.create_pending_game_participants();
