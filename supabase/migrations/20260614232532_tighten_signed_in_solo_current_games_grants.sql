revoke all on table public.signed_in_solo_current_games from anon;
revoke all on table public.signed_in_solo_current_games from authenticated;
revoke all on table public.signed_in_solo_current_games from service_role;

grant select, insert, update, delete
  on table public.signed_in_solo_current_games
  to authenticated;
grant select, insert, update, delete
  on table public.signed_in_solo_current_games
  to service_role;
