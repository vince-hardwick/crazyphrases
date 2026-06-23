alter table public.pending_games
  add column if not exists expires_at timestamp with time zone;

update public.pending_games
set expires_at = created_at + interval '7 days'
where expires_at is null;

alter table public.pending_games
  alter column expires_at set default (pg_catalog.timezone('utc', pg_catalog.now()) + interval '7 days');

alter table public.pending_games
  alter column expires_at set not null;

alter table public.pending_games
  drop constraint if exists pending_games_status;

alter table public.pending_games
  add constraint pending_games_status check (
    status in ('pending', 'cancelled', 'started', 'expired')
  );

create index if not exists pending_games_pending_expires_at_idx
  on public.pending_games (expires_at)
  where status = 'pending';

drop policy if exists "Invitees can respond to their Pending Game invites"
  on public.pending_game_participants;
create policy "Invitees can respond to their Pending Game invites"
  on public.pending_game_participants
  for update
  to authenticated
  using (
    participant_role = 'invitee'
    and invite_status = 'pending'
    and account_id is null
    and exists (
      select 1
      from public.account_profiles
      where account_id = (select auth.uid())
        and profile_id = pending_game_participants.profile_id
    )
    and exists (
      select 1
      from public.pending_games
      where id = pending_game_id
        and status = 'pending'
        and expires_at > pg_catalog.timezone('utc', pg_catalog.now())
    )
  )
  with check (
    participant_role = 'invitee'
    and invite_status in ('accepted', 'declined')
    and account_id = (select auth.uid())
    and exists (
      select 1
      from public.account_profiles
      where account_id = (select auth.uid())
        and profile_id = pending_game_participants.profile_id
    )
    and exists (
      select 1
      from public.pending_games
      where id = pending_game_id
        and status = 'pending'
        and expires_at > pg_catalog.timezone('utc', pg_catalog.now())
    )
  );

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
        and expires_at > pg_catalog.timezone('utc', pg_catalog.now())
    )
    and not exists (
      select 1
      from public.pending_game_participants
      where pending_game_id = public.games.pending_game_id
        and invite_status <> 'accepted'
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

  if pending_game.status <> 'pending'
     or pending_game.expires_at <= pg_catalog.timezone('utc', pg_catalog.now()) then
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

create or replace function public.cancel_created_game(
  target_pending_game_id uuid
)
returns table (
  id uuid,
  template_id text,
  row_count integer,
  status text,
  started_game_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_account_id uuid := (select auth.uid());
  notification_message text;
  target_pending_game public.pending_games%rowtype;
begin
  if caller_account_id is null then
    raise exception 'Game is not cancellable by this creator.'
      using errcode = '42501';
  end if;

  select pending_game.*
    into target_pending_game
  from public.pending_games as pending_game
  where pending_game.id = target_pending_game_id
  for update;

  if target_pending_game.id is null
     or target_pending_game.creator_account_id <> caller_account_id
     or target_pending_game.status not in ('pending', 'started')
     or (
       target_pending_game.status = 'pending'
       and target_pending_game.expires_at <= pg_catalog.timezone('utc', pg_catalog.now())
     ) then
    raise exception 'Game is not cancellable by this creator.'
      using errcode = '42501';
  end if;

  select game_row.id
    into started_game_id
  from public.games as game_row
  where game_row.pending_game_id = target_pending_game_id
  for update;

  if exists (
    select 1
    from public.multiplayer_batch_reveals as reveal
    where reveal.game_id = started_game_id
  ) then
    raise exception 'Game is not cancellable by this creator.'
      using errcode = '42501';
  end if;

  select
    '@' || creator.handle || ' cancelled a batch with ' ||
      pg_catalog.string_agg(
        '@' || participant.handle,
        ' and '
        order by
          case participant.participant_role
            when 'creator' then 0
            else 1
          end,
          participant.handle
      ) ||
      '.'
    into notification_message
  from public.pending_game_participants as creator
  join public.pending_game_participants as participant
    on participant.pending_game_id = creator.pending_game_id
  where creator.pending_game_id = target_pending_game_id
    and creator.participant_role = 'creator'
  group by creator.handle;

  update public.pending_games
  set status = 'cancelled',
      updated_at = pg_catalog.timezone('utc', pg_catalog.now())
  where public.pending_games.id = target_pending_game_id;

  update public.in_app_notifications
  set notification_status = 'read',
      updated_at = pg_catalog.timezone('utc', pg_catalog.now())
  where target_game_id = started_game_id
    and notification_type = 'entries_needed';

  insert into public.in_app_notifications (
    account_id,
    notification_type,
    notification_status,
    message,
    target_game_id,
    target_pending_game_id
  )
  select
    participant.account_id,
    'game_cancelled',
    'unread',
    notification_message,
    case
      when started_game_id is null then null
      else started_game_id
    end,
    case
      when started_game_id is null then target_pending_game_id
      else null
    end
  from public.pending_game_participants as participant
  where participant.pending_game_id = target_pending_game_id
    and participant.invite_status = 'accepted'
    and participant.account_id is not null
    and participant.account_id <> caller_account_id
  on conflict do nothing;

  return query
  select
    target_pending_game.id,
    target_pending_game.template_id,
    target_pending_game.row_count,
    'cancelled'::text,
    started_game_id;
end;
$$;

revoke all on function public.cancel_created_game(uuid)
  from public;
revoke all on function public.cancel_created_game(uuid)
  from anon;
revoke all on function public.cancel_created_game(uuid)
  from authenticated;
revoke all on function public.cancel_created_game(uuid)
  from service_role;
grant execute on function public.cancel_created_game(uuid)
  to authenticated;
