drop function if exists public.list_completed_multiplayer_history();

create or replace function public.list_completed_multiplayer_history(
  page_size integer default 20,
  after_completed_order bigint default null,
  after_game_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
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
      game_row.id as game_id,
      (
        pg_catalog.extract(epoch from max(assignment.submitted_at)) * 1000000
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
$$;

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
