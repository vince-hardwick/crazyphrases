alter table public.pending_game_participants
  drop constraint if exists pending_game_participants_invite_status;

alter table public.pending_game_participants
  add constraint pending_game_participants_invite_status check (
    invite_status in ('accepted', 'pending', 'declined')
  );

alter table public.pending_game_participants
  drop constraint if exists pending_game_participants_role_status;

alter table public.pending_game_participants
  add constraint pending_game_participants_role_status check (
    (
      participant_role = 'creator'
      and invite_status = 'accepted'
      and account_id is not null
    )
    or (
      participant_role = 'invitee'
      and invite_status = 'pending'
      and account_id is null
    )
    or (
      participant_role = 'invitee'
      and invite_status = 'accepted'
      and account_id is not null
    )
    or (
      participant_role = 'invitee'
      and invite_status = 'declined'
      and account_id is not null
    )
  );

grant update (account_id, invite_status)
  on table public.pending_game_participants
  to authenticated;

drop policy if exists "Invitees can view their Pending Game invites"
  on public.pending_games;
create policy "Invitees can view their Pending Game invites"
  on public.pending_games
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.account_profiles
      where account_id = (select auth.uid())
        and profile_id = invitee_profile_id
    )
  );

drop policy if exists
  "Invitees can view participant rows for their Pending Game invites"
  on public.pending_game_participants;
create policy
  "Invitees can view participant rows for their Pending Game invites"
  on public.pending_game_participants
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.pending_games
      join public.account_profiles
        on account_profiles.profile_id = pending_games.invitee_profile_id
      where pending_games.id = pending_game_id
        and account_profiles.account_id = (select auth.uid())
    )
  );

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
    )
  );

create schema if not exists private;

create or replace function private.set_pending_game_participants_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.timezone('utc', pg_catalog.now());
  return new;
end;
$$;

revoke all on function private.set_pending_game_participants_updated_at()
  from public;

drop trigger if exists set_pending_game_participants_updated_at
  on public.pending_game_participants;
create trigger set_pending_game_participants_updated_at
  before update on public.pending_game_participants
  for each row
  execute function private.set_pending_game_participants_updated_at();

create or replace function private.cancel_pending_game_after_invite_decline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.pending_games
  set status = 'cancelled',
      updated_at = pg_catalog.timezone('utc', pg_catalog.now())
  where id = new.pending_game_id
    and status = 'pending';

  return new;
end;
$$;

revoke all on function private.cancel_pending_game_after_invite_decline()
  from public;

drop trigger if exists cancel_pending_game_after_invite_decline
  on public.pending_game_participants;
create trigger cancel_pending_game_after_invite_decline
  after update of invite_status on public.pending_game_participants
  for each row
  when (
    old.invite_status = 'pending'
    and new.invite_status = 'declined'
  )
  execute function private.cancel_pending_game_after_invite_decline();
