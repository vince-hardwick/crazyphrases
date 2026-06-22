create or replace function public.list_completed_multiplayer_history()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  history_account_id uuid := (select auth.uid());
  history jsonb;
begin
  if history_account_id is null then
    return pg_catalog.jsonb_build_object('batches', '[]'::jsonb);
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
      'batches',
        coalesce(
          (
            select pg_catalog.jsonb_agg(item order by completed_at desc)
            from (
              select item, completed_at
              from completed_batches
              order by completed_at desc
              limit 20
            ) as first_completed_history_page
          ),
          '[]'::jsonb
        )
    )
    into history;

  return history;
end;
$$;

revoke all on function public.list_completed_multiplayer_history()
  from public;
revoke all on function public.list_completed_multiplayer_history()
  from anon;
revoke all on function public.list_completed_multiplayer_history()
  from authenticated;
revoke all on function public.list_completed_multiplayer_history()
  from service_role;
grant execute on function public.list_completed_multiplayer_history()
  to authenticated;
