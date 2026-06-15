create table if not exists public.private_phrase_favourites (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users (id) on delete cascade,
  favourite jsonb not null,
  source_fingerprint text not null,
  created_at timestamp with time zone not null default timezone('utc', now()),
  constraint private_phrase_favourites_account_source_unique
    unique (account_id, source_fingerprint),
  constraint private_phrase_favourites_valid_snapshot check (
    jsonb_typeof(favourite) = 'object'
    and favourite ->> 'type' = 'phrase'
    and favourite ->> 'sourceMode' = 'signed-in-solo'
    and favourite ->> 'templateId' = 'default-adjective-noun-noun'
    and char_length(btrim(favourite ->> 'phraseText')) > 0
  )
);

alter table public.private_phrase_favourites enable row level security;

revoke all on table public.private_phrase_favourites from anon;
revoke all on table public.private_phrase_favourites from authenticated;
revoke all on table public.private_phrase_favourites from service_role;

grant select, insert, delete
  on table public.private_phrase_favourites
  to authenticated;
grant select, insert, delete
  on table public.private_phrase_favourites
  to service_role;

drop policy if exists
  "Account holders can view their private Phrase Favourites."
  on public.private_phrase_favourites;
create policy "Account holders can view their private Phrase Favourites."
  on public.private_phrase_favourites
  for select
  to authenticated
  using ((select auth.uid()) = account_id);

drop policy if exists
  "Account holders can create their private Phrase Favourites."
  on public.private_phrase_favourites;
create policy "Account holders can create their private Phrase Favourites."
  on public.private_phrase_favourites
  for insert
  to authenticated
  with check ((select auth.uid()) = account_id);

drop policy if exists
  "Account holders can delete their private Phrase Favourites."
  on public.private_phrase_favourites;
create policy "Account holders can delete their private Phrase Favourites."
  on public.private_phrase_favourites
  for delete
  to authenticated
  using ((select auth.uid()) = account_id);
