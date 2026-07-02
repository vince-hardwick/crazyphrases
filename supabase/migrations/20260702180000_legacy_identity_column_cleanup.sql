alter table public.pending_game_participants
  add column if not exists gamer_tag text;

alter table public.game_participants
  add column if not exists gamer_tag text;

update public.pending_game_participants
set gamer_tag = left(btrim(gamer_name), 40)
where (gamer_tag is null or btrim(gamer_tag) = '')
  and gamer_name is not null
  and btrim(gamer_name) <> '';

update public.game_participants
set gamer_tag = left(btrim(gamer_name), 40)
where (gamer_tag is null or btrim(gamer_tag) = '')
  and gamer_name is not null
  and btrim(gamer_name) <> '';

update public.pending_game_participants
set gamer_tag = 'Player'
where gamer_tag is null
   or btrim(gamer_tag) = '';

update public.game_participants
set gamer_tag = 'Player'
where gamer_tag is null
   or btrim(gamer_tag) = '';

alter table public.pending_game_participants
  alter column gamer_tag set not null;

alter table public.game_participants
  alter column gamer_tag set not null;

alter table public.pending_game_participants
  drop constraint if exists pending_game_participants_gamer_tag_length,
  add constraint pending_game_participants_gamer_tag_length check (
    char_length(btrim(gamer_tag)) between 1 and 40
  );

alter table public.game_participants
  drop constraint if exists game_participants_gamer_tag_length,
  add constraint game_participants_gamer_tag_length check (
    char_length(btrim(gamer_tag)) between 1 and 40
  );

create or replace function private.sync_account_profile_lookup_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $sync_account_profile_lookup_identity$
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
  new.gamer_tag = left(
    coalesce(nullif(btrim(new.gamer_tag), ''), 'Player'),
    40
  );

  return new;
end;
$sync_account_profile_lookup_identity$;

revoke all on function private.sync_account_profile_lookup_identity()
  from public;
revoke all on function private.sync_account_profile_lookup_identity()
  from anon;
revoke all on function private.sync_account_profile_lookup_identity()
  from authenticated;

drop trigger if exists sync_account_profile_lookup_identity
  on public.account_profiles;
create trigger sync_account_profile_lookup_identity
  before insert or update of account_id, gamer_tag
  on public.account_profiles
  for each row
  execute function private.sync_account_profile_lookup_identity();

create or replace function private.sync_account_profile_directory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $sync_account_profile_directory$
begin
  if tg_op = 'DELETE' then
    delete from public.account_profile_directory
    where profile_id = old.profile_id;
    return old;
  end if;

  insert into public.account_profile_directory (
    profile_id,
    gamer_tag,
    email_lookup_key,
    avatar_type,
    avatar_key,
    avatar_object_path
  )
  values (
    new.profile_id,
    new.gamer_tag,
    new.email_lookup_key,
    new.avatar_type,
    new.avatar_key,
    new.avatar_object_path
  )
  on conflict (profile_id) do update
  set gamer_tag = excluded.gamer_tag,
      email_lookup_key = excluded.email_lookup_key,
      avatar_type = excluded.avatar_type,
      avatar_key = excluded.avatar_key,
      avatar_object_path = excluded.avatar_object_path;

  return new;
end;
$sync_account_profile_directory$;

revoke all on function private.sync_account_profile_directory()
  from public;
revoke all on function private.sync_account_profile_directory()
  from anon;
revoke all on function private.sync_account_profile_directory()
  from authenticated;

insert into public.account_profile_directory (
  profile_id,
  gamer_name,
  handle,
  gamer_tag,
  email_lookup_key,
  avatar_type,
  avatar_key,
  avatar_object_path
)
select
  profile_id,
  gamer_name,
  handle,
  gamer_tag,
  email_lookup_key,
  avatar_type,
  avatar_key,
  avatar_object_path
from public.account_profiles
on conflict (profile_id) do update
set gamer_tag = excluded.gamer_tag,
    gamer_name = excluded.gamer_name,
    handle = excluded.handle,
    email_lookup_key = excluded.email_lookup_key,
    avatar_type = excluded.avatar_type,
    avatar_key = excluded.avatar_key,
    avatar_object_path = excluded.avatar_object_path;

revoke select, insert, update on table public.account_profiles
  from authenticated;
grant select (account_id, profile_id, gamer_tag, avatar_type, avatar_key, avatar_object_path)
  on table public.account_profiles
  to authenticated;
grant insert (account_id, profile_id, gamer_tag, avatar_type, avatar_key, avatar_object_path)
  on table public.account_profiles
  to authenticated;
grant update (gamer_tag, avatar_type, avatar_key, avatar_object_path)
  on table public.account_profiles
  to authenticated;

revoke select on table public.account_profile_directory
  from authenticated;
grant select (profile_id, gamer_tag, avatar_type, avatar_key, avatar_object_path)
  on table public.account_profile_directory
  to authenticated;

create or replace function private.create_pending_game_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $create_pending_game_participants$
begin
  insert into public.pending_game_participants (
    pending_game_id,
    profile_id,
    account_id,
    gamer_tag,
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
    directory.gamer_tag,
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
    gamer_tag,
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
    directory.gamer_tag,
    directory.avatar_type,
    directory.avatar_key,
    directory.avatar_object_path,
    'invitee',
    'pending'
  from public.account_profile_directory as directory
  where directory.profile_id = new.invitee_profile_id;

  return new;
end;
$create_pending_game_participants$;

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
as $create_started_game_participants$
begin
  insert into public.game_participants (
    game_id,
    profile_id,
    account_id,
    gamer_tag,
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
    participant.gamer_tag,
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
$create_started_game_participants$;

revoke all on function private.create_started_game_participants()
  from public;
revoke all on function private.create_started_game_participants()
  from anon;
revoke all on function private.create_started_game_participants()
  from authenticated;

create or replace function private.multiplayer_participant_message(
  target_game_id uuid,
  message_prefix text
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $multiplayer_participant_message$
declare
  gamer_tags text[];
begin
  select array_agg(
      participant.gamer_tag
      order by
        case participant.participant_role
          when 'creator' then 0
          else 1
        end,
        participant.gamer_tag
    )
    into gamer_tags
  from public.game_participants as participant
  where participant.game_id = target_game_id;

  if coalesce(cardinality(gamer_tags), 0) = 0 then
    return message_prefix || '.';
  end if;

  if cardinality(gamer_tags) = 1 then
    return message_prefix || ' ' || gamer_tags[1] || '.';
  end if;

  return message_prefix
    || ' '
    || array_to_string(gamer_tags[1:cardinality(gamer_tags) - 1], ', ')
    || ' and '
    || gamer_tags[cardinality(gamer_tags)]
    || '.';
end;
$multiplayer_participant_message$;

revoke all on function private.multiplayer_participant_message(uuid, text)
  from public;
revoke all on function private.multiplayer_participant_message(uuid, text)
  from anon;
revoke all on function private.multiplayer_participant_message(uuid, text)
  from authenticated;

create or replace function public.list_multiplayer_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $list_multiplayer_dashboard$
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
        pg_catalog.jsonb_build_object('gamerTag', participant.gamer_tag)
        order by
          case participant.participant_role
            when 'creator' then 0
            else 1
          end,
          participant.gamer_tag
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
$list_multiplayer_dashboard$;

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

create or replace function public.list_completed_multiplayer_history(
  page_size integer default 20,
  after_completed_order bigint default null,
  after_game_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $list_completed_multiplayer_history$
declare
  history_account_id uuid := (select auth.uid());
  page_limit integer := least(greatest(coalesce(page_size, 20), 1), 50);
  history jsonb;
begin
  if history_account_id is null then
    return pg_catalog.jsonb_build_object(
      'batches', '[]'::jsonb,
      'hasMore', false,
      'nextCursor', null
    );
  end if;

  with account_participation as (
    select distinct
      participant.game_id,
      participant.profile_id
    from public.game_participants as participant
    where participant.account_id = history_account_id
  ),
  participant_lists as (
    select
      participant.game_id,
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('gamerTag', participant.gamer_tag)
        order by
          case participant.participant_role
            when 'creator' then 0
            else 1
          end,
          participant.gamer_tag
      ) as participants
    from public.game_participants as participant
    group by participant.game_id
  ),
  completed_batches as (
    select
      game_row.id as game_id,
      (
        pg_catalog.date_part('epoch', max(assignment.submitted_at)) * 1000000
      )::bigint as completed_order,
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
      ) as item
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
  ),
  cursor_filtered_batches as (
    select *
    from completed_batches
    where after_completed_order is null
       or after_game_id is null
       or (completed_order, game_id) < (after_completed_order, after_game_id)
  ),
  numbered_page as (
    select
      *,
      row_number() over (
        order by completed_order desc, game_id desc
      ) as page_index
    from cursor_filtered_batches
    order by completed_order desc, game_id desc
    limit page_limit + 1
  ),
  visible_page as (
    select *
    from numbered_page
    where page_index <= page_limit
  ),
  page_metadata as (
    select
      exists (
        select 1
        from numbered_page
        where page_index > page_limit
      ) as page_has_more,
      (
        select completed_order
        from visible_page
        order by page_index desc
        limit 1
      ) as page_cursor_completed_order,
      (
        select game_id
        from visible_page
        order by page_index desc
        limit 1
      ) as page_cursor_game_id
  )
  select pg_catalog.jsonb_build_object(
      'batches',
        coalesce(
          (
            select pg_catalog.jsonb_agg(
              item
              order by completed_order desc, game_id desc
            )
            from visible_page
          ),
          '[]'::jsonb
        ),
      'hasMore', page_has_more,
      'nextCursor',
        case
          when page_has_more then pg_catalog.jsonb_build_object(
            'completedOrder', page_cursor_completed_order,
            'gameId', page_cursor_game_id
          )
          else null
        end
    )
    into history
    from page_metadata;

  return history;
end;
$list_completed_multiplayer_history$;

revoke all on function public.list_completed_multiplayer_history(integer, bigint, uuid)
  from public;
revoke all on function public.list_completed_multiplayer_history(integer, bigint, uuid)
  from anon;
revoke all on function public.list_completed_multiplayer_history(integer, bigint, uuid)
  from authenticated;
revoke all on function public.list_completed_multiplayer_history(integer, bigint, uuid)
  from service_role;
grant execute on function public.list_completed_multiplayer_history(integer, bigint, uuid)
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
as $cancel_created_game$
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
    creator.gamer_tag || ' cancelled a batch with ' ||
      pg_catalog.string_agg(
        participant.gamer_tag,
        ' and '
        order by
          case participant.participant_role
            when 'creator' then 0
            else 1
          end,
          participant.gamer_tag
      ) ||
      '.'
    into notification_message
  from public.pending_game_participants as creator
  join public.pending_game_participants as participant
    on participant.pending_game_id = creator.pending_game_id
  where creator.pending_game_id = target_pending_game_id
    and creator.participant_role = 'creator'
  group by creator.gamer_tag;

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
$cancel_created_game$;

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

alter table public.account_profiles
  drop constraint if exists account_profiles_handle_key,
  drop constraint if exists account_profiles_handle_format,
  drop constraint if exists account_profiles_gamer_name_length,
  drop column if exists handle,
  drop column if exists gamer_name;

alter table public.account_profile_directory
  drop constraint if exists account_profile_directory_handle_key,
  drop constraint if exists account_profile_directory_handle_format,
  drop constraint if exists account_profile_directory_gamer_name_length,
  drop column if exists handle,
  drop column if exists gamer_name;

alter table public.pending_game_participants
  drop constraint if exists pending_game_participants_handle_format,
  drop constraint if exists pending_game_participants_gamer_name_length,
  drop column if exists handle,
  drop column if exists gamer_name;

alter table public.game_participants
  drop constraint if exists game_participants_handle_format,
  drop constraint if exists game_participants_gamer_name_length,
  drop column if exists handle,
  drop column if exists gamer_name;
