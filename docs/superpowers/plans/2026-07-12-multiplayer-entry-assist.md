# Multiplayer Entry Assist Implementation Plan

> **Status:** Tasks 1-5 and Task 6 Steps 1-6 are complete, including hosted
> migration verification, development workflow run `29240601750` for source head
> `901ca431fd87808a902316674465689795926170`, the visible two-Account functional
> smoke, and bounded cleanup. Resume at Step 7: commit and verify this evidence,
> push the new head, then obtain a fresh approved development deployment for that
> exact final head. Merge, test, production, promotion, and tracker closeout
> remain approval-gated. Issue #230 and draft PR #248 remain open.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add family-friendly dice-based Entry Assist to the active Multiplayer Game Play Surface using server-approved immutable Word Bank Shard references pinned to each Started Game.

**Architecture:** A private Supabase registry owns the currently approved immutable adjective and noun shard references. Game-start logic snapshots those references on the Started Game, the participant-scoped loader exposes only the active Entry Kind's reference, and the browser provider fetches and validates that exact static shard without falling forward to the current manifest.

**Tech Stack:** Static HTML/CSS/JavaScript, Node.js test runner, Playwright browser tests, Supabase Postgres migrations and RPCs, immutable JSON Word Bank Shards.

## Global Constraints

- Work only in `codex/issue230-multiplayer-entry-assist` under `.worktrees/issue230-multiplayer-entry-assist`, based on `origin/main` commit `8cc0eadd154de19cff5d4f022a05d84c10bc5174`.
- Follow red → green one public behaviour at a time; do not write tests against private rendering helpers.
- The agreed test seams are the database contract, pending-game repository/loader contract, Entry Candidate Provider contract, browser behaviour, and approval-gated hosted functional smoke.
- The MVP consumes only candidates whose records are `familyFriendly` and `accepted`.
- The Account Entry Assist Safety Setting, expanded noun diversity, and future Entry Kinds remain deferred to issues #247, #245, and #246 respectively.
- The browser must never authorise or choose a Started Game's shard path, version, source, candidate count, or curation tier.
- The loader must not reveal another participant's assigned section, entries, or unrelated Entry Kind references.
- Missing or invalid Entry Assist data disables only dice; typed entry and `Submit section` remain available on the authorised active surface.
- Dice fills are transient browser state and create no hosted mutation before the existing participant-section submission.
- Use Supabase CLI `2.109.1` through `npx --yes supabase@2.109.1` for migration-file creation because no repo-local or global CLI is installed.
- Do not apply a hosted migration, mutate hosted Game data, approve a deployment, or promote an environment without the separate authority required by the project runbooks.
- Use UK English in user-facing copy and project documentation.

---

## File Responsibility Map

- `supabase/migrations/*_pin_multiplayer_entry_assist_shards.sql`: private approved-reference registry, Started Game reference snapshot, pinning trigger, participant-loader extension, grants, and RLS/privilege hardening. The timestamped filename is created by the pinned Supabase CLI command in Task 1.
- `assets/pending-game.js`: local repository snapshot behaviour and strict recovery of the active section's Entry Assist reference.
- `assets/entry-candidate-provider.js`: exact immutable pinned-shard loading, validation, caching, and conversion to candidate values.
- `assets/app.js`: active-surface async loading, Multiplayer dice controls, transient no-repeat selection, and manual-entry fallback.
- `assets/site.css`: Multiplayer row layout for input plus dice control at mobile and desktop widths.
- `tests/supabase-migration-surface.test.mjs`: source-level database authority, privilege, and loader-contract tests.
- `tests/pending-game.test.mjs`: local and Supabase repository public-contract tests, including concealment and malformed-reference recovery.
- `tests/entry-candidate-provider.test.mjs`: exact pinned-path and validation tests at the provider seam.
- `tests/browser-smoke.test.mjs`: user-visible successful, pinned-version, and unavailable Entry Assist flows.
- `docs/runbooks/supabase-auth-and-postgres.md`: source migration, hosted application, readback, advisor, and rollback/stop contract.
- `docs/backlog.md`, `docs/decisions/0027-game-scoped-multiplayer-play-surface.md`, `docs/product-rules.md`, `docs/planning/supabase-state-ledger.md`, `docs/superpowers/README.md`: implementation and verification status routing.

---

### Task 1: Pin approved shard references and expose only the active reference

**Files:**
- Create: `supabase/migrations/*_pin_multiplayer_entry_assist_shards.sql` using the CLI-generated timestamp
- Modify: `assets/pending-game.js`
- Modify: `tests/supabase-migration-surface.test.mjs`
- Modify: `tests/pending-game.test.mjs`

**Interfaces:**
- Produces database snapshot shape:

```js
{
  schemaVersion: 1,
  entryKinds: {
    adjective: {
      entryKind: "adjective",
      version: "2026-07-05-esdb-v2-1e5b7d3-tracer",
      path: "assets/word-bank/shards/adjective.2026-07-05-esdb-v2-1e5b7d3-tracer.json",
      candidateCount: 114,
      familyFriendly: true,
      sourceId: "esdb-scowl-v2",
      sourceVersion: "1e5b7d3a72f47a71da5d28686c1dd4b397178485"
    },
    noun: {
      entryKind: "noun",
      version: "2026-07-05-esdb-v2-1e5b7d3-noun-tracer",
      path: "assets/word-bank/shards/noun.2026-07-05-esdb-v2-1e5b7d3-noun-tracer.json",
      candidateCount: 240,
      familyFriendly: true,
      sourceId: "esdb-scowl-v2",
      sourceVersion: "1e5b7d3a72f47a71da5d28686c1dd4b397178485"
    }
  }
}
```

- Produces active-section loader shape:

```js
currentSection.entryAssist =
  { state: "available", reference: snapshot.entryKinds[currentSection.entryKind] };
```

- Produces fallback shape: `currentSection.entryAssist = { state: "unavailable" }`.
- Preserves `repository.startPendingGame({ creatorAccountId, pendingGameId })` and `repository.loadGamePlaySurface({ accountId, gameId })` call signatures.

- [ ] **Step 1: Add the first failing repository contract test**

Add a test after the existing active Game Play Surface test in `tests/pending-game.test.mjs`. Start an accepted local Game, load its active surface, derive the expected reference from `state.currentSection.entryKind`, and assert the literal allowlisted result:

```js
assert.deepEqual(state.currentSection.entryAssist, {
  state: "available",
  reference:
    state.currentSection.entryKind === "adjective"
      ? {
          entryKind: "adjective",
          version: "2026-07-05-esdb-v2-1e5b7d3-tracer",
          path: "assets/word-bank/shards/adjective.2026-07-05-esdb-v2-1e5b7d3-tracer.json",
          candidateCount: 114,
          familyFriendly: true,
          sourceId: "esdb-scowl-v2",
          sourceVersion: "1e5b7d3a72f47a71da5d28686c1dd4b397178485",
        }
      : {
          entryKind: "noun",
          version: "2026-07-05-esdb-v2-1e5b7d3-noun-tracer",
          path: "assets/word-bank/shards/noun.2026-07-05-esdb-v2-1e5b7d3-noun-tracer.json",
          candidateCount: 240,
          familyFriendly: true,
          sourceId: "esdb-scowl-v2",
          sourceVersion: "1e5b7d3a72f47a71da5d28686c1dd4b397178485",
        },
});
```

- [ ] **Step 2: Run the repository test and verify RED**

Run:

```powershell
node --test --test-name-pattern="pins.*Entry Assist|loads only the current participant's active Game Play Surface state" tests/pending-game.test.mjs
```

Expected: FAIL because `currentSection.entryAssist` is absent.

- [ ] **Step 3: Implement the minimum local repository snapshot**

Add one immutable module constant with the exact snapshot above. Store it in a `startedGameEntryCandidateSnapshots` map keyed by Started Game id when `startPendingGame` succeeds. Pass the map to `createGamePlaySurfaceState`, and add only the active Entry Kind reference to `createCurrentSectionDto` output:

```js
function createEntryAssistDto(snapshot, entryKind) {
  const reference = snapshot?.entryKinds?.[entryKind];
  return reference
    ? { state: "available", reference: { ...reference } }
    : { state: "unavailable" };
}
```

Do not add the complete snapshot to any browser-safe Started Game DTO.

- [ ] **Step 4: Run the repository test and verify GREEN**

Run the Step 2 command.

Expected: PASS.

- [ ] **Step 5: Add the failing Supabase recovery/concealment test**

Extend the fake `load_game_play_surface` payload with `entry_assist`. Assert that `loadGamePlaySurface` recovers the exact camelCase shape and strips injected `profile_id`, `other_entry_kind`, and arbitrary fields. Add a second case where `path` is `https://example.invalid/shard.json`; expected result:

```js
{
  state: "active",
  game: expectedGame,
  currentSection: {
    ...expectedSection,
    entryAssist: { state: "unavailable" },
  },
}
```

- [ ] **Step 6: Run the Supabase repository case and verify RED**

Run:

```powershell
node --test --test-name-pattern="Game Play Surface allowlist|malformed Entry Assist reference" tests/pending-game.test.mjs
```

Expected: FAIL because the recovery layer ignores `entry_assist`.

- [ ] **Step 7: Add strict reference recovery**

Add `recoverGamePlaySurfaceEntryAssist` and `recoverPinnedEntryAssistReference` in `assets/pending-game.js`. Accept only:

```js
{
  entryKind: nonEmptyText,
  version: nonEmptyText,
  path: /^assets\/word-bank\/shards\/[a-z0-9.-]+\.json$/,
  candidateCount: positiveInteger,
  familyFriendly: true,
  sourceId: nonEmptyText,
  sourceVersion: nonEmptyText,
}
```

Require `reference.entryKind === currentSection.entryKind`. Return `{ state: "unavailable" }` for every other shape while preserving the authorised active surface.

- [ ] **Step 8: Run the Supabase repository case and verify GREEN**

Run the Step 6 command.

Expected: PASS.

- [ ] **Step 9: Create the migration file with the pinned CLI**

Run:

```powershell
npx --yes supabase@2.109.1 migration new pin_multiplayer_entry_assist_shards
```

Expected: one new file ending `_pin_multiplayer_entry_assist_shards.sql` under `supabase/migrations/`.

- [ ] **Step 10: Add the failing migration-surface test**

Use `findMigrationUrl("pin_multiplayer_entry_assist_shards")`. Assert that the new migration:

```js
assert.match(migration, /create table if not exists private\.word_bank_shard_registry/);
assert.match(migration, /alter table private\.word_bank_shard_registry enable row level security/);
assert.match(migration, /revoke all on table private\.word_bank_shard_registry from public, anon, authenticated, service_role/);
assert.match(migration, /add column if not exists entry_candidate_snapshot jsonb/);
assert.match(migration, /create trigger pin_started_game_entry_candidate_snapshot/);
assert.match(migration, /'entryAssist'/);
assert.match(migration, /'state', 'available'/);
assert.match(migration, /'state', 'unavailable'/);
assert.doesNotMatch(migration, /grant\s+select\s*\([^)]*entry_candidate_snapshot/i);
```

Also assert empty `search_path`, explicit function revocations, `auth.uid()` participant checks in the replaced loader, and no new browser grants on the registry or protected Multiplayer tables.

- [ ] **Step 11: Run the migration-surface test and verify RED**

Run:

```powershell
node --test --test-name-pattern="pins approved Multiplayer Entry Assist shard references" tests/supabase-migration-surface.test.mjs
```

Expected: FAIL because the migration is empty.

- [ ] **Step 12: Implement the database authority contract**

In the CLI-created migration:

1. Create `private.word_bank_shard_registry` with `entry_kind` primary key plus `version`, `asset_path`, `candidate_count`, `family_friendly`, `source_id`, and `source_version` constraints.
2. Enable RLS and revoke all table privileges from `public`, `anon`, `authenticated`, and `service_role`; create no browser policy.
3. Insert the exact adjective and noun references from `assets/word-bank/manifest.json` with `on conflict (entry_kind) do update`.
4. Add nullable `public.games.entry_candidate_snapshot jsonb`.
5. Add `private.build_default_entry_candidate_snapshot()` as a `stable security invoker` function with `set search_path = ''`; it must return null unless exactly adjective and noun references exist. Revoke direct execution from browser roles; the migration owner and pinning trigger remain its only callers.
6. Add `private.pin_started_game_entry_candidate_snapshot()` as a `security definer` trigger function with an explicit non-null `auth.uid()` check; reject non-null browser input, build the snapshot server-side, fail when unavailable, and assign `new.entry_candidate_snapshot`.
7. Backfill existing Started Games through `private.build_default_entry_candidate_snapshot()`, add a shape constraint, and set the column `not null`.
8. Recreate `private.load_game_play_surface(uuid)` from `20260709225028_participant_scoped_started_game_loader.sql`, preserving every existing state and participant check. In the active `currentSection`, add:

```sql
'entryAssist',
case
  when target_game.entry_candidate_snapshot
    -> 'entryKinds' ? current_section.entry_kind then
    pg_catalog.jsonb_build_object(
      'state', 'available',
      'reference', target_game.entry_candidate_snapshot
        -> 'entryKinds' -> current_section.entry_kind
    )
  else pg_catalog.jsonb_build_object('state', 'unavailable')
end
```

9. Keep the public wrapper `security invoker`; revoke before granting only `authenticated` execute.
10. Revoke all helper/trigger function execution from browser roles and preserve the existing authenticated execute grant only where the participant loader requires it.

- [ ] **Step 13: Run all Task 1 tests and verify GREEN**

Run:

```powershell
node --test tests/pending-game.test.mjs tests/supabase-migration-surface.test.mjs
```

Expected: PASS with no direct snapshot-column or private-registry browser authority.

- [ ] **Step 14: Commit Task 1**

```powershell
git add -- assets/pending-game.js tests/pending-game.test.mjs tests/supabase-migration-surface.test.mjs supabase/migrations/*_pin_multiplayer_entry_assist_shards.sql
git commit -m "feat: pin multiplayer entry assist shards"
```

---

### Task 2: Load and validate the exact pinned static shard

**Files:**
- Modify: `assets/entry-candidate-provider.js`
- Modify: `tests/entry-candidate-provider.test.mjs`

**Interfaces:**
- Consumes the Task 1 reference shape.
- Produces `entryCandidateProvider.loadPinnedEntryCandidateValues(reference): Promise<string[]>`.
- Never mutates or replaces the manifest-backed current Entry Kind cache when loading an older pinned reference.

- [ ] **Step 1: Write the failing exact-reference provider test**

Create a manifest that points noun to `noun.v2.json`, pass a pinned `noun.v1.json` reference, and record fetch paths. Return a one-candidate v1 shard with complete source and family-friendly metadata. Assert:

```js
assert.deepEqual(
  await provider.loadPinnedEntryCandidateValues(pinnedReference),
  ["teapot"],
);
assert.deepEqual(fetchPaths, [pinnedReference.path]);
```

- [ ] **Step 2: Run the provider test and verify RED**

Run:

```powershell
node --test --test-name-pattern="loads the exact pinned immutable shard" tests/entry-candidate-provider.test.mjs
```

Expected: FAIL because `loadPinnedEntryCandidateValues` does not exist.

- [ ] **Step 3: Implement the minimum pinned loader**

Add the method to the manifest-backed provider. Validate the reference before fetch, use `reference.path` directly, and cache by the existing entry-kind/version/path key without writing `loadedShardsByEntryKind`. Return normalised plain values:

```js
async loadPinnedEntryCandidateValues(reference) {
  const validatedReference = validatePinnedReference(reference);
  if (!validatedReference) return [];
  const shard = await fetchJson(validatedReference.path);
  return getPinnedShardCandidates(shard, validatedReference)
    .map(getEntryCandidateValue)
    .map(cleanWhitespace)
    .filter(Boolean);
}
```

Catch fetch failures and return `[]`.

- [ ] **Step 4: Run the exact-reference test and verify GREEN**

Run the Step 2 command.

Expected: PASS.

- [ ] **Step 5: Write one failing validation matrix test**

Use subtests for wrong Entry Kind, wrong version, wrong source id/version, `familyFriendly: false`, wrong candidate count, one potentially-offensive candidate, and a path outside `assets/word-bank/shards/`. Each expected result is `[]`, and no invalid-path case may call `fetchJson`.

- [ ] **Step 6: Run the validation matrix and verify RED**

Run:

```powershell
node --test --test-name-pattern="rejects mismatched pinned shard contracts" tests/entry-candidate-provider.test.mjs
```

Expected: at least one subtest FAIL until every pinned contract field is checked.

- [ ] **Step 7: Complete pinned shard validation**

Require shard schema version `1`, exact Entry Kind and version, `familyFriendly === true`, exact `source.id` and `source.version`, exact candidate count, and every candidate to match the Entry Kind with `safetyStatus === "familyFriendly"` and `curationStatus === "accepted"`. Treat any mismatch as complete pinned-shard unavailability rather than filtering or falling back.

- [ ] **Step 8: Run provider tests and verify GREEN**

```powershell
node --test tests/entry-candidate-provider.test.mjs
```

Expected: PASS.

- [ ] **Step 9: Commit Task 2**

```powershell
git add -- assets/entry-candidate-provider.js tests/entry-candidate-provider.test.mjs
git commit -m "feat: load pinned entry assist shards"
```

---

### Task 3: Deliver the working Multiplayer dice interaction

**Files:**
- Modify: `assets/app.js`
- Modify: `assets/site.css`
- Modify: `tests/browser-smoke.test.mjs`

**Interfaces:**
- Consumes `currentSection.entryAssist` from Task 1.
- Consumes `entryCandidateProvider.loadPinnedEntryCandidateValues(reference)` from Task 2.
- Produces buttons selected by `[data-multiplayer-dice-row-index="<rowIndex>"]` and inputs selected by the existing `[data-multiplayer-section-input="<rowIndex>"]`.

- [ ] **Step 1: Write the failing successful browser test**

Add a mobile-viewport test that intercepts the pinned adjective and noun paths with two accepted family-friendly candidates per Entry Kind. Create a Started local Multiplayer Game and wait for the active surface. Assert every visible row has an enabled button whose accessible name matches `Generate adjective for phrase 1` or `Generate noun for phrase 1`. Click row 0 twice and assert both values belong to the active Entry Kind fixture and differ.

Also return a different current-manifest path and assert it is never fetched for the Started Game.

- [ ] **Step 2: Run the browser test and verify RED**

Run:

```powershell
node --test --test-name-pattern="uses the Started Game's pinned shard for Multiplayer dice Entry Assist" tests/browser-smoke.test.mjs
```

Expected: FAIL because Multiplayer rows have no dice buttons.

- [ ] **Step 3: Load Entry Assist before rendering the active form**

In the active branch of `renderGamePlaySurfaceRoute`, await pinned values only when `currentSection.entryAssist.state === "available"`. Re-run the existing render request, route, and Account-session guards after the await. Render the active form with `[]` after any provider failure; do not render `Game unavailable.`.

Change signatures to:

```js
renderGamePlaySurfaceActive(surface, currentSection, entryCandidates)
renderMultiplayerSectionForm(currentSection, entryCandidates)
renderMultiplayerSectionRow(row, currentSection, diceState)
```

- [ ] **Step 4: Add accessible dice controls and transient selection**

Create one transient `Set` per rendered form. Change each row root from a wrapping `label` to a `.started-game-turn-row` `div` containing an explicit `label[for]`, the existing input with a stable id, and a `.dice-button` with `data-multiplayer-dice-row-index`. On click, select uniformly from candidates not yet used in this rendered form; when exhausted, use the full candidate list. Fill only the matching input and focus it. Do not dispatch repository mutations.

Use literal accessible copy:

```js
button.ariaLabel = `Generate ${currentSection.entryKind} for phrase ${row.rowIndex + 1}`;
button.title = `Generate ${currentSection.entryKind}`;
```

- [ ] **Step 5: Adjust row layout without changing Solo controls**

Keep `.started-game-turn-row` as the row container and use three columns at desktop/mobile-safe widths:

```css
.started-game-turn-row {
  grid-template-columns: minmax(72px, 96px) minmax(0, 1fr) auto;
}
```

Keep the dice button's existing minimum touch target and focus styles. Do not add inline style APIs.

- [ ] **Step 6: Run the successful browser test and verify GREEN**

Run the Step 2 command.

Expected: PASS with no console errors or horizontal overflow.

- [ ] **Step 7: Run focused regression tests**

```powershell
node --test tests/entry-candidate-provider.test.mjs tests/pending-game.test.mjs tests/browser-smoke.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

```powershell
git add -- assets/app.js assets/site.css tests/browser-smoke.test.mjs
git commit -m "feat: add multiplayer dice entry assist"
```

---

### Task 4: Harden unavailable and unsupported Entry Assist

**Files:**
- Modify: `assets/app.js`
- Modify: `assets/pending-game.js`
- Modify: `tests/pending-game.test.mjs`
- Modify: `tests/browser-smoke.test.mjs`

**Interfaces:**
- Preserves the Task 1 active fallback `{ state: "unavailable" }` inside `currentSection.entryAssist`.
- Preserves normal HTML-required validation and existing `submitMultiplayerSection` behaviour.

- [ ] **Step 1: Write the failing browser fallback test**

Intercept the pinned shard with a metadata mismatch so the provider returns `[]`. Create an active Game and assert:

```js
const dice = page.locator("[data-multiplayer-dice-row-index='0']");
assert.equal(await dice.isDisabled(), true);
assert.equal(await dice.getAttribute("aria-label"), "Random word unavailable");
```

Fill every `[data-multiplayer-section-input]` manually, submit, and assert the surface advances to the participant's next authorised state without showing `Section could not be submitted` or `Game unavailable.`.

- [ ] **Step 2: Run the fallback browser test and verify RED**

```powershell
node --test --test-name-pattern="keeps typed Multiplayer submission available when Entry Assist is unavailable" tests/browser-smoke.test.mjs
```

Expected: FAIL until unavailable rows render disabled controls and submission remains intact.

- [ ] **Step 3: Implement disabled-only failure behaviour**

When `entryCandidates.length === 0`, render each dice button disabled with `aria-label` and `title` set to `Random word unavailable`. Leave inputs, `required`, and submit listeners unchanged. A failed pinned load must not alter `currentSection` or the route state.

- [ ] **Step 4: Run the fallback browser test and verify GREEN**

Run the Step 2 command.

Expected: PASS.

- [ ] **Step 5: Add unsupported Entry Kind loader coverage**

In a Supabase repository recovery test, supply an otherwise valid active Game Play Surface payload whose `current_section.entry_kind` is `verb` and whose `entry_assist` is unavailable. Assert that the public result remains an active surface with `{ state: "unavailable" }` for Entry Assist, retains its rows for typed submission, and exposes no candidate reference. Do not add a new playable template, local repository mode, or production Entry Kind. The browser fallback test in Step 1 already proves the shared unavailable-dice/manual-submit presentation.

- [ ] **Step 6: Run unsupported coverage and verify RED then GREEN**

First run before unsupported Entry Kind recovery is implemented and observe FAIL:

```powershell
node --test --test-name-pattern="unsupported Multiplayer Entry Kind" tests/pending-game.test.mjs tests/browser-smoke.test.mjs
```

Then ensure the recovery allowlist treats the unsupported Entry Kind as active with Entry Assist unavailable and rerun.

Expected after implementation: PASS.

- [ ] **Step 7: Run all feature tests**

```powershell
node --test tests/entry-candidate-provider.test.mjs tests/pending-game.test.mjs tests/supabase-migration-surface.test.mjs tests/browser-smoke.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit Task 4**

```powershell
git add -- assets/app.js assets/pending-game.js tests/pending-game.test.mjs tests/browser-smoke.test.mjs
git commit -m "test: harden multiplayer entry assist fallback"
```

---

### Task 5: Reconcile source documentation and verify the final branch head

**Files:**
- Modify: `docs/runbooks/supabase-auth-and-postgres.md`
- Modify: `docs/decisions/0027-game-scoped-multiplayer-play-surface.md`
- Modify: `docs/product-rules.md`
- Modify: `docs/backlog.md`
- Modify: `docs/planning/supabase-state-ledger.md`
- Modify: `docs/superpowers/README.md`
- Modify: `docs/superpowers/specs/2026-07-12-multiplayer-entry-assist-design.md`
- Modify: `docs/superpowers/plans/2026-07-12-multiplayer-entry-assist.md`

**Interfaces:**
- Produces an implementation-complete source branch whose runtime migration remains unapplied until explicit hosted approval.
- Keeps issues #245, #246, and #247 deferred and leaves issue #89 untouched.

- [ ] **Step 1: Update owning documents**

Record:

- the private registry and Started Game reference-snapshot contract;
- the exact current adjective/noun references and family-friendly-only boundary;
- the loader's active-only reference disclosure and unavailable-dice fallback;
- source migration name, hosted apply/readback/advisor commands, and rollback/stop rules;
- issue #230 as source-complete but not closed before hosted verification;
- the design/spec/plan ledger status as implemented source awaiting hosted validation;
- issues #245–#247 as deferred follow-up routes, not #230 scope.

- [ ] **Step 2: Run focused validation**

```powershell
npm run word-bank:check
node --test tests/entry-candidate-provider.test.mjs tests/pending-game.test.mjs tests/supabase-migration-surface.test.mjs tests/browser-smoke.test.mjs tests/repository-hygiene.test.mjs
git diff --check
```

Expected: all commands PASS.

- [ ] **Step 3: Run the full suite**

```powershell
npm test
```

Expected: all tests PASS; allow at least five minutes for the browser-heavy suite.

- [ ] **Step 4: Inspect final scope**

```powershell
git status --short
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
```

Expected: only issue #230 code, tests, migration, and owning documentation are present; no root `assets/img/*`, scratch corpus, generated review output, credentials, or unrelated files are included.

- [ ] **Step 5: Commit final source documentation**

```powershell
git add -- docs/runbooks/supabase-auth-and-postgres.md docs/decisions/0027-game-scoped-multiplayer-play-surface.md docs/product-rules.md docs/backlog.md docs/planning/supabase-state-ledger.md docs/superpowers/README.md docs/superpowers/specs/2026-07-12-multiplayer-entry-assist-design.md docs/superpowers/plans/2026-07-12-multiplayer-entry-assist.md
git commit -m "docs: record multiplayer entry assist contract"
```

- [ ] **Step 6: Re-run final-head verification**

Run `npm test`, `npm run word-bank:check`, and `git diff --check origin/main...HEAD` again after the documentation commit.

Expected: PASS with a clean worktree.

---

### Task 6: Publish, apply, deploy, verify, and close out through approval gates

**Files:**
- Modify after runtime evidence: `docs/planning/supabase-state-ledger.md`
- Modify after runtime evidence: `docs/backlog.md`
- Modify after runtime evidence: `docs/decisions/0027-game-scoped-multiplayer-play-surface.md`
- Modify after runtime evidence: `docs/superpowers/README.md`
- Modify after runtime evidence: `docs/superpowers/specs/2026-07-12-multiplayer-entry-assist-design.md`
- Modify after runtime evidence: `docs/superpowers/plans/2026-07-12-multiplayer-entry-assist.md`

**Interfaces:**
- Consumes a clean, fully verified final source head from Task 5.
- Produces merged, promoted, visibly verified issue #230 completion and parent PRD #226 closure, with separate documentation closeout if post-merge evidence cannot live in the feature PR.

- [x] **Step 1: Push and open a draft PR without auto-closing #230**

Push `codex/issue230-multiplayer-entry-assist` and open a draft PR whose body uses `Refs #230`, not `Closes #230`. Explain that the issue remains open until migration, deployment, functional smoke, cleanup, and promotion evidence complete.

- [x] **Step 2: Verify PR checks and review state**

Require `CI / Verify static site` green, inspect the patch, resolve all review threads, and keep the PR draft until the hosted development gate succeeds.

- [x] **Step 3: Stop for explicit hosted migration approval**

Before any DDL, present the exact generated migration name, target Supabase project, schema objects, privileges, backfill, and rollback/stop conditions. Wait for explicit owner approval.

After approval, apply the source migration through the connected Supabase migration tool. Read back:

- migration history contains the exact migration;
- private registry contains exactly the approved adjective/noun references;
- existing Started Games have a non-null schema-version-1 snapshot;
- browser roles have no registry table privileges and no snapshot-column SELECT grant;
- `private.load_game_play_surface` and its public wrapper retain the documented security modes, empty `search_path`, and grants;
- security and performance advisors introduce no new WARN/ERROR findings.

Stop on any mismatch; do not deploy runtime code against a partially verified schema.

Receipt on 2026-07-13: after renewed explicit owner approval for the corrected
committed SQL, source migration
`supabase/migrations/20260713014439_pin_multiplayer_entry_assist_shards.sql`
applied to project `egnudphshvqdhrotxrfs` as hosted migration
`20260713092820 pin_multiplayer_entry_assist_shards`. Readback verified the exact
approved adjective and noun rows, zero existing Games, snapshot shape, trigger,
function security modes, empty `search_path` values, browser-role denial, no new
security WARN/ERROR, and no performance-advisor delta. The full immutable receipt
is in `docs/planning/supabase-state-ledger.md`. At the time of this migration
receipt, no deployment, browser smoke, hosted fixture mutation, cleanup, merge,
promotion, or tracker closure had occurred; the later separately approved
development receipt is recorded in Steps 4-6 below.

- [x] **Step 4: Stop for the `Deploy branch to dev` environment approval**

Request the documented dev deployment for the final branch head. If GitHub waits for Environment approval, pause until the owner confirms approval. Require the workflow to complete successfully with the exact source head stamped into deployed assets.

Receipt on 2026-07-13: after the separate GitHub Environment approval,
development workflow run `29240601750` completed successfully for source head
`901ca431fd87808a902316674465689795926170`, and deployed assets carried that
exact stamp. A normal Edge refresh initially retained the pre-deployment static
view; one hard refresh loaded the exact build. This is a cache observation, not
a failed acceptance criterion.

- [x] **Step 5: Stop for hosted dev Game-data mutation approval**

Before creating a two-Account fixture, state the exact creator/invitee Accounts, Pending Game/Game scope, expected rows, and bounded cleanup target. Wait for explicit approval.

After approval, use the visible in-app browser route from `docs/runbooks/in-app-browser-verification.md` to verify:

- creator starts an accepted Game and reaches the Game Play Surface;
- adjective and noun supported sections show enabled accessible dice controls;
- dice fills and replaces only the selected row from the pinned shard;
- another participant's assigned section and entries remain concealed;
- typed edits and normal section submission still work;
- no console errors or horizontal overflow occur.

Receipt on 2026-07-13: after separate fixture approval, the two-Account smoke
used creator Account/Profile `f222c9a8-e424-4156-a378-c34eabc71bbf` /
`005089ee-a35b-47e1-808b-a4d9b892fe32` (`vhCoder`) and invitee Account/Profile
`bf5c0e41-ea1c-4fa2-908d-830983ae806b` /
`b942b452-5032-4c1d-aaf5-070e25fdaad0` (`test-player`). Pending Game
`91d72b95-b022-4a4f-9239-9f2d2a5bfaab` started as Game
`747e4630-ac40-4600-85cc-8641745711cd` with two Pending Game participants, two
Game participants, three assignments, 30 submitted section entries, and five
notifications. The active snapshot exposed only the pinned adjective reference
with 114 candidates or noun reference with 240 candidates. Noun dice changed
`window` to `bookcase`; adjective dice changed `solemn` to `misty`; and the
second participant generated `pencil`. Every value belonged to its pinned shard,
only the selected row changed, and focus returned to its input. Typed
`curiosity`, `wonder`, and `memory` entries submitted normally, while the other
participant's section and entries remained concealed until Reveal. Both Accounts
reached `Batch complete.` with no console warnings or errors, framework overlay,
or horizontal overflow; document and body widths were `815/815`.

- [x] **Step 6: Stop for bounded dev cleanup confirmation**

Present the exact Pending Game id, Started Game id, participants, assignments, entries, reveals, and notifications to delete. After confirmation, remove only those fixtures and run read-only SQL proving zero targeted rows remain. Do not delete Account Profiles or Auth users.

Receipt on 2026-07-13: before cleanup, the owner manually selected Reveal for
`curiosity`; readback found exactly one reveal,
`fdb6d7f5-4d30-4358-94f6-85a7aedc556c`, for Account Profile
`b942b452-5032-4c1d-aaf5-070e25fdaad0`, and it was intentionally included in
the separately approved cleanup scope. Transactionally guarded cleanup deleted
only Started Game `747e4630-ac40-4600-85cc-8641745711cd` and Pending Game
`91d72b95-b022-4a4f-9239-9f2d2a5bfaab`. Cascades removed two Pending Game
participants, two Game participants, three assignments, 30 section entries, one
reveal, and five notifications. Legacy Game Turn and Game Entry counts were zero
before and after cleanup. Post-cleanup SQL proved zero targeted Pending Games,
Games, participants, assignments, section entries, Game Turns, Game Entries,
reveals, and notifications, while both Auth users, Account Profiles, and Account
Profile Directory rows remained. Visible verification showed `Game unavailable.`
on the deleted Game route, an empty Multiplayer dashboard, and
`You have no notifications yet.` in the notification panel. Browser logs stayed
empty, no framework overlay appeared, and widths remained `815/815`.

- [ ] **Step 7: Record dev evidence before the final deploy gate**

If dev evidence requires tracked documentation changes, commit them, rerun `npm test`, and request a fresh approved dev deployment for that new final branch head. An older deployment does not satisfy the final-head gate.

Current route: commit this six-document development receipt, run the full source
verification, push the new branch head, and obtain a fresh approved development
deployment for that exact head. Workflow run `29240601750` verified
`901ca431fd87808a902316674465689795926170` but cannot satisfy the new final-head
gate after this evidence commit. Keep issue #230 and draft PR #248 open. Do not
merge or begin test, production, promotion, or tracker closeout before this gate
passes. Issues #245, #246, and #247 and issue #89 remain open and deferred.

- [ ] **Step 8: Mark ready and merge without closing #230**

After the final-head dev gate, make the PR ready, ensure checks and reviews remain green, merge through protected `main`, and keep #230 open for test/promotion closeout.

- [ ] **Step 9: Approve and functionally verify test**

Wait for separate `Deploy main to test` approval. After deployment succeeds, verify the merge commit stamp and repeat the functional two-Account Entry Assist flow in visible test. Obtain separate mutation and bounded-cleanup approvals, then prove cleanup. A waiting production gate must not block test verification.

- [ ] **Step 10: Approve and verify production separately**

Wait for separate production approval. After deployment, perform the default read-only production smoke: exact merge-commit asset stamps, signed-in Game Play Surface availability, no framework overlay, no horizontal overflow, and empty browser warning/error logs. Do not create production Game data unless the owner separately approves a bounded production mutation smoke.

- [ ] **Step 11: Complete durable documentation closeout**

Update the ledger and owning docs with immutable run ids, commit SHAs, migration name, readback/advisor results, dev/test/production browser evidence, cleanup receipts, and remaining risks. If this requires a docs-only PR, use the protected-main documentation route and merge it before issue closeout.

- [ ] **Step 12: Close tracker scope and clean branches**

Close #230 only after all accepted criteria and required environment verification are complete. Reconcile and close parent PRD #226 because #230 is its final accepted open child. Leave #89 and issues #245–#247 open and deferred. Delete the merged feature branch locally and remotely, remove the finished worktree, and prune worktree metadata.

---

## Plan Self-Review Checklist

- Every issue #230 acceptance criterion maps to Tasks 1–4 and the hosted smoke in Task 6.
- The plan never uses the current manifest as a substitute for a Started Game's pinned reference.
- The private registry and snapshot column receive no browser read or mutation grant.
- Failure behaviour remains local to dice and preserves typed submission.
- No task implements #245, #246, #247, custom templates, or new Entry Kinds.
- Migration application, dev deployment, hosted mutation, cleanup, test promotion, and production promotion remain separate approval gates.
- The plan contains no unresolved implementation decisions or vague implementation steps.
