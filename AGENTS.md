# AGENTS.md

## Role

You are assisting with the Crazy Phrases web app project.

This repository is the source-controlled working copy for the `crazyphrases.com` static site, product documentation, implementation plans, runbooks, and future app code. Production, test, and development deployments are managed through documented GitHub Actions and hosting workflows; do not mutate live systems without explicit user approval or an approved deployment workflow.

## Source of Truth

- Repository files are the working source of truth for product rules, plans, decisions, runbooks, and proposed changes.
- GitHub Issues are the source of truth for PRDs and implementation tickets after they are published.
- Deployed environments are runtime validation targets, not design authorities.
- If repository documentation and runtime validation conflict, report the conflict before mutating production or deployment configuration.

## Default Source Reading Order

1. `AGENTS.md`
2. `README.md`
3. `docs/planning/agent-context-map.md` for document ownership and routing.
4. `CONTEXT.md` for project domain vocabulary.
5. `docs/product-rules.md` for accepted product and UX rules.
6. The relevant ADR under `docs/decisions/`.
7. The relevant runbook under `docs/runbooks/`.
8. The relevant backlog, research, plan, or source file for the task.

Do not read every planning, backlog, output, or generated file by default. Load the smallest authoritative set that can answer the task.

## Agent Skills

### Issue Tracker

Issues and PRDs are tracked in GitHub Issues for `vince-hardwick/crazyphrases`. See `docs/agents/issue-tracker.md`.

### Triage Labels

Use the default triage label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain Docs

This is a single-context repo with root `CONTEXT.md` and repo-wide decisions under `docs/decisions/`. See `docs/agents/domain.md`.

## Documentation Policy

- Update only the owning document for a change.
- Use `CONTEXT.md` only for domain vocabulary. Do not put specifications, implementation notes, or product rules there.
- Use `docs/product-rules.md` for accepted product, UX, game lifecycle, MVP scope, and validation rules.
- Use `docs/planning/agent-context-map.md` for routing and document ownership.
- Use `docs/backlog.md` for intentionally deferred work, with enough context to resume later.
- Use `docs/decisions/` for ADRs that record durable architecture, governance, deployment, or lifecycle boundaries.
- Use `docs/runbooks/` for operational procedures, deployment flows, authentication setup, and command contracts.
- Use `docs/research/` for candidate sources and evaluation notes that are not yet accepted decisions.
- Use `docs/superpowers/plans/` for implementation plans and staged execution checklists.

When accepted design knowledge creates or changes a durable boundary, lifecycle rule, execution profile, path convention, validation rule, deferral, or deployment assumption, update the owning document before moving on.

## ADR Policy

Create or update an ADR when a decision is durable, non-obvious, and would be costly or risky for a future agent to reverse without context. Prefer ADRs for:

- deployment or environment authority boundaries;
- source-of-truth rules;
- data lifecycle and deletion rules;
- template/versioning or game-history invariants;
- authentication, secrets, or live-mutation policies;
- technology choices that create meaningful lock-in;
- deliberate deviations from an obvious implementation path.

Do not create ADRs for every product preference. Product behaviour normally belongs in `docs/product-rules.md`; implementation tasks belong in plans or issues; deferred ideas belong in `docs/backlog.md`.

## Environment and Mutation Policy

- Development review happens in `dev`; formal testing happens in `test`; production promotion happens only after automated tests pass and human acceptance is completed in `test`.
- Detecting a hostname, branch, GitHub Environment, deployment target, or runtime context does not authorize mutation.
- GitHub Environment approval authorizes deployment; Cloudflare Access authorizes browser access; cPanel access authorizes origin hosting changes. These authorities are separate.
- Authenticated GitHub CLI commands from Codex may need sandbox escalation to access the Windows keyring. See `docs/runbooks/github-cli-auth-for-codex.md`.
- Do not store tokens in the repository, project-local config, checked-in scripts, or long-lived plaintext environment variables.

## Validation Policy

Use risk-tiered validation:

- Documentation-only changes: inspect diffs and check links/paths where practical.
- Static frontend changes: run the relevant local tests and a browser smoke test when available.
- Deployment workflow changes: validate workflow syntax or dry-run paths where practical, then use `dev` before `test`.
- Production-impacting changes: require explicit approval or the documented GitHub Environment gate, plus post-deployment verification.

Do not report success for production, deployment, or runtime work unless the relevant validation has passed.

## Session Closeout Rules

Before ending or switching away from design, planning, runbook, or operational-methodology work:

1. Check whether any accepted term, lifecycle rule, validation rule, path convention, environment boundary, or deferral was created or changed.
2. Update the owning document, ADR, runbook, backlog, or plan.
3. If implementation work was done, run the relevant verification.
4. Stage, commit, and push documentation changes with related code changes unless the user explicitly instructs otherwise.
5. Report changed files, validation performed, commit hash when applicable, and remaining risks.

## Style

Use UK English in user-facing copy and domain documentation. Be concise, exact, and implementation-oriented.

