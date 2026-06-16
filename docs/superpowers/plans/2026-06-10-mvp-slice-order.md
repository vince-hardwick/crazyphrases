# MVP Slice Order

## Status

Historical. The initial anonymous-solo-before-auth sequence has been executed.
Use `docs/backlog.md`, `docs/product-rules.md`, and the relevant ADR/runbook for
current next work.

## Decision

Build the anonymous solo game before account/auth scaffolding.

## Rationale

Anonymous solo proves the default template, slot sequencing, concealment, reveal, phrase rendering, configurable row count, and tiny seed word-bank dice feature without requiring backend or auth decisions.

Auth becomes valuable after the playable loop exists, when signed-in users can save games, favourite outputs, or invite another participant.
