# 0026: Pending Game Invite Notification Authority

## Status

Accepted. Source-controlled implementation exists for the MVP through
`supabase/migrations/20260707234133_pending_game_invite_notifications.sql`.
Hosted deployment, smoke, and cleanup evidence lives in
`docs/planning/supabase-state-ledger.md`.

## Context

MVP multiplayer already stores durable In-App Notifications for Game start, batch
completion, creator cancellation, and nudges. Product rules now also require a
newly created Game Invite to notify the invited Account through the top-bar
notification affordance.

Creating the invite notification is a mutation tied to Pending Game creation.
The browser already has narrow authority to request Pending Game creation, but
granting it direct insert authority on `public.in_app_notifications` would make
notification recipient selection, message construction, and target integrity a
browser concern. That would conflict with the existing multiplayer authority
model: invite responses, start conversion, creator cancellation, participant
execution, Reveal, and nudge generation all keep lifecycle mutation behind
narrow database-owned paths.

The main alternatives are:

- have browser code insert an invite notification after the Pending Game insert;
- create the invite notification in a database trigger or RPC as part of Pending
  Game creation;
- leave Pending Game invitations visible only on the Multiplayer page and omit
  invite notifications.

## Decision

Creating a Pending Game for another Account creates exactly one unread
invite-target In-App Notification for the invited Account. The Game Creator does
not receive a self-notification for the invite they just sent.

Invite notification creation is owned by backend/database logic as part of the
Pending Game creation authority path. Browser clients may request Pending Game
creation through the accepted narrow interface, but they do not receive direct
insert authority for invite notifications and do not decide the recipient,
target Pending Game id, notification type, message, or initial unread state.

The notification targets the Pending Game through `target_pending_game_id`.
Selecting the notification follows the general notification-panel rules: route
to `#/play/multiplayer`, render the matching received-invitation context first,
then mark the notification read only after that concrete Pending Game target is
present.

The invite notification message identifies the inviting participant using
invite-safe display data, for example `test-player invited you to a multiplayer
game.` It must not expose raw Auth ids, raw email lookup values, or storage
identifiers.

## Consequences

- The top-bar bell, unread badge, and notification popover can surface new
  Pending Game invitations without requiring the invitee to visit Multiplayer
  manually.
- Browser clients keep a narrow mutation interface and do not become general
  notification writers.
- The notification target is created in the same authority boundary as the
  Pending Game, reducing the chance of orphaned or mis-targeted invite
  notifications.
- Hosted migration application and any hosted write smoke for this change remain
  live backend mutations requiring explicit owner approval or the documented
  deployment workflow gate.
