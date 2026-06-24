alter table public.pending_games
  add column if not exists nudge_timeout_hours integer;

update public.pending_games
set nudge_timeout_hours = 48
where nudge_timeout_hours is null;

alter table public.pending_games
  alter column nudge_timeout_hours set default 48;

alter table public.pending_games
  alter column nudge_timeout_hours set not null;

alter table public.pending_games
  drop constraint if exists pending_games_nudge_timeout_hours;

alter table public.pending_games
  add constraint pending_games_nudge_timeout_hours check (
    nudge_timeout_hours in (24, 48, 72, 168)
  );

alter table public.games
  add column if not exists nudge_timeout_hours integer;

update public.games
set nudge_timeout_hours = pending_game.nudge_timeout_hours
from public.pending_games as pending_game
where pending_game.id = public.games.pending_game_id
  and public.games.nudge_timeout_hours is null;

update public.games
set nudge_timeout_hours = 48
where nudge_timeout_hours is null;

alter table public.games
  alter column nudge_timeout_hours set default 48;

alter table public.games
  alter column nudge_timeout_hours set not null;

alter table public.games
  drop constraint if exists games_nudge_timeout_hours;

alter table public.games
  add constraint games_nudge_timeout_hours check (
    nudge_timeout_hours in (24, 48, 72, 168)
  );

revoke select on table public.games
  from authenticated;
grant select (id, pending_game_id, creator_account_id, creator_profile_id, invitee_profile_id, template_id, row_count, nudge_timeout_hours, status, created_at, updated_at)
  on table public.games
  to authenticated;

alter table public.game_section_assignments
  add column if not exists available_at timestamp with time zone;

update public.game_section_assignments
set available_at = created_at
where available_at is null
  and participant_section_index = 0;

create index if not exists game_section_assignments_available_nudge_idx
  on public.game_section_assignments (available_at)
  where status = 'active'
    and available_at is not null;

alter table public.in_app_notifications
  add column if not exists target_assignment_id uuid;

create index if not exists in_app_notifications_target_assignment_id_idx
  on public.in_app_notifications (target_assignment_id);

alter table public.in_app_notifications
  drop constraint if exists in_app_notifications_type;

alter table public.in_app_notifications
  add constraint in_app_notifications_type check (
    notification_type in ('entries_needed', 'batch_complete', 'game_cancelled', 'nudge')
  );

alter table public.in_app_notifications
  drop constraint if exists in_app_notifications_target_required;

alter table public.in_app_notifications
  add constraint in_app_notifications_target_required check (
    (
      target_game_id is not null
      and target_pending_game_id is null
    )
    or
    (
      target_game_id is null
      and target_pending_game_id is not null
    )
  );

alter table public.in_app_notifications
  drop constraint if exists in_app_notifications_nudge_target_required;

alter table public.in_app_notifications
  add constraint in_app_notifications_nudge_target_required check (
    (
      notification_type = 'nudge'
      and target_game_id is not null
      and target_assignment_id is not null
      and target_pending_game_id is null
    )
    or
    (
      notification_type <> 'nudge'
      and target_assignment_id is null
    )
  );

alter table public.in_app_notifications
  drop constraint if exists in_app_notifications_target_assignment_fk;

alter table public.in_app_notifications
  add constraint in_app_notifications_target_assignment_fk
  foreign key (target_assignment_id, target_game_id)
  references public.game_section_assignments (id, game_id)
  on delete cascade;

drop index if exists public.in_app_notifications_target_game_unique;

create unique index if not exists in_app_notifications_target_game_unique
  on public.in_app_notifications (target_game_id, account_id, notification_type)
  where target_game_id is not null
    and notification_type <> 'nudge';

create unique index if not exists in_app_notifications_nudge_assignment_unique
  on public.in_app_notifications (target_game_id, target_assignment_id, account_id, notification_type)
  where target_game_id is not null
    and target_assignment_id is not null
    and notification_type = 'nudge';

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
  new.nudge_timeout_hours = pending_game.nudge_timeout_hours;
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

create or replace function private.create_started_game_section_assignments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  with assigned_sections as (
    select
      allocated_slot.slot_id,
      allocated_slot.entry_kind,
      allocated_slot.participant_profile_id,
      (
        row_number() over (
          partition by allocated_slot.participant_profile_id
          order by pg_catalog.random()
        ) - 1
      )::integer as participant_section_index
    from (
      select
        slot.value ->> 'slot_id' as slot_id,
        slot.value ->> 'entry_kind' as entry_kind,
        (slot.value ->> 'participant_profile_id')::uuid
          as participant_profile_id
      from pg_catalog.jsonb_array_elements(new.slot_allocation) as slot(value)
    ) as allocated_slot
  )
  insert into public.game_section_assignments (
    game_id,
    slot_id,
    entry_kind,
    participant_profile_id,
    participant_section_index,
    available_at,
    row_count
  )
  select
    new.id,
    assigned_section.slot_id,
    assigned_section.entry_kind,
    assigned_section.participant_profile_id,
    assigned_section.participant_section_index,
    case
      when assigned_section.participant_section_index = 0 then pg_catalog.timezone('utc', pg_catalog.now())
      else null
    end,
    new.row_count
  from assigned_sections as assigned_section
  on conflict (game_id, slot_id) do nothing;

  insert into public.in_app_notifications (
    account_id,
    notification_type,
    notification_status,
    message,
    target_game_id
  )
  select
    participant.account_id,
    'entries_needed',
    'unread',
    private.multiplayer_participant_message(
      new.id,
      'You can submit entries to a batch with'
    ),
    new.id
  from public.game_participants as participant
  where participant.game_id = new.id
    and participant.account_id is not null
  on conflict (target_game_id, account_id, notification_type) do nothing;

  return new;
end;
$$;

revoke all on function private.create_started_game_section_assignments()
  from public;
revoke all on function private.create_started_game_section_assignments()
  from anon;
revoke all on function private.create_started_game_section_assignments()
  from authenticated;

create or replace function private.create_overdue_nudge_notifications(
  target_account_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_account_id is null then
    return;
  end if;

  insert into public.in_app_notifications (
    account_id,
    notification_type,
    notification_status,
    message,
    target_game_id,
    target_assignment_id
  )
  select
    participant.account_id,
    'nudge',
    'unread',
    private.multiplayer_participant_message(
      assignment.game_id,
      'A batch is waiting for your entries with'
    ),
    assignment.game_id,
    assignment.id
  from public.game_section_assignments as assignment
  join public.game_participants as participant
    on participant.game_id = assignment.game_id
   and participant.profile_id = assignment.participant_profile_id
  join public.games as game_row
    on game_row.id = assignment.game_id
  join public.pending_games as pending_game
    on pending_game.id = game_row.pending_game_id
   and pending_game.status = 'started'
  where participant.account_id = target_account_id
    and assignment.status = 'active'
    and assignment.available_at is not null
    and assignment.id = (
      private.current_game_section_assignment(
        assignment.game_id,
        assignment.participant_profile_id
      )
    ).id
    and assignment.available_at + pg_catalog.make_interval(hours => pending_game.nudge_timeout_hours)
      <= pg_catalog.timezone('utc', pg_catalog.now())
  on conflict do nothing;
end;
$$;

revoke all on function private.create_overdue_nudge_notifications(uuid)
  from public;
revoke all on function private.create_overdue_nudge_notifications(uuid)
  from anon;
revoke all on function private.create_overdue_nudge_notifications(uuid)
  from authenticated;

create or replace function public.list_multiplayer_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  dashboard_account_id uuid := (select auth.uid());
  dashboard jsonb;
begin
  if dashboard_account_id is null then
    return pg_catalog.jsonb_build_object(
      'awaitingYourEntries', '[]'::jsonb,
      'awaitingOtherPlayerEntries', '[]'::jsonb,
      'completedBatches', '[]'::jsonb
    );
  end if;

  perform private.create_overdue_nudge_notifications(dashboard_account_id);

  with account_participation as (
    select distinct
      participant.game_id,
      participant.profile_id
    from public.game_participants as participant
    where participant.account_id = dashboard_account_id
  ),
  participant_lists as (
    select
      participant.game_id,
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('handle', participant.handle)
        order by
          case participant.participant_role
            when 'creator' then 0
            else 1
          end,
          participant.handle
      ) as participants
    from public.game_participants as participant
    group by participant.game_id
  ),
  section_counts as (
    select
      assignment.game_id,
      assignment.participant_profile_id,
      count(*)::integer as section_count
    from public.game_section_assignments as assignment
    group by assignment.game_id, assignment.participant_profile_id
  ),
  current_sections as (
    select distinct on (
      assignment.game_id,
      assignment.participant_profile_id
    )
      assignment.*
    from public.game_section_assignments as assignment
    where assignment.status <> 'submitted'
    order by
      assignment.game_id,
      assignment.participant_profile_id,
      assignment.participant_section_index
  ),
  awaiting_your_entries as (
    select
      pg_catalog.jsonb_build_object(
        'id', game_row.id,
        'pendingGameId', game_row.pending_game_id,
        'rowCount', game_row.row_count,
        'participants', participant_lists.participants,
        'currentSection', pg_catalog.jsonb_build_object(
          'id', current_sections.id,
          'entryKind', current_sections.entry_kind,
          'sectionIndex', current_sections.participant_section_index,
          'sectionCount', section_counts.section_count,
          'rows', (
            select pg_catalog.jsonb_agg(
              pg_catalog.jsonb_build_object(
                'rowIndex', row_number.row_index,
                'value', ''
              )
              order by row_number.row_index
            )
            from generate_series(
              0,
              current_sections.row_count - 1
            ) as row_number(row_index)
          )
        )
      ) as item,
      current_sections.participant_section_index,
      game_row.created_at
    from account_participation
    join current_sections
      on current_sections.game_id = account_participation.game_id
     and current_sections.participant_profile_id =
       account_participation.profile_id
    join public.games as game_row
      on game_row.id = current_sections.game_id
    join public.pending_games as pending_game
      on pending_game.id = game_row.pending_game_id
     and pending_game.status = 'started'
    join participant_lists
      on participant_lists.game_id = game_row.id
    join section_counts
      on section_counts.game_id = current_sections.game_id
     and section_counts.participant_profile_id =
       current_sections.participant_profile_id
  ),
  awaiting_other_player_entries as (
    select
      pg_catalog.jsonb_build_object(
        'id', game_row.id,
        'pendingGameId', game_row.pending_game_id,
        'rowCount', game_row.row_count,
        'participants', participant_lists.participants
      ) as item,
      game_row.created_at
    from account_participation
    join public.games as game_row
      on game_row.id = account_participation.game_id
    join public.pending_games as pending_game
      on pending_game.id = game_row.pending_game_id
     and pending_game.status = 'started'
    join participant_lists
      on participant_lists.game_id = game_row.id
    where not private.multiplayer_batch_is_complete(game_row.id)
      and not exists (
        select 1
        from current_sections
        where current_sections.game_id = game_row.id
          and current_sections.participant_profile_id =
            account_participation.profile_id
      )
      and exists (
        select 1
        from public.game_section_assignments as other_assignment
        where other_assignment.game_id = game_row.id
          and other_assignment.participant_profile_id <>
            account_participation.profile_id
          and other_assignment.status <> 'submitted'
      )
  ),
  completed_batches as (
    select
      pg_catalog.jsonb_build_object(
        'id', game_row.id,
        'pendingGameId', game_row.pending_game_id,
        'rowCount', game_row.row_count,
        'participants', participant_lists.participants,
        'revealed', exists (
          select 1
          from public.multiplayer_batch_reveals as reveal
          where reveal.game_id = game_row.id
            and reveal.participant_profile_id =
              account_participation.profile_id
        ),
        'phrases', case
          when exists (
            select 1
            from public.multiplayer_batch_reveals as reveal
            where reveal.game_id = game_row.id
              and reveal.participant_profile_id =
                account_participation.profile_id
          )
          then private.render_multiplayer_phrases(game_row.id)
          else null
        end
      ) as item,
      max(assignment.submitted_at) as completed_at
    from account_participation
    join public.games as game_row
      on game_row.id = account_participation.game_id
    join public.pending_games as pending_game
      on pending_game.id = game_row.pending_game_id
     and pending_game.status = 'started'
    join participant_lists
      on participant_lists.game_id = game_row.id
    join public.game_section_assignments as assignment
      on assignment.game_id = game_row.id
    group by
      game_row.id,
      game_row.pending_game_id,
      game_row.row_count,
      participant_lists.participants,
      account_participation.profile_id
    having private.multiplayer_batch_is_complete(game_row.id)
  )
  select pg_catalog.jsonb_build_object(
      'awaitingYourEntries',
        coalesce(
          (
            select pg_catalog.jsonb_agg(item order by participant_section_index, created_at desc)
            from awaiting_your_entries
          ),
          '[]'::jsonb
        ),
      'awaitingOtherPlayerEntries',
        coalesce(
          (
            select pg_catalog.jsonb_agg(item order by created_at desc)
            from awaiting_other_player_entries
          ),
          '[]'::jsonb
        ),
      'completedBatches',
        coalesce(
          (
            select pg_catalog.jsonb_agg(item order by completed_at desc)
            from (
              select item, completed_at
              from completed_batches
              order by completed_at desc
              limit 5
            ) as recent_completed_batches
          ),
          '[]'::jsonb
        )
    )
    into dashboard;

  return dashboard;
end;
$$;

revoke all on function public.list_multiplayer_dashboard()
  from public;
revoke all on function public.list_multiplayer_dashboard()
  from anon;
revoke all on function public.list_multiplayer_dashboard()
  from authenticated;
revoke all on function public.list_multiplayer_dashboard()
  from service_role;
grant execute on function public.list_multiplayer_dashboard()
  to authenticated;

create or replace function public.submit_multiplayer_section(
  target_assignment_id uuid,
  submitted_entries jsonb
)
returns table (
  assignment_id uuid,
  game_id uuid,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_assignment public.game_section_assignments%rowtype;
  current_assignment public.game_section_assignments%rowtype;
  caller_account_id uuid := (select auth.uid());
  caller_profile_id uuid;
  submitted_count integer;
  distinct_row_count integer;
  valid_row_count integer;
  invalid_row_index_count integer;
  completed_now boolean;
begin
  select *
    into target_assignment
  from public.game_section_assignments
  where id = target_assignment_id;

  if target_assignment.id is null then
    raise exception 'Multiplayer section is not active for this Account.'
      using errcode = '42501';
  end if;

  select participant.profile_id
    into caller_profile_id
  from public.game_participants as participant
  where participant.game_id = target_assignment.game_id
    and participant.profile_id = target_assignment.participant_profile_id
    and participant.account_id = caller_account_id;

  if caller_profile_id is null then
    raise exception 'Multiplayer section is not active for this Account.'
      using errcode = '42501';
  end if;

  perform 1
  from public.games as game_row
  where game_row.id = target_assignment.game_id
  for update;

  perform 1
  from public.game_section_assignments as assignment
  where assignment.game_id = target_assignment.game_id
  order by assignment.id
  for update;

  if not exists (
    select 1
    from public.games as game_row
    join public.pending_games as pending_game
      on pending_game.id = game_row.pending_game_id
     and pending_game.status = 'started'
    where game_row.id = target_assignment.game_id
  ) then
    raise exception 'Multiplayer game has been cancelled.'
      using errcode = '42501';
  end if;

  select *
    into target_assignment
  from public.game_section_assignments
  where id = target_assignment_id;

  select *
    into current_assignment
  from private.current_game_section_assignment(
    target_assignment.game_id,
    caller_profile_id
  );

  if current_assignment.id is null
     or current_assignment.id <> target_assignment.id
     or target_assignment.status <> 'active' then
    raise exception 'Multiplayer section is not active for this Account.'
      using errcode = '42501';
  end if;

  if pg_catalog.jsonb_typeof(submitted_entries) <> 'array' then
    raise exception 'Submit one Entry for every row.';
  end if;

  with payload as (
    select
      entry.value ->> 'rowIndex' as row_index_text,
      pg_catalog.btrim(entry.value ->> 'value') as value
    from pg_catalog.jsonb_array_elements(submitted_entries) as entry(value)
  ),
  normalised_payload as (
    select
      row_index_text::integer as row_index,
      value
    from payload
    where row_index_text ~ '^[0-9]+$'
      and char_length(row_index_text) <= 9
  )
  select
    count(*),
    count(*) filter (
      where row_index_text is null
        or row_index_text !~ '^[0-9]+$'
        or char_length(row_index_text) > 9
    ),
    (
      select count(distinct row_index)
      from normalised_payload
    ),
    (
      select count(*)
      from normalised_payload
      where row_index >= 0
        and row_index < target_assignment.row_count
        and value <> ''
        and char_length(value) <= 80
    )
    into submitted_count,
         invalid_row_index_count,
         distinct_row_count,
         valid_row_count
  from payload;

  if submitted_count <> target_assignment.row_count
     or invalid_row_index_count <> 0
     or distinct_row_count <> target_assignment.row_count
     or valid_row_count <> target_assignment.row_count then
    raise exception 'Submit one Entry for every row.';
  end if;

  insert into public.game_section_entries (
    game_id,
    assignment_id,
    row_index,
    value
  )
  select
    target_assignment.game_id,
    target_assignment.id,
    payload.row_index,
    payload.value
  from (
    select
      row_index_text::integer as row_index,
      value
    from (
      select
        entry.value ->> 'rowIndex' as row_index_text,
        pg_catalog.btrim(entry.value ->> 'value') as value
      from pg_catalog.jsonb_array_elements(submitted_entries) as entry(value)
    ) as raw_payload
    where row_index_text ~ '^[0-9]+$'
      and char_length(row_index_text) <= 9
  ) as payload
  order by payload.row_index;

  update public.game_section_assignments
  set status = 'submitted',
      submitted_at = pg_catalog.timezone('utc', pg_catalog.now()),
      updated_at = pg_catalog.timezone('utc', pg_catalog.now())
  where id = target_assignment.id;

  update public.game_section_assignments as next_assignment
  set available_at = coalesce(next_assignment.available_at, pg_catalog.timezone('utc', pg_catalog.now())),
      updated_at = pg_catalog.timezone('utc', pg_catalog.now())
  where next_assignment.id = (
    select candidate.id
    from public.game_section_assignments as candidate
    where candidate.game_id = target_assignment.game_id
      and candidate.participant_profile_id =
        target_assignment.participant_profile_id
      and candidate.status = 'active'
    order by candidate.participant_section_index
    limit 1
  )
    and next_assignment.available_at is null;

  select private.multiplayer_batch_is_complete(target_assignment.game_id)
    into completed_now;

  if completed_now
     and not exists (
       select 1
       from public.in_app_notifications as notification
       where notification.target_game_id = target_assignment.game_id
         and notification.notification_type = 'batch_complete'
     ) then
    insert into public.in_app_notifications (
      account_id,
      notification_type,
      notification_status,
      message,
      target_game_id
    )
    select
      participant.account_id,
      'batch_complete',
      case
        when participant.account_id = caller_account_id then 'read'
        else 'unread'
      end,
      private.multiplayer_participant_message(
        target_assignment.game_id,
        'A batch is complete with'
      ),
      target_assignment.game_id
    from public.game_participants as participant
    where participant.game_id = target_assignment.game_id
      and participant.account_id is not null
    on conflict do nothing;
  end if;

  return query
  select
    target_assignment.id,
    target_assignment.game_id,
    'submitted'::text;
end;
$$;

revoke all on function public.submit_multiplayer_section(uuid, jsonb)
  from public;
revoke all on function public.submit_multiplayer_section(uuid, jsonb)
  from anon;
revoke all on function public.submit_multiplayer_section(uuid, jsonb)
  from authenticated;
revoke all on function public.submit_multiplayer_section(uuid, jsonb)
  from service_role;
grant execute on function public.submit_multiplayer_section(uuid, jsonb)
  to authenticated;

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
    and notification_type in ('entries_needed', 'nudge');

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
