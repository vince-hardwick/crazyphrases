# 0016: Creator-Controlled Multiplayer Cancellation

## Status

Accepted. PR #58 merged to `main` as
`91e855bee56286fb3a7cafdfc5447d2391cce7e7`, and promotion run
`27851753455` deployed the creator-cancellation slice through `test` and
production after owner approvals. Hosted migration
`20260619221615 creator_multiplayer_cancellation` applied the source migration
`supabase/migrations/20260619151000_creator_multiplayer_cancellation.sql`
after separate explicit owner approval.

## Context

PR #57 made signed-in participant-section multiplayer usable through
production. After that point, Game Creators can create Pending Games and start
Started Games that may become accidental, stale, or undesirable before Reveal.

The product rules already allow the Game Creator to cancel before Reveal, while
invited participants can decline before accepting or starting. The existing
backend deliberately avoided broad browser update authority on
`public.pending_games`: invite decline mutates through the invitee participant
row, game-start conversion mutates through a narrow `public.games` insert, and
participant execution mutates through narrow RPCs.

Creator cancellation spans both Pending Games and Started Games. It also spans
notification targets: a pre-start cancellation has no Started Game row to point
at, while a Started Game cancellation should remove the game from active
dashboard buckets and prevent further section submission or Reveal.

## Decision

Creator cancellation uses a dedicated RPC:
`public.cancel_created_game(uuid)`.

Authenticated browser clients do not receive direct update grants on
`public.pending_games`. The RPC is `security definer`, checks
`auth.uid()` against the Pending Game creator, locks the Pending Game, permits
only `pending` or `started` source states, and rejects cancellation once any
participant has created a `public.multiplayer_batch_reveals` row for the
Started Game.

Cancelling preserves records for audit and history. It marks the Pending Game
as `cancelled`; it does not hard-delete the Pending Game, Started Game,
participant snapshots, assigned sections, submitted entries, or notification
rows.

`public.in_app_notifications` supports exactly one target per notification:
either `target_game_id` for Started Game notifications or
`target_pending_game_id` for pre-start Pending Game notifications.
Cancellation creates a `game_cancelled` notification for accepted participants
other than the creator. If a Started Game had prior `entries_needed`
notifications, cancellation marks those notifications `read` before adding the
cancellation notification so stale actionable prompts do not remain unread.

Dashboard and action RPCs must treat a cancelled source Pending Game as
inactive. `public.list_multiplayer_dashboard()` excludes cancelled Started
Games from `Awaiting your entries`, `Awaiting other player entries`, and
`Completed batches`. `public.submit_multiplayer_section(uuid, jsonb)` and
`public.reveal_multiplayer_batch(uuid)` reject cancelled games.

The creator UI exposes a creator-only `Cancel game` action on cancellable
created-game cards. It refreshes the multiplayer dashboard after cancellation
so active entry forms disappear.

## Consequences

- Creator cancellation has a separate authority path instead of overloading
  invitee decline or granting broad Pending Game updates.
- Pending Game cancellation before start can notify accepted invitees without
  fabricating a Started Game target.
- Started Game cancellation leaves historical rows intact while removing the
  game from active participant surfaces.
- Read notification history may include obsolete `entries_needed` rows, but
  they are marked read when cancellation supersedes them.
- Future invite expiry, participant replacement, nudge, and Share Consent
  flows should use their own authority paths rather than extending this RPC
  beyond creator cancellation.
- Future cancellation-related hosted migrations remain live backend mutations
  and require explicit owner approval or the documented deployment workflow
  gate.
