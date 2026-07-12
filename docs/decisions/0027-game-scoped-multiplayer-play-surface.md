# 0027: Game-Scoped Multiplayer Play Surface

## Status

Accepted.

Implementation is tracked by PRD issue #226. Child issues #227, #228, #229,
#231, and #232 are complete; #230 remains open.

## Context

The MVP Multiplayer destination currently owns invite creation, dashboard
buckets, completed-history entry, active section submission, and completed-batch
Reveal. That made the first participant-section implementation compact, but it
also means active phrase entry can appear as a form embedded inside the
`Awaiting your entries` dashboard bucket.

Phrase entry and Reveal are core Game work, not dashboard administration.
Solo play already gives Entry input and Reveal first-class treatment because
the Solo lifecycle is simpler. Multiplayer now needs the same product boundary
without weakening the participant-section authority model accepted in ADR 0015.

The main alternatives are:

- keep active Multiplayer section input embedded inside dashboard cards;
- make the dashboard switch into a temporary subview while staying at the same
  Multiplayer route;
- add a Game-scoped signed-in Game Play Surface for the current participant's
  work in a Started Game.

## Decision

Multiplayer active Entry input, waiting state, participant-scoped Reveal, and
the participant's revealed Batch belong in a Game-scoped Game Play Surface.
The Multiplayer destination remains the overview for invite creation, active
Game summaries, waiting states, and completed-batch summaries. Its
`Awaiting your entries` cards should stay summary-only and open the Game Play
Surface through a `Take turn` action.

The Game Play Surface is scoped to the Started Game rather than to a specific
assigned section. Its canonical route shape is
`#/play/multiplayer/games/<started-game-id>`. The route selects a presentation
target only; it does not grant read or mutation authority. A narrow
participant-scoped Started Game read contract should load only the state the
current Account may see for that Game, and existing database-owned
participant-section submission and Reveal authority remain responsible for
lifecycle mutation.

Anonymous visits to the Game Play Surface use the existing signed-in route gate
and hosted Auth route handoff. Preserving a deep link through Auth preserves
intent only; after sign-in, the participant-scoped read contract decides whether
the Account can see the target Game.

For signed-in Accounts, a failed authorised participant-state load renders a
conservative route-local unavailable state. That state must not reveal whether a
Started Game exists, who participates in it, or which protected lifecycle state
prevented access.

An authorised participant-state load may return a cancelled Started Game state
when the signed-in Account is allowed to know about that cancellation. That state
can name cancellation explicitly, while non-participants, invalid ids, and
protected stale links continue to receive the generic unavailable state.

Actionable notifications for available entries and completed batches should
target the Game Play Surface when the target Game still has a participant task.
The dashboard remains the fallback when the target Game no longer has a current
participant task or when the route cannot load an authorised Game state.

For Multiplayer Entry Assist, database-owned Game-start logic pins
server-approved immutable Word Bank Shard references for the Started Game. The
browser does not choose candidate content, paths, versions, or curation tiers.
The participant-scoped loader may return only the active Entry Kind's pinned
reference, and the browser loads that exact static shard rather than resolving a
newer manifest entry. This preserves ADR 0024's static delivery boundary and
keeps suggestions stable for the Started Game without exposing another
participant's section or entries.

## Consequences

- Active Multiplayer phrase entry is no longer visually or conceptually
  subsumed inside the dashboard bucket model.
- Dashboard, notification, direct-load, and post-submit flows need to agree on
  the same Game-scoped participant state.
- Directly opening or refreshing the Game Play Surface must not depend on the
  Multiplayer dashboard payload having already loaded.
- The Game Play Surface needs a route-local skeleton loading state so deep links
  and post-auth handoffs do not flash dashboard content or stale Game details.
- Waiting, cancelled, unavailable, and revealed-batch states need a clear return
  route to the Multiplayer dashboard, while active entry keeps `Submit section`
  as the dominant action.
- Multiplayer Entry Assist should be available on the Game Play Surface for
  supported Entry Kinds without revealing another participant's assigned section
  or entries.
- Entry Assist reference or shard failures should disable only the affected dice
  affordance. They must not block typed entry, section submission, or otherwise
  turn an authorised active Game Play Surface into an unavailable Game.
- Future agents should not move active Multiplayer section input back into
  `Awaiting your entries` cards as a simplification unless this decision is
  deliberately superseded.
