# Pending Game Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a source-controlled handle-invite Pending Game backend foundation without UI, hosted Supabase mutation, invite acceptance, turns, or Reveal.

**Architecture:** Keep the static JavaScript shape and add one focused Pending Game repository module. The Supabase adapter creates a Pending Game with one browser insert into `public.pending_games`; a private-schema Postgres trigger creates the creator and invitee participant rows atomically from Account Profile Directory ids. Tests drive behaviour through public repository seams and migration-surface assertions.

**Tech Stack:** Plain JavaScript modules, Node `node:test`, Supabase Data API conventions, Supabase Postgres migrations, repository fakes for automated tests.

---

## File Structure

- Create `assets/pending-game.js`: Pending Game repository contract, test fixture repository, Supabase adapter, DTO recovery, validation, and Handle normalisation.
- Create `tests/pending-game.test.mjs`: TDD repository behaviour tests for handle-invite Pending Game creation, validation, and Supabase adapter query behaviour.
- Modify `tests/supabase-migration-surface.test.mjs`: migration-surface checks for Pending Game tables, grants, RLS, indexes, constraints, and private trigger function.
- Create `supabase/migrations/20260616143000_create_pending_games.sql`: Pending Game and participant tables, RLS, grants, indexes, and private trigger.
- Modify `docs/runbooks/supabase-auth-and-postgres.md`: record the source-controlled Pending Game migration and the hosted-mutation approval boundary.
- Modify `docs/backlog.md`: record the source-controlled foundation state and remaining deferred multiplayer lifecycle work.

## Task 1: Test-Only Pending Game Repository Tracer Bullet

**Files:**
- Create: `tests/pending-game.test.mjs`
- Create: `assets/pending-game.js`

- [x] **Step 1: Write the failing repository behaviour test**

Create `tests/pending-game.test.mjs`:

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createTestPendingGameRepository } from "../assets/pending-game.js";

const creatorProfile = {
  accountId: "creator-auth-account",
  profileId: "creator-profile-id",
  handle: "creator-one",
  gamerName: "Creator One",
  avatarKey: "spark",
};

const inviteeProfile = {
  accountId: "invitee-auth-account",
  profileId: "invitee-profile-id",
  handle: "invitee-two",
  gamerName: "Invitee Two",
  avatarKey: "paper",
};

describe("Pending Game repository", () => {
  it("creates a browser-safe Pending Game from a handle invite", async () => {
    const repository = createTestPendingGameRepository({
      createPendingGameId: () => "pending-game-1",
      profiles: [creatorProfile, inviteeProfile],
    });

    const pendingGame = await repository.createPendingGameFromHandle({
      creatorAccountId: creatorProfile.accountId,
      inviteeHandle: "INVITEE-TWO",
      rowCount: 10,
    });

    assert.deepEqual(pendingGame, {
      id: "pending-game-1",
      status: "pending",
      templateId: "default-adjective-noun-noun",
      rowCount: 10,
      participants: [
        {
          role: "creator",
          inviteStatus: "accepted",
          profileId: "creator-profile-id",
          handle: "creator-one",
          gamerName: "Creator One",
          avatarKey: "spark",
        },
        {
          role: "invitee",
          inviteStatus: "pending",
          profileId: "invitee-profile-id",
          handle: "invitee-two",
          gamerName: "Invitee Two",
          avatarKey: "paper",
        },
      ],
    });
    assert.equal(JSON.stringify(pendingGame).includes("auth-account"), false);
  });
});
```

- [x] **Step 2: Run RED**

Run:

```powershell
npm test -- tests/pending-game.test.mjs
```

Expected: FAIL because `assets/pending-game.js` does not exist or does not export `createTestPendingGameRepository`.

- [x] **Step 3: Implement the smallest test repository**

Create `assets/pending-game.js`:

```js
export const DEFAULT_TEMPLATE_ID = "default-adjective-noun-noun";
const ALLOWED_ROW_COUNTS = new Set([10, 15, 20, 25, 30]);

export function createTestPendingGameRepository({
  createPendingGameId = defaultCreatePendingGameId,
  profiles = [],
} = {}) {
  const profilesByAccountId = new Map(
    profiles.map((profile) => [profile.accountId, normaliseProfile(profile)]),
  );
  const profilesByHandle = new Map(
    profiles.map((profile) => [
      normaliseHandle(profile.handle),
      normaliseProfile(profile),
    ]),
  );

  return {
    async createPendingGameFromHandle({
      creatorAccountId,
      inviteeHandle,
      rowCount = 20,
    }) {
      assertAccountId(creatorAccountId);
      const creatorProfile = profilesByAccountId.get(creatorAccountId);
      const inviteeProfile = profilesByHandle.get(normaliseHandle(inviteeHandle));

      return createPendingGameDto({
        id: createPendingGameId(),
        rowCount,
        status: "pending",
        templateId: DEFAULT_TEMPLATE_ID,
        participants: [
          createParticipantDto(creatorProfile, {
            inviteStatus: "accepted",
            role: "creator",
          }),
          createParticipantDto(inviteeProfile, {
            inviteStatus: "pending",
            role: "invitee",
          }),
        ],
      });
    },
  };
}

function createPendingGameDto({ id, participants, rowCount, status, templateId }) {
  return {
    id,
    status,
    templateId,
    rowCount,
    participants,
  };
}

function createParticipantDto(profile, { inviteStatus, role }) {
  return {
    role,
    inviteStatus,
    profileId: profile.profileId,
    handle: profile.handle,
    gamerName: profile.gamerName,
    avatarKey: profile.avatarKey,
  };
}

function normaliseProfile(profile) {
  return {
    accountId: profile.accountId,
    profileId: assertText(profile.profileId, "A profile id is required."),
    handle: normaliseHandle(profile.handle),
    gamerName: assertText(profile.gamerName, "A Gamer Name is required."),
    avatarKey: assertText(profile.avatarKey, "An Avatar key is required."),
  };
}

function assertAccountId(accountId) {
  assertText(accountId, "A signed-in Account id is required.");
}

function assertRowCount(rowCount) {
  if (!ALLOWED_ROW_COUNTS.has(rowCount)) {
    throw new Error("A supported row count is required.");
  }
}

function assertText(value, message) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(message);
  }
  return value.trim();
}

function normaliseHandle(handle) {
  return String(handle ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function defaultCreatePendingGameId() {
  return globalThis.crypto?.randomUUID?.() ?? `pending-game-${Date.now()}`;
}
```

- [x] **Step 4: Run GREEN**

Run:

```powershell
npm test -- tests/pending-game.test.mjs
```

Expected: PASS for the new tracer bullet test.

- [x] **Step 5: Commit**

Run:

```powershell
git add assets/pending-game.js tests/pending-game.test.mjs
git commit -m "Add pending game repository contract"
```

## Task 2: Repository Validation Behaviour

**Files:**
- Modify: `tests/pending-game.test.mjs`
- Modify: `assets/pending-game.js`

- [x] **Step 1: Write failing validation tests**

Append these tests inside the existing `describe("Pending Game repository", () => { ... })` block:

```js
  it("rejects an unknown invitee Handle", async () => {
    const repository = createTestPendingGameRepository({
      profiles: [creatorProfile],
    });

    await assert.rejects(
      () =>
        repository.createPendingGameFromHandle({
          creatorAccountId: creatorProfile.accountId,
          inviteeHandle: "missing-handle",
          rowCount: 10,
        }),
      /handle/i,
    );
  });

  it("rejects inviting the creator's own Handle", async () => {
    const repository = createTestPendingGameRepository({
      profiles: [creatorProfile],
    });

    await assert.rejects(
      () =>
        repository.createPendingGameFromHandle({
          creatorAccountId: creatorProfile.accountId,
          inviteeHandle: creatorProfile.handle,
          rowCount: 10,
        }),
      /own handle/i,
    );
  });

  it("rejects row counts outside the default-template options", async () => {
    const repository = createTestPendingGameRepository({
      profiles: [creatorProfile, inviteeProfile],
    });

    await assert.rejects(
      () =>
        repository.createPendingGameFromHandle({
          creatorAccountId: creatorProfile.accountId,
          inviteeHandle: inviteeProfile.handle,
          rowCount: 12,
        }),
      /row count/i,
    );
  });
```

- [x] **Step 2: Run RED**

Run:

```powershell
npm test -- tests/pending-game.test.mjs
```

Expected: FAIL because the tracer implementation does not yet reject unsupported row counts, self-invites, or unknown Handles with the required repository errors.

- [x] **Step 3: Implement missing validation**

If the tests failed, update `assets/pending-game.js` so:

```js
assertRowCount(rowCount);
const creatorProfile = profilesByAccountId.get(creatorAccountId);
if (!creatorProfile) {
  throw new Error("Creator Account Profile is required.");
}
const inviteeProfile = profilesByHandle.get(normaliseHandle(inviteeHandle));
if (!inviteeProfile) {
  throw new Error("Invitee Handle was not found.");
}
if (creatorProfile.profileId === inviteeProfile.profileId) {
  throw new Error("A creator cannot invite their own Handle.");
}
```

- [x] **Step 4: Run GREEN**

Run:

```powershell
npm test -- tests/pending-game.test.mjs
```

Expected: PASS.

- [x] **Step 5: Commit**

Run:

```powershell
git add assets/pending-game.js tests/pending-game.test.mjs
git commit -m "Validate pending game handle invites"
```

## Task 3: Supabase Pending Game Adapter

**Files:**
- Modify: `tests/pending-game.test.mjs`
- Modify: `assets/pending-game.js`

- [x] **Step 1: Write the failing Supabase adapter test**

Add this import at the top of `tests/pending-game.test.mjs`:

```js
  createSupabasePendingGameRepository,
```

so the import reads:

```js
import {
  createSupabasePendingGameRepository,
  createTestPendingGameRepository,
} from "../assets/pending-game.js";
```

Append this test inside the existing describe block:

```js
  it("creates Pending Games through Supabase rows without exposing invited Auth identity", async () => {
    const supabase = createFakePendingGameSupabase({
      creatorProfile,
      inviteeProfile,
    });
    const repository = createSupabasePendingGameRepository({ supabase });

    const pendingGame = await repository.createPendingGameFromHandle({
      creatorAccountId: creatorProfile.accountId,
      inviteeHandle: inviteeProfile.handle.toUpperCase(),
      rowCount: 15,
    });

    assert.deepEqual(pendingGame, {
      id: "supabase-pending-game-1",
      status: "pending",
      templateId: "default-adjective-noun-noun",
      rowCount: 15,
      participants: [
        {
          role: "creator",
          inviteStatus: "accepted",
          profileId: creatorProfile.profileId,
          handle: creatorProfile.handle,
          gamerName: creatorProfile.gamerName,
          avatarKey: creatorProfile.avatarKey,
        },
        {
          role: "invitee",
          inviteStatus: "pending",
          profileId: inviteeProfile.profileId,
          handle: inviteeProfile.handle,
          gamerName: inviteeProfile.gamerName,
          avatarKey: inviteeProfile.avatarKey,
        },
      ],
    });
    assert.deepEqual(supabase.tableCalls, [
      "account_profiles",
      "account_profile_directory",
      "pending_games",
      "pending_game_participants",
    ]);
    assert.equal(JSON.stringify(pendingGame).includes(inviteeProfile.accountId), false);
  });
```

Add the fake below the tests:

```js
function createFakePendingGameSupabase({ creatorProfile, inviteeProfile }) {
  const state = {
    creatorProfile,
    inviteeProfile,
    pendingGame: null,
    participants: [],
  };

  return {
    tableCalls: [],
    from(tableName) {
      assert.ok(
        [
          "account_profiles",
          "account_profile_directory",
          "pending_games",
          "pending_game_participants",
        ].includes(tableName),
      );
      this.tableCalls.push(tableName);
      return new FakePendingGameQuery(tableName, state);
    },
  };
}

class FakePendingGameQuery {
  constructor(tableName, state) {
    this.tableName = tableName;
    this.state = state;
    this.filters = {};
    this.insertedRow = null;
  }

  insert(row) {
    this.insertedRow = row;
    return this;
  }

  select() {
    return this;
  }

  eq(column, value) {
    this.filters[column] = value;
    return this;
  }

  single() {
    return this.#resolveSingle({ allowNull: false });
  }

  maybeSingle() {
    return this.#resolveSingle({ allowNull: true });
  }

  async #resolveSingle({ allowNull }) {
    const rows = await this.#resolveRows();
    const row = rows[0] ?? null;
    return {
      data: row,
      error: row || allowNull ? null : { message: "row not found" },
    };
  }

  async then(resolve, reject) {
    try {
      resolve({
        data: await this.#resolveRows(),
        error: null,
      });
    } catch (error) {
      reject(error);
    }
  }

  async #resolveRows() {
    if (this.tableName === "account_profiles") {
      return this.filters.account_id === this.state.creatorProfile.accountId
        ? [toAccountProfileRow(this.state.creatorProfile)]
        : [];
    }

    if (this.tableName === "account_profile_directory") {
      return this.filters.handle === this.state.inviteeProfile.handle
        ? [toDirectoryProfileRow(this.state.inviteeProfile)]
        : [];
    }

    if (this.tableName === "pending_games" && this.insertedRow) {
      this.state.pendingGame = {
        id: "supabase-pending-game-1",
        creator_account_id: this.insertedRow.creator_account_id,
        creator_profile_id: this.insertedRow.creator_profile_id,
        invitee_profile_id: this.insertedRow.invitee_profile_id,
        row_count: this.insertedRow.row_count,
        status: "pending",
        template_id: "default-adjective-noun-noun",
      };
      this.state.participants = [
        toParticipantRow(this.state.creatorProfile, {
          inviteStatus: "accepted",
          pendingGameId: this.state.pendingGame.id,
          role: "creator",
        }),
        toParticipantRow(this.state.inviteeProfile, {
          inviteStatus: "pending",
          pendingGameId: this.state.pendingGame.id,
          role: "invitee",
        }),
      ];
      return [this.state.pendingGame];
    }

    if (this.tableName === "pending_game_participants") {
      return this.state.participants.filter(
        (row) => row.pending_game_id === this.filters.pending_game_id,
      );
    }

    return [];
  }
}

function toAccountProfileRow(profile) {
  return {
    profile_id: profile.profileId,
    handle: profile.handle,
    gamer_name: profile.gamerName,
    avatar_key: profile.avatarKey,
  };
}

function toDirectoryProfileRow(profile) {
  return toAccountProfileRow(profile);
}

function toParticipantRow(profile, { inviteStatus, pendingGameId, role }) {
  return {
    pending_game_id: pendingGameId,
    profile_id: profile.profileId,
    handle: profile.handle,
    gamer_name: profile.gamerName,
    avatar_key: profile.avatarKey,
    participant_role: role,
    invite_status: inviteStatus,
  };
}
```

- [x] **Step 2: Run RED**

Run:

```powershell
npm test -- tests/pending-game.test.mjs
```

Expected: FAIL because `createSupabasePendingGameRepository` is not exported.

- [x] **Step 3: Implement the Supabase adapter**

Add this export to `assets/pending-game.js`:

```js
export function createSupabasePendingGameRepository({ supabase } = {}) {
  if (!supabase || typeof supabase.from !== "function") {
    throw new Error("A Supabase client is required.");
  }

  return {
    async createPendingGameFromHandle({
      creatorAccountId,
      inviteeHandle,
      rowCount = 20,
    }) {
      assertAccountId(creatorAccountId);
      assertRowCount(rowCount);

      const creatorResponse = await supabase
        .from("account_profiles")
        .select("profile_id, handle, gamer_name, avatar_key")
        .eq("account_id", creatorAccountId)
        .maybeSingle();
      assertNoSupabaseError(creatorResponse, "Could not load creator Account Profile");

      if (!creatorResponse.data) {
        throw new Error("Creator Account Profile is required.");
      }

      const creatorProfile = recoverProfile(creatorResponse.data);
      const inviteeResponse = await supabase
        .from("account_profile_directory")
        .select("profile_id, handle, gamer_name, avatar_key")
        .eq("handle", normaliseHandle(inviteeHandle))
        .maybeSingle();
      assertNoSupabaseError(inviteeResponse, "Could not look up invitee Handle");

      if (!inviteeResponse.data) {
        throw new Error("Invitee Handle was not found.");
      }

      const inviteeProfile = recoverProfile(inviteeResponse.data);
      if (creatorProfile.profileId === inviteeProfile.profileId) {
        throw new Error("A creator cannot invite their own Handle.");
      }

      const pendingGameResponse = await supabase
        .from("pending_games")
        .insert({
          creator_account_id: creatorAccountId,
          creator_profile_id: creatorProfile.profileId,
          invitee_profile_id: inviteeProfile.profileId,
          row_count: rowCount,
          template_id: DEFAULT_TEMPLATE_ID,
        })
        .select("id, template_id, row_count, status")
        .single();
      assertNoSupabaseError(pendingGameResponse, "Could not create Pending Game");

      const participantResponse = await supabase
        .from("pending_game_participants")
        .select(
          "profile_id, handle, gamer_name, avatar_key, participant_role, invite_status",
        )
        .eq("pending_game_id", pendingGameResponse.data.id);
      assertNoSupabaseError(
        participantResponse,
        "Could not load Pending Game participants",
      );

      return recoverPendingGame({
        participantRows: participantResponse.data,
        pendingGameRow: pendingGameResponse.data,
      });
    },
  };
}
```

Add these helper functions to `assets/pending-game.js`:

```js
function recoverProfile(row) {
  return {
    profileId: assertText(row?.profile_id, "A profile id is required."),
    handle: normaliseHandle(row?.handle),
    gamerName: assertText(row?.gamer_name, "A Gamer Name is required."),
    avatarKey: assertText(row?.avatar_key, "An Avatar key is required."),
  };
}

function recoverPendingGame({ participantRows, pendingGameRow }) {
  const participants = participantRows
    .map((row) => ({
      role: row.participant_role,
      inviteStatus: row.invite_status,
      profileId: row.profile_id,
      handle: row.handle,
      gamerName: row.gamer_name,
      avatarKey: row.avatar_key,
    }))
    .toSorted((left, right) => roleOrder(left.role) - roleOrder(right.role));

  return createPendingGameDto({
    id: assertText(pendingGameRow?.id, "A Pending Game id is required."),
    status: pendingGameRow.status,
    templateId: pendingGameRow.template_id,
    rowCount: pendingGameRow.row_count,
    participants,
  });
}

function roleOrder(role) {
  return role === "creator" ? 0 : 1;
}

function assertNoSupabaseError(response, message) {
  if (response?.error) {
    const detail =
      typeof response.error.message === "string"
        ? response.error.message
        : "Supabase request failed.";
    throw new Error(`${message}: ${detail}`);
  }
}
```

- [x] **Step 4: Run GREEN**

Run:

```powershell
npm test -- tests/pending-game.test.mjs
```

Expected: PASS.

- [x] **Step 5: Commit**

Run:

```powershell
git add assets/pending-game.js tests/pending-game.test.mjs
git commit -m "Add Supabase pending game adapter"
```

## Task 4: Pending Game Migration Surface Test

**Files:**
- Modify: `tests/supabase-migration-surface.test.mjs`
- Create: `supabase/migrations/20260616143000_create_pending_games.sql`

- [ ] **Step 1: Write the failing migration-surface test**

Add this constant near the other migration URL constants:

```js
const createPendingGamesMigrationUrl = findMigrationUrl("create_pending_games");
```

Append this test inside `describe("Supabase migration surface", () => { ... })`:

```js
  it("creates Pending Games with creator-owned creation and trigger-managed participants", () => {
    assert.equal(existsSync(createPendingGamesMigrationUrl), true);

    const createPendingGamesMigration = readFileSync(
      createPendingGamesMigrationUrl,
      "utf8",
    );

    assert.match(
      createPendingGamesMigration,
      /create table if not exists public\.pending_games/,
    );
    assert.match(
      createPendingGamesMigration,
      /creator_account_id uuid not null references auth\.users \(id\) on delete cascade/,
    );
    assert.match(
      createPendingGamesMigration,
      /creator_profile_id uuid not null references public\.account_profile_directory \(profile_id\)/,
    );
    assert.match(
      createPendingGamesMigration,
      /invitee_profile_id uuid not null references public\.account_profile_directory \(profile_id\)/,
    );
    assert.match(createPendingGamesMigration, /row_count integer not null/);
    assert.match(createPendingGamesMigration, /row_count in \(10, 15, 20, 25, 30\)/);
    assert.match(createPendingGamesMigration, /status text not null default 'pending'/);
    assert.match(createPendingGamesMigration, /creator_profile_id <> invitee_profile_id/);

    assert.match(
      createPendingGamesMigration,
      /create table if not exists public\.pending_game_participants/,
    );
    assert.match(
      createPendingGamesMigration,
      /pending_game_id uuid not null references public\.pending_games \(id\) on delete cascade/,
    );
    assert.match(createPendingGamesMigration, /participant_role in \('creator', 'invitee'\)/);
    assert.match(createPendingGamesMigration, /invite_status in \('accepted', 'pending'\)/);
    assert.match(createPendingGamesMigration, /unique \(pending_game_id, profile_id\)/);

    for (const tableName of ["pending_games", "pending_game_participants"]) {
      assert.match(
        createPendingGamesMigration,
        new RegExp(`alter table public\\.${tableName} enable row level security`),
      );
      assert.match(
        createPendingGamesMigration,
        new RegExp(`revoke all on table public\\.${tableName} from anon`),
      );
    }

    assert.match(
      createPendingGamesMigration,
      /grant select, insert on table public\.pending_games to authenticated/,
    );
    assert.match(
      createPendingGamesMigration,
      /grant select on table public\.pending_game_participants to authenticated/,
    );
    assert.doesNotMatch(
      createPendingGamesMigration,
      /grant insert on table public\.pending_game_participants to authenticated/i,
    );

    assert.match(
      createPendingGamesMigration,
      /Account holders can create their Pending Games/,
    );
    assert.match(
      createPendingGamesMigration,
      /\(select auth\.uid\(\)\) = creator_account_id/,
    );
    assert.match(
      createPendingGamesMigration,
      /Account holders can view participant rows for their created Pending Games/,
    );

    for (const indexName of [
      "pending_games_creator_account_id_idx",
      "pending_games_creator_profile_id_idx",
      "pending_games_invitee_profile_id_idx",
      "pending_game_participants_pending_game_id_idx",
      "pending_game_participants_profile_id_idx",
    ]) {
      assert.match(createPendingGamesMigration, new RegExp(`create index if not exists ${indexName}`));
    }

    assert.match(
      createPendingGamesMigration,
      /create or replace function private\.create_pending_game_participants\(\)/,
    );
    assert.match(createPendingGamesMigration, /security definer/);
    assert.match(createPendingGamesMigration, /set search_path = ''/);
    assert.match(
      createPendingGamesMigration,
      /revoke all on function private\.create_pending_game_participants\(\) from public/,
    );
    assert.match(
      createPendingGamesMigration,
      /create trigger create_pending_game_participants\s+after insert on public\.pending_games/,
    );
    assert.doesNotMatch(
      createPendingGamesMigration,
      /create or replace function public\.create_pending_game_participants/i,
    );
  });
```

- [ ] **Step 2: Run RED**

Run:

```powershell
npm test -- tests/supabase-migration-surface.test.mjs
```

Expected: FAIL because `create_pending_games` migration does not exist.

- [ ] **Step 3: Create the migration file**

First try the documented Supabase CLI route:

```powershell
npx supabase migration new create_pending_games
```

If sandboxed `npx` is blocked, rerun the same command with sandbox escalation as documented in `docs/runbooks/node-npm-for-codex.md` and `docs/runbooks/supabase-auth-and-postgres.md`. Use the generated migration file path. If the CLI is unavailable after escalation, create `supabase/migrations/20260616143000_create_pending_games.sql` manually.

Fill the migration with:

```sql
create table if not exists public.pending_games (
  id uuid primary key default gen_random_uuid(),
  creator_account_id uuid not null references auth.users (id) on delete cascade,
  creator_profile_id uuid not null
    references public.account_profile_directory (profile_id)
    on update cascade
    on delete restrict,
  invitee_profile_id uuid not null
    references public.account_profile_directory (profile_id)
    on update cascade
    on delete restrict,
  template_id text not null default 'default-adjective-noun-noun',
  row_count integer not null,
  status text not null default 'pending',
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  constraint pending_games_default_template check (
    template_id = 'default-adjective-noun-noun'
  ),
  constraint pending_games_row_count check (
    row_count in (10, 15, 20, 25, 30)
  ),
  constraint pending_games_status check (
    status in ('pending', 'cancelled')
  ),
  constraint pending_games_distinct_profiles check (
    creator_profile_id <> invitee_profile_id
  )
);

create table if not exists public.pending_game_participants (
  id uuid primary key default gen_random_uuid(),
  pending_game_id uuid not null
    references public.pending_games (id)
    on delete cascade,
  profile_id uuid not null
    references public.account_profile_directory (profile_id)
    on update cascade
    on delete restrict,
  account_id uuid references auth.users (id) on delete set null,
  handle text not null,
  gamer_name text not null,
  avatar_key text not null,
  participant_role text not null,
  invite_status text not null,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  unique (pending_game_id, profile_id),
  constraint pending_game_participants_role check (
    participant_role in ('creator', 'invitee')
  ),
  constraint pending_game_participants_invite_status check (
    invite_status in ('accepted', 'pending')
  ),
  constraint pending_game_participants_role_status check (
    (
      participant_role = 'creator'
      and invite_status = 'accepted'
      and account_id is not null
    )
    or (
      participant_role = 'invitee'
      and invite_status = 'pending'
      and account_id is null
    )
  ),
  constraint pending_game_participants_handle_format check (
    handle = lower(handle)
    and char_length(handle) between 3 and 30
    and handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint pending_game_participants_gamer_name_length check (
    char_length(btrim(gamer_name)) between 1 and 40
  ),
  constraint pending_game_participants_avatar_key check (
    avatar_key in ('spark', 'paper', 'moon', 'star', 'comet', 'kite')
  )
);

create index if not exists pending_games_creator_account_id_idx
  on public.pending_games (creator_account_id);
create index if not exists pending_games_creator_profile_id_idx
  on public.pending_games (creator_profile_id);
create index if not exists pending_games_invitee_profile_id_idx
  on public.pending_games (invitee_profile_id);
create index if not exists pending_game_participants_pending_game_id_idx
  on public.pending_game_participants (pending_game_id);
create index if not exists pending_game_participants_profile_id_idx
  on public.pending_game_participants (profile_id);

alter table public.pending_games enable row level security;
alter table public.pending_game_participants enable row level security;

revoke all on table public.pending_games from public;
revoke all on table public.pending_games from anon;
revoke all on table public.pending_games from authenticated;
revoke all on table public.pending_games from service_role;
revoke all on table public.pending_game_participants from public;
revoke all on table public.pending_game_participants from anon;
revoke all on table public.pending_game_participants from authenticated;
revoke all on table public.pending_game_participants from service_role;

grant select, insert on table public.pending_games to authenticated;
grant select, insert on table public.pending_games to service_role;
grant select on table public.pending_game_participants to authenticated;
grant select, insert on table public.pending_game_participants to service_role;

drop policy if exists "Account holders can view their created Pending Games"
  on public.pending_games;
create policy "Account holders can view their created Pending Games"
  on public.pending_games
  for select
  to authenticated
  using ((select auth.uid()) = creator_account_id);

drop policy if exists "Account holders can create their Pending Games"
  on public.pending_games;
create policy "Account holders can create their Pending Games"
  on public.pending_games
  for insert
  to authenticated
  with check (
    (select auth.uid()) = creator_account_id
    and status = 'pending'
    and exists (
      select 1
      from public.account_profiles
      where account_id = (select auth.uid())
        and profile_id = creator_profile_id
    )
  );

drop policy if exists
  "Account holders can view participant rows for their created Pending Games"
  on public.pending_game_participants;
create policy
  "Account holders can view participant rows for their created Pending Games"
  on public.pending_game_participants
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.pending_games
      where id = pending_game_id
        and creator_account_id = (select auth.uid())
    )
  );

create schema if not exists private;

create or replace function private.create_pending_game_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.pending_game_participants (
    pending_game_id,
    profile_id,
    account_id,
    handle,
    gamer_name,
    avatar_key,
    participant_role,
    invite_status
  )
  select
    new.id,
    directory.profile_id,
    new.creator_account_id,
    directory.handle,
    directory.gamer_name,
    directory.avatar_key,
    'creator',
    'accepted'
  from public.account_profile_directory as directory
  where directory.profile_id = new.creator_profile_id;

  insert into public.pending_game_participants (
    pending_game_id,
    profile_id,
    account_id,
    handle,
    gamer_name,
    avatar_key,
    participant_role,
    invite_status
  )
  select
    new.id,
    directory.profile_id,
    null,
    directory.handle,
    directory.gamer_name,
    directory.avatar_key,
    'invitee',
    'pending'
  from public.account_profile_directory as directory
  where directory.profile_id = new.invitee_profile_id;

  return new;
end;
$$;

revoke all on function private.create_pending_game_participants() from public;

drop trigger if exists create_pending_game_participants
  on public.pending_games;
create trigger create_pending_game_participants
  after insert on public.pending_games
  for each row
  execute function private.create_pending_game_participants();
```

- [ ] **Step 4: Run GREEN**

Run:

```powershell
npm test -- tests/supabase-migration-surface.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add tests/supabase-migration-surface.test.mjs supabase/migrations
git commit -m "Add pending game Supabase migration"
```

## Task 5: Documentation Closeout

**Files:**
- Modify: `docs/runbooks/supabase-auth-and-postgres.md`
- Modify: `docs/backlog.md`
- Modify: `docs/superpowers/specs/2026-06-16-pending-game-foundation-design.md`

- [ ] **Step 1: Update the Supabase runbook**

Add a new section after the Account Profile directory migration section in `docs/runbooks/supabase-auth-and-postgres.md`:

````markdown
The first Pending Game foundation migration is:

```text
supabase/migrations/20260616143000_create_pending_games.sql
```

It creates source-controlled relational storage for handle-invite Pending Game
creation. `public.pending_games` stores creator-owned pending setup with
creator and invitee directory profile ids. A private-schema
`private.create_pending_game_participants()` trigger creates the creator and
invitee rows in `public.pending_game_participants` from the Account Profile
Directory so browser code does not manage a multi-table transaction and does
not supply participant display snapshots directly.

The migration enables Row Level Security on both public tables, grants no
`anon` access, grants authenticated browser clients `select` and `insert` on
`pending_games`, grants authenticated browser clients only `select` on
`pending_game_participants`, and keeps hosted application of the migration
behind explicit owner approval. The first source-controlled slice does not add
UI, invite acceptance, turn storage, Reveal, Share Consent, nudges, friends, or
public discovery.
````

- [ ] **Step 2: Update the backlog status**

In `docs/backlog.md`, update the `Signed-in 2-player asynchronous game` status to say the source-controlled Pending Game foundation is implemented locally with tests and not yet applied to hosted Supabase unless explicit approval has been granted.

- [ ] **Step 3: Verify the design spec status**

Confirm the status line in `docs/superpowers/specs/2026-06-16-pending-game-foundation-design.md` remains:

```markdown
Approved by owner on 2026-06-16; implementation tracked by this branch.
```

- [ ] **Step 4: Inspect documentation diff**

Run:

```powershell
git diff --check
git diff --stat
```

Expected: no whitespace errors; only Pending Game documentation files changed in this task.

- [ ] **Step 5: Commit**

Run:

```powershell
git add docs/runbooks/supabase-auth-and-postgres.md docs/backlog.md docs/superpowers/specs/2026-06-16-pending-game-foundation-design.md
git commit -m "Document pending game foundation migration"
```

## Task 6: Full Verification

**Files:**
- Verify all changed files from Tasks 1-5.

- [ ] **Step 1: Run full automated tests**

Run:

```powershell
npm test
```

Expected: all Node tests pass. If sandboxed Node/npm is blocked, follow `docs/runbooks/node-npm-for-codex.md` and rerun with sandbox escalation rather than changing dependencies or local tool paths.

- [ ] **Step 2: Inspect final diff and status**

Run:

```powershell
git status --short --branch
git log --oneline -5
```

Expected: branch is ahead of `origin/codex/pending-game-foundation` by implementation commits, with no unrelated files changed.

- [ ] **Step 3: Push the branch**

Run:

```powershell
git push
```

Expected: branch pushes to `origin/codex/pending-game-foundation`. This is a source push only. Do not request or approve a `dev`, `test`, production, or hosted Supabase mutation as part of this step.
