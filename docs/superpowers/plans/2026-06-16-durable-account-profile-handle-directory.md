# Durable Account Profile and Handle Directory Implementation Plan

> **Status:** Historical/completed. Do not execute this plan as active work. Current authority lives in ADR 0011, `docs/product-rules.md`, `docs/backlog.md`, `docs/runbooks/supabase-auth-and-postgres.md`, and GitHub Issues.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a durable Supabase-backed Account Profile and signed-in Handle Directory prerequisite without implementing multiplayer invites.

**Architecture:** Keep the existing static JavaScript shape. Add a focused profile repository module, wire it optionally into the Supabase Auth session, and add a source-controlled migration with RLS. Handle lookup returns invite-safe profile data and does not expose email addresses or raw Supabase Auth user ids.

**Tech Stack:** Plain JavaScript modules, Node `node:test`, Supabase JavaScript browser client conventions, Supabase Postgres migrations.

---

### Task 1: Durable Profile Repository

**Files:**
- Create: `assets/account-profile.js`
- Create: `tests/account-profile.test.mjs`

- [x] **Step 1: Write the failing memory repository test**

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createMemoryAccountProfileRepository } from "../assets/account-profile.js";

describe("Account Profile repository", () => {
  it("creates and looks up durable profiles without exposing Auth identity", async () => {
    const repository = createMemoryAccountProfileRepository({
      createProfileId: () => "profile-directory-1",
    });

    const profile = await repository.ensureOwnProfile({
      accountId: "auth-account-1",
    });
    const duplicate = await repository.ensureOwnProfile({
      accountId: "auth-account-1",
    });
    const lookup = await repository.lookupProfileByHandle({
      handle: profile.handle.toUpperCase(),
    });

    assert.deepEqual(duplicate, profile);
    assert.deepEqual(lookup, {
      profileId: "profile-directory-1",
      handle: profile.handle,
      gamerName: "Player",
      avatarKey: profile.avatarKey,
    });
    assert.equal("accountId" in lookup, false);
    assert.equal(JSON.stringify(lookup).includes("auth-account-1"), false);
  });
});
```

- [x] **Step 2: Run RED**

Run: `npm test -- tests/account-profile.test.mjs`

Expected: FAIL because `assets/account-profile.js` does not exist or does not export `createMemoryAccountProfileRepository`.

- [x] **Step 3: Implement the memory repository**

Create `assets/account-profile.js` with `createMemoryAccountProfileRepository`, `ensureOwnProfile`, `updateOwnProfile`, `loadOwnProfile`, and `lookupProfileByHandle`. Reuse `createDefaultProfile` from `account-shell.js`.

- [x] **Step 4: Run GREEN**

Run: `npm test -- tests/account-profile.test.mjs`

Expected: PASS for the new repository test.

### Task 2: Supabase Profile Repository

**Files:**
- Modify: `assets/account-profile.js`
- Modify: `tests/account-profile.test.mjs`

- [x] **Step 1: Write the failing Supabase repository test**

Add a test proving `createSupabaseAccountProfileRepository({ supabase })` inserts one default profile, returns the existing profile on a second ensure, and looks up by normalised Handle without returning `accountId`.

- [x] **Step 2: Run RED**

Run: `npm test -- tests/account-profile.test.mjs`

Expected: FAIL because the Supabase repository is not implemented.

- [x] **Step 3: Implement the Supabase repository**

Add `createSupabaseAccountProfileRepository({ supabase })`. Use `account_profiles`, select `profile_id, handle, gamer_name, avatar_key`, insert with `account_id`, and retry default Handle suffixes only on unique Handle conflicts.

- [x] **Step 4: Run GREEN**

Run: `npm test -- tests/account-profile.test.mjs`

Expected: PASS for memory and Supabase repository tests.

### Task 3: Auth Session Profile Hydration

**Files:**
- Modify: `assets/supabase-auth-session.js`
- Modify: `tests/supabase-auth-session.test.mjs`

- [x] **Step 1: Write the failing auth-session test**

Add a test proving `createSupabaseAuthSession({ supabase, profileRepository })` calls `profileRepository.ensureOwnProfile({ accountId })` and passes the returned durable profile into the Account shell.

- [x] **Step 2: Run RED**

Run: `npm test -- tests/supabase-auth-session.test.mjs`

Expected: FAIL because `profileRepository` is ignored.

- [x] **Step 3: Implement optional profile hydration**

Update `createSupabaseAuthSession` so `loadAccountShell()` uses `profileRepository.ensureOwnProfile()` when the dependency is supplied, while preserving the existing default-profile path when it is absent.

- [x] **Step 4: Run GREEN**

Run: `npm test -- tests/supabase-auth-session.test.mjs`

Expected: PASS for existing and new auth-session tests.

### Task 4: Supabase Migration Surface

**Files:**
- Create: `supabase/migrations/20260615234349_create_account_profiles.sql`
- Modify: `tests/supabase-migration-surface.test.mjs`
- Modify: `docs/runbooks/supabase-auth-and-postgres.md`
- Modify: `docs/product-rules.md`
- Add: `docs/decisions/0011-account-profile-handle-directory.md`
- Modify: `docs/decisions/README.md`
- Modify: `docs/planning/agent-context-map.md`

- [x] **Step 1: Write the failing migration-surface test**

Add assertions for `public.account_profiles`: `profile_id`, `account_id`, `handle`, `gamer_name`, `avatar_key`, global Handle uniqueness, RLS enabled, no `anon` grant, signed-in select, owner-only insert/update, and lookup-safe selected columns.

- [x] **Step 2: Run RED**

Run: `npm test -- tests/supabase-migration-surface.test.mjs`

Expected: FAIL because the migration file does not exist.

- [x] **Step 3: Create the migration and documentation**

Use `npx supabase migration new create_account_profiles` where available, then fill the migration. Update product rules, ADR/runbook routing, and the Supabase runbook with the source-controlled migration contract. Do not apply the migration to hosted Supabase without explicit owner approval.

- [x] **Step 4: Run GREEN**

Run: `npm test -- tests/supabase-migration-surface.test.mjs`

Expected: PASS for all migration-surface tests.

### Task 5: Full Verification and Issue Publishing

**Files:**
- Modify: `docs/superpowers/specs/2026-06-16-durable-account-profile-handle-directory-prd.md`

- [x] **Step 1: Run the full automated suite**

Run: `npm test`

Expected: all tests pass with zero failures.

- [x] **Step 2: Publish GitHub issues**

Create a PRD issue from the spec and one ready-for-agent implementation issue for this first slice. Update the spec with the published issue numbers.

- [x] **Step 3: Inspect diffs and commit**

Run: `git diff --check`, inspect `git diff --stat`, stage related files, and commit on `codex/durable-account-profile-handle-directory`.
