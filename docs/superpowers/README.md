# Superpowers Plan and Spec Status Ledger

## Purpose

This file is the plan/spec status ledger for `docs/superpowers/`. Use it to
decide whether a plan or spec is active, completed, abandoned, superseded, or
only historical provenance before opening the full document.

The directory contains planning provenance. Use it to understand why a slice was
designed or implemented, not as the first source of current product,
architecture, or operational authority.

Current authority lives in:

- `docs/product-rules.md` for accepted product behaviour.
- `docs/decisions/` for durable architecture and governance decisions.
- `docs/runbooks/` for operational commands and approval-gated flows.
- `docs/backlog.md` for intentionally deferred work and next-session state.
- GitHub Issues for published PRDs and implementation tickets.

## Loading Rule

Before opening an older plan or spec, search this index and the routed owning
document first. Open the full plan/spec only when investigating provenance,
debugging a regression, or resuming a task that this index and the backlog still
mark as active.

Completed and historical plans/specs must not override product rules, ADRs,
runbooks, backlog entries, or GitHub issue state.

## Status Rules

- **Active**: The plan/spec is still executable. The row must name the owning
  task, issue, or backlog item and the next expected action.
- **Historical/completed**: The work is complete or no longer executable. The
  row must name the current authority for future changes.
- **Superseded**: A newer plan, ADR, product rule, runbook, backlog item, or
  issue replaced this document. The row must name the replacement authority.
- **Abandoned**: The work was intentionally stopped. The row must name the
  deferral, `wontfix`, or follow-up route that explains why.

## Status Index

| Document | Status | Current Authority |
| --- | --- | --- |
| `plans/2026-06-08-bare-landing-page.md` | Historical. The holding-page slice has been superseded by the current static Crazy Phrases app. | `README.md`, `docs/runbooks/live-static-hosting.md` |
| `plans/2026-06-10-mvp-slice-order.md` | Historical. The original slice-order decision has been executed. | `docs/backlog.md`, `docs/product-rules.md` |
| `plans/2026-06-16-durable-account-profile-handle-directory.md` | Historical/completed. Do not execute as an active plan. | `docs/decisions/0011-account-profile-handle-directory.md`, `docs/runbooks/supabase-auth-and-postgres.md`, GitHub issue #43 and child issues |
| `plans/2026-06-16-pending-game-foundation.md` | Historical/completed. Do not execute as an active plan. | `docs/backlog.md` section `Signed-in 2-player asynchronous game`, `docs/runbooks/supabase-auth-and-postgres.md` |
| `plans/2026-06-18-started-game-turn-submission.md` | Historical/completed. Do not execute as an active plan. | `docs/decisions/0014-started-game-turn-submission-authority.md`, `docs/product-rules.md`, `docs/runbooks/supabase-auth-and-postgres.md`, `docs/planning/supabase-state-ledger.md` |
| `plans/2026-06-18-participant-section-multiplayer-foundation.md` | Historical/source-controlled complete. Do not execute as an active source plan; PR #57 is merged to `main` and promoted through production. | ADR 0015, `docs/product-rules.md`, `docs/runbooks/supabase-auth-and-postgres.md`, `docs/planning/supabase-state-ledger.md`, `docs/backlog.md`, PR #57 |
| `plans/2026-06-26-signed-in-favourites.md` | Historical/completed. Do not execute as an active plan; future changes should use product rules, tests, and source files as authority. | `docs/product-rules.md`, `assets/app.js`, `assets/site.css`, `assets/favourites-view-model.js`, `tests/browser-smoke.test.mjs`, `tests/favourites-view-model.test.mjs` |
| `specs/2026-06-08-bare-landing-page-design.md` | Historical. | `README.md`, `docs/runbooks/live-static-hosting.md` |
| `specs/2026-06-11-anonymous-solo-mvp-prd.md` | Published historical PRD. | GitHub issue #1, `docs/product-rules.md`, ADRs 0004 and 0008 |
| `specs/2026-06-12-signed-in-foundation-solo-persistence-prd.md` | Published historical PRD. | GitHub issue #22, ADR 0010, `docs/product-rules.md`, `docs/runbooks/supabase-auth-and-postgres.md` |
| `specs/2026-06-15-private-phrase-and-batch-favourites-prd.md` | Published PRD provenance. Current child-ticket status belongs to GitHub Issues and backlog. | GitHub issue #33 and child issues, `docs/product-rules.md`, `docs/backlog.md`, `docs/runbooks/supabase-auth-and-postgres.md` |
| `specs/2026-06-16-durable-account-profile-handle-directory-prd.md` | Published PRD provenance. Durable profile, MVP profile-management, avatar-upload personalisation, circular crop derivatives, and visual cropper UX are complete. | GitHub issues #43, #47, #63, #64, and #79; ADRs 0011, 0019, 0020, and 0021; `docs/backlog.md` |
| `specs/2026-06-16-pending-game-foundation-design.md` | Historical/completed design for the backend foundation slice. | `docs/backlog.md`, `docs/product-rules.md`, `docs/runbooks/supabase-auth-and-postgres.md` |
| `specs/2026-06-18-multiplayer-execution-redesign.md` | Approved design provenance. Source-controlled participant-section foundation is complete; PR #57 is merged to `main` and promoted through production. | ADR 0015, `docs/product-rules.md`, `docs/backlog.md`, `docs/runbooks/supabase-auth-and-postgres.md`, `docs/planning/supabase-state-ledger.md`, PR #57 |
| `specs/2026-06-25-uploaded-avatar-circular-crop-derived-image-prd.md` | Published PRD provenance. #64 shipped through PR #78 and production promotion; #79 shipped through PR #92 and production promotion. | GitHub issues #64 and #79; ADRs 0019 and 0021; `docs/product-rules.md`; `docs/backlog.md`; `docs/planning/supabase-state-ledger.md` |
| `specs/2026-06-26-signed-in-favourites-design.md` | Approved design provenance. Implementation is complete; do not treat this as pending design or implementation work. | `docs/product-rules.md`, `docs/backlog.md`, `assets/app.js`, `assets/site.css`, `tests/browser-smoke.test.mjs` |

## Adding Future Plans Or Specs

When adding a new plan or spec:

1. Add a clear status near the top of the file.
2. Add a row to this index.
3. When the work completes, is abandoned, or is superseded, update both this
   index row and the file header in the same change.
4. In historical or completed plan/spec files, put status and current authority
   before any old worker instructions, checkbox tasks, or implementation
   prompts.
5. Promote durable rules to the owning product rule, ADR, runbook, or backlog
   document before closing the task.
6. Do not leave checkbox state inside a plan/spec as the only signal of current
   status. Completed, abandoned, and superseded documents must route readers to
   the current authority or follow-up location.
