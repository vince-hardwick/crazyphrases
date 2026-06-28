# Multiplayer Execution Redesign

**Status:** Approved design provenance. Source-controlled participant-section
implementation is complete; PR #57 was merged to `main` and promoted through
production on 2026-06-19 after owner approvals. Current durable authority lives
in ADR 0015, `docs/product-rules.md`, `docs/backlog.md`,
`docs/runbooks/supabase-auth-and-postgres.md`, and
`docs/planning/supabase-state-ledger.md`.

## Goal

Redesign signed-in 2-player multiplayer execution so participants can submit
their own assigned sections without waiting for another participant's unrelated
section, while preserving concealment, section-by-section play, durable
notifications, and completion-gated Reveal.

## Approved Model

Started multiplayer Games use participant-section execution.

Game start still resolves random Slot Allocation for the default template. It
also creates a participant-local random order for each participant's assigned
sections. A participant sees only their own next incomplete assigned section.
If they have two assigned sections, they submit each section separately in that
participant-local order.

Participants can work concurrently. One participant submitting a section does
not block another participant from submitting their own current section.

## Multiplayer Areas

The signed-in multiplayer surface has three areas:

- `Awaiting your entries`: Games where the current Account has a next
  incomplete assigned section.
- `Awaiting other player entries`: Games where the current Account has no
  currently available assigned section, but at least one other participant has
  incomplete assigned sections.
- `Batches completed`: Games where every assigned section has been submitted.

`Batches completed` lists the five most recently completed multiplayer batches
for the signed-in Account.

## Reveal

A multiplayer batch can be revealed only after every assigned section in the
Game is complete. A participant who has completed all of their own sections
must still wait if another participant has incomplete sections.

Reveal is a per-participant viewing action. Each participant clicks `Reveal
phrases` for themselves. Revealing does not globally reveal the batch for other
participants. After a participant reveals, the batch remains in `Batches
completed` for that participant.

## Notifications

In-app notifications are durable rows stored per participant.

When a Game starts after every invited participant has accepted, every
participant receives an unread actionable notification that they can submit
entries to the batch.

When the final assigned section is submitted, every participant receives a
batch-complete notification. The final submitter's notification is created
already read because the submit flow presents the completed batch and `Reveal
phrases` action directly. Other participants receive the notification unread.

The notification icon lives in the top-right area near the help button. Its
dropdown lists read and unread notifications. Viewing a notification item in
the dropdown marks it read.

No notification is created when a participant's own next assigned section
becomes available immediately after they submit a previous assigned section.
That same-user progression should stay in the entry flow rather than creating
clutter.

## Authority And Storage

Postgres owns multiplayer section state, completion, and notification
creation. Browser clients should not receive broad direct write access to
entries, assigned sections, completed-batch state, or notification creation.

A narrow authenticated submission authority should validate atomically that:

- the caller is assigned to the submitted section;
- the section is the caller's next incomplete assigned section;
- the section has not already been submitted;
- the payload contains one non-empty Entry for every row in the Game.

Batch completion is derived from all assigned sections being submitted. The
final section submission creates durable batch-complete notifications.

## Superseded Behaviour

This design supersedes ADR 0014's global active-Turn sequencing for future
multiplayer execution. ADR 0014 remains historical evidence for the first
turn-submission slice and for the narrow mutation-authority principle.

## Out Of Scope

- Full paginated completed-batch history page.
- Share Consent and multiplayer external sharing.
- Public discovery, feeds, leaderboards, and reactions.
- Friends, nudges, push notifications, email notifications, and Android app.
- Creator cancellation UI, invite expiry, and participant replacement.
- Post-submission correction requests.

## Deferred Follow-Up

The full completed-batch history page is deferred until participants need to
browse beyond the five most recent completed multiplayer batches. The future
page should be Account-scoped and paginated.
