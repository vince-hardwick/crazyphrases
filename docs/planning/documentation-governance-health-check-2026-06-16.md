# Documentation Governance Health Check - 2026-06-16

## Purpose

This audit reviewed repository documentation architecture and agent operability.
It focused on authority, routing, context efficiency, stale-plan risk,
cross-reference integrity, ADR lifecycle clarity, and operational consistency.

The audit prioritised critical infrastructure first: `AGENTS.md`, `README.md`,
`docs/planning/agent-context-map.md`, ADRs, runbooks, backlog state, and
agent-facing indexes. Plans, specs, PRDs, and research were reviewed afterwards
as lower-authority provenance.

## Findings Report

### Critical Issues

None found.

No accepted ADR, runbook, or root agent instruction was found authorising live
mutation from environment detection alone. The repository consistently separates
GitHub Environment deployment approval, Cloudflare Access browser access,
cPanel origin authority, and Supabase hosted-data mutation authority.

### Important Issues

1. `docs/runbooks/live-static-hosting.md` contained a stale hand-maintained
   runtime file list that omitted newer browser modules and Supabase runtime
   config. A future emergency upload or deployment review could have missed
   required files.
2. Historical Superpowers plans and specs still looked active when opened
   directly. In particular, old plans retained "implement this plan" headers,
   and the Pending Game design still said implementation was tracked by the
   branch even though the slice had landed and the hosted migration had been
   applied.
3. The first-hop routing map did not point to a plan/spec status index, so a
   newly spawned agent had to infer whether older PRDs and plans were active,
   completed, or merely provenance.
4. Large documents create context-risk hotspots. `docs/runbooks/supabase-auth-and-postgres.md`,
   `docs/backlog.md`, `docs/product-rules.md`, and some PRDs are valuable but
   expensive to load wholesale. Agents needed a stronger instruction to search
   targeted headings before loading entire documents.

### Minor Issues

1. ADR status semantics did not explicitly name `Accepted` as active and did not
   include an `Obsolete` status. This was low risk because all current ADRs
   already use `Accepted`, but explicit lifecycle vocabulary helps future
   reviews.
2. No separate `state-ledger` or `contracts` directory exists. Effective state
   is distributed across backlog entries, runbook evidence, ADRs, and published
   issues. This is workable at the current repository size but should be watched
   as Supabase and deployment evidence grows.
3. Research documents are clearly labelled as research, but provider/pricing
   research is time-sensitive. Future ADR or provider work should re-check
   current primary sources before relying on 2026-06-12 research notes.

### Suggested Improvements

1. Split `docs/runbooks/supabase-auth-and-postgres.md` if it grows further:
   keep operational commands and approval rules in the runbook, and move
   migration/deployment evidence into a separate state ledger or evidence log.
2. Add an automated documentation reference check to `npm test` or a dedicated
   docs check if path churn increases.
3. If `docs/backlog.md` continues to grow, add a short backlog index grouped by
   product area, or split completed/historical evidence from active deferred
   work.
4. Consider a lightweight contracts directory only when repository
   contracts become numerous enough that product rules, ADRs, and runbooks no
   longer route them cleanly.

## Remediation Applied

- Added plan/spec status routing to `AGENTS.md`.
- Added large-document progressive-disclosure guidance to
  `docs/planning/agent-context-map.md`.
- Added `docs/superpowers/README.md` as a compact status index for historical
  plans and specs.
- Added direct historical/completed status notes to old Superpowers plans and
  specs that could otherwise look active.
- Replaced the stale static-hosting upload list with the workflow-backed
  deployment payload contract in `docs/runbooks/live-static-hosting.md`.
- Updated `README.md` to refer to the runtime payload contract instead of a
  hand-maintained runtime file set.
- Clarified ADR lifecycle status values in `docs/decisions/README.md`.
- Added this durable audit report under `docs/planning/`.

## Cross-Reference Integrity

Markdown link validation found no missing internal Markdown link targets.

Backticked path validation found two intentional non-file cases:

- The old ADR directory name in `docs/agents/domain.md`, used only to warn that ADRs do not
  live there.
- `assets/word-bank-seed.json?v=__ASSET_VERSION__` in
  `docs/runbooks/live-static-hosting.md`, used as a deployed runtime URL shape.

No remediation was needed for those cases.

## ADR and Contract Integrity

All current ADRs are `Accepted` and active. No ADR was found to be implicitly
superseded by a later plan, runbook, or state ledger.

No standalone contract documents were found. Existing contract-like rules are
owned by:

- `docs/product-rules.md` for product lifecycle and validation rules.
- ADRs for durable architecture and authority boundaries.
- Runbooks for operational command contracts and approval paths.
- Tests for executable workflow and migration surface contracts.

## Operational Consistency

The environment and mutation authority boundary is consistent across root
instructions, ADRs, runbooks, and specs:

- Detecting OS, branch, hostname, deployment target, project ref, or runtime
  context does not authorise mutation.
- GitHub Environment approval authorises deployment only.
- Cloudflare Access authorises runtime browser access only.
- Supabase hosted schema or data mutation requires explicit owner approval or a
  task-specific accepted plan.
- cPanel access authorises origin hosting changes only.

No unresolved operational conflict remains from this audit.

## Governance Recommendations

1. Treat `docs/superpowers/README.md` as the plan/spec status ledger and update
   it whenever a plan is created, completed, abandoned, or superseded.
2. Keep `docs/planning/agent-context-map.md` as the only first-hop routing
   surface. Add routes there instead of duplicating authority tables in many
   documents.
3. For future completed implementation slices, update three places before
   closeout: the owning product/ADR/runbook/backlog document, the relevant
   plan/spec header, and `docs/superpowers/README.md`.
4. If Supabase evidence continues to dominate the runbook, split it into:
   `docs/runbooks/supabase-auth-and-postgres.md` for procedures and a separate
   Supabase state ledger for migration/application evidence.
5. Keep research notes non-authoritative. Any future provider, pricing, API, or
   dependency decision should re-check current primary docs before promoting
   research into an ADR or runbook.

## Scorecard

| Dimension | Score | Justification |
| --- | ---: | --- |
| Authority clarity | 8/10 | Root policy, context map, ADRs, and runbooks now align clearly. Remaining risk is distributed state evidence across backlog and the large Supabase runbook. |
| Routing quality | 8/10 | The context map is effective and now includes plan/spec status and Pending Game routes. More topic-specific indexes may be useful as backlog grows. |
| Cross-reference integrity | 9/10 | Internal Markdown links resolve. Inline path checks found only intentional non-file cases. |
| Context efficiency | 7/10 | Progressive disclosure is now explicit, but several documents are still large enough to punish full reads. |
| Progressive disclosure | 8/10 | Agents have a clear loading order and status index. Further gains would come from splitting the Supabase evidence log and indexing backlog sections. |
| Agent operability | 8/10 | A new agent can identify authority, next work, mutation boundaries, and plan status with few document loads. |
| Drift resistance | 8/10 | ADR/runbook/product-rule ownership is strong, and workflow payload drift is test-backed. Plan/spec status now needs ongoing closeout discipline. |
| Overall documentation architecture | 8/10 | The architecture is sound after remediation. The next improvement is structural, not urgent: split or index large state-heavy documents as the project grows. |
