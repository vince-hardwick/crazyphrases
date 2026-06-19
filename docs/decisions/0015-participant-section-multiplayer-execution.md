# 0015: Participant-Section Multiplayer Execution

## Status

Accepted. Source-controlled implementation is complete. PR #57 was deployed to
`dev` on 2026-06-19 after owner approval. Hosted Supabase migration application
and hosted smoke validation remain pending explicit owner approval.

## Context

ADR 0014 implemented the first source-controlled Started Game Turn submission
path with a single global Slot Order. That model lets only the first
unsubmitted Turn in the Game become active, so one participant can block all
other participants from entering their own assigned sections.

The product direction has changed. Multiplayer should preserve the
folded-paper concealment mechanic, but participants do not need to wait for an
unrelated participant before entering their own assigned section. In the
default 2-player template, one participant may be assigned two sections. That
participant should still complete one section at a time, in a random
participant-local order, so they do not see both of their assigned section
kinds at once.

This decision changes a durable lifecycle and authority boundary. It
supersedes ADR 0014 for future multiplayer execution, while preserving ADR
0014's principle that browser clients should submit entries through a narrow
database-owned authority path rather than receiving broad direct write access.

## Decision

Started multiplayer Games use participant-section execution.

When a Pending Game starts, Postgres will still resolve random Slot Allocation
for the default template. It will no longer use one global Slot Order as the
cross-participant gating authority. Instead, Postgres will create one durable
assigned-section record for each allocated section, with a participant-local
order for the sections assigned to that participant.

Participants may work concurrently. Each participant can see and submit only
their own next incomplete assigned section. If a participant has two assigned
sections, they submit the first assigned section, then immediately see their
next assigned section. They do not receive a notification for that
same-participant progression.

A section submission stores one non-empty Entry for every row in the batch and
locks that assigned section. The submission authority remains database-owned
and must atomically validate:

- the caller is the participant assigned to the section;
- the section is the caller's next incomplete assigned section;
- the section is not already submitted;
- the payload contains exactly one non-empty Entry for every row in the Game.

A multiplayer batch becomes complete only when every assigned section in the
Game has been submitted. Reveal availability is completion-gated: no
participant can reveal the batch before all assigned sections are complete,
even if that participant has already submitted all of their own assigned
sections.

Reveal is participant-scoped viewing state, not a global Game transition. Each
participant clicks `Reveal phrases` for themselves after the batch is complete.
The batch remains in `Batches completed` after that participant reveals it.

The signed-in multiplayer surface should classify Started Games into three
areas for the current Account:

- `Awaiting your entries`: the Account has a next incomplete assigned section.
- `Awaiting other player entries`: the Account has no remaining available
  sections, but at least one other participant still has incomplete assigned
  sections.
- `Batches completed`: all assigned sections are complete. Show the five most
  recently completed batches for the Account.

Durable in-app notification rows are stored per participant. When a Game
starts, every participant receives an unread actionable notification that
entries can be submitted. When the final section submission completes a batch,
every participant receives a batch-complete notification. The final submitter's
batch-complete notification is created as read because the submit flow takes
that participant directly to the completed batch and reveal action; other
participants receive it unread. Viewing notification items in the top-bar
dropdown marks them read, but read notifications remain listed.

## Consequences

- ADR 0014's global active-Turn rule is no longer the future product model.
- Existing `game_turns` and `submit_started_game_turn` implementation should
  be treated as a historical slice to replace or migrate, not a surface to
  extend for Reveal.
- Future migrations need a participant-section storage and submission surface
  that preserves narrow mutation authority.
- The UI can show active work, waiting-on-others state, and completed batches
  without revealing another participant's section kind or entries before
  Reveal.
- The full paginated completed-batch history page remains deferred; the MVP
  completed-batch panel lists only the five most recent completed multiplayer
  batches for the Account.
- Hosted schema changes remain live backend mutations and require explicit
  owner approval or the documented deployment workflow gate.
