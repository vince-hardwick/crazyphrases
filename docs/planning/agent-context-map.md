# Agent Context Map

## Purpose

This map is the first-hop routing surface for agents working in this repository. Use it after `AGENTS.md` and `README.md` to decide which authoritative document to open next.

## Loading Rule

Load the smallest authoritative set that can answer the task:

1. `AGENTS.md`
2. `README.md`
3. this map
4. `CONTEXT.md`
5. only the routed product rule, ADR, runbook, backlog item, plan, research note, or source file needed for the task

For large documents, search for the relevant heading first and then read that section. Do not load all backlog, runbook, plan, spec, or research documents unless the task is a documentation-governance audit or explicitly asks for repository-wide context.

## Authority Matrix

| Information Type | Owning Document Class | Notes |
| --- | --- | --- |
| Mandatory agent policy, approval boundaries, reading order, closeout rules | `AGENTS.md` | Do not duplicate detailed product rules here. |
| Human/project entry point and common project links | `README.md` | Link to deeper docs rather than restating contracts. |
| Agent routing and document ownership | `docs/planning/agent-context-map.md` | This file routes; it does not own detailed rules. |
| Canonical domain vocabulary | `CONTEXT.md` | Glossary only. No specifications or implementation detail. |
| Accepted product, UX, game lifecycle, MVP scope, and validation rules | `docs/product-rules.md` | First stop for feature behaviour and MVP boundaries. |
| Durable architectural, governance, lifecycle, or deployment decisions | `docs/decisions/*.md` | ADRs explain why a durable boundary exists. |
| ADR index and creation guidance | `docs/decisions/README.md` | Keep the decision list and ADR policy discoverable. |
| Operational commands, deployment procedures, auth setup, and approval-gated flows | `docs/runbooks/*.md` | Runbooks own exact command shapes and operational sequencing. For authenticated GitHub CLI work, route to `docs/runbooks/github-cli-auth-for-codex.md` before interpreting sandboxed auth failures. |
| Deferred product or operational work | `docs/backlog.md` | Deferrals include what is deferred, why, revisit trigger, and remaining risk. |
| Hosted Supabase migration, deployment, smoke, and state evidence | `docs/planning/supabase-state-ledger.md` | Evidence/provenance only. The Supabase runbook owns procedures and mutation authority. |
| Candidate sources and research notes | `docs/research/*.md` | Research is not accepted architecture until promoted to rules or ADRs. |
| Superpowers plan/spec status and provenance routing | `docs/superpowers/README.md` | Check before executing or resuming older plans/specs. |
| Active implementation plans and checklist state | `docs/superpowers/plans/*.md` | Active only when the plan status says so. Completed or historical plans are provenance and must not override higher-authority docs. |
| Design-session specs and raw planning input | `docs/superpowers/specs/*.md` | Promote durable content to product rules, ADRs, runbooks, or backlog. Published PRDs defer current execution status to GitHub Issues and backlog entries. |
| Agent skill configuration | `docs/agents/*.md` | Issue tracker, triage label, and domain-doc consumption rules for skills. |
| Documentation governance audit and follow-up reports | `docs/planning/documentation-governance-*.md` | Historical audit evidence and recommendations, not product or operational authority. |

## Common Routes

| Topic | Open |
| --- | --- |
| MVP anonymous solo behaviour | `docs/product-rules.md` |
| Signed-in backend and auth source of truth | `docs/decisions/0010-supabase-auth-and-postgres-for-signed-in-state.md` |
| Account Profile and Handle Directory | `docs/decisions/0011-account-profile-handle-directory.md`, `docs/product-rules.md` |
| Additional hosted Auth providers | `docs/backlog.md` section `Additional hosted Auth providers`, `docs/runbooks/supabase-auth-and-postgres.md`; GitHub issue #89 |
| Branded hosted Auth domain | `docs/decisions/0022-branded-supabase-auth-deferral.md`, `docs/runbooks/supabase-auth-and-postgres.md`, `docs/runbooks/cloudflare-dns-and-access.md`, `docs/backlog.md` section `Branded Supabase Auth domain`; completed GitHub issues #83 and #84 |
| Uploaded Avatar storage | `docs/decisions/0019-uploaded-avatar-storage-authority.md`, `docs/decisions/0021-derived-cropped-images-for-uploaded-avatars.md`, `docs/runbooks/supabase-auth-and-postgres.md`, `docs/backlog.md` section `Uploaded Avatars` |
| Built-in Avatar icons | `docs/decisions/0020-font-awesome-kit-for-built-in-avatars.md`, `.font-awesome.md`, `docs/runbooks/font-awesome-kit.md`, `docs/product-rules.md` |
| Pending Game foundation and lifecycle slices | `docs/backlog.md` section `Signed-in 2-player asynchronous game`, `docs/product-rules.md`, `docs/decisions/0011-account-profile-handle-directory.md`, `docs/decisions/0012-pending-game-invite-response-authority.md`, `docs/decisions/0013-pending-game-start-conversion-authority.md`, `docs/decisions/0016-creator-controlled-multiplayer-cancellation.md`, `docs/decisions/0017-pending-game-invite-expiry.md`, `docs/decisions/0018-dashboard-triggered-nudge-generation.md`, `docs/runbooks/supabase-auth-and-postgres.md` |
| Supabase project operations | `docs/runbooks/supabase-auth-and-postgres.md` |
| Supabase hosted migration, deployment, or smoke evidence | `docs/planning/supabase-state-ledger.md` |
| Supabase schema migrations | `supabase/migrations/`, `docs/runbooks/supabase-auth-and-postgres.md` |
| Domain language for game concepts | `CONTEXT.md` |
| Deferred future features | `docs/backlog.md` |
| Word-bank source candidates | `docs/research/word-bank-sources.md` |
| MVP seed Word Bank asset and rules | `assets/word-bank-seed.json`, `docs/product-rules.md` |
| Deployment environments and promotion order | `docs/runbooks/cloudflare-dns-and-access.md`; for `gh workflow run`, `gh run view`, or other authenticated GitHub CLI commands, read `docs/runbooks/github-cli-auth-for-codex.md` first. |
| Visible in-app browser verification | `docs/runbooks/in-app-browser-verification.md` |
| Local static frontend smoke with in-app Codex Browser and Playwright | `docs/runbooks/in-app-browser-verification.md` - read the Local Static Site Fast Path before starting any local server or hidden Playwright run. |
| Deployed dev/test/production browser smoke with in-app Codex Browser and Playwright | `docs/runbooks/in-app-browser-verification.md`, `docs/runbooks/cloudflare-dns-and-access.md` |
| Browser side pane not visible, localhost refused, or Playwright wrapper limitations | `docs/runbooks/in-app-browser-verification.md` - use the failure-mode checklist before falling back to standalone or Edge-backed Playwright. |
| Branch-based dev deployment, protected `main`, required CI check, and main promotion | `docs/decisions/0009-branch-based-dev-and-main-promotion.md`, `docs/runbooks/cloudflare-dns-and-access.md` |
| Production static hosting | `docs/runbooks/live-static-hosting.md` |
| Git and GitHub CLI authentication from Codex, including sandboxed `401`, invalid-token, unauthenticated `403`, rate-limit, Windows keyring, `gh workflow run`, `gh run view`, issue, and PR commands | `docs/runbooks/github-cli-auth-for-codex.md` |
| Node, npm, npx, and package installs from Codex | `docs/runbooks/node-npm-for-codex.md` |
| Static-first anonymous solo architecture | `docs/decisions/0008-static-first-anonymous-solo.md` |
| Cached word-bank architecture | `docs/decisions/0004-cached-word-bank-for-entry-candidates.md` |
| Historical plan or PRD status | `docs/superpowers/README.md` |

## Historical Context

Open older plans, specs, generated output, and screenshots only when investigating provenance, debugging a regression, or resuming an explicitly routed unfinished task. Completed plans and historical PRDs are not authority for current implementation status; use the issue tracker, backlog, product rules, ADRs, and runbooks first.
