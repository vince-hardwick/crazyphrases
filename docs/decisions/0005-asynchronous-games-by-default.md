# 0005: Asynchronous Games by Default

## Status

Accepted

## Context

Crazy Phrases comes from a folded-paper turn-based game, and nudge timeouts already assume that participants may not act at the same time. Live synchronous play would add presence, realtime updates, and connection-state complexity before the core game loop is proven.

## Decision

Games are asynchronous by default. Participants can complete their slot assignments without being present at the same time, while live synchronous play is deferred as a later execution profile.

## Consequences

- The first implementation can focus on invitations, turn state, nudges, concealment, and reveal.
- Realtime party-room behavior is not required for MVP.
- Game state should leave room for a future live execution profile without making it the default assumption.
