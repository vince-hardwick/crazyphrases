# Documentation Governance Follow-Up - 2026-06-16

## Scope Reviewed

- `docs/runbooks/supabase-auth-and-postgres.md`
- `docs/backlog.md`
- `docs/superpowers/README.md`
- `docs/planning/agent-context-map.md`

This follow-up targeted the context-efficiency and drift-risk watch items from
`docs/planning/documentation-governance-health-check-2026-06-16.md`.

## Changes Made

- Extracted hosted Supabase migration application records, schema verification
  summaries, deployment smoke evidence, and hosted-state observations into
  `docs/planning/supabase-state-ledger.md`.
- Kept `docs/runbooks/supabase-auth-and-postgres.md` focused on procedure,
  mutation authority, commands, approval paths, provider setup, and operational
  safety, with cross-links to the new evidence ledger.
- Added the Supabase state ledger to `docs/planning/agent-context-map.md` so
  agents can route directly to hosted-state evidence without loading the full
  runbook.
- Added a compact `docs/backlog.md` index grouped by area and status, without
  splitting or rewriting the backlog entries.
- Clarified `docs/superpowers/README.md` as the plan/spec status ledger and
  made closeout expectations explicit for completed, abandoned, and superseded
  plans/specs.

## Intentionally Left Alone

- Product behaviour, application code, tests, migrations, and deployment
  workflows were not changed.
- ADRs, product rules, and runbook command contracts were not rewritten.
- `docs/backlog.md` remains a single backlog ledger because an index was enough
  to reduce first-load context cost without adding routing overhead.
- Existing backlog semantics and history were preserved.
- Plans and specs remain provenance unless explicitly marked active by
  `docs/superpowers/README.md`.

## Remaining Watch Items

- Keep future Supabase migration proof and deployment smoke evidence in
  `docs/planning/supabase-state-ledger.md`; do not let dated evidence accumulate
  back into the procedural runbook.
- Reconsider splitting `docs/backlog.md` only if the new index stops being
  enough for first-hop routing.
- During future plan closeout, update both the plan/spec header and
  `docs/superpowers/README.md` so stale checklists cannot look active.
- The Supabase TypeScript generated-types owner path remains deferred until the
  static JavaScript app has a reason to consume generated database types.

## Validation

- `git diff --check` passed.
- Repository-owned Markdown internal link check passed for root and `docs/`
  Markdown files.
- Existing Node test suite passed with the bundled Node runtime:
  100 tests, 16 suites, 0 failures.

## Score Impact

| Area | Previous | Updated | Impact |
| --- | --- | --- | --- |
| Context efficiency | 7/10 | 8/10 | Large Supabase evidence moved behind a direct route; backlog gained a compact index. |
| Progressive disclosure | 8/10 | 9/10 | First-hop routing now separates Supabase procedures from hosted-state evidence. |
| Drift resistance | 8/10 | 9/10 | Plan/spec closeout rules now require explicit historical, abandoned, or superseded status. |
| Overall documentation architecture | 8/10 | 8.5/10 | Improvements reduce context load and stale-plan risk without introducing a new governance system. |
