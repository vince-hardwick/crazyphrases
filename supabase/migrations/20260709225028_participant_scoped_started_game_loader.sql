create schema if not exists private;

grant usage on schema private to authenticated;

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
  from public;
revoke all on function private.load_game_play_surface(uuid)
  from anon;
revoke all on function private.load_game_play_surface(uuid)
  from service_role;
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
