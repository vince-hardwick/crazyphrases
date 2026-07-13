create schema if not exists private;

create table if not exists private.word_bank_shard_registry (
  entry_kind text primary key,
  version text not null,
  asset_path text not null,
  candidate_count integer not null,
  family_friendly boolean not null,
  source_id text not null,
  source_version text not null,
  constraint word_bank_shard_registry_entry_kind check (
    entry_kind in ('adjective', 'noun')
  ),
  constraint word_bank_shard_registry_version check (
    pg_catalog.btrim(version) <> ''
  ),
  constraint word_bank_shard_registry_asset_path check (
    asset_path ~ '^assets/word-bank/shards/[a-z0-9.-]+[.]json$'
  ),
  constraint word_bank_shard_registry_candidate_count check (
    candidate_count > 0
  ),
  constraint word_bank_shard_registry_family_friendly check (
    family_friendly = true
  ),
  constraint word_bank_shard_registry_source_id check (
    pg_catalog.btrim(source_id) <> ''
  ),
  constraint word_bank_shard_registry_source_version check (
    pg_catalog.btrim(source_version) <> ''
  )
);

alter table private.word_bank_shard_registry enable row level security;

revoke all on table private.word_bank_shard_registry from public, anon, authenticated, service_role;

insert into private.word_bank_shard_registry (
  entry_kind,
  version,
  asset_path,
  candidate_count,
  family_friendly,
  source_id,
  source_version
)
values
  (
    'adjective',
    '2026-07-05-esdb-v2-1e5b7d3-tracer',
    'assets/word-bank/shards/adjective.2026-07-05-esdb-v2-1e5b7d3-tracer.json',
    114,
    true,
    'esdb-scowl-v2',
    '1e5b7d3a72f47a71da5d28686c1dd4b397178485'
  ),
  (
    'noun',
    '2026-07-05-esdb-v2-1e5b7d3-noun-tracer',
    'assets/word-bank/shards/noun.2026-07-05-esdb-v2-1e5b7d3-noun-tracer.json',
    240,
    true,
    'esdb-scowl-v2',
    '1e5b7d3a72f47a71da5d28686c1dd4b397178485'
  )
on conflict (entry_kind) do update
set version = excluded.version,
    asset_path = excluded.asset_path,
    candidate_count = excluded.candidate_count,
    family_friendly = excluded.family_friendly,
    source_id = excluded.source_id,
    source_version = excluded.source_version;

alter table public.games
  add column if not exists entry_candidate_snapshot jsonb;

create or replace function private.build_default_entry_candidate_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $build_default_entry_candidate_snapshot$
  select case
    when count(*) = 2
      and count(*) filter (
        where entry_kind in ('adjective', 'noun')
          and family_friendly = true
      ) = 2
    then pg_catalog.jsonb_build_object(
      'schemaVersion', 1,
      'entryKinds', pg_catalog.jsonb_object_agg(
        entry_kind,
        pg_catalog.jsonb_build_object(
          'entryKind', entry_kind,
          'version', version,
          'path', asset_path,
          'candidateCount', candidate_count,
          'familyFriendly', family_friendly,
          'sourceId', source_id,
          'sourceVersion', source_version
        )
        order by entry_kind
      )
    )
    else null
  end
  from private.word_bank_shard_registry;
$build_default_entry_candidate_snapshot$;

revoke all on function private.build_default_entry_candidate_snapshot()
  from public, anon, authenticated, service_role;

create or replace function private.pin_started_game_entry_candidate_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $pin_started_game_entry_candidate_snapshot$
declare
  caller_account_id uuid := (select auth.uid());
  approved_snapshot jsonb;
begin
  if (select auth.uid()) is null or caller_account_id is null then
    raise exception 'An authenticated Account is required to start a Game.'
      using errcode = '42501';
  end if;

  if new.entry_candidate_snapshot is not null then
    raise exception 'Entry candidate snapshots are server-owned.'
      using errcode = '42501';
  end if;

  approved_snapshot := private.build_default_entry_candidate_snapshot();
  if approved_snapshot is null then
    raise exception 'Approved Entry Assist shard references are unavailable.';
  end if;

  new.entry_candidate_snapshot = approved_snapshot;
  return new;
end;
$pin_started_game_entry_candidate_snapshot$;

revoke all on function private.pin_started_game_entry_candidate_snapshot()
  from public, anon, authenticated, service_role;

drop trigger if exists pin_started_game_entry_candidate_snapshot
  on public.games;
create trigger pin_started_game_entry_candidate_snapshot
  before insert on public.games
  for each row
  execute function private.pin_started_game_entry_candidate_snapshot();

update public.games
set entry_candidate_snapshot = private.build_default_entry_candidate_snapshot()
where entry_candidate_snapshot is null;

do $entry_candidate_snapshot_constraint$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'games_entry_candidate_snapshot_shape'
      and conrelid = 'public.games'::pg_catalog.regclass
  ) then
    alter table public.games
      add constraint games_entry_candidate_snapshot_shape check (
        pg_catalog.jsonb_typeof(entry_candidate_snapshot) = 'object'
        and entry_candidate_snapshot ->> 'schemaVersion' = '1'
        and pg_catalog.jsonb_typeof(entry_candidate_snapshot -> 'entryKinds') = 'object'
        and entry_candidate_snapshot -> 'entryKinds' ?& array['adjective', 'noun']
        and (
          entry_candidate_snapshot -> 'entryKinds' - 'adjective' - 'noun'
        ) = '{}'::jsonb
        and entry_candidate_snapshot -> 'entryKinds' -> 'adjective'
          ->> 'entryKind' = 'adjective'
        and entry_candidate_snapshot -> 'entryKinds' -> 'adjective'
          ->> 'familyFriendly' = 'true'
        and entry_candidate_snapshot -> 'entryKinds' -> 'noun'
          ->> 'entryKind' = 'noun'
        and entry_candidate_snapshot -> 'entryKinds' -> 'noun'
          ->> 'familyFriendly' = 'true'
      );
  end if;
end;
$entry_candidate_snapshot_constraint$;

alter table public.games
  alter column entry_candidate_snapshot set not null;

create or replace function private.load_game_play_surface(
  target_game_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $load_game_play_surface$
declare
  caller_account_id uuid := (select auth.uid());
  caller_profile_id uuid;
  current_section public.game_section_assignments%rowtype;
  game_summary jsonb;
  section_count integer;
  target_game public.games%rowtype;
  target_pending_game public.pending_games%rowtype;
begin
  if caller_account_id is null then
    return pg_catalog.jsonb_build_object('state', 'unavailable');
  end if;

  select profile.profile_id
    into caller_profile_id
  from public.account_profiles as profile
  where profile.account_id = caller_account_id;

  if caller_profile_id is null then
    return pg_catalog.jsonb_build_object('state', 'unavailable');
  end if;

  select game_row.*
    into target_game
  from public.games as game_row
  where game_row.id = target_game_id;

  if target_game.id is null then
    return pg_catalog.jsonb_build_object('state', 'unavailable');
  end if;

  if not exists (
    select 1
    from public.game_participants as participant
    where participant.game_id = target_game_id
      and participant.profile_id = caller_profile_id
  ) then
    return pg_catalog.jsonb_build_object('state', 'unavailable');
  end if;

  select pending_game.*
    into target_pending_game
  from public.pending_games as pending_game
  where pending_game.id = target_game.pending_game_id;

  if target_pending_game.id is null then
    return pg_catalog.jsonb_build_object('state', 'unavailable');
  end if;

  select pg_catalog.jsonb_build_object(
      'id', target_game.id,
      'rowCount', target_game.row_count,
      'participants', coalesce(
        (
          select pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object('gamerTag', participant.gamer_tag)
            order by
              case participant.participant_role
                when 'creator' then 0
                else 1
              end,
              participant.gamer_tag
          )
          from public.game_participants as participant
          where participant.game_id = target_game_id
        ),
        '[]'::jsonb
      )
    )
    into game_summary;

  if target_pending_game.status = 'cancelled' then
    return pg_catalog.jsonb_build_object(
      'state', 'cancelled',
      'game', game_summary
    );
  end if;

  if target_pending_game.status <> 'started' then
    return pg_catalog.jsonb_build_object('state', 'unavailable');
  end if;

  select assignment.*
    into current_section
  from private.current_game_section_assignment(
    target_game_id,
    caller_profile_id
  ) as assignment;

  if current_section.id is not null then
    select count(*)::integer
      into section_count
    from public.game_section_assignments as assignment
    where assignment.game_id = target_game_id
      and assignment.participant_profile_id = caller_profile_id;

    return pg_catalog.jsonb_build_object(
      'state', 'active',
      'game', game_summary,
      'currentSection', pg_catalog.jsonb_build_object(
        'id', current_section.id,
        'entryKind', current_section.entry_kind,
        'sectionIndex', current_section.participant_section_index,
        'sectionCount', section_count,
        'entryAssist',
        case
          when target_game.entry_candidate_snapshot
            -> 'entryKinds' ? current_section.entry_kind then
            pg_catalog.jsonb_build_object(
              'state', 'available',
              'reference', target_game.entry_candidate_snapshot
                -> 'entryKinds' -> current_section.entry_kind
            )
          else pg_catalog.jsonb_build_object('state', 'unavailable')
        end,
        'rows', coalesce(
          (
            select pg_catalog.jsonb_agg(
              pg_catalog.jsonb_build_object(
                'rowIndex', row_number.row_index,
                'value', ''
              )
              order by row_number.row_index
            )
            from pg_catalog.generate_series(
              0,
              current_section.row_count - 1
            ) as row_number(row_index)
          ),
          '[]'::jsonb
        )
      )
    );
  end if;

  if not private.multiplayer_batch_is_complete(target_game_id) then
    return pg_catalog.jsonb_build_object(
      'state', 'waiting',
      'game', game_summary
    );
  end if;

  if exists (
    select 1
    from public.multiplayer_batch_reveals as reveal
    where reveal.game_id = target_game_id
      and reveal.participant_profile_id = caller_profile_id
  ) then
    return pg_catalog.jsonb_build_object(
      'state', 'revealed',
      'game', game_summary,
      'phrases', private.render_multiplayer_phrases(target_game_id)
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'state', 'completed',
    'game', game_summary
  );
end;
$load_game_play_surface$;

revoke all on function private.load_game_play_surface(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.load_game_play_surface(uuid)
  to authenticated;

create or replace function public.load_game_play_surface(
  target_game_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $load_game_play_surface_public_wrapper$
  select private.load_game_play_surface(target_game_id);
$load_game_play_surface_public_wrapper$;

revoke all on function public.load_game_play_surface(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.load_game_play_surface(uuid)
  to authenticated;
