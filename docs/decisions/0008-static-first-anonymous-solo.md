# 0008: Static-First Anonymous Solo

## Status

Accepted

## Context

The repository already has a static deployment path, and anonymous solo play can deliver immediate value without accounts, persistence, invites, or backend state. Signed-in play and multiplayer features require durable server-side state and should not be constrained by the static hosting model.

## Decision

The first implementation is static-first for anonymous solo, with a clear backend boundary for signed-in features. Static hosting may serve the anonymous solo experience, while accounts, signed-in persistence, multiplayer, invites, consent, and private favourites require backend-backed state.

## Consequences

- Anonymous solo can launch quickly on the current static deployment path.
- Static hosting is an implementation path for the first-play experience, not authority for the whole product architecture.
- Future signed-in features need a backend design before implementation.
