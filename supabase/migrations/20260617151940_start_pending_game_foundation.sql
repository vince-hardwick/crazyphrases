alter table public.pending_games
  drop constraint if exists pending_games_status;

alter table public.pending_games
  add constraint pending_games_status check (
    status in ('pending', 'cancelled', 'started')
  );

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  pending_game_id uuid not null unique
    references public.pending_games (id)
    on update cascade
    on delete restrict,
  creator_account_id uuid references auth.users (id) on delete set null,
  creator_profile_id uuid not null,
  invitee_profile_id uuid not null,
  template_id text not null,
  row_count integer not null,
  status text not null default 'started',
  slot_allocation jsonb not null,
  slot_order jsonb not null,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  constraint games_default_template check (
    template_id = 'default-adjective-noun-noun'
  ),
  constraint games_row_count check (
    row_count in (10, 15, 20, 25, 30)
  ),
  constraint games_status check (
    status = 'started'
  ),
  constraint games_slot_allocation_shape check (
    jsonb_typeof(slot_allocation) = 'array'
    and jsonb_array_length(slot_allocation) = 3
  ),
  constraint games_slot_order_shape check (
    jsonb_typeof(slot_order) = 'array'
    and jsonb_array_length(slot_order) = 3
  )
);

create table if not exists public.game_participants (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null
    references public.games (id)
    on delete cascade,
  profile_id uuid not null,
  account_id uuid references auth.users (id) on delete set null,
  handle text not null,
  gamer_name text not null,
  avatar_key text not null,
  participant_role text not null,
  participant_kind text not null default 'human',
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  unique (game_id, profile_id),
  constraint game_participants_role check (
    participant_role in ('creator', 'invitee')
  ),
  constraint game_participants_kind check (
    participant_kind in ('human', 'cpu')
  ),
  constraint game_participants_handle_format check (
    handle = lower(handle)
    and char_length(handle) between 3 and 30
    and handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint game_participants_gamer_name_length check (
    char_length(btrim(gamer_name)) between 1 and 40
  ),
  constraint game_participants_avatar_key check (
    avatar_key in ('spark', 'paper', 'moon', 'star', 'comet', 'kite')
  )
);

create index if not exists games_pending_game_id_idx
  on public.games (pending_game_id);
create index if not exists games_creator_account_id_idx
  on public.games (creator_account_id);
create index if not exists games_creator_profile_id_idx
  on public.games (creator_profile_id);
create index if not exists games_invitee_profile_id_idx
  on public.games (invitee_profile_id);
create index if not exists game_participants_game_id_idx
  on public.game_participants (game_id);
create index if not exists game_participants_profile_id_idx
  on public.game_participants (profile_id);
create index if not exists game_participants_account_id_idx
  on public.game_participants (account_id);

alter table public.games enable row level security;
alter table public.game_participants enable row level security;

revoke all on table public.games from public;
revoke all on table public.games from anon;
revoke all on table public.games from authenticated;
revoke all on table public.games from service_role;
revoke all on table public.game_participants from public;
revoke all on table public.game_participants from anon;
revoke all on table public.game_participants from authenticated;
revoke all on table public.game_participants from service_role;

grant select on table public.games to authenticated;
grant insert (pending_game_id)
  on table public.games
  to authenticated;
grant select, insert on table public.games to service_role;
grant select on table public.game_participants to authenticated;
grant select, insert on table public.game_participants to service_role;

create schema if not exists private;

grant usage on schema private to authenticated;

create or replace function private.is_started_game_participant(
  target_game_id uuid,
  target_account_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.game_participants
    where game_id = target_game_id
      and account_id = target_account_id
  );
$$;

revoke all on function private.is_started_game_participant(uuid, uuid)
  from public;
revoke all on function private.is_started_game_participant(uuid, uuid)
  from anon;
grant execute on function private.is_started_game_participant(uuid, uuid)
  to authenticated;

drop policy if exists "Game Creators can start accepted Pending Games"
  on public.games;
create policy "Game Creators can start accepted Pending Games"
  on public.games
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.pending_games
      where id = public.games.pending_game_id
        and creator_account_id = (select auth.uid())
        and status = 'pending'
    )
    and not exists (
      select 1
      from public.pending_game_participants
      where pending_game_id = public.games.pending_game_id
        and invite_status <> 'accepted'
    )
  );

drop policy if exists "Participants can view their Started Games"
  on public.games;
create policy "Participants can view their Started Games"
  on public.games
  for select
  to authenticated
  using (
    creator_account_id = (select auth.uid())
    or private.is_started_game_participant(public.games.id, (select auth.uid()))
  );

drop policy if exists "Participants can view Started Game snapshots"
  on public.game_participants;
create policy "Participants can view Started Game snapshots"
  on public.game_participants
  for select
  to authenticated
  using (
    private.is_started_game_participant(
      public.game_participants.game_id,
      (select auth.uid())
    )
  );

create or replace function private.prepare_started_game_from_pending()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pending_game public.pending_games%rowtype;
  participant_profile_ids uuid[];
  unresolved_participants integer;
  resolved_slot_allocation jsonb;
  resolved_slot_order jsonb;
begin
  select *
    into pending_game
  from public.pending_games
  where id = new.pending_game_id
  for update;

  if pending_game.id is null then
    raise exception 'Pending Game does not exist.';
  end if;

  if pending_game.creator_account_id <> (select auth.uid()) then
    raise exception 'Only the Game Creator can start this Pending Game.'
      using errcode = '42501';
  end if;

  if pending_game.status <> 'pending' then
    raise exception 'Pending Game is not ready to start.';
  end if;

  select count(*)
    into unresolved_participants
  from public.pending_game_participants
  where pending_game_id = new.pending_game_id
    and invite_status <> 'accepted';

  if unresolved_participants <> 0 then
    raise exception 'Pending Game is not ready to start.';
  end if;

  select array_agg(profile_id order by pg_catalog.random())
    into participant_profile_ids
  from public.pending_game_participants
  where pending_game_id = new.pending_game_id;

  if coalesce(cardinality(participant_profile_ids), 0) <> 2 then
    raise exception 'The default template requires two participants.';
  end if;

  with slots(slot_id, entry_kind) as (
    values
      ('adjective', 'adjective'),
      ('noun-1', 'noun'),
      ('noun-2', 'noun')
  ),
  ordered_slots as (
    select
      slot_id,
      entry_kind,
      pg_catalog.random() as sort_key
    from slots
  )
  select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'slot_id', slot_id,
        'entry_kind', entry_kind
      )
      order by sort_key
    )
    into resolved_slot_order
  from ordered_slots;

  with slots(slot_id, entry_kind) as (
    values
      ('adjective', 'adjective'),
      ('noun-1', 'noun'),
      ('noun-2', 'noun')
  ),
  allocated_slots as (
    select
      slot_id,
      entry_kind,
      row_number() over (order by pg_catalog.random()) as allocation_index
    from slots
  )
  select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'slot_id', slot_id,
        'entry_kind', entry_kind,
        'participant_profile_id',
          case
            when allocation_index < 3 then participant_profile_ids[1]
            else participant_profile_ids[2]
          end
      )
      order by allocation_index
    )
    into resolved_slot_allocation
  from allocated_slots;

  new.creator_account_id = pending_game.creator_account_id;
  new.creator_profile_id = pending_game.creator_profile_id;
  new.invitee_profile_id = pending_game.invitee_profile_id;
  new.template_id = pending_game.template_id;
  new.row_count = pending_game.row_count;
  new.status = 'started';
  new.slot_allocation = resolved_slot_allocation;
  new.slot_order = resolved_slot_order;
  new.created_at = pg_catalog.timezone('utc', pg_catalog.now());
  new.updated_at = pg_catalog.timezone('utc', pg_catalog.now());

  return new;
end;
$$;

revoke all on function private.prepare_started_game_from_pending()
  from public;
revoke all on function private.prepare_started_game_from_pending()
  from anon;
revoke all on function private.prepare_started_game_from_pending()
  from authenticated;

drop trigger if exists prepare_started_game_from_pending
  on public.games;
create trigger prepare_started_game_from_pending
  before insert on public.games
  for each row
  execute function private.prepare_started_game_from_pending();

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
    avatar_key,
    participant_role,
    participant_kind
  )
  select
    new.id,
    participant.profile_id,
    participant.account_id,
    participant.handle,
    participant.gamer_name,
    participant.avatar_key,
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

drop trigger if exists create_started_game_participants
  on public.games;
create trigger create_started_game_participants
  after insert on public.games
  for each row
  execute function private.create_started_game_participants();
