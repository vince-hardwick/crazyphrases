create schema if not exists private;

create or replace function private.set_signed_in_solo_current_games_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.timezone('utc', pg_catalog.now());
  return new;
end;
$$;

revoke all on function private.set_signed_in_solo_current_games_updated_at() from public;

drop trigger if exists set_signed_in_solo_current_games_updated_at
  on public.signed_in_solo_current_games;

create trigger set_signed_in_solo_current_games_updated_at
  before update on public.signed_in_solo_current_games
  for each row
  execute function private.set_signed_in_solo_current_games_updated_at();
