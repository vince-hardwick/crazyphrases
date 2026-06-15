create table if not exists public.private_batch_favourites (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users (id) on delete cascade,
  favourite jsonb not null,
  source_fingerprint text not null,
  created_at timestamp with time zone not null default timezone('utc', now()),
  constraint private_batch_favourites_account_source_unique
    unique (account_id, source_fingerprint),
  constraint private_batch_favourites_valid_snapshot check (
    jsonb_typeof(favourite) = 'object'
    and favourite ->> 'type' = 'batch'
    and favourite ->> 'sourceMode' = 'signed-in-solo'
    and favourite ->> 'templateId' = 'default-adjective-noun-noun'
    and favourite ->> 'rowCount' ~ '^[1-9][0-9]*$'
    and jsonb_typeof(favourite -> 'phrases') = 'array'
    and jsonb_typeof(favourite -> 'rows') = 'array'
    and case
      when jsonb_typeof(favourite -> 'phrases') = 'array'
        and jsonb_typeof(favourite -> 'rows') = 'array'
        and favourite ->> 'rowCount' ~ '^[1-9][0-9]*$'
      then jsonb_array_length(favourite -> 'phrases') = (favourite ->> 'rowCount')::integer
        and jsonb_array_length(favourite -> 'rows') = (favourite ->> 'rowCount')::integer
      else false
    end
  )
);

alter table public.private_batch_favourites enable row level security;

revoke all on table public.private_batch_favourites from anon;
revoke all on table public.private_batch_favourites from authenticated;
revoke all on table public.private_batch_favourites from service_role;

grant select, insert, delete
  on table public.private_batch_favourites
  to authenticated;
grant select, insert, delete
  on table public.private_batch_favourites
  to service_role;

drop policy if exists
  "Account holders can view their private Batch Favourites."
  on public.private_batch_favourites;
create policy "Account holders can view their private Batch Favourites."
  on public.private_batch_favourites
  for select
  to authenticated
  using ((select auth.uid()) = account_id);

drop policy if exists
  "Account holders can create their private Batch Favourites."
  on public.private_batch_favourites;
create policy "Account holders can create their private Batch Favourites."
  on public.private_batch_favourites
  for insert
  to authenticated
  with check ((select auth.uid()) = account_id);

drop policy if exists
  "Account holders can delete their private Batch Favourites."
  on public.private_batch_favourites;
create policy "Account holders can delete their private Batch Favourites."
  on public.private_batch_favourites
  for delete
  to authenticated
  using ((select auth.uid()) = account_id);
