create index if not exists game_section_entries_assignment_game_idx
  on public.game_section_entries (assignment_id, game_id);

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
  on conflict on constraint multiplayer_batch_reveals_game_id_participant_profile_id_key
  do nothing;

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
