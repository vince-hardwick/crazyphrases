# 0012: Pending Game Invite Response Authority

## Status

Accepted

## Context

The first Pending Game slice let a signed-in Game Creator create a handle-based
Game Invite and see creator/invitee participant rows. It deliberately did not
let the invitee see, accept, or decline the invite.

The next lifecycle slice needs invitee response visibility without expanding
into game-start conversion, turn storage, Slot Allocation, Slot Order, Reveal,
Share Consent, expiry, creator cancellation UI, notifications, friends, or
public discovery.

The browser must not receive broad update authority over Pending Games. A
decline cancels the Pending Game in the MVP, but letting browser code directly
update `public.pending_games.status` would blur response authority with creator
or system cancellation authority.

## Decision

Invite response mutation is authorised through the invitee participant row.

Signed-in invitees may select Pending Games where their Account Profile is the
invited profile. They may update only `account_id` and `invite_status` on their
own pending invitee participant row, under Row Level Security and column-level
grants.

Accepting an invite sets the invitee participant to `invite_status = 'accepted'`
and attaches the responding Account id to that participant row. The Pending Game
remains `pending`; game-start conversion is a later slice.

Declining an invite sets the invitee participant to `invite_status = 'declined'`
and attaches the responding Account id to that participant row. A private-schema
trigger then changes the owning Pending Game to `status = 'cancelled'`. Browser
clients do not receive `update` grants on `public.pending_games`.

Creator visibility is read-only through the existing creator-owned Pending Game
select path plus participant rows. The browser-facing DTO continues to expose
Profile ids, Handles, Gamer Names, Avatars, roles, invite status, row count,
template id, and Pending Game status, but not raw invited Auth identities.

## Consequences

- Invitee response is auditable without exposing raw Auth ids in browser DTOs.
- Decline cancellation is atomic from the browser's perspective: the browser
  performs one participant-row response update and the database owns the
  Pending Game status transition.
- Future creator cancellation, expiry, replacement, and game-start conversion
  can use separate authority paths instead of overloading invitee response
  updates.
- A fully accepted Pending Game may still have `status = 'pending'` until a
  later game-start conversion slice resolves Slot Allocation and Slot Order.
- Hosted migration application remains a live backend mutation and requires
  explicit owner approval or the documented deployment workflow gate.
