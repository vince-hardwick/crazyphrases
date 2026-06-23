# 0017: Pending Game Invite Expiry

## Status

Accepted. Source-controlled implementation is present in the browser adapter,
UI, tests, and source migration
`supabase/migrations/20260623151948_pending_game_invite_expiry.sql`. Hosted
migration application remains a live backend mutation and requires explicit
owner approval or the documented deployment workflow gate.

## Context

Pending Game invites already had an accepted product rule that they must expire
automatically, but the exact duration was deferred. Leaving invites pending
forever would keep old creator and invitee actions available, which conflicts
with the MVP lifecycle once multiplayer history, cancellation, and notification
surfaces exist.

The current backend deliberately avoids broad browser update authority on
`public.pending_games`. Invitee responses mutate through the invitee
participant row, Game start mutates through the narrow `public.games` insert
path, and creator cancellation mutates through a dedicated RPC. Expiry needs to
preserve that authority split rather than giving browser clients permission to
mark Pending Games expired.

## Decision

Pending Game invites expire seven days after Pending Game creation unless the
Pending Game is started, cancelled, or declined first.

The source of truth for the expiry timestamp is `public.pending_games.expires_at`.
New rows default to creation time plus seven days. Existing rows are backfilled
to `created_at + interval '7 days'` when the migration is applied.

Browser-facing DTOs may derive an effective `expired` status for pending rows
whose `expires_at` is in the past. This is a read-time presentation state, not a
browser mutation path. Expired Pending Games remain visible to relevant
creators and invitees, but the browser hides accept, decline, start, and
creator-cancel actions for them.

Database authority paths must also enforce expiry:

- invitee accept and decline policies require an unexpired Pending Game;
- Game start policies and trigger functions require an unexpired Pending Game;
- creator cancellation rejects already expired pre-start Pending Games.

The MVP does not add a cron job, scheduled function, or read-time mutation that
changes `public.pending_games.status` to `expired`. The status constraint may
allow `expired` so a future scheduled lifecycle worker can persist the terminal
state without another compatibility migration.

Expiry does not hard-delete Pending Games, Started Games, participant
snapshots, assigned sections, submitted entries, notifications, or reveal
state. Expiry does not send notifications in the first product shape.

## Consequences

- Pending invites have a concrete lifecycle limit without adding a scheduler to
  the static-first MVP.
- Browser clients can display expired invites without receiving direct update
  authority on `public.pending_games`.
- Action paths reject stale Pending Games even if an old browser bundle or
  malicious client tries to submit an expired response, start, or cancellation.
- Future notification cadence, nudges, expiry emails, or scheduled persistence
  of `status = 'expired'` remain separate slices.
- Hosted migration application and any hosted write smoke remain separate from
  deployment approval and require explicit owner approval.
