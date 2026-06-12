create table if not exists public.signed_in_solo_current_games (
  account_id uuid primary key references auth.users (id) on delete cascade,
  game jsonb not null,
  revision integer not null default 1 check (revision >= 1),
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  constraint signed_in_solo_current_games_valid_game check (
    jsonb_typeof(game) = 'object'
    and game ->> 'mode' = 'signed-in-solo'
    and game ->> 'accountId' = account_id::text
    and (game ->> 'started')::boolean is true
  )
);

alter table public.signed_in_solo_current_games enable row level security;

revoke all on table public.signed_in_solo_current_games from anon;
grant select, insert, update, delete
  on table public.signed_in_solo_current_games
  to authenticated;
grant select, insert, update, delete
  on table public.signed_in_solo_current_games
  to service_role;

drop policy if exists
  "Account holders can view their current signed-in Solo Game."
  on public.signed_in_solo_current_games;
create policy "Account holders can view their current signed-in Solo Game."
  on public.signed_in_solo_current_games
  for select
  to authenticated
  using ((select auth.uid()) = account_id);

drop policy if exists
  "Account holders can create their current signed-in Solo Game."
  on public.signed_in_solo_current_games;
create policy "Account holders can create their current signed-in Solo Game."
  on public.signed_in_solo_current_games
  for insert
  to authenticated
  with check ((select auth.uid()) = account_id);

drop policy if exists
  "Account holders can update their current signed-in Solo Game."
  on public.signed_in_solo_current_games;
create policy "Account holders can update their current signed-in Solo Game."
  on public.signed_in_solo_current_games
  for update
  to authenticated
  using ((select auth.uid()) = account_id)
  with check ((select auth.uid()) = account_id);

drop policy if exists
  "Account holders can delete their current signed-in Solo Game."
  on public.signed_in_solo_current_games;
create policy "Account holders can delete their current signed-in Solo Game."
  on public.signed_in_solo_current_games
  for delete
  to authenticated
  using ((select auth.uid()) = account_id);
