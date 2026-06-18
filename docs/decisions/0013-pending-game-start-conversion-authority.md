# 0013: Pending Game Start Conversion Authority

## Status

Accepted.

ADR 0015 supersedes this ADR's global Slot Order assumption for future
multiplayer execution. The game-start conversion authority and participant
snapshot rules remain accepted.

## Context

The Pending Game invite-response slice lets invitees accept or decline without
granting browser clients broad update authority on `public.pending_games`.

The next lifecycle boundary starts a multiplayer Game after every invited human
participant accepts. Starting must preserve Pending Game provenance, create a
durable Game instance, copy participant display snapshots, and resolve random
default-template Slot Allocation plus participant-local section order at start
time. It must not add assigned-section submission, Reveal, Share Consent,
expiry automation, creator cancellation UI, friends, nudges, or public
discovery.

The browser needs a creator-visible start action, but detecting the signed-in
Account, branch, host, or deployment target must not itself authorise mutation.
Mutation authority remains in Row Level Security, column grants, and private
database code.

## Decision

Game-start conversion is authorised through a narrow insert into
`public.games`.

Authenticated browser clients may insert only `pending_game_id` into
`public.games`. They do not receive update authority on
`public.pending_games`, and they do not supply participant snapshots, row count,
template id, Slot Allocation, or participant-local section order.

Row Level Security permits the insert only when the Pending Game belongs to the
signed-in Game Creator, still has `status = 'pending'`, and has no invited
participant rows left unaccepted. A unique `public.games.pending_game_id`
constraint prevents starting the same Pending Game twice.

Private-schema trigger functions then:

- lock and re-check the Pending Game;
- copy creator, template, row count, and participant snapshot data;
- resolve and store random default-template Slot Allocation and
  participant-local section order;
- create `public.game_participants` snapshot rows;
- mark the source Pending Game as `started` for provenance.

The migration grants `authenticated` `USAGE` on the private schema and
`EXECUTE` on the specific `private.is_started_game_participant(uuid, uuid)`
helper because RLS policies call it to avoid self-recursive participant-table
policies. Private trigger functions remain non-executable by browser roles, and
the private schema remains outside the Data API exposure boundary.

Browser-facing repository DTOs expose a Started Game shell with participant
display snapshots and setup-resolution flags only. They do not expose raw Auth
ids or hidden resolved Slot Allocation and participant-local section order
details to the creator.

## Consequences

- Starting a Game has a dedicated authority path instead of overloading invitee
  response updates or granting broad Pending Game mutation.
- Pending Game history remains queryable after conversion through a terminal
  `started` status and a one-to-one Game reference.
- Random allocation and participant-local order become durable Game-instance
  state at the correct lifecycle moment.
- The current UI can show that the Game has started while honestly leaving
  turns, entries, and Reveal unavailable.
- Hosted migration application remains a live backend mutation and requires
  explicit owner approval or the documented deployment workflow gate.
