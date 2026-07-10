# 0028: Autonomous Docs-Only Pull-Request Merge

## Status

Accepted.

## Context

`main` remains protected: changes must arrive through a pull request with the
latest required `CI / Verify static site` check and no unresolved review
threads. The current `Protect main` ruleset deliberately does not require an
approving reviewer because Crazy Phrases is a user-owned solo repository.

The owner has authorised Codex to self-review and merge documentation-only
pull requests autonomously. Requiring a separate human merge confirmation for
each prose-only closeout would add delay without adding an independent review
control, while direct pushes and CI bypass remain unacceptable.

## Decision

Codex may self-review, mark ready, and merge a docs-only pull request without
requesting a separate human review or merge confirmation when all of the
following are true:

1. The diff changes documentation only: Markdown or other prose documents,
   including repository governance, ADR, runbook, product, plan, and ledger
   documents; it changes no executable source, runtime asset, test, workflow,
   dependency, configuration, Supabase migration, or deployment-payload file.
2. Codex completes a standards-and-spec self-review against the documented
   owning authorities, addresses any actionable findings, and records the
   result in the pull-request closeout.
3. The pull request targets `main`, the latest `CI / Verify static site` check
   passes, and all review threads are resolved.

This delegation does not authorise a direct push, force-push, ruleset bypass,
or any environment deployment. A mixed or runtime-affecting pull request
continues to require the normal human review and deployment-approval path.

## Consequences

- Documentation closeouts can reach the protected `main` branch promptly once
  their self-review and CI evidence are complete.
- The pull-request, CI, and resolved-thread safeguards remain mandatory.
- Documentation that records a governance or operational decision remains
  discoverable and reviewable in the same protected-main history as code.
- Future agents must classify a pull request by its complete diff, not by its
  title or an individual documentation file, before using this authority.
