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
| Operational commands, deployment procedures, auth setup, and approval-gated flows | `docs/runbooks/*.md` | Runbooks own exact command shapes and operational sequencing. |
| Deferred product or operational work | `docs/backlog.md` | Deferrals include what is deferred, why, revisit trigger, and remaining risk. |
| Candidate sources and research notes | `docs/research/*.md` | Research is not accepted architecture until promoted to rules or ADRs. |
| Active implementation plans and checklist state | `docs/superpowers/plans/*.md` | Completed plans are historical provenance, not first-hop context. |
| Design-session specs and raw planning input | `docs/superpowers/specs/*.md` | Promote durable content to product rules, ADRs, runbooks, or backlog. |
| Agent skill configuration | `docs/agents/*.md` | Issue tracker, triage label, and domain-doc consumption rules for skills. |

## Common Routes

| Topic | Open |
| --- | --- |
| MVP anonymous solo behaviour | `docs/product-rules.md` |
| Domain language for game concepts | `CONTEXT.md` |
| Deferred future features | `docs/backlog.md` |
| Word-bank source candidates | `docs/research/word-bank-sources.md` |
| Deployment environments and promotion order | `docs/runbooks/cloudflare-dns-and-access.md` |
| Branch-based dev deployment and main promotion | `docs/decisions/0009-branch-based-dev-and-main-promotion.md` |
| Production static hosting | `docs/runbooks/live-static-hosting.md` |
| GitHub CLI authentication from Codex | `docs/runbooks/github-cli-auth-for-codex.md` |
| Node, npm, npx, and package installs from Codex | `docs/runbooks/node-npm-for-codex.md` |
| Static-first anonymous solo architecture | `docs/decisions/0008-static-first-anonymous-solo.md` |
| Cached word-bank architecture | `docs/decisions/0004-cached-word-bank-for-entry-candidates.md` |

## Historical Context

Open older plans, specs, generated output, and screenshots only when investigating provenance, debugging a regression, or resuming an explicitly routed unfinished task.
