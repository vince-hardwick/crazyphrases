# 0018: Dashboard-Triggered Nudge Generation

## Status

Accepted. Source-controlled implementation exists for the MVP in-app nudge
timeout foundation; hosted application remains approval-gated.

## Context

MVP multiplayer already stores durable in-app notifications for game start,
batch completion, and creator cancellation. Product rules also require a
configurable per-Game Nudge Timeout and in-app-only nudges, but the project has
not yet chosen how overdue active Games create those notification rows.

Nudge generation is a mutation. Detecting that a participant has an overdue
assigned section must not itself grant browser clients broad authority to write
notifications or mutate Started Game lifecycle state. The existing multiplayer
model keeps section submission, Reveal, cancellation, and dashboard reads
behind narrow database-owned paths.

The main alternatives are:

- a scheduled Supabase Cron or Edge Function worker that scans for overdue
  sections;
- a browser-side check that inserts notification rows directly;
- an authenticated database-owned path invoked when the multiplayer dashboard
  is refreshed.

## Decision

The first nudge slice uses a database-owned nudge-generation path invoked as
part of authenticated multiplayer dashboard refresh.

The browser may request a dashboard refresh, but it does not decide which
participants are overdue and does not receive direct insert authority for nudge
notifications. Postgres owns the overdue-section query, participant scoping,
deduplication, and notification creation. The same refresh returns the normal
participant-scoped dashboard shape.

Nudges are durable in-app notification rows for the assigned participant whose
current incomplete section is overdue according to the Game's configured
Nudge Timeout. Repeated refreshes must not create duplicate unread or read
nudge rows for the same Started Game, Account, and assigned section. Nudges do
not reveal other participants' section assignments, entry kinds, or entries.

The MVP does not add Supabase Cron, Edge Functions, email, push notifications,
manual pokes, partial timeout Reveal, friend relationships, or account-level
notification mute settings in this slice. Those remain separate future work.

## Consequences

- The static-first app can generate in-app nudges without adding a scheduler to
  the first product shape.
- Browser clients keep a narrow interface: refresh dashboard, list
  notifications, mark notifications read.
- Refresh-triggered generation means nudges are created opportunistically when
  participants open or refresh the app, not at a guaranteed wall-clock instant.
- A future scheduled worker can reuse the database-owned generation logic if
  active multiplayer usage needs out-of-app or exact-time reminders.
- Hosted migration application and any hosted write smoke remain live backend
  mutations requiring explicit owner approval or the documented deployment
  workflow gate.
