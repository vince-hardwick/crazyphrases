# 0004: Cached Word Bank for Entry Candidates

## Status

Accepted

## Context

Dice-click entry assistance is part of the core play loop and needs very low latency. Calling an external API or LLM for every candidate would add visible delay, cost, rate-limit risk, and network failure modes during play.

## Decision

Entry candidates are served from a local or cached word bank grouped by entry kind. External APIs or LLMs may refresh or enrich the word bank asynchronously, but dice clicks do not depend on a synchronous external generation call.

## Consequences

- Candidate generation can remain fast and available during play.
- The app will need word-bank storage, refresh, and quality-control paths.
- Future enrichment jobs must be separated from the authority to mutate live gameplay data.
