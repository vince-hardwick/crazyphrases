create table if not exists public.game_turns (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null
    references public.games (id)
    on delete cascade,
  turn_index integer not null,
  slot_id text not null,
  entry_kind text not null,
  participant_profile_id uuid not null,
  row_count integer not null,
  status text not null default 'active',
  submitted_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  unique (game_id, turn_index),
  unique (game_id, slot_id),
  constraint game_turns_turn_index check (
    turn_index between 0 and 2
  ),
  constraint game_turns_slot_id check (
    slot_id in ('adjective', 'noun-1', 'noun-2')
  ),
  constraint game_turns_entry_kind check (
    entry_kind in ('adjective', 'noun')
  ),
  constraint game_turns_row_count check (
    row_count in (10, 15, 20, 25, 30)
  ),
  constraint game_turns_status check (
    status in ('active', 'submitted')
  ),
  constraint game_turns_submitted_at check (
    (
      status = 'active'
      and submitted_at is null
    )
    or (
      status = 'submitted'
      and submitted_at is not null
    )
  )
);

create table if not exists public.game_entries (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null
    references public.games (id)
    on delete cascade,
  turn_id uuid not null
    references public.game_turns (id)
    on delete cascade,
  row_index integer not null,
  value text not null,
  created_at timestamp with time zone not null default timezone('utc', now()),
  unique (turn_id, row_index),
  constraint game_entries_row_index check (
    row_index >= 0
  ),
  constraint game_entries_value_length check (
    char_length(btrim(value)) between 1 and 80
  )
);

create index if not exists game_turns_game_id_idx
  on public.game_turns (game_id);
create index if not exists game_turns_participant_profile_id_idx
  on public.game_turns (participant_profile_id);
create index if not exists game_turns_active_order_idx
  on public.game_turns (game_id, status, turn_index);
create index if not exists game_entries_game_id_idx
  on public.game_entries (game_id);
create index if not exists game_entries_turn_id_idx
  on public.game_entries (turn_id);

alter table public.game_turns enable row level security;
alter table public.game_entries enable row level security;

revoke all on table public.game_turns from public;
revoke all on table public.game_turns from anon;
revoke all on table public.game_turns from authenticated;
revoke all on table public.game_turns from service_role;
revoke all on table public.game_entries from public;
revoke all on table public.game_entries from anon;
revoke all on table public.game_entries from authenticated;
revoke all on table public.game_entries from service_role;

grant select on table public.game_turns to authenticated;
grant select, insert, update on table public.game_turns to service_role;
grant select, insert on table public.game_entries to service_role;

create schema if not exists private;

create or replace function private.is_active_started_game_turn_assignee(
  target_turn_id uuid,
  target_account_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.game_turns as turn
    join public.game_participants as participant
      on participant.game_id = turn.game_id
     and participant.profile_id = turn.participant_profile_id
    where turn.id = target_turn_id
      and turn.status = 'active'
      and participant.account_id = target_account_id
      and not exists (
        select 1
        from public.game_turns as earlier_turn
        where earlier_turn.game_id = turn.game_id
          and earlier_turn.turn_index < turn.turn_index
          and earlier_turn.status <> 'submitted'
      )
  );
$$;

revoke all on function private.is_active_started_game_turn_assignee(uuid, uuid)
  from public;
revoke all on function private.is_active_started_game_turn_assignee(uuid, uuid)
  from anon;
grant execute on function private.is_active_started_game_turn_assignee(uuid, uuid)
  to authenticated;

drop policy if exists "Participants can view their active Started Game Turns"
  on public.game_turns;
create policy "Participants can view their active Started Game Turns"
  on public.game_turns
  for select
  to authenticated
  using (
    private.is_active_started_game_turn_assignee(
      public.game_turns.id,
      (select auth.uid())
    )
  );

create or replace function private.create_started_game_turns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.game_turns (
    game_id,
    turn_index,
    slot_id,
    entry_kind,
    participant_profile_id,
    row_count
  )
  select
    new.id,
    (ordered_slot.ordinality - 1)::integer,
    ordered_slot.value ->> 'slot_id',
    ordered_slot.value ->> 'entry_kind',
    (allocated_slot.value ->> 'participant_profile_id')::uuid,
    new.row_count
  from pg_catalog.jsonb_array_elements(new.slot_order) with ordinality
    as ordered_slot(value, ordinality)
  join pg_catalog.jsonb_array_elements(new.slot_allocation)
    as allocated_slot(value)
    on allocated_slot.value ->> 'slot_id' = ordered_slot.value ->> 'slot_id'
  order by ordered_slot.ordinality;

  return new;
end;
$$;

revoke all on function private.create_started_game_turns()
  from public;
revoke all on function private.create_started_game_turns()
  from anon;
revoke all on function private.create_started_game_turns()
  from authenticated;

drop trigger if exists create_started_game_turns
  on public.games;
create trigger create_started_game_turns
  after insert on public.games
  for each row
  execute function private.create_started_game_turns();

insert into public.game_turns (
  game_id,
  turn_index,
  slot_id,
  entry_kind,
  participant_profile_id,
  row_count
)
select
  game_row.id,
  (ordered_slot.ordinality - 1)::integer,
  ordered_slot.value ->> 'slot_id',
  ordered_slot.value ->> 'entry_kind',
  (allocated_slot.value ->> 'participant_profile_id')::uuid,
  game_row.row_count
from public.games as game_row
cross join lateral pg_catalog.jsonb_array_elements(game_row.slot_order)
  with ordinality as ordered_slot(value, ordinality)
join lateral pg_catalog.jsonb_array_elements(game_row.slot_allocation)
  as allocated_slot(value)
  on allocated_slot.value ->> 'slot_id' = ordered_slot.value ->> 'slot_id'
on conflict (game_id, turn_index) do nothing;

create or replace function public.submit_started_game_turn(
  target_turn_id uuid,
  submitted_entries jsonb
)
returns table (
  turn_id uuid,
  game_id uuid,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_turn public.game_turns%rowtype;
  submitted_count integer;
  distinct_row_count integer;
  valid_row_count integer;
begin
  select *
    into target_turn
  from public.game_turns
  where id = target_turn_id
  for update;

  if target_turn.id is null then
    raise exception 'Started Game Turn was not found.';
  end if;

  if not private.is_active_started_game_turn_assignee(
    target_turn_id,
    (select auth.uid())
  ) then
    raise exception 'Started Game Turn is not active for this Account.'
      using errcode = '42501';
  end if;

  if target_turn.status <> 'active' then
    raise exception 'Started Game Turn has already been submitted.';
  end if;

  if pg_catalog.jsonb_typeof(submitted_entries) <> 'array' then
    raise exception 'Submit one Entry for every row.';
  end if;

  with payload as (
    select
      (entry.value ->> 'rowIndex')::integer as row_index,
      pg_catalog.btrim(entry.value ->> 'value') as value
    from pg_catalog.jsonb_array_elements(submitted_entries) as entry(value)
  )
  select
    count(*),
    count(distinct row_index),
    count(*) filter (
      where row_index >= 0
        and row_index < target_turn.row_count
        and value <> ''
        and char_length(value) <= 80
    )
    into submitted_count,
         distinct_row_count,
         valid_row_count
  from payload;

  if submitted_count <> target_turn.row_count
     or distinct_row_count <> target_turn.row_count
     or valid_row_count <> target_turn.row_count then
    raise exception 'Submit one Entry for every row.';
  end if;

  insert into public.game_entries (
    game_id,
    turn_id,
    row_index,
    value
  )
  select
    target_turn.game_id,
    target_turn.id,
    payload.row_index,
    payload.value
  from (
    select
      (entry.value ->> 'rowIndex')::integer as row_index,
      pg_catalog.btrim(entry.value ->> 'value') as value
    from pg_catalog.jsonb_array_elements(submitted_entries) as entry(value)
  ) as payload
  order by payload.row_index;

  update public.game_turns
  set status = 'submitted',
      submitted_at = pg_catalog.timezone('utc', pg_catalog.now()),
      updated_at = pg_catalog.timezone('utc', pg_catalog.now())
  where id = target_turn.id;

  return query
  select
    target_turn.id,
    target_turn.game_id,
    'submitted'::text;
end;
$$;

revoke all on function public.submit_started_game_turn(uuid, jsonb)
  from public;
revoke all on function public.submit_started_game_turn(uuid, jsonb)
  from anon;
grant execute on function public.submit_started_game_turn(uuid, jsonb)
  to authenticated;
