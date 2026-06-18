create table if not exists public.game_section_assignments (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null
    references public.games (id)
    on delete cascade,
  slot_id text not null,
  entry_kind text not null,
  participant_profile_id uuid not null,
  participant_section_index integer not null,
  row_count integer not null,
  status text not null default 'active',
  submitted_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  unique (id, game_id),
  unique (game_id, participant_profile_id, participant_section_index),
  unique (game_id, slot_id),
  constraint game_section_assignments_participant_fk
    foreign key (game_id, participant_profile_id)
    references public.game_participants (game_id, profile_id)
    on delete cascade,
  constraint game_section_assignments_slot_id check (
    slot_id in ('adjective', 'noun-1', 'noun-2')
  ),
  constraint game_section_assignments_entry_kind check (
    entry_kind in ('adjective', 'noun')
  ),
  constraint game_section_assignments_section_index check (
    participant_section_index >= 0
  ),
  constraint game_section_assignments_row_count check (
    row_count in (10, 15, 20, 25, 30)
  ),
  constraint game_section_assignments_status check (
    status in ('active', 'submitted')
  ),
  constraint game_section_assignments_submitted_at check (
    (
      status = 'active'
      and submitted_at is null
    )
    or (
      status = 'submitted'
      and submitted_at is not null
    )
  )
);

create table if not exists public.game_section_entries (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null
    references public.games (id)
    on delete cascade,
  assignment_id uuid not null
    references public.game_section_assignments (id)
    on delete cascade,
  row_index integer not null,
  value text not null,
  created_at timestamp with time zone not null default timezone('utc', now()),
  unique (assignment_id, row_index),
  constraint game_section_entries_assignment_game_fk
    foreign key (assignment_id, game_id)
    references public.game_section_assignments (id, game_id)
    on delete cascade,
  constraint game_section_entries_row_index check (
    row_index >= 0
  ),
  constraint game_section_entries_value_length check (
    char_length(btrim(value)) between 1 and 80
  )
);

create table if not exists public.multiplayer_batch_reveals (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null
    references public.games (id)
    on delete cascade,
  participant_profile_id uuid not null,
  revealed_at timestamp with time zone not null default timezone('utc', now()),
  created_at timestamp with time zone not null default timezone('utc', now()),
  unique (game_id, participant_profile_id),
  constraint multiplayer_batch_reveals_participant_fk
    foreign key (game_id, participant_profile_id)
    references public.game_participants (game_id, profile_id)
    on delete cascade
);

create table if not exists public.in_app_notifications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users (id) on delete cascade,
  notification_type text not null,
  notification_status text not null default 'unread',
  message text not null,
  target_game_id uuid not null
    references public.games (id)
    on delete cascade,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  unique (target_game_id, account_id, notification_type),
  constraint in_app_notifications_type check (
    notification_type in ('entries_needed', 'batch_complete')
  ),
  constraint in_app_notifications_status check (
    notification_status in ('unread', 'read')
  )
);

create index if not exists game_section_assignments_game_id_idx
  on public.game_section_assignments (game_id);
create index if not exists game_section_assignments_participant_profile_id_idx
  on public.game_section_assignments (participant_profile_id);
create index if not exists game_section_assignments_status_idx
  on public.game_section_assignments (game_id, status);
create index if not exists game_section_entries_game_id_idx
  on public.game_section_entries (game_id);
create index if not exists game_section_entries_assignment_id_idx
  on public.game_section_entries (assignment_id);
create index if not exists multiplayer_batch_reveals_game_id_idx
  on public.multiplayer_batch_reveals (game_id);
create index if not exists multiplayer_batch_reveals_participant_profile_id_idx
  on public.multiplayer_batch_reveals (participant_profile_id);
create index if not exists in_app_notifications_account_id_idx
  on public.in_app_notifications (account_id, created_at desc);
create index if not exists in_app_notifications_target_game_id_idx
  on public.in_app_notifications (target_game_id);

alter table public.game_section_assignments enable row level security;
alter table public.game_section_entries enable row level security;
alter table public.multiplayer_batch_reveals enable row level security;
alter table public.in_app_notifications enable row level security;

revoke all on table public.game_section_assignments from public;
revoke all on table public.game_section_assignments from anon;
revoke all on table public.game_section_assignments from authenticated;
revoke all on table public.game_section_assignments from service_role;
revoke all on table public.game_section_entries from public;
revoke all on table public.game_section_entries from anon;
revoke all on table public.game_section_entries from authenticated;
revoke all on table public.game_section_entries from service_role;
revoke all on table public.multiplayer_batch_reveals from public;
revoke all on table public.multiplayer_batch_reveals from anon;
revoke all on table public.multiplayer_batch_reveals from authenticated;
revoke all on table public.multiplayer_batch_reveals from service_role;
revoke all on table public.in_app_notifications from public;
revoke all on table public.in_app_notifications from anon;
revoke all on table public.in_app_notifications from authenticated;
revoke all on table public.in_app_notifications from service_role;

grant select, insert, update on table public.game_section_assignments
  to service_role;
grant select, insert on table public.game_section_entries
  to service_role;
grant select, insert on table public.multiplayer_batch_reveals
  to service_role;
grant select, insert, update on table public.in_app_notifications
  to service_role;
grant select on table public.in_app_notifications
  to authenticated;
grant update (notification_status)
  on table public.in_app_notifications
  to authenticated;

revoke select on table public.games
  from authenticated;
grant select (id, pending_game_id, creator_account_id, creator_profile_id, invitee_profile_id, template_id, row_count, status, created_at, updated_at)
  on table public.games
  to authenticated;

drop trigger if exists create_started_game_turns
  on public.games;
drop policy if exists "Participants can view their active Started Game Turns"
  on public.game_turns;
revoke all on table public.game_turns
  from authenticated;
revoke all on table public.game_entries
  from authenticated;
revoke all on function private.is_active_started_game_turn_assignee(uuid, uuid)
  from authenticated;
revoke all on function public.submit_started_game_turn(uuid, jsonb)
  from public;
revoke all on function public.submit_started_game_turn(uuid, jsonb)
  from anon;
revoke all on function public.submit_started_game_turn(uuid, jsonb)
  from authenticated;
revoke all on function public.submit_started_game_turn(uuid, jsonb)
  from service_role;

drop policy if exists "Account holders can view their in-app notifications"
  on public.in_app_notifications;
create policy "Account holders can view their in-app notifications"
  on public.in_app_notifications
  for select
  to authenticated
  using (
    account_id = (select auth.uid())
  );

drop policy if exists "Account holders can mark their in-app notifications read"
  on public.in_app_notifications;
create policy "Account holders can mark their in-app notifications read"
  on public.in_app_notifications
  for update
  to authenticated
  using (
    account_id = (select auth.uid())
  )
  with check (
    account_id = (select auth.uid())
    and notification_status = 'read'
  );

create schema if not exists private;

create or replace function private.set_in_app_notifications_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.timezone('utc', pg_catalog.now());
  return new;
end;
$$;

revoke all on function private.set_in_app_notifications_updated_at()
  from public;
revoke all on function private.set_in_app_notifications_updated_at()
  from anon;
revoke all on function private.set_in_app_notifications_updated_at()
  from authenticated;

drop trigger if exists set_in_app_notifications_updated_at
  on public.in_app_notifications;
create trigger set_in_app_notifications_updated_at
  before update on public.in_app_notifications
  for each row
  execute function private.set_in_app_notifications_updated_at();

create or replace function private.multiplayer_participant_message(
  target_game_id uuid,
  message_prefix text
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  handles text[];
begin
  select array_agg(
      '@' || participant.handle
      order by
        case participant.participant_role
          when 'creator' then 0
          else 1
        end,
        participant.handle
    )
    into handles
  from public.game_participants as participant
  where participant.game_id = target_game_id;

  if coalesce(cardinality(handles), 0) = 0 then
    return message_prefix || '.';
  end if;

  if cardinality(handles) = 1 then
    return message_prefix || ' ' || handles[1] || '.';
  end if;

  return message_prefix
    || ' '
    || array_to_string(handles[1:cardinality(handles) - 1], ', ')
    || ' and '
    || handles[cardinality(handles)]
    || '.';
end;
$$;

revoke all on function private.multiplayer_participant_message(uuid, text)
  from public;
revoke all on function private.multiplayer_participant_message(uuid, text)
  from anon;
revoke all on function private.multiplayer_participant_message(uuid, text)
  from authenticated;

create or replace function private.create_started_game_section_assignments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.game_section_assignments (
    game_id,
    slot_id,
    entry_kind,
    participant_profile_id,
    participant_section_index,
    row_count
  )
  select
    new.id,
    allocated_slot.slot_id,
    allocated_slot.entry_kind,
    allocated_slot.participant_profile_id,
    (
      row_number() over (
        partition by allocated_slot.participant_profile_id
        order by pg_catalog.random()
      ) - 1
    )::integer,
    new.row_count
  from (
    select
      slot.value ->> 'slot_id' as slot_id,
      slot.value ->> 'entry_kind' as entry_kind,
      (slot.value ->> 'participant_profile_id')::uuid
        as participant_profile_id
    from pg_catalog.jsonb_array_elements(new.slot_allocation) as slot(value)
  ) as allocated_slot
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

drop trigger if exists create_started_game_section_assignments
  on public.games;
create trigger create_started_game_section_assignments
  after insert on public.games
  for each row
  execute function private.create_started_game_section_assignments();

-- Precondition: hosted application must verify there are no meaningful legacy Started Game Turn submissions before applying this migration. If legacy public.game_turns or public.game_entries rows contain meaningful submissions, write an explicit data migration into participant sections instead of accepting this active backfill.
insert into public.game_section_assignments (
  game_id,
  slot_id,
  entry_kind,
  participant_profile_id,
  participant_section_index,
  row_count
)
select
  game_row.id,
  allocated_slot.slot_id,
  allocated_slot.entry_kind,
  allocated_slot.participant_profile_id,
  (
    row_number() over (
      partition by game_row.id, allocated_slot.participant_profile_id
      order by pg_catalog.random()
    ) - 1
  )::integer,
  game_row.row_count
from public.games as game_row
cross join lateral (
  select
    slot.value ->> 'slot_id' as slot_id,
    slot.value ->> 'entry_kind' as entry_kind,
    (slot.value ->> 'participant_profile_id')::uuid
      as participant_profile_id
  from pg_catalog.jsonb_array_elements(game_row.slot_allocation) as slot(value)
) as allocated_slot
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
    participant.game_id,
    'You can submit entries to a batch with'
  ),
  participant.game_id
from public.game_participants as participant
where participant.account_id is not null
on conflict (target_game_id, account_id, notification_type) do nothing;

create or replace function private.current_game_section_assignment(
  target_game_id uuid,
  target_participant_profile_id uuid
)
returns public.game_section_assignments
language sql
stable
security definer
set search_path = ''
as $$
  select assignment.*
  from public.game_section_assignments as assignment
  where assignment.game_id = target_game_id
    and assignment.participant_profile_id = target_participant_profile_id
    and assignment.status <> 'submitted'
  order by assignment.participant_section_index
  limit 1;
$$;

revoke all on function private.current_game_section_assignment(uuid, uuid)
  from public;
revoke all on function private.current_game_section_assignment(uuid, uuid)
  from anon;
revoke all on function private.current_game_section_assignment(uuid, uuid)
  from authenticated;

create or replace function private.multiplayer_batch_is_complete(
  target_game_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1
      from public.game_section_assignments
      where game_id = target_game_id
    )
    and not exists (
      select 1
      from public.game_section_assignments
      where game_id = target_game_id
        and status <> 'submitted'
    );
$$;

revoke all on function private.multiplayer_batch_is_complete(uuid)
  from public;
revoke all on function private.multiplayer_batch_is_complete(uuid)
  from anon;
revoke all on function private.multiplayer_batch_is_complete(uuid)
  from authenticated;

create or replace function private.render_multiplayer_phrases(
  target_game_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with submitted_sections as (
    select
      assignment.id,
      assignment.slot_id,
      assignment.row_count,
      case assignment.slot_id
        when 'adjective' then 0
        when 'noun-1' then 1
        when 'noun-2' then 2
      end as slot_render_order
    from public.game_section_assignments as assignment
    where assignment.game_id = target_game_id
      and assignment.status = 'submitted'
  ),
  rendered_rows as (
    select
      row_number.row_index,
      pg_catalog.trim(
        pg_catalog.regexp_replace(
          string_agg(entry.value, ' ' order by section.slot_render_order),
          '\s+',
          ' ',
          'g'
        )
      ) as phrase
    from submitted_sections as section
    cross join generate_series(
      0,
      section.row_count - 1
    ) as row_number(row_index)
    join public.game_section_entries as entry
      on entry.assignment_id = section.id
     and entry.row_index = row_number.row_index
    group by row_number.row_index
  )
  select coalesce(
    pg_catalog.jsonb_agg(
      upper(substr(phrase, 1, 1)) || substr(phrase, 2)
      order by row_index
    ),
    '[]'::jsonb
  )
  from rendered_rows;
$$;

revoke all on function private.render_multiplayer_phrases(uuid)
  from public;
revoke all on function private.render_multiplayer_phrases(uuid)
  from anon;
revoke all on function private.render_multiplayer_phrases(uuid)
  from authenticated;

create or replace function public.list_multiplayer_dashboard()
returns jsonb
language plpgsql
stable
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
    on conflict (target_game_id, account_id, notification_type) do nothing;
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
grant execute on function public.submit_multiplayer_section(uuid, jsonb)
  to authenticated;

create or replace function public.reveal_multiplayer_batch(target_game_id uuid)
returns table (
  game_id uuid,
  phrases jsonb,
  revealed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_profile_id uuid;
begin
  select participant.profile_id
    into caller_profile_id
  from public.game_participants as participant
  where participant.game_id = target_game_id
    and participant.account_id = (select auth.uid());

  if caller_profile_id is null then
    raise exception 'Multiplayer batch was not found.'
      using errcode = '42501';
  end if;

  if not private.multiplayer_batch_is_complete(target_game_id) then
    raise exception 'Multiplayer batch is not complete.';
  end if;

  insert into public.multiplayer_batch_reveals (
    game_id,
    participant_profile_id
  )
  values (
    target_game_id,
    caller_profile_id
  )
  on conflict (game_id, participant_profile_id) do nothing;

  return query
  select
    target_game_id,
    private.render_multiplayer_phrases(target_game_id),
    true;
end;
$$;

revoke all on function public.reveal_multiplayer_batch(uuid)
  from public;
revoke all on function public.reveal_multiplayer_batch(uuid)
  from anon;
grant execute on function public.reveal_multiplayer_batch(uuid)
  to authenticated;
