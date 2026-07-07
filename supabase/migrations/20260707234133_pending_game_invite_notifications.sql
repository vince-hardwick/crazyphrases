alter table public.in_app_notifications
  drop constraint if exists in_app_notifications_type;

alter table public.in_app_notifications
  add constraint in_app_notifications_type check (
    notification_type in ('entries_needed', 'batch_complete', 'game_cancelled', 'nudge', 'game_invite')
  );

create schema if not exists private;

create or replace function private.create_pending_game_invite_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $create_pending_game_invite_notification$
begin
  insert into public.in_app_notifications (
    account_id,
    notification_type,
    notification_status,
    message,
    target_pending_game_id
  )
  select
    invitee.account_id,
    'game_invite',
    'unread',
    creator.gamer_tag || ' invited you to a multiplayer game.',
    new.id
  from public.account_profiles as creator
  join public.account_profiles as invitee
    on invitee.profile_id = new.invitee_profile_id
  where creator.account_id = new.creator_account_id
    and creator.profile_id = new.creator_profile_id
    and invitee.account_id <> new.creator_account_id
  on conflict do nothing;

  return new;
end;
$create_pending_game_invite_notification$;

revoke all on function private.create_pending_game_invite_notification()
  from public;
revoke all on function private.create_pending_game_invite_notification()
  from anon;
revoke all on function private.create_pending_game_invite_notification()
  from authenticated;
revoke all on function private.create_pending_game_invite_notification()
  from service_role;

drop trigger if exists create_pending_game_invite_notification
  on public.pending_games;
create trigger create_pending_game_invite_notification
  after insert on public.pending_games
  for each row
  execute function private.create_pending_game_invite_notification();
