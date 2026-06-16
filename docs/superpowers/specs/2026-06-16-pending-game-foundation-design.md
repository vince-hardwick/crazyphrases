# Pending Game Foundation Design

## Status

Approved by owner on 2026-06-16; implementation tracked by this branch.

## Problem

Crazy Phrases now has signed-in Accounts, durable Account Profiles, and an
invite-safe Handle Directory, but there is no source-controlled foundation for
starting a signed-in 2-player asynchronous Game. The first multiplayer slice
needs to create a Pending Game from a handle invite without taking on invite
acceptance, turn completion, Reveal, Share Consent, nudges, friends, public
discovery, or profile editing.

## Scope

This slice adds a source-controlled backend foundation only:

- a Pending Game repository contract with memory and Supabase adapters;
- a Supabase migration for relational Pending Game storage;
- tests for repository behaviour and migration security surface;
- project documentation updates for the new source-controlled boundary.

It does not add UI, apply hosted Supabase migrations, mutate live data, deploy
Edge Functions, create GitHub deployment runs, or perform browser smoke tests
unless later code changes touch the browser flow.

## Public Interface

Add `assets/pending-game.js` with:

- `createTestPendingGameRepository()`;
- `createSupabasePendingGameRepository({ supabase })`;
- `createPendingGameFromHandle({ creatorAccountId, inviteeHandle, rowCount })`.

The repository returns a browser-safe Pending Game DTO. The DTO includes the
Pending Game id, status, row count, participant snapshots, and invited handle
metadata. It must not expose raw Supabase Auth user ids for invited
participants.

`createTestPendingGameRepository()` is a provider-independent test fixture for
automated repository tests. It must not be wired into anonymous play,
production browser code, local browser smoke routes, or any runtime path that
would allow anonymous users to create invites without signed-in Supabase-backed
state.

Errors are explicit:

- missing invitee handle;
- creator inviting their own profile;
- invalid row count;
- Supabase/Data API failure.

## Data Model

Use relational tables rather than one JSONB game blob.

`public.pending_games` stores the game-level pending setup:

- `id`;
- `creator_account_id`;
- `creator_profile_id`;
- `invitee_profile_id`;
- `template_id`, initially the default template;
- `row_count`;
- `status`, initially `pending`;
- `created_at`;
- `updated_at`.

`public.pending_game_participants` stores participant rows:

- `pending_game_id`;
- `profile_id`;
- `account_id`, only where the participant is the signed-in creator or where a
  future accepted invite resolves to account authority;
- `handle`;
- `gamer_name`;
- `avatar_key`;
- `participant_role`, initially `creator` or `invitee`;
- `invite_status`, initially `accepted` for the creator and `pending` for the
  invited participant;
- `created_at`;
- `updated_at`.

The creator row may use `auth.uid()` authority. The invited participant is
created from `public.account_profile_directory.profile_id` plus display
snapshot data. The first slice must not require the invitee's raw Auth user id
to be exposed to the browser.

The Supabase adapter creates a Pending Game with one insert into
`public.pending_games`. A private-schema Postgres trigger then creates the
creator and invitee participant rows from the creator and invitee profile ids.
This keeps the relational model without adding a browser-managed multi-table
transaction, RPC-only creation path, or Edge Function deployment in the first
slice. The trigger function must live outside the exposed `public` schema and
use an empty `search_path`.

Random Slot Allocation and Slot Order are deliberately not resolved during
Pending Game creation. Product rules say they resolve when all invited human
participants accept.

## Supabase Security

The migration must:

- explicitly grant Data API access needed by `authenticated` and
  `service_role`;
- grant no `anon` table access;
- enable Row Level Security on both new public tables;
- use policies based on `(select auth.uid())` where account authority is
  checked;
- index foreign-key columns used by joins, cascades, and policies;
- keep browser-visible select columns invite-safe;
- avoid security-definer functions in the exposed `public` schema.

Hosted Supabase application remains a separate live backend mutation requiring
explicit owner approval.

## Behaviour

When a signed-in creator creates a Pending Game by Handle:

1. The repository validates creator account id, invitee handle, and row count.
2. The repository resolves the invitee through the Account Profile Directory.
3. The repository rejects a self-invite.
4. The repository creates one Pending Game with status `pending`.
5. The repository creates a creator participant row with accepted status.
6. The repository creates an invited participant row with pending status and
   invite-safe profile snapshot data.
7. The repository returns a browser-safe Pending Game DTO.

The first slice has no inbox, notification, acceptance, decline, expiry,
cancellation UI, turn state, entry storage, Slot Allocation, Slot Order, or
Reveal.

## Testing

Use TDD with vertical slices:

1. Add one failing memory repository test for handle-invite Pending Game
   creation.
2. Implement the smallest memory repository behaviour.
3. Add one failing Supabase adapter test against a fake Supabase client.
4. Implement the smallest Supabase adapter behaviour.
5. Add migration-surface tests for tables, grants, RLS, constraints, and
   indexes.
6. Create the migration and update owning docs.
7. Run targeted tests after each green step, then `npm test`.

Tests should exercise public repository behaviour, not private helper
implementation. Automated tests must not mutate hosted Supabase.

## Out Of Scope

- UI for starting or viewing Pending Games.
- Hosted Supabase migration application without explicit owner approval.
- Invite acceptance, decline, expiry, or cancellation flows.
- Anti-spam limits and recipient controls.
- Friends or friend-based invite shortcuts.
- In-App Notifications, nudges, email notifications, push notifications, and
  manual pokes.
- Slot Allocation, Slot Order resolution, turns, entry persistence, and Reveal.
- Share Consent, external multiplayer sharing, public discovery, public share
  links, feeds, leaderboards, reactions, reports, and moderation.
- Profile editing or broader account navigation.
- Edge Functions or RPC-only creation.

## Open Follow-Ups

The following work remains deferred after this slice:

- choosing the fixed Pending Game invite expiry duration;
- anti-spam limits and recipient controls for non-friend handle invites;
- invite acceptance and decline lifecycle;
- Slot Allocation and Slot Order resolution at game start;
- in-app invite notifications and nudge delivery;
- multiplayer turn storage and Reveal;
- Share Consent and multiplayer external sharing.
