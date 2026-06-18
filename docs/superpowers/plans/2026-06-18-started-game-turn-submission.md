# Started Game Turn Submission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Historical/completed. Implemented by PR #56 and promoted through
`dev`, `test`, and production on 2026-06-18. Current authority lives in
`docs/product-rules.md`, ADR 0014, `docs/runbooks/supabase-auth-and-postgres.md`,
and `docs/planning/supabase-state-ledger.md`.

**Goal:** Let a signed-in participant load and submit their active Started Game turn without exposing other slots, entries, or Reveal.

**Architecture:** Add Postgres-owned turn and entry tables plus a narrow authenticated submission RPC. Extend the existing Pending Game repository seam so local tests, hosted Supabase, and the browser UI use the same public behaviours. Keep Reveal, Share Consent, expiry, cancellation UI, friends, nudges, public discovery, and broader profile/account work out of scope.

**Tech Stack:** Static JavaScript modules, Node `--test`, Playwright browser smoke, Supabase Postgres migrations and Row Level Security.

---

### Task 1: Repository Tracer Bullet

**Files:**
- Modify: `assets/pending-game.js`
- Modify: `tests/pending-game.test.mjs`

- [x] Write one failing test proving the creator can load the active turn after starting an accepted Pending Game.
- [x] Run `node --test tests/pending-game.test.mjs` and confirm the new test fails.
- [x] Add the minimal local repository state needed to create internal turns at game start and return a browser-safe active Turn DTO.
- [x] Re-run `node --test tests/pending-game.test.mjs` and confirm the test passes.

### Task 2: Turn Submission

**Files:**
- Modify: `assets/pending-game.js`
- Modify: `tests/pending-game.test.mjs`

- [x] Write one failing test proving the active participant submits one complete Turn with one Entry per row.
- [x] Run the targeted test and confirm it fails.
- [x] Add minimal repository validation for complete, non-empty submitted Entries and mark the Turn submitted.
- [x] Re-run the targeted test and confirm it passes.

### Task 3: Supabase Surface

**Files:**
- Create: `supabase/migrations/20260618120000_started_game_turn_submission.sql`
- Modify: `assets/pending-game.js`
- Modify: `tests/pending-game.test.mjs`
- Modify: `tests/supabase-migration-surface.test.mjs`

- [x] Write one failing Supabase-adapter test proving the hosted repository reads an active Turn through `game_turns`.
- [x] Add a failing migration-surface test for RLS, no direct entry insert grant, and the submission RPC.
- [x] Add the migration and Supabase repository implementation.
- [x] Re-run the targeted repository and migration tests.

### Task 4: Browser Slice

**Files:**
- Modify: `assets/app.js`
- Modify: `assets/site.css`
- Modify: `tests/browser-smoke.test.mjs`

- [x] Write one failing browser smoke assertion for submitting the first active Started Game Turn in local signed-in mode.
- [x] Render a compact active-turn form in the Multiplayer panel for the current account's active turn.
- [x] Submit the form through the repository and show a waiting state without rendering Reveal.
- [x] Re-run the browser smoke test.

### Task 5: Durable Docs And Verification

**Files:**
- Modify: `docs/product-rules.md`
- Modify: `docs/runbooks/supabase-auth-and-postgres.md`
- Modify: `docs/backlog.md`
- Modify: `docs/superpowers/README.md`
- Modify: `docs/decisions/README.md`

- [x] Record the accepted turn lifecycle, mutation authority, and deferred follow-up work.
- [x] Run the full bundled Node test suite.
- [x] Inspect the final diff for accidental scope expansion.
