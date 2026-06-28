# Documentation Governance Health Check - 2026-06-28

## Purpose

This audit reviewed the repository's agent-facing documentation architecture
after the 2026-06-16 governance follow-up. It prioritised critical
infrastructure before implementation plans or research: `AGENTS.md`,
`README.md`, `docs/planning/agent-context-map.md`,
`docs/planning/supabase-state-ledger.md`, ADRs, runbooks, the plan/spec status
ledger, backlog routing, and project-level configuration notes.

The review focused on source-of-truth clarity, progressive disclosure,
cross-reference integrity, ADR/contract lifecycle status, operational
consistency, stale-plan risk, and likely agent failure modes.

## Findings Report

### Critical Issues

None found.

No accepted ADR, runbook, state ledger, root instruction, or routing table was
found authorising live mutation from environment, host, branch, runtime, or
plugin detection alone. GitHub Environment approval, Cloudflare Access browser
access, cPanel/FTPS origin mutation, Supabase hosted mutation, and GitHub CLI
authentication remain distinct authority boundaries.

### Important Issues

1. `docs/superpowers/plans/2026-06-26-signed-in-favourites.md` opened with an
   executable "For agentic workers" instruction before its historical status.
   The status ledger correctly marked it completed, but an agent opening the
   plan directly could still start executing stale checklist tasks.
2. `docs/superpowers/specs/2026-06-18-multiplayer-execution-redesign.md`
   still said implementation had not started, contradicting ADR 0015,
   `docs/superpowers/README.md`, the backlog, and the Supabase state ledger.
3. `docs/planning/agent-context-map.md` did not provide a first-hop route for
   the production-visible notification top-bar placeholder follow-up tracked by
   GitHub issue #97, even though the backlog and product rules contain the
   accepted notification model.

### Minor Issues

1. Several older historical plans still contain original implementation tasks
   and commit steps by design. Their top-level status notes are adequate, but
   future closeout should keep the status/current-authority block ahead of any
   old worker instructions.
2. No standalone contracts directory exists. This remains acceptable at
   the current repository size because contract-like rules are routed through
   product rules, ADRs, runbooks, tests, and backlog entries.
3. `docs/product-rules.md`, `docs/backlog.md`, and
   `docs/planning/supabase-state-ledger.md` are still large context-expansion
   hotspots. Their indexes and routing rules currently make them manageable, but
   continued growth should trigger splitting or stronger sub-indexes.

### Suggested Improvements

1. Add automated checks for plan/spec header status if stale-plan regressions
   recur.
2. Consider a lightweight contracts index only if executable contracts
   multiply beyond the current ADR/runbook/product-rule routing model.
3. Re-check provider, pricing, package, and platform research against current
   primary docs before promoting old research notes into decisions.

## Remediation Applied

- Moved the signed-in Favourites plan's historical status and current-authority
  guidance ahead of the original worker instruction, and converted that
  instruction to provenance wording.
- Updated the multiplayer execution redesign spec status to match ADR 0015, the
  plan/spec ledger, and the Supabase state ledger.
- Added a `docs/superpowers/README.md` closeout rule requiring historical or
  completed plans/specs to put status and current authority before old worker
  instructions or checklist prompts.
- Added context-map routes for the notification top-bar affordance follow-up and
  documentation governance audit reports.
- Added this dated governance audit report under `docs/planning/`.

## Cross-Reference Integrity

Repository-owned Markdown link validation found no missing internal Markdown
files or anchors across `AGENTS.md`, `README.md`, `CONTEXT.md`, and `docs/`.

Backticked project-path validation found no missing project-owned paths for the
checked path prefixes: `AGENTS.md`, `README.md`, `CONTEXT.md`, `docs/`,
`assets/`, `tests/`, `supabase/`, `.github/`, `.htaccess`, `index.html`,
`package.json`, and `package-lock.json`.

The plan/spec status ledger covers every Markdown file under
`docs/superpowers/plans/` and `docs/superpowers/specs/`.

## ADR and Contract Integrity

ADR lifecycle state is explicit:

- ADRs 0001-0013 and 0015-0022 are accepted.
- ADR 0014 is superseded by ADR 0015 for future multiplayer execution and kept
  only as historical evidence for the earlier global active-Turn slice and its
  narrow mutation-authority principle.
- ADR 0013 remains accepted for game-start conversion authority and participant
  snapshot rules, while ADR 0015 supersedes only its global Slot Order
  assumption for future multiplayer execution.

No newer plan, research note, state ledger entry, or runbook was found silently
overriding an accepted ADR. Contract-like authority is still distributed as
intended:

- `docs/product-rules.md` owns accepted product, UX, game lifecycle, MVP scope,
  and validation rules.
- `docs/decisions/` owns durable architecture, governance, deployment, storage,
  and lifecycle boundaries.
- `docs/runbooks/` owns operational command contracts, approval paths, and
  mutation procedures.
- `docs/planning/supabase-state-ledger.md` owns hosted-state evidence only, not
  mutation procedure.
- Tests own executable workflow, deployment-surface, migration-surface, and
  browser behaviour contracts.

## Operational Consistency

Operational guidance remains aligned across root instructions, ADRs, runbooks,
state ledger, workflows, and tests:

- Source-only or docs-only changes should not trigger hosted static promotion.
- Runtime changes require fresh `dev` deployment and visible browser smoke
  before merge.
- Merged `main` runtime changes promote through `test` before any gated
  production deployment.
- Hosted Supabase migrations, provider changes, Storage writes, and hosted data
  write/cleanup smokes require explicit owner approval or an accepted
  task-specific plan.
- GitHub CLI authentication failures from sandboxed `gh` commands should be
  rerun with escalation before being treated as real auth failures.
- Node/npm execution from Codex should follow the Node runbook rather than
  reinstalling tooling or copying binaries into the repository.

No unresolved operational conflict remains from this audit.

## Governance Recommendations

1. Keep `docs/planning/agent-context-map.md` as the first-hop routing surface and
   add routes there rather than creating parallel authority maps.
2. Keep `docs/superpowers/README.md` as the plan/spec status ledger and update
   it in the same change as any plan/spec header status change.
3. When a plan completes, preserve detailed task history only as provenance and
   ensure the file's first screen routes to current authority before showing old
   implementation steps.
4. Keep hosted Supabase migration/deployment evidence in
   `docs/planning/supabase-state-ledger.md`; do not let dated evidence drift
   back into the procedural runbook.
5. Split or sub-index large ledgers only when the current indexes stop allowing
   a future agent to route to the needed section without loading the whole file.

## Scorecard

| Dimension | Score | Justification |
| --- | ---: | --- |
| Authority clarity | 9/10 | Root policy, context map, ADRs, runbooks, backlog, and state ledger have clear ownership. Remaining risk is mostly large-document navigation, not conflicting authority. |
| Routing quality | 9/10 | First-hop routing now covers the new notification follow-up and governance reports; all critical documents are reachable from a small number of loads. |
| Cross-reference integrity | 10/10 | Repository-owned Markdown links and checked project-path references resolve, and every plan/spec has a ledger row. |
| Context efficiency | 8/10 | Progressive disclosure is strong, but product rules, backlog, and the Supabase state ledger remain large enough to require heading-level routing. |
| Progressive disclosure | 9/10 | `AGENTS.md`, the context map, backlog index, state ledger purpose, and plan/spec ledger consistently tell agents what to open next and what not to load by default. |
| Agent operability | 9/10 | A new agent can answer what is authoritative, what to read next, what is mutable, and where to document new knowledge with few document loads. |
| Drift resistance | 9/10 | ADR supersession, plan/spec status, deployment/test gates, and state-ledger provenance are explicit; the main remaining drift risk is future stale plan headers. |
| Overall documentation architecture | 9/10 | The architecture is sound and improved by this pass. Further gains would be automated status/link checks or splitting large ledgers if growth continues. |
