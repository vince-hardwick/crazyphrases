alter default privileges in schema public
  revoke execute on functions from public;
alter default privileges in schema public
  revoke execute on functions from anon, authenticated;

create schema if not exists private;
grant usage on schema private to authenticated;

alter function public.cancel_created_game(uuid)
  set schema private;
alter function public.list_completed_multiplayer_history(integer, bigint, uuid)
  set schema private;
alter function public.list_multiplayer_dashboard()
  set schema private;
alter function public.lookup_account_profile(text, text)
  set schema private;
alter function public.reveal_multiplayer_batch(uuid)
  set schema private;
alter function public.submit_multiplayer_section(uuid, jsonb)
  set schema private;

revoke all on function private.cancel_created_game(uuid)
  from public, anon, service_role;
revoke all on function private.list_completed_multiplayer_history(integer, bigint, uuid)
  from public, anon, service_role;
revoke all on function private.list_multiplayer_dashboard()
  from public, anon, service_role;
revoke all on function private.lookup_account_profile(text, text)
  from public, anon, service_role;
revoke all on function private.reveal_multiplayer_batch(uuid)
  from public, anon, service_role;
revoke all on function private.submit_multiplayer_section(uuid, jsonb)
  from public, anon, service_role;

grant execute on function private.cancel_created_game(uuid)
  to authenticated;
grant execute on function private.list_completed_multiplayer_history(integer, bigint, uuid)
  to authenticated;
grant execute on function private.list_multiplayer_dashboard()
  to authenticated;
grant execute on function private.lookup_account_profile(text, text)
  to authenticated;
grant execute on function private.reveal_multiplayer_batch(uuid)
  to authenticated;
grant execute on function private.submit_multiplayer_section(uuid, jsonb)
  to authenticated;

create or replace function public.lookup_account_profile(
  lookup_key text,
  lookup_kind text
)
returns table (
  profile_id uuid,
  gamer_tag text,
  avatar_type text,
  avatar_key text,
  avatar_object_path text
)
language sql
stable
security invoker
set search_path = ''
as $lookup_account_profile_public_wrapper$
  select *
  from private.lookup_account_profile(lookup_key, lookup_kind);
$lookup_account_profile_public_wrapper$;

create or replace function public.list_multiplayer_dashboard()
returns jsonb
language sql
security invoker
set search_path = ''
as $list_multiplayer_dashboard_public_wrapper$
  select private.list_multiplayer_dashboard();
$list_multiplayer_dashboard_public_wrapper$;

create or replace function public.list_completed_multiplayer_history(
  page_size integer default 20,
  after_completed_order bigint default null,
  after_game_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $list_completed_multiplayer_history_public_wrapper$
  select private.list_completed_multiplayer_history(
    page_size,
    after_completed_order,
    after_game_id
  );
$list_completed_multiplayer_history_public_wrapper$;

create or replace function public.submit_multiplayer_section(
  target_assignment_id uuid,
  submitted_entries jsonb
)
returns table (
  assignment_id uuid,
  game_id uuid,
  status text
)
language sql
security invoker
set search_path = ''
as $submit_multiplayer_section_public_wrapper$
  select *
  from private.submit_multiplayer_section(
    target_assignment_id,
    submitted_entries
  );
$submit_multiplayer_section_public_wrapper$;

create or replace function public.reveal_multiplayer_batch(
  target_game_id uuid
)
returns table (
  game_id uuid,
  phrases jsonb,
  revealed boolean
)
language sql
security invoker
set search_path = ''
as $reveal_multiplayer_batch_public_wrapper$
  select *
  from private.reveal_multiplayer_batch(target_game_id);
$reveal_multiplayer_batch_public_wrapper$;

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
language sql
security invoker
set search_path = ''
as $cancel_created_game_public_wrapper$
  select *
  from private.cancel_created_game(target_pending_game_id);
$cancel_created_game_public_wrapper$;

revoke all on function public.cancel_created_game(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.list_completed_multiplayer_history(integer, bigint, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.list_multiplayer_dashboard()
  from public, anon, authenticated, service_role;
revoke all on function public.lookup_account_profile(text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.reveal_multiplayer_batch(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.submit_multiplayer_section(uuid, jsonb)
  from public, anon, authenticated, service_role;

grant execute on function public.cancel_created_game(uuid)
  to authenticated;
grant execute on function public.list_completed_multiplayer_history(integer, bigint, uuid)
  to authenticated;
grant execute on function public.list_multiplayer_dashboard()
  to authenticated;
grant execute on function public.lookup_account_profile(text, text)
  to authenticated;
grant execute on function public.reveal_multiplayer_batch(uuid)
  to authenticated;
grant execute on function public.submit_multiplayer_section(uuid, jsonb)
  to authenticated;

drop policy if exists "No direct browser access to game_entries"
  on public.game_entries;
create policy "No direct browser access to game_entries"
  on public.game_entries
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No direct browser access to game_section_assignments"
  on public.game_section_assignments;
create policy "No direct browser access to game_section_assignments"
  on public.game_section_assignments
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No direct browser access to game_section_entries"
  on public.game_section_entries;
create policy "No direct browser access to game_section_entries"
  on public.game_section_entries
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No direct browser access to game_turns"
  on public.game_turns;
create policy "No direct browser access to game_turns"
  on public.game_turns
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No direct browser access to multiplayer_batch_reveals"
  on public.multiplayer_batch_reveals;
create policy "No direct browser access to multiplayer_batch_reveals"
  on public.multiplayer_batch_reveals
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "Account holders can view relevant Pending Games"
  on public.pending_games;
drop policy if exists "Account holders can view their created Pending Games"
  on public.pending_games;
drop policy if exists "Invitees can view their Pending Game invites"
  on public.pending_games;

create policy "Account holders can view relevant Pending Games"
  on public.pending_games
  for select
  to authenticated
  using (
    ((select auth.uid()) = creator_account_id)
    or exists (
      select 1
      from public.account_profiles as profile
      where profile.account_id = (select auth.uid())
        and profile.profile_id = pending_games.invitee_profile_id
    )
  );

drop policy if exists "Account holders can view relevant Pending Game participants"
  on public.pending_game_participants;
drop policy if exists
  "Account holders can view participant rows for their created Pending Games"
  on public.pending_game_participants;
drop policy if exists
  "Invitees can view participant rows for their Pending Game invites"
  on public.pending_game_participants;

create policy "Account holders can view relevant Pending Game participants"
  on public.pending_game_participants
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.pending_games as pending_game
      where pending_game.id = pending_game_participants.pending_game_id
        and (
          pending_game.creator_account_id = (select auth.uid())
          or exists (
            select 1
            from public.account_profiles as profile
            where profile.account_id = (select auth.uid())
              and profile.profile_id = pending_game.invitee_profile_id
          )
        )
    )
  );

drop index if exists public.game_section_entries_assignment_id_idx;
drop index if exists public.game_turns_participant_profile_id_idx;
drop index if exists public.games_creator_profile_id_idx;
