# Participant-Section Multiplayer Foundation Implementation Plan

> **Status:** Historical/source-controlled complete as of 2026-06-18. Do not
> execute this as an active source plan. Hosted Supabase migration application,
> `dev` deployment, hosted schema verification, and hosted write/cleanup smoke
> remain pending explicit owner approval under
> `docs/runbooks/supabase-auth-and-postgres.md`.
>
> **For provenance:** This plan was originally executable with
> superpowers:subagent-driven-development or superpowers:executing-plans. Future
> agents should use `docs/product-rules.md`, ADR 0015,
> `docs/runbooks/supabase-auth-and-postgres.md`,
> `docs/planning/supabase-state-ledger.md`, and `docs/backlog.md` as current
> authority. Any unchecked task checkboxes below are historical provenance, not
> active implementation status.

**Goal:** Replace global Started Game Turn sequencing with participant-local section queues, completion-gated Reveal, and durable in-app notification foundation for signed-in 2-player multiplayer.

**Architecture:** Keep Pending Game creation and Game-start conversion behind the existing `createSupabasePendingGameRepository` seam, but replace the future Started Game work surface with participant-section APIs. Postgres owns assigned-section state, submission authority, batch completion, participant-scoped Reveal state, and notification creation; browser code consumes narrow repository methods and renders three Multiplayer buckets plus a top-bar notification dropdown.

**Tech Stack:** Static JavaScript modules, Node `--test`, Playwright browser smoke, Supabase Postgres migrations, Row Level Security, narrow authenticated RPCs, and existing no-build static deployment.

---

## File Structure

- Modify `assets/pending-game.js`: keep Pending Game invite/start methods; replace future Started Game work methods with participant-section dashboard, section submission, batch reveal, and notification methods for local and Supabase repositories.
- Modify `assets/app.js`: render Multiplayer buckets (`Awaiting your entries`, `Awaiting other player entries`, `Batches completed`), section forms, completed-batch reveal actions, and notification dropdown state.
- Modify `assets/site.css`: style the three Multiplayer buckets and top-bar notification dropdown without changing the anonymous solo core layout.
- Modify `index.html`: add the notification icon/dropdown mount near the help button.
- Modify `tests/pending-game.test.mjs`: repository-level TDD for local fixture and Supabase adapter behaviours through the public repository interface.
- Modify `tests/supabase-migration-surface.test.mjs`: source-controlled migration surface assertions for participant sections, entries, reveal state, notifications, grants, RLS, and RPCs.
- Modify `tests/browser-smoke.test.mjs`: local browser smoke for concurrent participant sections, completion-gated Reveal, and read/unread notification behaviour.
- Create `supabase/migrations/*_participant_section_multiplayer_execution.sql`: generated with `npx supabase migration new participant_section_multiplayer_execution`; do not hand-invent the timestamp. The generated filename is the source-controlled migration file for this plan.
- Modify `docs/product-rules.md`, `docs/runbooks/supabase-auth-and-postgres.md`, `docs/planning/supabase-state-ledger.md`, `docs/superpowers/README.md`, and this plan as implementation status changes.

## Public Interface Target

Keep the repository surface small and behaviour-focused:

```js
await pendingGameRepository.listMultiplayerDashboard({ accountId });
await pendingGameRepository.submitMultiplayerSection({
  accountId,
  sectionId,
  entries,
});
await pendingGameRepository.revealMultiplayerBatch({ accountId, gameId });
await pendingGameRepository.listInAppNotifications({ accountId });
await pendingGameRepository.markInAppNotificationRead({
  accountId,
  notificationId,
});
```

`listMultiplayerDashboard()` returns:

```js
{
  awaitingYourEntries: [
    {
      id: "started-game-1",
      pendingGameId: "pending-game-1",
      rowCount: 10,
      participants: [{ handle: "player-test-account" }],
      currentSection: {
        id: "started-game-1-section-creator-1",
        entryKind: "adjective",
        sectionIndex: 0,
        sectionCount: 2,
        rows: [{ rowIndex: 0, value: "" }],
      },
    },
  ],
  awaitingOtherPlayerEntries: [],
  completedBatches: [
    {
      id: "started-game-1",
      pendingGameId: "pending-game-1",
      rowCount: 10,
      participants: [{ handle: "invitee-two" }],
      completedAt: "2026-06-18T12:00:00.000Z",
      revealed: false,
      phrases: [],
    },
  ],
}
```

Notifications return:

```js
[
  {
    id: "notification-1",
    type: "entries_needed",
    status: "unread",
    message: "You can submit entries to a batch with @player-test-account and @invitee-two.",
    targetGameId: "started-game-1",
    createdAt: "2026-06-18T12:00:00.000Z",
  },
]
```

## Task 1: Local Repository Tracer Bullet For Participant Sections

**Files:**
- Modify: `tests/pending-game.test.mjs`
- Modify: `assets/pending-game.js`

- [ ] **Step 1: Write the failing test**

Add a test under `describe("Pending Game repository", ...)` proving both participants receive concurrent first sections and Game-start notifications after an accepted Pending Game starts.

```js
it("starts accepted Games with participant-local current sections and entry notifications", async () => {
  const repository = createTestPendingGameRepository({
    createPendingGameId: () => "pending-game-1",
    createStartedGameId: () => "started-game-1",
    createNotificationId: createSequenceId("notification"),
    profiles: [creatorProfile, inviteeProfile],
  });

  await repository.createPendingGameFromHandle({
    creatorAccountId: creatorProfile.accountId,
    inviteeHandle: inviteeProfile.handle,
    rowCount: 10,
  });
  await repository.acceptPendingGameInvite({
    accountId: inviteeProfile.accountId,
    pendingGameId: "pending-game-1",
  });
  await repository.startPendingGame({
    creatorAccountId: creatorProfile.accountId,
    pendingGameId: "pending-game-1",
  });

  const creatorDashboard = await repository.listMultiplayerDashboard({
    accountId: creatorProfile.accountId,
  });
  const inviteeDashboard = await repository.listMultiplayerDashboard({
    accountId: inviteeProfile.accountId,
  });

  assert.equal(creatorDashboard.awaitingYourEntries.length, 1);
  assert.equal(inviteeDashboard.awaitingYourEntries.length, 1);
  assert.equal(creatorDashboard.awaitingOtherPlayerEntries.length, 0);
  assert.equal(inviteeDashboard.awaitingOtherPlayerEntries.length, 0);
  assert.equal(creatorDashboard.completedBatches.length, 0);
  assert.equal(inviteeDashboard.completedBatches.length, 0);
  assert.deepEqual(
    creatorDashboard.awaitingYourEntries[0].currentSection.rows,
    Array.from({ length: 10 }, (_, rowIndex) => ({ rowIndex, value: "" })),
  );
  assert.equal(
    JSON.stringify(creatorDashboard).includes(inviteeProfile.accountId),
    false,
  );
  assert.equal(
    JSON.stringify(inviteeDashboard).includes(creatorProfile.accountId),
    false,
  );

  assert.deepEqual(
    await repository.listInAppNotifications({
      accountId: creatorProfile.accountId,
    }),
    [
      {
        id: "notification-1",
        type: "entries_needed",
        status: "unread",
        message:
          "You can submit entries to a batch with @player-test-account and @invitee-two.",
        targetGameId: "started-game-1",
      },
    ],
  );
  assert.deepEqual(
    await repository.listInAppNotifications({
      accountId: inviteeProfile.accountId,
    }),
    [
      {
        id: "notification-2",
        type: "entries_needed",
        status: "unread",
        message:
          "You can submit entries to a batch with @player-test-account and @invitee-two.",
        targetGameId: "started-game-1",
      },
    ],
  );
});

function createSequenceId(prefix) {
  let sequence = 0;
  return () => {
    sequence += 1;
    return `${prefix}-${sequence}`;
  };
}
```

- [ ] **Step 2: Run the targeted test to verify RED**

Run:

```powershell
node --test tests/pending-game.test.mjs
```

Expected: FAIL because `listMultiplayerDashboard`, `listInAppNotifications`, or `createNotificationId` support does not exist.

- [ ] **Step 3: Implement the minimal local repository state**

In `assets/pending-game.js`, add local fixture arrays and public methods. Keep the old Turn methods temporarily until browser code is moved.

```js
const assignedSections = [];
const inAppNotifications = [];
```

Extend `createTestPendingGameRepository()` options:

```js
export function createTestPendingGameRepository({
  createPendingGameId = defaultCreatePendingGameId,
  createStartedGameId = defaultCreateStartedGameId,
  createNotificationId = defaultCreateNotificationId,
  profiles = [],
} = {}) {
```

After `startedTurns.push(...)` in `startPendingGame()`, add:

```js
assignedSections.push(
  ...createStartedGameAssignedSections({ pendingGame, startedGame }),
);
inAppNotifications.push(
  ...createGameStartedNotifications({
    createNotificationId,
    participants: pendingGame.participants,
    startedGame,
  }),
);
```

Add methods:

```js
async listMultiplayerDashboard({ accountId }) {
  assertAccountId(accountId);
  const profile = profilesByAccountId.get(accountId);
  if (!profile) {
    return createEmptyMultiplayerDashboard();
  }

  return createMultiplayerDashboard({
    assignedSections,
    pendingGames,
    profile,
  });
},

async listInAppNotifications({ accountId }) {
  assertAccountId(accountId);
  return inAppNotifications
    .filter((notification) => notification.accountId === accountId)
    .map(toNotificationDto);
},
```

Add helpers:

```js
function createStartedGameAssignedSections({ pendingGame, startedGame }) {
  const creator = pendingGame.participants.find(
    (participant) => participant.role === "creator",
  );
  const invitee = pendingGame.participants.find(
    (participant) => participant.role === "invitee",
  );

  return [
    createAssignedSection({
      id: `${startedGame.id}-section-creator-1`,
      entryKind: "adjective",
      gameId: startedGame.id,
      participantProfileId: creator.profileId,
      participantSectionIndex: 0,
      rowCount: pendingGame.rowCount,
      slotId: "adjective",
    }),
    createAssignedSection({
      id: `${startedGame.id}-section-invitee-1`,
      entryKind: "noun",
      gameId: startedGame.id,
      participantProfileId: invitee.profileId,
      participantSectionIndex: 0,
      rowCount: pendingGame.rowCount,
      slotId: "noun-1",
    }),
    createAssignedSection({
      id: `${startedGame.id}-section-invitee-2`,
      entryKind: "noun",
      gameId: startedGame.id,
      participantProfileId: invitee.profileId,
      participantSectionIndex: 1,
      rowCount: pendingGame.rowCount,
      slotId: "noun-2",
    }),
  ];
}

function createAssignedSection({
  entryKind,
  gameId,
  id,
  participantProfileId,
  participantSectionIndex,
  rowCount,
  slotId,
}) {
  return {
    id,
    entryKind,
    gameId,
    participantProfileId,
    participantSectionIndex,
    rowCount,
    slotId,
    status: "active",
    entries: [],
  };
}

function createGameStartedNotifications({
  createNotificationId,
  participants,
  startedGame,
}) {
  const message = createParticipantNotificationMessage({
    participants,
    text: "You can submit entries to a batch with",
  });

  return participants.map((participant) => ({
    id: createNotificationId(),
    accountId: participant.accountId,
    createdAt: new Date(0).toISOString(),
    message,
    status: "unread",
    targetGameId: startedGame.id,
    type: "entries_needed",
  }));
}

function createEmptyMultiplayerDashboard() {
  return {
    awaitingYourEntries: [],
    awaitingOtherPlayerEntries: [],
    completedBatches: [],
  };
}
```

- [ ] **Step 4: Run the targeted test to verify GREEN**

Run:

```powershell
node --test tests/pending-game.test.mjs
```

Expected: PASS for the new tracer bullet and all existing repository tests.

- [ ] **Step 5: Commit**

```powershell
git add assets/pending-game.js tests/pending-game.test.mjs
git commit -m "Add participant section dashboard tracer"
```

## Task 2: Local Section Submission, Waiting Bucket, And Completion

**Files:**
- Modify: `tests/pending-game.test.mjs`
- Modify: `assets/pending-game.js`

- [ ] **Step 1: Write the failing test**

Add a test proving one participant can submit sections independently, sees their own next section without a notification, then moves to waiting on the other participant.

```js
it("submits participant sections in participant-local order without notifying same-user progression", async () => {
  const repository = createTestPendingGameRepository({
    createPendingGameId: () => "pending-game-1",
    createStartedGameId: () => "started-game-1",
    createNotificationId: createSequenceId("notification"),
    profiles: [creatorProfile, inviteeProfile],
  });

  await startAcceptedLocalGame(repository);

  const inviteeFirstDashboard = await repository.listMultiplayerDashboard({
    accountId: inviteeProfile.accountId,
  });
  const firstSection =
    inviteeFirstDashboard.awaitingYourEntries[0].currentSection;

  await repository.submitMultiplayerSection({
    accountId: inviteeProfile.accountId,
    sectionId: firstSection.id,
    entries: firstSection.rows.map((row) => ({
      rowIndex: row.rowIndex,
      value: `noun-a-${row.rowIndex}`,
    })),
  });

  const inviteeSecondDashboard = await repository.listMultiplayerDashboard({
    accountId: inviteeProfile.accountId,
  });
  assert.equal(inviteeSecondDashboard.awaitingYourEntries.length, 1);
  assert.equal(
    inviteeSecondDashboard.awaitingYourEntries[0].currentSection.sectionIndex,
    1,
  );
  assert.equal(
    (await repository.listInAppNotifications({
      accountId: inviteeProfile.accountId,
    })).length,
    1,
  );

  await repository.submitMultiplayerSection({
    accountId: inviteeProfile.accountId,
    sectionId: inviteeSecondDashboard.awaitingYourEntries[0].currentSection.id,
    entries: inviteeSecondDashboard.awaitingYourEntries[0].currentSection.rows.map(
      (row) => ({ rowIndex: row.rowIndex, value: `noun-b-${row.rowIndex}` }),
    ),
  });

  const waitingDashboard = await repository.listMultiplayerDashboard({
    accountId: inviteeProfile.accountId,
  });
  assert.equal(waitingDashboard.awaitingYourEntries.length, 0);
  assert.equal(waitingDashboard.awaitingOtherPlayerEntries.length, 1);
  assert.equal(waitingDashboard.completedBatches.length, 0);
  assert.equal(JSON.stringify(waitingDashboard).includes("adjective"), false);
});

async function startAcceptedLocalGame(repository) {
  await repository.createPendingGameFromHandle({
    creatorAccountId: creatorProfile.accountId,
    inviteeHandle: inviteeProfile.handle,
    rowCount: 10,
  });
  await repository.acceptPendingGameInvite({
    accountId: inviteeProfile.accountId,
    pendingGameId: "pending-game-1",
  });
  return repository.startPendingGame({
    creatorAccountId: creatorProfile.accountId,
    pendingGameId: "pending-game-1",
  });
}
```

- [ ] **Step 2: Run the targeted test to verify RED**

Run:

```powershell
node --test tests/pending-game.test.mjs
```

Expected: FAIL because `submitMultiplayerSection()` does not exist or the waiting bucket is not populated.

- [ ] **Step 3: Implement minimal section submission**

Add method:

```js
async submitMultiplayerSection({ accountId, entries, sectionId }) {
  assertAccountId(accountId);
  assertText(sectionId, "A multiplayer section id is required.");

  const profile = profilesByAccountId.get(accountId);
  const section = assignedSections.find((candidate) => candidate.id === sectionId);
  if (!profile || !section || section.participantProfileId !== profile.profileId) {
    throw new Error("Multiplayer section is not active for this Account.");
  }

  const currentSection = findCurrentAssignedSection({
    assignedSections,
    gameId: section.gameId,
    participantProfileId: profile.profileId,
  });
  if (currentSection?.id !== section.id) {
    throw new Error("Multiplayer section is not active for this Account.");
  }

  section.entries = normaliseSubmittedEntries(entries, {
    rowCount: section.rowCount,
  });
  section.status = "submitted";

  return {
    id: section.id,
    gameId: section.gameId,
    status: section.status,
  };
},
```

Add helper:

```js
function findCurrentAssignedSection({
  assignedSections,
  gameId,
  participantProfileId,
}) {
  return assignedSections
    .filter(
      (section) =>
        section.gameId === gameId &&
        section.participantProfileId === participantProfileId &&
        section.status !== "submitted",
    )
    .toSorted(
      (left, right) =>
        left.participantSectionIndex - right.participantSectionIndex,
    )[0] ?? null;
}
```

Update dashboard bucketing so a started Game with no current section for the Account but incomplete other sections appears in `awaitingOtherPlayerEntries`.

- [ ] **Step 4: Run the targeted test to verify GREEN**

Run:

```powershell
node --test tests/pending-game.test.mjs
```

Expected: PASS for repository tests.

- [ ] **Step 5: Commit**

```powershell
git add assets/pending-game.js tests/pending-game.test.mjs
git commit -m "Support participant-local section submission"
```

## Task 3: Local Batch Completion, Reveal State, And Completion Notifications

**Files:**
- Modify: `tests/pending-game.test.mjs`
- Modify: `assets/pending-game.js`

- [ ] **Step 1: Write the failing test**

Add a test proving final section submission creates completion notifications, marks the final submitter notification read, lists completed batches, and Reveal is participant-scoped.

```js
it("completes batches after all sections and reveals per participant", async () => {
  const repository = createTestPendingGameRepository({
    createPendingGameId: () => "pending-game-1",
    createStartedGameId: () => "started-game-1",
    createNotificationId: createSequenceId("notification"),
    profiles: [creatorProfile, inviteeProfile],
  });

  const startedGame = await startAcceptedLocalGame(repository);
  await submitAllCurrentSections(repository, inviteeProfile.accountId, "noun");

  const creatorDashboard = await repository.listMultiplayerDashboard({
    accountId: creatorProfile.accountId,
  });
  const creatorSection = creatorDashboard.awaitingYourEntries[0].currentSection;

  await repository.submitMultiplayerSection({
    accountId: creatorProfile.accountId,
    sectionId: creatorSection.id,
    entries: creatorSection.rows.map((row) => ({
      rowIndex: row.rowIndex,
      value: `brisk-${row.rowIndex}`,
    })),
  });

  const completedForCreator = await repository.listMultiplayerDashboard({
    accountId: creatorProfile.accountId,
  });
  const completedForInvitee = await repository.listMultiplayerDashboard({
    accountId: inviteeProfile.accountId,
  });

  assert.equal(completedForCreator.completedBatches.length, 1);
  assert.equal(completedForInvitee.completedBatches.length, 1);
  assert.equal(completedForCreator.completedBatches[0].revealed, false);
  assert.equal(completedForInvitee.completedBatches[0].revealed, false);

  const creatorNotifications = await repository.listInAppNotifications({
    accountId: creatorProfile.accountId,
  });
  const inviteeNotifications = await repository.listInAppNotifications({
    accountId: inviteeProfile.accountId,
  });
  assert.equal(creatorNotifications.at(-1).type, "batch_complete");
  assert.equal(creatorNotifications.at(-1).status, "read");
  assert.equal(inviteeNotifications.at(-1).type, "batch_complete");
  assert.equal(inviteeNotifications.at(-1).status, "unread");

  const revealed = await repository.revealMultiplayerBatch({
    accountId: inviteeProfile.accountId,
    gameId: startedGame.id,
  });
  assert.deepEqual(revealed.phrases.slice(0, 2), [
    "Brisk-0 noun-a-0 noun-b-0",
    "Brisk-1 noun-a-1 noun-b-1",
  ]);

  const afterInviteeReveal = await repository.listMultiplayerDashboard({
    accountId: inviteeProfile.accountId,
  });
  const afterCreatorReveal = await repository.listMultiplayerDashboard({
    accountId: creatorProfile.accountId,
  });
  assert.equal(afterInviteeReveal.completedBatches[0].revealed, true);
  assert.equal(afterCreatorReveal.completedBatches[0].revealed, false);
});

async function submitAllCurrentSections(repository, accountId, prefix) {
  while (true) {
    const dashboard = await repository.listMultiplayerDashboard({ accountId });
    const section = dashboard.awaitingYourEntries[0]?.currentSection;
    if (!section) {
      return;
    }
    await repository.submitMultiplayerSection({
      accountId,
      sectionId: section.id,
      entries: section.rows.map((row) => ({
        rowIndex: row.rowIndex,
        value: `${prefix}-${section.sectionIndex === 0 ? "a" : "b"}-${row.rowIndex}`,
      })),
    });
  }
}
```

- [ ] **Step 2: Run the targeted test to verify RED**

Run:

```powershell
node --test tests/pending-game.test.mjs
```

Expected: FAIL because completion notifications, completed batches, and `revealMultiplayerBatch()` do not exist.

- [ ] **Step 3: Implement local completion and reveal**

Add local state:

```js
const revealedMultiplayerBatches = [];
```

After a section is marked submitted in `submitMultiplayerSection()`, call:

```js
if (isGameComplete({ assignedSections, gameId: section.gameId })) {
  inAppNotifications.push(
    ...createBatchCompleteNotifications({
      createNotificationId,
      finalSubmitterAccountId: accountId,
      participants: findStartedGameParticipants({
        gameId: section.gameId,
        pendingGames,
      }),
      startedGameId: section.gameId,
    }),
  );
}
```

Add `revealMultiplayerBatch()`:

```js
async revealMultiplayerBatch({ accountId, gameId }) {
  assertAccountId(accountId);
  assertText(gameId, "A Started Game id is required.");

  const profile = profilesByAccountId.get(accountId);
  if (!profile || !isGameComplete({ assignedSections, gameId })) {
    throw new Error("Multiplayer batch is not complete.");
  }

  if (!isStartedGameParticipant({ gameId, pendingGames, profile })) {
    throw new Error("Multiplayer batch was not found.");
  }

  const phrases = renderMultiplayerPhrases({
    assignedSections,
    gameId,
  });
  upsertRevealState({
    gameId,
    profileId: profile.profileId,
    revealedMultiplayerBatches,
  });

  return { gameId, phrases, revealed: true };
},
```

Add helpers:

```js
function isGameComplete({ assignedSections, gameId }) {
  const gameSections = assignedSections.filter(
    (section) => section.gameId === gameId,
  );
  return (
    gameSections.length > 0 &&
    gameSections.every((section) => section.status === "submitted")
  );
}

function renderMultiplayerPhrases({ assignedSections, gameId }) {
  const submittedSections = assignedSections
    .filter((section) => section.gameId === gameId)
    .toSorted((left, right) => slotRenderOrder(left.slotId) - slotRenderOrder(right.slotId));

  return Array.from({ length: submittedSections[0].rowCount }, (_, rowIndex) => {
    const phrase = submittedSections
      .map((section) => section.entries[rowIndex]?.value ?? "")
      .join(" ")
      .trim()
      .replace(/\s+/g, " ");
    return phrase.charAt(0).toUpperCase() + phrase.slice(1);
  });
}

function slotRenderOrder(slotId) {
  return ["adjective", "noun-1", "noun-2"].indexOf(slotId);
}
```

- [ ] **Step 4: Run the targeted test to verify GREEN**

Run:

```powershell
node --test tests/pending-game.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add assets/pending-game.js tests/pending-game.test.mjs
git commit -m "Complete and reveal multiplayer batches locally"
```

## Task 4: Supabase Migration Surface

**Files:**
- Modify: `tests/supabase-migration-surface.test.mjs`
- Create: `supabase/migrations/*_participant_section_multiplayer_execution.sql`
- Modify: `docs/runbooks/supabase-auth-and-postgres.md`

- [ ] **Step 1: Confirm current Supabase CLI and docs path**

Run:

```powershell
npx supabase --version
npx supabase migration --help
```

Expected: Supabase CLI prints a version and migration help. If sandbox blocks `npx`, rerun with escalation and the justification: "Do you want to allow npx Supabase CLI access to create the source-controlled migration file?"

- [ ] **Step 2: Write the failing migration-surface test**

Add a new test to `tests/supabase-migration-surface.test.mjs`:

```js
const participantSectionExecutionMigrationUrl = findMigrationUrl(
  "participant_section_multiplayer_execution",
);

it("creates participant-section multiplayer execution with notifications and reveal state", () => {
  assert.equal(existsSync(participantSectionExecutionMigrationUrl), true);

  const migration = readFileSync(
    participantSectionExecutionMigrationUrl,
    "utf8",
  );

  for (const tableName of [
    "game_section_assignments",
    "game_section_entries",
    "multiplayer_batch_reveals",
    "in_app_notifications",
  ]) {
    assert.match(
      migration,
      new RegExp(`create table if not exists public\\.${tableName}`),
    );
    assert.match(
      migration,
      new RegExp(`alter table public\\.${tableName} enable row level security`),
    );
    assert.match(
      migration,
      new RegExp(`revoke all on table public\\.${tableName} from anon`),
    );
  }

  assert.match(migration, /participant_section_index integer not null/);
  assert.match(migration, /unique \(game_id, participant_profile_id, participant_section_index\)/);
  assert.match(migration, /unique \(assignment_id, row_index\)/);
  assert.match(migration, /notification_type in \('entries_needed', 'batch_complete'\)/);
  assert.match(migration, /notification_status in \('unread', 'read'\)/);

  assert.match(
    migration,
    /create or replace function private\.create_started_game_section_assignments\(\)/,
  );
  assert.match(
    migration,
    /create trigger create_started_game_section_assignments\s+after insert on public\.games/,
  );
  assert.match(
    migration,
    /create or replace function public\.list_multiplayer_dashboard\(\)/,
  );
  assert.match(
    migration,
    /create or replace function public\.submit_multiplayer_section\(uuid, jsonb\)/,
  );
  assert.match(
    migration,
    /create or replace function public\.reveal_multiplayer_batch\(uuid\)/,
  );

  assert.match(
    migration,
    /grant execute on function public\.list_multiplayer_dashboard\(\)\s+to authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.submit_multiplayer_section\(uuid, jsonb\)\s+to authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.reveal_multiplayer_batch\(uuid\)\s+to authenticated/,
  );
  assert.doesNotMatch(
    migration,
    /grant insert .*on table public\.game_section_entries to authenticated/i,
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.create_started_game_section_assignments/i,
  );
});
```

- [ ] **Step 3: Run the migration-surface test to verify RED**

Run:

```powershell
node --test tests/supabase-migration-surface.test.mjs
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 4: Generate and implement the migration**

Run:

```powershell
npx supabase migration new participant_section_multiplayer_execution
```

Edit the generated `supabase/migrations/*_participant_section_multiplayer_execution.sql` file. The migration must:

- create `public.game_section_assignments`;
- create `public.game_section_entries`;
- create `public.multiplayer_batch_reveals`;
- create `public.in_app_notifications`;
- enable RLS on every new table;
- revoke all public, anon, authenticated, and service_role table grants before granting minimum required privileges back;
- grant authenticated clients execute access only to narrow public RPCs and direct select/update access only where RLS permits it for notifications;
- keep helper functions in `private` unless the browser must call them;
- use `security definer` with `set search_path = ''` for privileged functions;
- create participant-section rows from `public.games.slot_allocation`;
- create Game-start `entries_needed` notifications for every participant;
- submit sections through `public.submit_multiplayer_section(uuid, jsonb)`;
- derive batch completion from all section assignments being submitted;
- create batch-complete notifications during the final section submission;
- create the final submitter's batch-complete notification with `notification_status = 'read'`;
- reveal through `public.reveal_multiplayer_batch(uuid)` with participant-scoped reveal state.

- [ ] **Step 5: Run migration-surface test to verify GREEN**

Run:

```powershell
node --test tests/supabase-migration-surface.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Update Supabase runbook**

In `docs/runbooks/supabase-auth-and-postgres.md`, add the generated migration filename and summarise its authority boundary under the Started Game / Pending Game Browser Wiring sections.

- [ ] **Step 7: Commit**

```powershell
git add docs/runbooks/supabase-auth-and-postgres.md supabase/migrations tests/supabase-migration-surface.test.mjs
git commit -m "Add participant section Supabase surface"
```

## Task 5: Supabase Repository Adapter

**Files:**
- Modify: `tests/pending-game.test.mjs`
- Modify: `assets/pending-game.js`

**Completion note (2026-06-18):** Task 5 completed in commit `dbd897d`.
Follow-up commit `ad576bf` named the public SQL RPC arguments
(`target_assignment_id`, `submitted_entries`, `target_game_id`) so Supabase JS
named `.rpc()` params match the migration contract. The public execute grants
remain checked by type signature.

- [x] **Step 1: Write failing Supabase adapter tests**

Add tests proving the Supabase repository calls the new RPCs and notification table surface:

```js
it("loads participant-section dashboard through Supabase RPC", async () => {
  const supabase = createFakePendingGameSupabase({
    creatorProfile,
    inviteeProfile,
  });
  const repository = createSupabasePendingGameRepository({ supabase });

  const dashboard = await repository.listMultiplayerDashboard({
    accountId: creatorProfile.accountId,
  });

  assert.deepEqual(supabase.rpcCalls, ["list_multiplayer_dashboard"]);
  assert.equal(dashboard.awaitingYourEntries.length, 1);
  assert.equal(dashboard.awaitingYourEntries[0].currentSection.entryKind, "adjective");
});

it("submits participant sections through Supabase RPC", async () => {
  const supabase = createFakePendingGameSupabase({
    creatorProfile,
    inviteeProfile,
  });
  const repository = createSupabasePendingGameRepository({ supabase });

  const result = await repository.submitMultiplayerSection({
    accountId: creatorProfile.accountId,
    sectionId: "supabase-section-1",
    entries: [{ rowIndex: 0, value: "brisk" }],
  });

  assert.deepEqual(supabase.rpcCalls, ["submit_multiplayer_section"]);
  assert.deepEqual(result, {
    gameId: "supabase-started-game-1",
    id: "supabase-section-1",
    status: "submitted",
  });
});

it("reveals multiplayer batches through Supabase RPC", async () => {
  const supabase = createFakePendingGameSupabase({
    creatorProfile,
    inviteeProfile,
  });
  const repository = createSupabasePendingGameRepository({ supabase });

  const revealed = await repository.revealMultiplayerBatch({
    accountId: creatorProfile.accountId,
    gameId: "supabase-started-game-1",
  });

  assert.deepEqual(supabase.rpcCalls, ["reveal_multiplayer_batch"]);
  assert.deepEqual(revealed.phrases, ["Brisk teapot cloud"]);
});

it("lists and marks in-app notifications through Supabase rows", async () => {
  const supabase = createFakePendingGameSupabase({
    creatorProfile,
    inviteeProfile,
  });
  const repository = createSupabasePendingGameRepository({ supabase });

  const notifications = await repository.listInAppNotifications({
    accountId: creatorProfile.accountId,
  });
  await repository.markInAppNotificationRead({
    accountId: creatorProfile.accountId,
    notificationId: notifications[0].id,
  });

  assert.deepEqual(supabase.tableCalls, [
    "in_app_notifications",
    "in_app_notifications",
  ]);
});
```

- [x] **Step 2: Run tests to verify RED**

Run:

```powershell
node --test tests/pending-game.test.mjs
```

Expected: FAIL because Supabase repository methods are missing.

- [x] **Step 3: Implement Supabase adapter methods**

In `createSupabasePendingGameRepository()`, add:

```js
async listMultiplayerDashboard({ accountId }) {
  assertAccountId(accountId);
  const response = await supabase.rpc("list_multiplayer_dashboard");
  assertNoSupabaseError(response, "Could not load Multiplayer dashboard");
  return recoverMultiplayerDashboard(response.data);
},

async submitMultiplayerSection({ accountId, entries, sectionId }) {
  assertAccountId(accountId);
  assertText(sectionId, "A multiplayer section id is required.");
  const response = await supabase.rpc("submit_multiplayer_section", {
    submitted_entries: normaliseSubmittedEntries(entries, {
      rowCount: entries?.length ?? 0,
    }),
    target_assignment_id: sectionId,
  });
  assertNoSupabaseError(response, "Could not submit Multiplayer section");
  return recoverSubmittedMultiplayerSection(response.data);
},

async revealMultiplayerBatch({ accountId, gameId }) {
  assertAccountId(accountId);
  assertText(gameId, "A Started Game id is required.");
  const response = await supabase.rpc("reveal_multiplayer_batch", {
    target_game_id: gameId,
  });
  assertNoSupabaseError(response, "Could not reveal Multiplayer batch");
  return recoverRevealedMultiplayerBatch(response.data);
},

async listInAppNotifications({ accountId }) {
  assertAccountId(accountId);
  const response = await supabase
    .from("in_app_notifications")
    .select("id, notification_type, notification_status, message, target_game_id, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  assertNoSupabaseError(response, "Could not load notifications");
  return response.data.map(recoverInAppNotification);
},

async markInAppNotificationRead({ accountId, notificationId }) {
  assertAccountId(accountId);
  assertText(notificationId, "A notification id is required.");
  const response = await supabase
    .from("in_app_notifications")
    .update({
      notification_status: "read",
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
    .select("id, notification_type, notification_status, message, target_game_id, created_at")
    .single();
  assertNoSupabaseError(response, "Could not mark notification read");
  return recoverInAppNotification(response.data);
},
```

- [x] **Step 4: Extend fake Supabase client**

Update `createFakePendingGameSupabase()` and `FakePendingGameQuery` to support the new RPC names and `in_app_notifications` table.

- [x] **Step 5: Run tests to verify GREEN**

Run:

```powershell
node --test tests/pending-game.test.mjs
```

Expected: PASS.

- [x] **Step 6: Commit**

```powershell
git add assets/pending-game.js tests/pending-game.test.mjs
git commit -m "Wire Supabase participant section adapter"
```

## Task 6: Browser UI And Local Smoke

**Files:**
- Modify: `index.html`
- Modify: `assets/app.js`
- Modify: `assets/site.css`
- Modify: `tests/browser-smoke.test.mjs`

- [ ] **Step 1: Write failing browser smoke**

Replace the old "submit the first active turn" smoke with one proving:

- both creator and invitee see `Awaiting your entries` after the Game starts;
- invitee can complete two sections in sequence without extra same-user notifications;
- invitee then sees `Awaiting other player entries`;
- creator completes the final section and sees `Batches completed` with `Reveal phrases`;
- invitee has an unread batch-complete notification;
- viewing notification dropdown marks the invitee notification read;
- invitee can reveal independently.

Use selectors:

```js
await assertTextVisible(page, "Awaiting your entries");
await assertTextVisible(page, "Awaiting other player entries");
await assertTextVisible(page, "Batches completed");
await page.getByRole("button", { name: "Notifications" }).click();
await assertTextVisible(page, "Batch with @player-test-account and @invitee-two is now complete and available to reveal.");
await assertTextVisible(page, "Read");
await page.getByRole("button", { name: "Reveal phrases" }).click();
await assertTextVisible(page, "Your crazy phrases");
```

- [ ] **Step 2: Run browser smoke to verify RED**

Run:

```powershell
node --test tests/browser-smoke.test.mjs
```

Expected: FAIL because the UI still renders old Started Game Turn controls.

- [ ] **Step 3: Add notification markup**

In `index.html`, add a notification mount before the help button:

```html
<div class="notification-shell" data-notification-shell hidden>
  <button
    class="icon-button notification-button"
    type="button"
    aria-expanded="false"
    aria-controls="notification-panel"
    data-notification-toggle
  >
    <span aria-hidden="true">!</span>
    <span class="sr-only">Notifications</span>
  </button>
  <div
    class="notification-panel"
    id="notification-panel"
    data-notification-panel
    hidden
  ></div>
</div>
```

- [ ] **Step 4: Render Multiplayer buckets**

In `assets/app.js`, replace `activeStartedGameTurns` state with:

```js
let multiplayerDashboard = {
  awaitingYourEntries: [],
  awaitingOtherPlayerEntries: [],
  completedBatches: [],
};
let inAppNotifications = [];
```

Replace `loadActiveStartedGameTurns()` calls with:

```js
async function loadMultiplayerDashboard() {
  if (accountShell.persistenceAuthority.type !== "account") {
    multiplayerDashboard = createEmptyMultiplayerDashboard();
    inAppNotifications = [];
    return;
  }

  [multiplayerDashboard, inAppNotifications] = await Promise.all([
    pendingGameRepository.listMultiplayerDashboard({
      accountId: accountShell.accountId,
    }),
    pendingGameRepository.listInAppNotifications({
      accountId: accountShell.accountId,
    }),
  ]);
}
```

Add render functions with concrete bucket output:

```js
function renderMultiplayerDashboard() {
  const dashboard = document.createElement("div");
  dashboard.className = "multiplayer-dashboard";
  dashboard.dataset.multiplayerDashboard = "";
  dashboard.replaceChildren(
    renderMultiplayerBucket({
      headingText: "Awaiting your entries",
      items: multiplayerDashboard.awaitingYourEntries,
      renderItem: renderAwaitingYourEntries,
    }),
    renderMultiplayerBucket({
      headingText: "Awaiting other player entries",
      items: multiplayerDashboard.awaitingOtherPlayerEntries,
      renderItem: renderAwaitingOtherPlayerEntries,
    }),
    renderMultiplayerBucket({
      headingText: "Batches completed",
      items: multiplayerDashboard.completedBatches,
      renderItem: renderCompletedMultiplayerBatch,
    }),
  );
  return dashboard;
}

function renderMultiplayerBucket({ headingText, items, renderItem }) {
  const section = document.createElement("section");
  section.className = "multiplayer-bucket";
  const heading = document.createElement("h3");
  heading.textContent = headingText;
  section.append(heading);
  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "pending-game-row-count";
    empty.textContent = "Nothing here yet.";
    section.append(empty);
    return section;
  }
  section.append(...items.map(renderItem));
  return section;
}

function renderAwaitingYourEntries(gameSummary) {
  const card = document.createElement("div");
  card.className = "pending-game-card";
  card.append(renderMultiplayerParticipantSummary(gameSummary));
  card.append(renderMultiplayerSectionForm(gameSummary.currentSection));
  return card;
}

function renderAwaitingOtherPlayerEntries(gameSummary) {
  const card = document.createElement("div");
  card.className = "pending-game-card";
  card.append(renderMultiplayerParticipantSummary(gameSummary));
  const waiting = document.createElement("p");
  waiting.className = "pending-game-row-count";
  waiting.textContent = "Awaiting other player entries.";
  card.append(waiting);
  return card;
}

function renderCompletedMultiplayerBatch(batchSummary) {
  const card = document.createElement("div");
  card.className = "pending-game-card";
  card.append(renderMultiplayerParticipantSummary(batchSummary));
  if (!batchSummary.revealed) {
    const revealButton = document.createElement("button");
    revealButton.className = "secondary-button";
    revealButton.type = "button";
    revealButton.textContent = "Reveal phrases";
    revealButton.addEventListener("click", () => {
      void revealMultiplayerBatch(batchSummary.id);
    });
    card.append(revealButton);
    return card;
  }
  const list = document.createElement("ol");
  list.className = "phrase-list";
  list.replaceChildren(
    ...batchSummary.phrases.map((phrase) => {
      const item = document.createElement("li");
      item.textContent = phrase;
      return item;
    }),
  );
  card.append(list);
  return card;
}

function renderNotificationDropdown() {
  notificationPanel.replaceChildren(
    ...inAppNotifications.map((notification) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "notification-item";
      item.textContent = `${notification.message} ${
        notification.status === "unread" ? "Unread" : "Read"
      }`;
      item.addEventListener("click", () => {
        void markNotificationRead(notification.id);
      });
      return item;
    }),
  );
}
```

Keep the functions small and call them from `renderPendingGamePanel()`.

- [ ] **Step 5: Wire section submit and reveal actions**

Add handlers:

```js
async function submitMultiplayerSection(event, currentSection) {
  event.preventDefault();
  const form = event.currentTarget;
  const entries = [...form.querySelectorAll("[data-multiplayer-section-input]")]
    .map((input) => ({
      rowIndex: Number(input.dataset.multiplayerSectionInput),
      value: input.value,
    }));

  await pendingGameRepository.submitMultiplayerSection({
    accountId: accountShell.accountId,
    entries,
    sectionId: currentSection.id,
  });
  await refreshMultiplayerSurfaces();
}

async function revealMultiplayerBatch(gameId) {
  const revealed = await pendingGameRepository.revealMultiplayerBatch({
    accountId: accountShell.accountId,
    gameId,
  });
  multiplayerDashboard.completedBatches = multiplayerDashboard.completedBatches.map(
    (batch) => batch.id === gameId ? { ...batch, ...revealed } : batch,
  );
  renderPendingGamePanel();
}
```

- [ ] **Step 6: Style UI**

Add CSS classes:

```css
.notification-shell {
  position: relative;
}

.notification-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  z-index: 10;
  width: min(320px, calc(100vw - 32px));
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.multiplayer-bucket {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}
```

- [ ] **Step 7: Run browser smoke to verify GREEN**

Run:

```powershell
node --test tests/browser-smoke.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add index.html assets/app.js assets/site.css tests/browser-smoke.test.mjs
git commit -m "Render participant section multiplayer UI"
```

## Task 7: Documentation, Full Verification, And Closeout

**Files:**
- Modify: `docs/product-rules.md`
- Modify: `docs/runbooks/supabase-auth-and-postgres.md`
- Modify: `docs/planning/supabase-state-ledger.md`
- Modify: `docs/backlog.md`
- Modify: `docs/superpowers/README.md`
- Modify: `docs/superpowers/plans/2026-06-18-participant-section-multiplayer-foundation.md`

- [x] **Step 1: Update durable docs**

Record:

- implementation status for ADR 0015;
- migration filename and local verification evidence in the Supabase runbook;
- plan status in `docs/superpowers/README.md`;
- any follow-up deferrals in `docs/backlog.md`;
- hosted migration/deployment evidence in `docs/planning/supabase-state-ledger.md` only after hosted validation occurs.

- [x] **Step 2: Run targeted tests**

Run:

```powershell
node --test tests/pending-game.test.mjs
node --test tests/supabase-migration-surface.test.mjs
node --test tests/browser-smoke.test.mjs
```

Expected: all targeted tests PASS.

Actual on 2026-06-18: plain `node` was unavailable on the Codex sandbox `PATH`,
so the documented bundled Node executable was used.
`tests/pending-game.test.mjs` passed 37/37 tests,
`tests/supabase-migration-surface.test.mjs` passed 13/13 tests, and
`tests/browser-smoke.test.mjs` passed 13/13 tests.

- [x] **Step 3: Run full local suite**

Run:

```powershell
npm test
```

Expected: all suites PASS with no unexpected warnings.

Actual on 2026-06-18: plain `npm` was unavailable on the Codex sandbox `PATH`,
so `npm test` did not run. The package script is `node --test`; the equivalent
bundled `node.exe --test` command passed 141/141 tests.

- [x] **Step 4: Inspect diff and whitespace**

Run:

```powershell
git diff --check
git diff --stat
```

Expected: no whitespace errors. LF/CRLF warnings are acceptable if they match the repo's existing Windows behaviour.

Actual on 2026-06-18: `git diff --check` reported no whitespace errors and
only the existing Windows LF-to-CRLF working-copy warnings. `git diff --stat`
showed documentation-only closeout changes.

- [x] **Step 5: Commit docs and closeout**

```powershell
git add docs/product-rules.md docs/runbooks/supabase-auth-and-postgres.md docs/planning/supabase-state-ledger.md docs/backlog.md docs/superpowers/README.md docs/superpowers/plans/2026-06-18-participant-section-multiplayer-foundation.md
git commit -m "Document participant section multiplayer foundation"
```

- [x] **Step 6: Stop before hosted mutation**

Do not apply hosted Supabase migrations, deploy to `dev`, or run hosted write smokes without explicit owner approval. Hosted migration application is a live backend mutation under `docs/runbooks/supabase-auth-and-postgres.md`.

## Self-Review

- Spec coverage: participant-local section queues are covered in Tasks 1-3; durable Supabase authority in Tasks 4-5; three UI areas and notification dropdown in Task 6; documentation and verification in Task 7.
- Placeholder scan: the only wildcard path is the Supabase CLI-generated migration filename. This is intentional because the runbook and Supabase skill require `npx supabase migration new` rather than hand-inventing timestamps.
- Type consistency: repository methods use `listMultiplayerDashboard`, `submitMultiplayerSection`, `revealMultiplayerBatch`, `listInAppNotifications`, and `markInAppNotificationRead` consistently across tests, local repository, Supabase adapter, and UI.
- Scope check: the plan does not implement full paginated completed-batch history, Share Consent, external sharing, friends, nudges, push/email notifications, Android app, creator cancellation UI, invite expiry, participant replacement, or post-submission correction requests.
