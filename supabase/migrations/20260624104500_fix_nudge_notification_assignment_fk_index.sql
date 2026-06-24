create index if not exists in_app_notifications_target_assignment_game_idx
  on public.in_app_notifications (target_assignment_id, target_game_id)
  where target_assignment_id is not null
    and target_game_id is not null;

drop index if exists public.in_app_notifications_target_assignment_id_idx;
