# Participant-Scoped Started Game Loader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Status:** Historical/completed source implementation at `ed5e0f4`. This plan
does not authorise hosted Supabase migration application, deployment, or
browser smoke; use the Supabase and deployment runbooks with separate approval.

**Goal:** Add a narrow, participant-authorised Started Game loader for issue #228 without depending on the Multiplayer dashboard payload.

**Architecture:** The browser calls one authenticated public RPC, load_game_play_surface(target_game_id uuid). Its security-invoker wrapper delegates to a private security-definer loader, which authorises auth.uid() before constructing a deliberately small JSON state. Both local and Supabase repositories expose loadGamePlaySurface({ accountId, gameId }); #229 will consume it to render the interface.

**Tech Stack:** Vanilla ES modules, Node built-in test runner, Supabase/Postgres migrations, and the browser Supabase RPC client.

## Global Constraints

- Preserve ADR 0015 participant-section authority and ADR 0016 cancellation authority.
- Preserve ADR 0027: the route selects presentation only; it grants no access.
- Do not read the full Multiplayer dashboard, grant direct browser table access, or expose another participant's section kind, rows, entries, profile ID, or assignment ID.
- State is exactly one of active, waiting, completed, revealed, cancelled, or unavailable. Unavailable has no Game context.
- Only active contains currentSection; only revealed contains phrases.
- Authorised cancellation is cancelled. Invalid IDs, stale non-started IDs, and non-participants are the indistinguishable unavailable state.
- Keep #228 data-only: do not change Game Play Surface rendering, dashboard cards, Take turn, submission, or Reveal UI. Those belong to later child issues.
- Do not apply the source migration to a hosted environment in this slice. Hosted schema mutation remains separately approval-gated.

## File Structure

- assets/pending-game.js: local and Supabase repository implementations plus response recovery.
- tests/pending-game.test.mjs: public repository seam and Supabase adapter tests.
- supabase/migrations/20260709225028_participant_scoped_started_game_loader.sql: private authorising loader and authenticated public wrapper.
- tests/supabase-migration-surface.test.mjs: migration signature, grant, and no-broad-access assertions.
- docs/superpowers/plans/2026-07-09-participant-scoped-started-game-loader.md: this historical implementation plan.
- docs/superpowers/README.md: plan-status ledger entry.

---

### Task 1: Define the local repository state contract

**Files:**
- Modify: tests/pending-game.test.mjs
- Modify: assets/pending-game.js

**Consumes:** createTestPendingGameRepository, the durable participant-section fixture, and a current Account ID.

**Produces:** loadGamePlaySurface({ accountId, gameId }) with these public shapes:

    { state: "active", game: { id, rowCount, participants }, currentSection }
    { state: "waiting", game: { id, rowCount, participants } }
    { state: "completed", game: { id, rowCount, participants } }
    { state: "revealed", game: { id, rowCount, participants }, phrases }
    { state: "cancelled", game: { id, rowCount, participants } }
    { state: "unavailable" }

- [x] **Step 1: Write failing local-contract tests**

  Add one test each for active, waiting, completed-unrevealed, revealed, authorised cancellation, and unavailable/non-participant state. Build every fixture through the repository's public Pending Game lifecycle. The active test must prove the current section has empty row values; the revealed test must assert the known phrase literal; all other state tests must assert that phrases are absent.

      const state = await repository.loadGamePlaySurface({
        accountId: creatorProfile.accountId,
        gameId: startedGame.id,
      });

      assert.equal(state.state, "active");
      assert.deepEqual(state.currentSection.rows, [{ rowIndex: 0, value: "" }]);
      assert.equal(JSON.stringify(state).includes(inviteeProfile.profileId), false);
      assert.equal(JSON.stringify(state).includes(inviteeProfile.accountId), false);

- [x] **Step 2: Run the tests and verify red**

      node --test tests/pending-game.test.mjs

  Expected: the new tests fail because loadGamePlaySurface does not exist.

- [x] **Step 3: Implement the local loader**

  Add loadGamePlaySurface to createTestPendingGameRepository. Resolve the Account Profile, require a matching Started Game participant before creating any context, then use the existing findCurrentAssignedSection, completion, reveal, and cancellation predicates.

  Add a focused helper that exposes gamer tags only:

      function createGamePlaySurfaceGameDto({ gameId, pendingGame }) {
        return {
          id: gameId,
          rowCount: pendingGame.rowCount,
          participants: pendingGame.participants.map(toMultiplayerParticipantDto),
        };
      }

  Return unavailable before creating the game DTO when no Account Profile, Game, Started Game source, or participant authorisation exists. Return cancelled only after authorising that participant.

- [x] **Step 4: Run the tests and verify green**

      node --test tests/pending-game.test.mjs

  Expected: all pending-game tests pass, including six new state tests.

- [x] **Step 5: Commit**

      git add assets/pending-game.js tests/pending-game.test.mjs
      git commit -m "Add participant-scoped local game loader"

### Task 2: Route the Supabase repository through one narrow RPC

**Files:**
- Modify: tests/pending-game.test.mjs
- Modify: assets/pending-game.js

**Consumes:** load_game_play_surface RPC output matching Task 1's state union.

**Produces:** createSupabasePendingGameRepository(...).loadGamePlaySurface({ accountId, gameId }) with no table query and no dashboard-RPC call.

- [x] **Step 1: Write failing adapter tests**

  Extend createFakePendingGameSupabase with loader fixtures for the six state shapes. Assert the adapter makes one RPC call, sends only target_game_id, and makes no direct table call.

      const state = await repository.loadGamePlaySurface({
        accountId: creatorProfile.accountId,
        gameId: "supabase-started-game-1",
      });

      assert.deepEqual(supabase.rpcCalls, ["load_game_play_surface"]);
      assert.deepEqual(supabase.rpcParams, [{ target_game_id: "supabase-started-game-1" }]);
      assert.deepEqual(supabase.tableCalls, []);
      assert.equal(state.state, "active");

  Add a recovery test proving null or malformed loader data becomes unavailable and cannot carry profile IDs, account IDs, or another participant's section into the public result.

- [x] **Step 2: Run the tests and verify red**

      node --test tests/pending-game.test.mjs

  Expected: adapter tests fail because the repository does not call load_game_play_surface.

- [x] **Step 3: Implement the adapter and recovery allowlist**

      async loadGamePlaySurface({ accountId, gameId }) {
        assertAccountId(accountId);
        assertText(gameId, "A Started Game id is required.");

        const response = await supabase.rpc("load_game_play_surface", {
          target_game_id: gameId,
        });
        assertNoSupabaseError(response, "Could not load Game Play Surface");
        return recoverGamePlaySurface(response.data);
      }

  Implement recoverGamePlaySurface as an allowlist for the six state shapes. It accepts gamer-tag-only participant summaries, preserves the caller's active-section ID, Entry Kind, and rows, and preserves phrases only in revealed.

- [x] **Step 4: Run the tests and verify green**

      node --test tests/pending-game.test.mjs

  Expected: all pending-game tests pass; fake Supabase sees only the loader RPC.

- [x] **Step 5: Commit**

      git add assets/pending-game.js tests/pending-game.test.mjs
      git commit -m "Load game play state through narrow RPC"

### Task 3: Add the RLS-safe database loader migration

**Files:**
- Create: Supabase-generated migration for participant_scoped_started_game_loader
- Modify: tests/supabase-migration-surface.test.mjs

**Consumes:** auth.uid(), games, game_participants, game_section_assignments, multiplayer_batch_reveals, and existing private phrase rendering.

**Produces:** public.load_game_play_surface(target_game_id uuid) returns jsonb, executable only by authenticated.

- [x] **Step 1: Write the failing migration-surface test**

  Add participantScopedStartedGameLoaderMigrationUrl = findMigrationUrl("participant_scoped_started_game_loader"). Assert that the migration creates both functions, uses security definer set search_path = '' only in private.load_game_play_surface, uses security invoker in the public wrapper, revokes execution from public, anon, and service_role, grants execution only to authenticated, and contains no browser-role table grant.

- [x] **Step 2: Run the test and verify red**

      node --test tests/supabase-migration-surface.test.mjs

  Expected: findMigrationUrl cannot find the source migration.

- [x] **Step 3: Create and implement the migration**

  Discover the installed command first:

      npx --yes supabase migration new --help

  Create the timestamped file:

      npx --yes supabase migration new participant_scoped_started_game_loader

  Implement private.load_game_play_surface(target_game_id uuid) as a security-definer function with set search_path = ''. It must:

  1. obtain caller_account_id from auth.uid();
  2. resolve caller profile and Game participant before querying lifecycle data;
  3. return unavailable for no caller, non-participant, missing Game, or non-started/non-cancelled source;
  4. return cancelled for an authorised participant of a cancelled Started Game;
  5. return active with only the caller's current active assignment and generated row indexes;
  6. return completed until the caller's own reveal exists, then revealed with private.render_multiplayer_phrases output;
  7. otherwise return waiting.

  Add the public wrapper:

      create or replace function public.load_game_play_surface(target_game_id uuid)
      returns jsonb
      language sql
      security invoker
      set search_path = ''
      as $load_game_play_surface_public_wrapper$
        select private.load_game_play_surface(target_game_id);
      $load_game_play_surface_public_wrapper$;

  Revoke all roles first, then grant execute to authenticated only for both functions. Do not alter table grants, RLS policies, submission RPCs, or Reveal RPCs.

- [x] **Step 4: Run the migration test and verify green**

      node --test tests/supabase-migration-surface.test.mjs

  Expected: all migration-surface tests pass, including function/privilege/no-broad-access assertions.

- [x] **Step 5: Commit**

      git add supabase/migrations tests/supabase-migration-surface.test.mjs
      git commit -m "Add participant-scoped game loader RPC"

### Task 4: Record the plan and verify the full slice

**Files:**
- Modify: docs/superpowers/README.md
- Modify: docs/superpowers/plans/2026-07-09-participant-scoped-started-game-loader.md

**Consumes:** Tasks 1–3 and issue #228.

**Produces:** active-plan ledger evidence, complete test evidence, and a #228 tracker comment that does not claim hosted migration execution.

- [x] **Step 1: Add the active-plan ledger row**

  Add the row for this plan, owned by #228, with issue #228, ADRs 0015/0016/0027, product rules, and the Supabase runbook as current authority.

- [x] **Step 2: Run focused verification**

      node --test tests/pending-game.test.mjs tests/supabase-migration-surface.test.mjs

  Expected: all focused tests pass.

- [x] **Step 3: Run full verification**

      npm test

  Expected: zero failures. Do not run a hosted-data mutation smoke; deployment approval never authorises it.

- [x] **Step 4: Review and update the tracker**

      git diff --check main...HEAD
      git diff --stat main...HEAD

  Comment on #228 with the exact RPC name, state union, concealment boundary, test evidence, and that the source migration still needs separately approved hosted application.

- [x] **Step 5: Commit the plan-status closeout**

      git add docs/superpowers/README.md docs/superpowers/plans/2026-07-09-participant-scoped-started-game-loader.md
      git commit -m "Record started game loader plan"

## Plan Self-Review

- Spec coverage: Tasks 1–3 cover every #228 acceptance state, caller-only phrases, participant concealment, independent dashboard-free loading, cancellation distinction, RPC signature, grants, and RLS-safe shape.
- Placeholder scan: the migration filename is generated by the required Supabase CLI command; all other file names, commands, interfaces, and expected results are explicit.
- Type consistency: both repositories expose loadGamePlaySurface({ accountId, gameId }); the public RPC takes target_game_id; all consumers use the same six-state union.

## Execution Evidence

- The generated source migration is
  `20260709225028_participant_scoped_started_game_loader.sql`.
- Focused verification passed 96 tests across the pending-game and
  migration-surface suites. Full `npm test` passed 342 tests across 23 suites;
  `git diff --check` passed.
- The review found no remaining Critical or Important issues after the Supabase
  adapter state matrix and stale-source assertion were added.
- Issue #228 contains the source-only implementation receipt. No hosted
  Supabase migration, data mutation, deployment, or browser smoke occurred;
  hosted migration application remains separately approval-gated.
