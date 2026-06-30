import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createLocalTestPendingGameRepository,
  createSupabasePendingGameRepository,
  createTestPendingGameRepository,
} from "../assets/pending-game.js";

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

const otherCreatorProfile = {
  accountId: "other-creator-auth-account",
  profileId: "other-creator-profile-id",
  handle: "other-creator",
  gamerName: "Other Creator",
  avatarKey: "moon",
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

  it("lists incoming Pending Game invites for the invitee Account without exposing Auth identities", async () => {
    const repository = createTestPendingGameRepository({
      createPendingGameId: () => "pending-game-1",
      profiles: [creatorProfile, inviteeProfile],
    });

    await repository.createPendingGameFromHandle({
      creatorAccountId: creatorProfile.accountId,
      inviteeHandle: inviteeProfile.handle,
      rowCount: 10,
    });

    const pendingInvites = await repository.listIncomingPendingGameInvites({
      accountId: inviteeProfile.accountId,
    });

    assert.deepEqual(pendingInvites, [
      {
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
      },
    ]);
    assert.equal(JSON.stringify(pendingInvites).includes("auth-account"), false);
  });

  it("lists expired Pending Game invites with expired status", async () => {
    let currentTime = Date.parse("2026-06-01T12:00:00.000Z");
    const repository = createTestPendingGameRepository({
      createPendingGameId: () => "pending-game-1",
      now: () => new Date(currentTime),
      profiles: [creatorProfile, inviteeProfile],
    });

    await repository.createPendingGameFromHandle({
      creatorAccountId: creatorProfile.accountId,
      inviteeHandle: inviteeProfile.handle,
      rowCount: 10,
    });

    currentTime = Date.parse("2026-06-09T12:00:00.000Z");
    const pendingInvites = await repository.listIncomingPendingGameInvites({
      accountId: inviteeProfile.accountId,
    });

    assert.equal(pendingInvites[0].status, "expired");
    assert.equal(JSON.stringify(pendingInvites).includes("auth-account"), false);
  });

  it("accepts an incoming Pending Game invite for the invitee Account", async () => {
    const repository = createTestPendingGameRepository({
      createPendingGameId: () => "pending-game-1",
      profiles: [creatorProfile, inviteeProfile],
    });

    await repository.createPendingGameFromHandle({
      creatorAccountId: creatorProfile.accountId,
      inviteeHandle: inviteeProfile.handle,
      rowCount: 10,
    });

    const acceptedInvite = await repository.acceptPendingGameInvite({
      accountId: inviteeProfile.accountId,
      pendingGameId: "pending-game-1",
    });

    assert.deepEqual(acceptedInvite, {
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
          inviteStatus: "accepted",
          profileId: "invitee-profile-id",
          handle: "invitee-two",
          gamerName: "Invitee Two",
          avatarKey: "paper",
        },
      ],
    });
    assert.equal(JSON.stringify(acceptedInvite).includes("auth-account"), false);
  });

  it("rejects accepting an expired Pending Game invite", async () => {
    let currentTime = Date.parse("2026-06-01T12:00:00.000Z");
    const repository = createTestPendingGameRepository({
      createPendingGameId: () => "pending-game-1",
      now: () => new Date(currentTime),
      profiles: [creatorProfile, inviteeProfile],
    });

    await repository.createPendingGameFromHandle({
      creatorAccountId: creatorProfile.accountId,
      inviteeHandle: inviteeProfile.handle,
      rowCount: 10,
    });

    currentTime = Date.parse("2026-06-09T12:00:00.000Z");

    await assert.rejects(
      () =>
        repository.acceptPendingGameInvite({
          accountId: inviteeProfile.accountId,
          pendingGameId: "pending-game-1",
        }),
      /Pending Game invite was not found\./,
    );
  });

  it("declines an incoming Pending Game invite and cancels the Pending Game", async () => {
    const repository = createTestPendingGameRepository({
      createPendingGameId: () => "pending-game-1",
      profiles: [creatorProfile, inviteeProfile],
    });

    await repository.createPendingGameFromHandle({
      creatorAccountId: creatorProfile.accountId,
      inviteeHandle: inviteeProfile.handle,
      rowCount: 10,
    });

    const declinedInvite = await repository.declinePendingGameInvite({
      accountId: inviteeProfile.accountId,
      pendingGameId: "pending-game-1",
    });

    assert.deepEqual(declinedInvite, {
      id: "pending-game-1",
      status: "cancelled",
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
          inviteStatus: "declined",
          profileId: "invitee-profile-id",
          handle: "invitee-two",
          gamerName: "Invitee Two",
          avatarKey: "paper",
        },
      ],
    });
    assert.equal(JSON.stringify(declinedInvite).includes("auth-account"), false);
  });

  it("lists created Pending Games with invitee response state for the creator Account", async () => {
    const repository = createTestPendingGameRepository({
      createPendingGameId: () => "pending-game-1",
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

    const createdGames = await repository.listCreatedPendingGames({
      accountId: creatorProfile.accountId,
    });

    assert.deepEqual(createdGames, [
      {
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
            inviteStatus: "accepted",
            profileId: "invitee-profile-id",
            handle: "invitee-two",
            gamerName: "Invitee Two",
            avatarKey: "paper",
          },
        ],
      },
    ]);
    assert.equal(JSON.stringify(createdGames).includes("auth-account"), false);
  });

  it("lists expired created Pending Games with expired status", async () => {
    let currentTime = Date.parse("2026-06-01T12:00:00.000Z");
    const repository = createTestPendingGameRepository({
      createPendingGameId: () => "pending-game-1",
      now: () => new Date(currentTime),
      profiles: [creatorProfile, inviteeProfile],
    });

    await repository.createPendingGameFromHandle({
      creatorAccountId: creatorProfile.accountId,
      inviteeHandle: inviteeProfile.handle,
      rowCount: 10,
    });

    currentTime = Date.parse("2026-06-09T12:00:00.000Z");
    const createdGames = await repository.listCreatedPendingGames({
      accountId: creatorProfile.accountId,
    });

    assert.equal(createdGames[0].status, "expired");
    assert.equal(JSON.stringify(createdGames).includes("auth-account"), false);
  });

  it("starts an accepted Pending Game as a browser-safe Started Game", async () => {
    const repository = createTestPendingGameRepository({
      createPendingGameId: () => "pending-game-1",
      createStartedGameId: () => "started-game-1",
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

    const startedGame = await repository.startPendingGame({
      creatorAccountId: creatorProfile.accountId,
      pendingGameId: "pending-game-1",
    });

    assert.deepEqual(startedGame, {
      id: "started-game-1",
      pendingGameId: "pending-game-1",
      status: "started",
      templateId: "default-adjective-noun-noun",
      rowCount: 10,
      participants: [
        {
          role: "creator",
          profileId: "creator-profile-id",
          handle: "creator-one",
          gamerName: "Creator One",
          avatarKey: "spark",
        },
        {
          role: "invitee",
          profileId: "invitee-profile-id",
          handle: "invitee-two",
          gamerName: "Invitee Two",
          avatarKey: "paper",
        },
      ],
      setup: {
        slotAllocation: "resolved",
        slotOrder: "resolved",
      },
    });
    assert.equal(JSON.stringify(startedGame).includes("auth-account"), false);
    assert.equal(Array.isArray(startedGame.setup.slotAllocation), false);
    assert.equal(Array.isArray(startedGame.setup.slotOrder), false);
  });

  it("carries a configured Nudge Timeout into the Started Game", async () => {
    const repository = createTestPendingGameRepository({
      createPendingGameId: () => "pending-game-1",
      createStartedGameId: () => "started-game-1",
      profiles: [creatorProfile, inviteeProfile],
    });

    await repository.createPendingGameFromHandle({
      creatorAccountId: creatorProfile.accountId,
      inviteeHandle: inviteeProfile.handle,
      nudgeTimeoutHours: 48,
      rowCount: 10,
    });
    await repository.acceptPendingGameInvite({
      accountId: inviteeProfile.accountId,
      pendingGameId: "pending-game-1",
    });

    const startedGame = await repository.startPendingGame({
      creatorAccountId: creatorProfile.accountId,
      pendingGameId: "pending-game-1",
    });

    assert.equal(startedGame.nudgeTimeoutHours, 48);
    assert.equal(JSON.stringify(startedGame).includes("auth-account"), false);
  });

  it("rejects starting an accepted Pending Game after expiry", async () => {
    let currentTime = Date.parse("2026-06-01T12:00:00.000Z");
    const repository = createTestPendingGameRepository({
      createPendingGameId: () => "pending-game-1",
      createStartedGameId: () => "started-game-1",
      now: () => new Date(currentTime),
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

    currentTime = Date.parse("2026-06-09T12:00:00.000Z");

    await assert.rejects(
      () =>
        repository.startPendingGame({
          creatorAccountId: creatorProfile.accountId,
          pendingGameId: "pending-game-1",
        }),
      /Pending Game is not ready to start\./,
    );
  });

  it("starts accepted Games with participant-local current sections and entry notifications", async () => {
    const creatorProfile = createPlayerTestCreatorProfile();
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
    const blankRows = Array.from({ length: 10 }, (_, rowIndex) => ({
      rowIndex,
      value: "",
    }));

    assert.equal(creatorDashboard.awaitingYourEntries.length, 1);
    assert.equal(inviteeDashboard.awaitingYourEntries.length, 1);
    assert.equal(creatorDashboard.awaitingOtherPlayerEntries.length, 0);
    assert.equal(inviteeDashboard.awaitingOtherPlayerEntries.length, 0);
    assert.equal(creatorDashboard.completedBatches.length, 0);
    assert.equal(inviteeDashboard.completedBatches.length, 0);
    assert.deepEqual(
      creatorDashboard.awaitingYourEntries[0].currentSection,
      {
        id: "started-game-1-section-creator-1",
        entryKind: "adjective",
        sectionIndex: 0,
        sectionCount: 1,
        rows: blankRows,
      },
    );
    assert.deepEqual(
      inviteeDashboard.awaitingYourEntries[0].currentSection,
      {
        id: "started-game-1-section-invitee-1",
        entryKind: "noun",
        sectionIndex: 0,
        sectionCount: 2,
        rows: blankRows,
      },
    );
    for (const dashboard of [creatorDashboard, inviteeDashboard]) {
      const dashboardJson = JSON.stringify(dashboard);
      assert.equal(dashboardJson.includes(creatorProfile.accountId), false);
      assert.equal(dashboardJson.includes(inviteeProfile.accountId), false);
    }

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
          createdAt: "1970-01-01T00:00:00.000Z",
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
          createdAt: "1970-01-01T00:00:00.000Z",
          targetGameId: "started-game-1",
        },
      ],
    );
  });

  it("creates one in-app nudge notification for an overdue current section", async () => {
    let currentTime = Date.parse("2026-06-01T12:00:00.000Z");
    const repository = createTestPendingGameRepository({
      createPendingGameId: () => "pending-game-1",
      createStartedGameId: () => "started-game-1",
      createNotificationId: createSequenceId("notification"),
      now: () => new Date(currentTime),
      profiles: [creatorProfile, inviteeProfile],
    });

    await repository.createPendingGameFromHandle({
      creatorAccountId: creatorProfile.accountId,
      inviteeHandle: inviteeProfile.handle,
      nudgeTimeoutHours: 24,
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

    currentTime = Date.parse("2026-06-02T13:00:00.000Z");
    await repository.listMultiplayerDashboard({
      accountId: inviteeProfile.accountId,
    });
    await repository.listMultiplayerDashboard({
      accountId: inviteeProfile.accountId,
    });

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
            "You can submit entries to a batch with @creator-one and @invitee-two.",
          createdAt: "1970-01-01T00:00:00.000Z",
          targetGameId: "started-game-1",
        },
        {
          id: "notification-3",
          type: "nudge",
          status: "unread",
          message:
            "A batch is waiting for your entries with @creator-one and @invitee-two.",
          createdAt: "2026-06-02T13:00:00.000Z",
          targetGameId: "started-game-1",
        },
      ],
    );
  });

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
    const creatorSection =
      creatorDashboard.awaitingYourEntries[0].currentSection;

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
    assert.deepEqual(afterInviteeReveal.completedBatches[0].phrases.slice(0, 2), [
      "Brisk-0 noun-a-0 noun-b-0",
      "Brisk-1 noun-a-1 noun-b-1",
    ]);
    assert.equal(afterCreatorReveal.completedBatches[0].revealed, false);
  });

  it("rejects reveal requests without leaking completion state or writing reveal state", async () => {
    const repository = createTestPendingGameRepository({
      createPendingGameId: () => "pending-game-1",
      createStartedGameId: () => "started-game-1",
      createNotificationId: createSequenceId("notification"),
      profiles: [creatorProfile, inviteeProfile, otherCreatorProfile],
    });

    const startedGame = await startAcceptedLocalGame(repository);

    await assert.rejects(
      () =>
        repository.revealMultiplayerBatch({
          accountId: inviteeProfile.accountId,
          gameId: startedGame.id,
        }),
      /Multiplayer batch is not complete\./,
    );
    await assert.rejects(
      () =>
        repository.revealMultiplayerBatch({
          accountId: otherCreatorProfile.accountId,
          gameId: startedGame.id,
        }),
      /Multiplayer batch was not found\./,
    );
    await assert.rejects(
      () =>
        repository.revealMultiplayerBatch({
          accountId: creatorProfile.accountId,
          gameId: "unknown-started-game",
        }),
      /Multiplayer batch was not found\./,
    );
    await assert.rejects(
      () =>
        repository.revealMultiplayerBatch({
          accountId: "unknown-auth-account",
          gameId: startedGame.id,
        }),
      /Multiplayer batch was not found\./,
    );

    await submitAllCurrentSections(repository, inviteeProfile.accountId, "noun");
    await submitAllCurrentSections(
      repository,
      creatorProfile.accountId,
      "brisk",
    );

    await assert.rejects(
      () =>
        repository.revealMultiplayerBatch({
          accountId: otherCreatorProfile.accountId,
          gameId: startedGame.id,
        }),
      /Multiplayer batch was not found\./,
    );

    const creatorDashboard = await repository.listMultiplayerDashboard({
      accountId: creatorProfile.accountId,
    });
    const inviteeDashboard = await repository.listMultiplayerDashboard({
      accountId: inviteeProfile.accountId,
    });
    assert.equal(creatorDashboard.completedBatches[0].revealed, false);
    assert.equal(inviteeDashboard.completedBatches[0].revealed, false);
  });

  it("lists only the five most recently completed batches", async () => {
    const repository = createTestPendingGameRepository({
      createPendingGameId: createSequenceId("pending-game"),
      createStartedGameId: createSequenceId("started-game"),
      createNotificationId: createSequenceId("notification"),
      profiles: [creatorProfile, inviteeProfile],
    });

    for (let index = 1; index <= 7; index += 1) {
      await completeAcceptedLocalGame(repository, {
        adjectivePrefix: `brisk-${index}`,
        nounPrefix: `noun-${index}`,
      });
    }

    const dashboard = await repository.listMultiplayerDashboard({
      accountId: creatorProfile.accountId,
    });

    assert.deepEqual(
      dashboard.completedBatches.map((batch) => batch.id),
      [
        "started-game-7",
        "started-game-6",
        "started-game-5",
        "started-game-4",
        "started-game-3",
      ],
    );
  });

  it("lists an empty completed multiplayer history page", async () => {
    const repository = createTestPendingGameRepository({
      profiles: [creatorProfile, inviteeProfile],
    });

    const history = await repository.listCompletedMultiplayerHistory({
      accountId: creatorProfile.accountId,
    });

    assert.deepEqual(history, { batches: [] });
  });

  it("lists fewer than five completed multiplayer history batches", async () => {
    const repository = createTestPendingGameRepository({
      createPendingGameId: createSequenceId("pending-game"),
      createStartedGameId: createSequenceId("started-game"),
      createNotificationId: createSequenceId("notification"),
      profiles: [creatorProfile, inviteeProfile],
    });

    for (let index = 1; index <= 3; index += 1) {
      await completeAcceptedLocalGame(repository, {
        adjectivePrefix: `brisk-${index}`,
        nounPrefix: `noun-${index}`,
      });
    }

    const history = await repository.listCompletedMultiplayerHistory({
      accountId: creatorProfile.accountId,
    });

    assert.deepEqual(
      history.batches.map((batch) => batch.id),
      ["started-game-3", "started-game-2", "started-game-1"],
    );
  });

  it("lists exactly five completed multiplayer history batches", async () => {
    const repository = createTestPendingGameRepository({
      createPendingGameId: createSequenceId("pending-game"),
      createStartedGameId: createSequenceId("started-game"),
      createNotificationId: createSequenceId("notification"),
      profiles: [creatorProfile, inviteeProfile],
    });

    for (let index = 1; index <= 5; index += 1) {
      await completeAcceptedLocalGame(repository, {
        adjectivePrefix: `brisk-${index}`,
        nounPrefix: `noun-${index}`,
      });
    }

    const history = await repository.listCompletedMultiplayerHistory({
      accountId: creatorProfile.accountId,
    });

    assert.deepEqual(
      history.batches.map((batch) => batch.id),
      [
        "started-game-5",
        "started-game-4",
        "started-game-3",
        "started-game-2",
        "started-game-1",
      ],
    );
  });

  it("lists the first completed multiplayer history page beyond the dashboard cap", async () => {
    const repository = createTestPendingGameRepository({
      createPendingGameId: createSequenceId("pending-game"),
      createStartedGameId: createSequenceId("started-game"),
      createNotificationId: createSequenceId("notification"),
      profiles: [creatorProfile, inviteeProfile],
    });

    for (let index = 1; index <= 7; index += 1) {
      await completeAcceptedLocalGame(repository, {
        adjectivePrefix: `brisk-${index}`,
        nounPrefix: `noun-${index}`,
      });
    }

    const dashboard = await repository.listMultiplayerDashboard({
      accountId: creatorProfile.accountId,
    });
    const history = await repository.listCompletedMultiplayerHistory({
      accountId: creatorProfile.accountId,
    });

    assert.deepEqual(
      dashboard.completedBatches.map((batch) => batch.id),
      [
        "started-game-7",
        "started-game-6",
        "started-game-5",
        "started-game-4",
        "started-game-3",
      ],
    );
    assert.deepEqual(
      history.batches.map((batch) => batch.id),
      [
        "started-game-7",
        "started-game-6",
        "started-game-5",
        "started-game-4",
        "started-game-3",
        "started-game-2",
        "started-game-1",
      ],
    );
  });

  it("returns a continuation cursor when completed multiplayer history has another page", async () => {
    const repository = createTestPendingGameRepository({
      createPendingGameId: createSequenceId("pending-game"),
      createStartedGameId: createSequenceId("started-game"),
      createNotificationId: createSequenceId("notification"),
      profiles: [creatorProfile, inviteeProfile],
    });

    for (let index = 1; index <= 3; index += 1) {
      await completeAcceptedLocalGame(repository, {
        adjectivePrefix: `brisk-${index}`,
        nounPrefix: `noun-${index}`,
      });
    }

    const history = await repository.listCompletedMultiplayerHistory({
      accountId: creatorProfile.accountId,
      pageSize: 2,
    });

    assert.deepEqual(
      history.batches.map((batch) => batch.id),
      ["started-game-3", "started-game-2"],
    );
    assert.equal(history.hasMore, true);
    assert.deepEqual(history.nextCursor, {
      completedOrder: 2,
      gameId: "started-game-2",
    });
  });

  it("continues completed multiplayer history after the requested cursor", async () => {
    const repository = createTestPendingGameRepository({
      createPendingGameId: createSequenceId("pending-game"),
      createStartedGameId: createSequenceId("started-game"),
      createNotificationId: createSequenceId("notification"),
      profiles: [creatorProfile, inviteeProfile],
    });

    for (let index = 1; index <= 3; index += 1) {
      await completeAcceptedLocalGame(repository, {
        adjectivePrefix: `brisk-${index}`,
        nounPrefix: `noun-${index}`,
      });
    }

    const firstPage = await repository.listCompletedMultiplayerHistory({
      accountId: creatorProfile.accountId,
      pageSize: 2,
    });
    const secondPage = await repository.listCompletedMultiplayerHistory({
      accountId: creatorProfile.accountId,
      cursor: firstPage.nextCursor,
      pageSize: 2,
    });

    assert.deepEqual(
      secondPage.batches.map((batch) => batch.id),
      ["started-game-1"],
    );
    assert.equal(secondPage.hasMore, false);
    assert.equal(secondPage.nextCursor, null);
  });

  it("lets the creator cancel a started game before reveal", async () => {
    const repository = createTestPendingGameRepository({
      createPendingGameId: () => "pending-game-1",
      createStartedGameId: () => "started-game-1",
      createNotificationId: createSequenceId("notification"),
      profiles: [creatorProfile, inviteeProfile],
    });

    await startAcceptedLocalGame(repository);

    const cancelledGame = await repository.cancelCreatedGame({
      creatorAccountId: creatorProfile.accountId,
      pendingGameId: "pending-game-1",
    });

    assert.deepEqual(cancelledGame, {
      id: "pending-game-1",
      status: "cancelled",
      templateId: "default-adjective-noun-noun",
      rowCount: 10,
      startedGameId: "started-game-1",
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
          inviteStatus: "accepted",
          profileId: "invitee-profile-id",
          handle: "invitee-two",
          gamerName: "Invitee Two",
          avatarKey: "paper",
        },
      ],
    });

    assert.deepEqual(
      await repository.listMultiplayerDashboard({
        accountId: creatorProfile.accountId,
      }),
      {
        awaitingYourEntries: [],
        awaitingOtherPlayerEntries: [],
        completedBatches: [],
      },
    );
    assert.deepEqual(
      await repository.listMultiplayerDashboard({
        accountId: inviteeProfile.accountId,
      }),
      {
        awaitingYourEntries: [],
        awaitingOtherPlayerEntries: [],
        completedBatches: [],
      },
    );
    assert.deepEqual(
      await repository.listInAppNotifications({
        accountId: inviteeProfile.accountId,
      }),
      [
        {
          id: "notification-2",
          type: "entries_needed",
          status: "read",
          message:
            "You can submit entries to a batch with @creator-one and @invitee-two.",
          createdAt: "1970-01-01T00:00:00.000Z",
          targetGameId: "started-game-1",
        },
        {
          id: "notification-3",
          type: "game_cancelled",
          status: "unread",
          message: "@creator-one cancelled a batch with @creator-one and @invitee-two.",
          createdAt: "1970-01-01T00:00:00.000Z",
          targetGameId: "started-game-1",
        },
      ],
    );

    await assert.rejects(
      () =>
        repository.submitMultiplayerSection({
          accountId: inviteeProfile.accountId,
          sectionId: "started-game-1-section-invitee-1",
          entries: Array.from({ length: 10 }, (_, rowIndex) => ({
            rowIndex,
            value: `noun-${rowIndex}`,
          })),
        }),
      /cancelled/i,
    );
  });

  it("lets the creator cancel an accepted Pending Game before start", async () => {
    const repository = createTestPendingGameRepository({
      createPendingGameId: () => "pending-game-1",
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

    const cancelledGame = await repository.cancelCreatedGame({
      creatorAccountId: creatorProfile.accountId,
      pendingGameId: "pending-game-1",
    });

    assert.equal(cancelledGame.status, "cancelled");
    assert.equal("startedGameId" in cancelledGame, false);
    assert.deepEqual(
      await repository.listIncomingPendingGameInvites({
        accountId: inviteeProfile.accountId,
      }),
      [],
    );
    assert.deepEqual(
      await repository.listInAppNotifications({
        accountId: inviteeProfile.accountId,
      }),
      [
        {
          id: "notification-1",
          type: "game_cancelled",
          status: "unread",
          message:
            "@creator-one cancelled a batch with @creator-one and @invitee-two.",
          createdAt: "1970-01-01T00:00:00.000Z",
          targetPendingGameId: "pending-game-1",
        },
      ],
    );
  });

  it("rejects creator cancellation after Pending Game expiry", async () => {
    let currentTime = Date.parse("2026-06-01T12:00:00.000Z");
    const repository = createTestPendingGameRepository({
      createPendingGameId: () => "pending-game-1",
      now: () => new Date(currentTime),
      profiles: [creatorProfile, inviteeProfile],
    });

    await repository.createPendingGameFromHandle({
      creatorAccountId: creatorProfile.accountId,
      inviteeHandle: inviteeProfile.handle,
      rowCount: 10,
    });

    currentTime = Date.parse("2026-06-09T12:00:00.000Z");

    await assert.rejects(
      () =>
        repository.cancelCreatedGame({
          creatorAccountId: creatorProfile.accountId,
          pendingGameId: "pending-game-1",
        }),
      /Game is not cancellable by this creator\./,
    );
  });

  it("rejects creator cancellation after the batch has been revealed", async () => {
    const repository = createTestPendingGameRepository({
      createPendingGameId: () => "pending-game-1",
      createStartedGameId: () => "started-game-1",
      createNotificationId: createSequenceId("notification"),
      profiles: [creatorProfile, inviteeProfile],
    });

    await completeAcceptedLocalGame(repository, {
      adjectivePrefix: "brisk",
      nounPrefix: "noun",
    });
    await repository.revealMultiplayerBatch({
      accountId: creatorProfile.accountId,
      gameId: "started-game-1",
    });

    await assert.rejects(
      () =>
        repository.cancelCreatedGame({
          creatorAccountId: creatorProfile.accountId,
          pendingGameId: "pending-game-1",
        }),
      /not cancellable/i,
    );

    const dashboard = await repository.listMultiplayerDashboard({
      accountId: creatorProfile.accountId,
    });
    assert.equal(dashboard.completedBatches.length, 1);
    assert.equal(dashboard.completedBatches[0].revealed, true);
  });

  it("rejects multiplayer section submissions from the wrong participant or out of participant-local order", async () => {
    const repository = createTestPendingGameRepository({
      createPendingGameId: () => "pending-game-1",
      createStartedGameId: () => "started-game-1",
      profiles: [creatorProfile, inviteeProfile],
    });

    await startAcceptedLocalGame(repository);

    const inviteeDashboard = await repository.listMultiplayerDashboard({
      accountId: inviteeProfile.accountId,
    });
    const inviteeFirstSection =
      inviteeDashboard.awaitingYourEntries[0].currentSection;

    await assert.rejects(
      () =>
        repository.submitMultiplayerSection({
          accountId: creatorProfile.accountId,
          sectionId: inviteeFirstSection.id,
          entries: createSubmittedEntries(inviteeFirstSection.rows, "noun-a"),
        }),
      /not active for this Account/i,
    );

    await assert.rejects(
      () =>
        repository.submitMultiplayerSection({
          accountId: inviteeProfile.accountId,
          sectionId: "started-game-1-section-invitee-2",
          entries: createSubmittedEntries(inviteeFirstSection.rows, "noun-b"),
        }),
      /not active for this Account/i,
    );

    assert.equal(
      (
        await repository.listMultiplayerDashboard({
          accountId: inviteeProfile.accountId,
        })
      ).awaitingYourEntries[0].currentSection.id,
      inviteeFirstSection.id,
    );
  });

  it("rejects multiplayer section submissions with invalid section ids or row entries", async () => {
    const repository = createTestPendingGameRepository({
      createPendingGameId: () => "pending-game-1",
      createStartedGameId: () => "started-game-1",
      profiles: [creatorProfile, inviteeProfile],
    });

    await startAcceptedLocalGame(repository);

    const inviteeDashboard = await repository.listMultiplayerDashboard({
      accountId: inviteeProfile.accountId,
    });
    const inviteeFirstSection =
      inviteeDashboard.awaitingYourEntries[0].currentSection;
    const completeEntries = createSubmittedEntries(
      inviteeFirstSection.rows,
      "noun-a",
    );

    await assert.rejects(
      () =>
        repository.submitMultiplayerSection({
          accountId: inviteeProfile.accountId,
          sectionId: "unknown-section",
          entries: completeEntries,
        }),
      /not active for this Account/i,
    );
    await assert.rejects(
      () =>
        repository.submitMultiplayerSection({
          accountId: inviteeProfile.accountId,
          sectionId: " ",
          entries: completeEntries,
        }),
      /section id is required/i,
    );
    await assert.rejects(
      () =>
        repository.submitMultiplayerSection({
          accountId: inviteeProfile.accountId,
          sectionId: inviteeFirstSection.id,
          entries: completeEntries.slice(1),
        }),
      /Submit one Entry for every row/i,
    );
    await assert.rejects(
      () =>
        repository.submitMultiplayerSection({
          accountId: inviteeProfile.accountId,
          sectionId: inviteeFirstSection.id,
          entries: completeEntries.map((entry, index) =>
            index === 1 ? { ...entry, rowIndex: 0 } : entry,
          ),
        }),
      /Submit one Entry for every row/i,
    );
    await assert.rejects(
      () =>
        repository.submitMultiplayerSection({
          accountId: inviteeProfile.accountId,
          sectionId: inviteeFirstSection.id,
          entries: completeEntries.map((entry, index) =>
            index === 0
              ? { ...entry, rowIndex: inviteeFirstSection.rows.length }
              : entry,
          ),
        }),
      /Submit one Entry for every row/i,
    );

    assert.equal(
      (
        await repository.listMultiplayerDashboard({
          accountId: inviteeProfile.accountId,
        })
      ).awaitingYourEntries[0].currentSection.id,
      inviteeFirstSection.id,
    );
  });

  it("loads the active Started Game Turn for the assigned participant", async () => {
    const repository = createTestPendingGameRepository({
      createPendingGameId: () => "pending-game-1",
      createStartedGameId: () => "started-game-1",
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
    const startedGame = await repository.startPendingGame({
      creatorAccountId: creatorProfile.accountId,
      pendingGameId: "pending-game-1",
    });

    const activeTurn = await repository.loadActiveStartedGameTurn({
      accountId: creatorProfile.accountId,
      gameId: startedGame.id,
    });

    assert.deepEqual(activeTurn, {
      id: "started-game-1-turn-1",
      gameId: "started-game-1",
      status: "active",
      turnIndex: 0,
      entryKind: "adjective",
      rowCount: 10,
      rows: Array.from({ length: 10 }, (_, rowIndex) => ({
        rowIndex,
        value: "",
      })),
    });
    assert.equal(JSON.stringify(activeTurn).includes("profile-id"), false);
    assert.equal(JSON.stringify(activeTurn).includes("auth-account"), false);
  });

  it("submits a complete active Started Game Turn and advances to the next participant", async () => {
    const repository = createTestPendingGameRepository({
      createPendingGameId: () => "pending-game-1",
      createStartedGameId: () => "started-game-1",
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
    const startedGame = await repository.startPendingGame({
      creatorAccountId: creatorProfile.accountId,
      pendingGameId: "pending-game-1",
    });
    const activeTurn = await repository.loadActiveStartedGameTurn({
      accountId: creatorProfile.accountId,
      gameId: startedGame.id,
    });

    const submittedTurn = await repository.submitStartedGameTurn({
      accountId: creatorProfile.accountId,
      turnId: activeTurn.id,
      entries: activeTurn.rows.map((row) => ({
        rowIndex: row.rowIndex,
        value: `brisk-${row.rowIndex}`,
      })),
    });

    assert.deepEqual(submittedTurn, {
      id: "started-game-1-turn-1",
      gameId: "started-game-1",
      status: "submitted",
    });
    assert.equal(
      await repository.loadActiveStartedGameTurn({
        accountId: creatorProfile.accountId,
        gameId: startedGame.id,
      }),
      null,
    );
    assert.deepEqual(await repository.loadActiveStartedGameTurn({
      accountId: inviteeProfile.accountId,
      gameId: startedGame.id,
    }), {
      id: "started-game-1-turn-2",
      gameId: "started-game-1",
      status: "active",
      turnIndex: 1,
      entryKind: "noun",
      rowCount: 10,
      rows: Array.from({ length: 10 }, (_, rowIndex) => ({
        rowIndex,
        value: "",
      })),
    });
    assert.equal(JSON.stringify(submittedTurn).includes("brisk-"), false);
  });

  it("rejects starting a Pending Game before invitee acceptance", async () => {
    const repository = createTestPendingGameRepository({
      createPendingGameId: () => "pending-game-1",
      profiles: [creatorProfile, inviteeProfile],
    });

    await repository.createPendingGameFromHandle({
      creatorAccountId: creatorProfile.accountId,
      inviteeHandle: inviteeProfile.handle,
      rowCount: 10,
    });

    await assert.rejects(
      () =>
        repository.startPendingGame({
          creatorAccountId: creatorProfile.accountId,
          pendingGameId: "pending-game-1",
        }),
      /ready to start/i,
    );
  });

  it("rejects starting a cancelled Pending Game", async () => {
    const repository = createTestPendingGameRepository({
      createPendingGameId: () => "pending-game-1",
      profiles: [creatorProfile, inviteeProfile],
    });

    await repository.createPendingGameFromHandle({
      creatorAccountId: creatorProfile.accountId,
      inviteeHandle: inviteeProfile.handle,
      rowCount: 10,
    });
    await repository.declinePendingGameInvite({
      accountId: inviteeProfile.accountId,
      pendingGameId: "pending-game-1",
    });

    await assert.rejects(
      () =>
        repository.startPendingGame({
          creatorAccountId: creatorProfile.accountId,
          pendingGameId: "pending-game-1",
        }),
      /ready to start/i,
    );
  });

  it("rejects starting another creator's Pending Game", async () => {
    const repository = createTestPendingGameRepository({
      createPendingGameId: () => "pending-game-1",
      profiles: [creatorProfile, inviteeProfile, otherCreatorProfile],
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

    await assert.rejects(
      () =>
        repository.startPendingGame({
          creatorAccountId: otherCreatorProfile.accountId,
          pendingGameId: "pending-game-1",
        }),
      /ready to start/i,
    );
  });

  it("rejects starting the same Pending Game twice", async () => {
    const repository = createTestPendingGameRepository({
      createPendingGameId: () => "pending-game-1",
      createStartedGameId: () => "started-game-1",
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

    await assert.rejects(
      () =>
        repository.startPendingGame({
          creatorAccountId: creatorProfile.accountId,
          pendingGameId: "pending-game-1",
        }),
      /ready to start/i,
    );
  });

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

  it("creates Pending Games through Supabase rows without exposing invited Auth identity", async () => {
    const supabase = createFakePendingGameSupabase({
      creatorProfile,
      inviteeProfile,
    });
    const repository = createSupabasePendingGameRepository({ supabase });

    const pendingGame = await repository.createPendingGameFromHandle({
      creatorAccountId: creatorProfile.accountId,
      inviteeHandle: inviteeProfile.handle.toUpperCase(),
      nudgeTimeoutHours: 48,
      rowCount: 15,
    });

    assert.deepEqual(pendingGame, {
      id: "supabase-pending-game-1",
      status: "pending",
      templateId: "default-adjective-noun-noun",
      rowCount: 15,
      nudgeTimeoutHours: 48,
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

  it("lists incoming Pending Game invites through Supabase rows without exposing Auth identities", async () => {
    const supabase = createFakePendingGameSupabase({
      creatorProfile,
      inviteeProfile,
    });
    const repository = createSupabasePendingGameRepository({ supabase });

    await repository.createPendingGameFromHandle({
      creatorAccountId: creatorProfile.accountId,
      inviteeHandle: inviteeProfile.handle,
      rowCount: 15,
    });

    const pendingInvites = await repository.listIncomingPendingGameInvites({
      accountId: inviteeProfile.accountId,
    });

    assert.deepEqual(pendingInvites, [
      {
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
      },
    ]);
    assert.equal(JSON.stringify(pendingInvites).includes("auth-account"), false);
  });

  it("lists expired incoming Pending Game invites through Supabase rows", async () => {
    const supabase = createFakePendingGameSupabase({
      creatorProfile,
      inviteeProfile,
      pendingGameExpiresAt: "2026-06-08T12:00:00.000Z",
    });
    const repository = createSupabasePendingGameRepository({
      now: () => new Date("2026-06-09T12:00:00.000Z"),
      supabase,
    });

    await repository.createPendingGameFromHandle({
      creatorAccountId: creatorProfile.accountId,
      inviteeHandle: inviteeProfile.handle,
      rowCount: 15,
    });

    const pendingInvites = await repository.listIncomingPendingGameInvites({
      accountId: inviteeProfile.accountId,
    });

    assert.equal(pendingInvites[0].status, "expired");
    assert.equal(JSON.stringify(pendingInvites).includes("auth-account"), false);
  });

  it("accepts an incoming Pending Game invite through Supabase rows", async () => {
    const supabase = createFakePendingGameSupabase({
      creatorProfile,
      inviteeProfile,
    });
    const repository = createSupabasePendingGameRepository({ supabase });

    await repository.createPendingGameFromHandle({
      creatorAccountId: creatorProfile.accountId,
      inviteeHandle: inviteeProfile.handle,
      rowCount: 15,
    });

    const acceptedInvite = await repository.acceptPendingGameInvite({
      accountId: inviteeProfile.accountId,
      pendingGameId: "supabase-pending-game-1",
    });

    assert.deepEqual(acceptedInvite, {
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
          inviteStatus: "accepted",
          profileId: inviteeProfile.profileId,
          handle: inviteeProfile.handle,
          gamerName: inviteeProfile.gamerName,
          avatarKey: inviteeProfile.avatarKey,
        },
      ],
    });
    assert.equal(JSON.stringify(acceptedInvite).includes("auth-account"), false);
  });

  it("declines an incoming Pending Game invite through Supabase rows", async () => {
    const supabase = createFakePendingGameSupabase({
      creatorProfile,
      inviteeProfile,
    });
    const repository = createSupabasePendingGameRepository({ supabase });

    await repository.createPendingGameFromHandle({
      creatorAccountId: creatorProfile.accountId,
      inviteeHandle: inviteeProfile.handle,
      rowCount: 15,
    });

    const declinedInvite = await repository.declinePendingGameInvite({
      accountId: inviteeProfile.accountId,
      pendingGameId: "supabase-pending-game-1",
    });

    assert.deepEqual(declinedInvite, {
      id: "supabase-pending-game-1",
      status: "cancelled",
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
          inviteStatus: "declined",
          profileId: inviteeProfile.profileId,
          handle: inviteeProfile.handle,
          gamerName: inviteeProfile.gamerName,
          avatarKey: inviteeProfile.avatarKey,
        },
      ],
    });
    assert.equal(JSON.stringify(declinedInvite).includes("auth-account"), false);
  });

  it("lists created Pending Games through Supabase rows with invitee response state", async () => {
    const supabase = createFakePendingGameSupabase({
      creatorProfile,
      inviteeProfile,
    });
    const repository = createSupabasePendingGameRepository({ supabase });

    await repository.createPendingGameFromHandle({
      creatorAccountId: creatorProfile.accountId,
      inviteeHandle: inviteeProfile.handle,
      rowCount: 15,
    });
    await repository.acceptPendingGameInvite({
      accountId: inviteeProfile.accountId,
      pendingGameId: "supabase-pending-game-1",
    });

    const createdGames = await repository.listCreatedPendingGames({
      accountId: creatorProfile.accountId,
    });

    assert.deepEqual(createdGames, [
      {
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
            inviteStatus: "accepted",
            profileId: inviteeProfile.profileId,
            handle: inviteeProfile.handle,
            gamerName: inviteeProfile.gamerName,
            avatarKey: inviteeProfile.avatarKey,
          },
        ],
      },
    ]);
    assert.equal(JSON.stringify(createdGames).includes("auth-account"), false);
  });

  it("starts accepted Pending Games through Supabase rows with resolved setup state", async () => {
    const supabase = createFakePendingGameSupabase({
      creatorProfile,
      inviteeProfile,
    });
    const repository = createSupabasePendingGameRepository({ supabase });

    await repository.createPendingGameFromHandle({
      creatorAccountId: creatorProfile.accountId,
      inviteeHandle: inviteeProfile.handle,
      nudgeTimeoutHours: 48,
      rowCount: 15,
    });
    await repository.acceptPendingGameInvite({
      accountId: inviteeProfile.accountId,
      pendingGameId: "supabase-pending-game-1",
    });

    const startedGame = await repository.startPendingGame({
      creatorAccountId: creatorProfile.accountId,
      pendingGameId: "supabase-pending-game-1",
    });

    assert.deepEqual(startedGame, {
      id: "supabase-started-game-1",
      pendingGameId: "supabase-pending-game-1",
      status: "started",
      templateId: "default-adjective-noun-noun",
      rowCount: 15,
      nudgeTimeoutHours: 48,
      participants: [
        {
          role: "creator",
          profileId: creatorProfile.profileId,
          handle: creatorProfile.handle,
          gamerName: creatorProfile.gamerName,
          avatarKey: creatorProfile.avatarKey,
        },
        {
          role: "invitee",
          profileId: inviteeProfile.profileId,
          handle: inviteeProfile.handle,
          gamerName: inviteeProfile.gamerName,
          avatarKey: inviteeProfile.avatarKey,
        },
      ],
      setup: {
        slotAllocation: "resolved",
        slotOrder: "resolved",
      },
    });
    assert.equal(JSON.stringify(startedGame).includes("auth-account"), false);
    assert.equal(JSON.stringify(startedGame).includes("slot_id"), false);
    assert.equal(supabase.startedGameRows.length, 1);
    assert.equal(supabase.startedGameRows[0].slot_allocation.length, 3);
    assert.deepEqual(
      supabase.startedGameRows[0].slot_order.map((slot) => slot.slot_id).sort(),
      ["adjective", "noun-1", "noun-2"],
    );
    assert.deepEqual(
      supabase.startedGameRows[0].slot_allocation
        .map((slot) => slot.participant_profile_id)
        .sort(),
      [
        creatorProfile.profileId,
        inviteeProfile.profileId,
        inviteeProfile.profileId,
      ].sort(),
    );
  });

  it("loads active Started Game Turns through Supabase rows", async () => {
    const supabase = createFakePendingGameSupabase({
      creatorProfile,
      inviteeProfile,
    });
    const repository = createSupabasePendingGameRepository({ supabase });

    await repository.createPendingGameFromHandle({
      creatorAccountId: creatorProfile.accountId,
      inviteeHandle: inviteeProfile.handle,
      rowCount: 15,
    });
    await repository.acceptPendingGameInvite({
      accountId: inviteeProfile.accountId,
      pendingGameId: "supabase-pending-game-1",
    });
    const startedGame = await repository.startPendingGame({
      creatorAccountId: creatorProfile.accountId,
      pendingGameId: "supabase-pending-game-1",
    });

    const activeTurn = await repository.loadActiveStartedGameTurn({
      accountId: creatorProfile.accountId,
      gameId: startedGame.id,
    });

    assert.deepEqual(activeTurn, {
      id: "supabase-started-game-1-turn-1",
      gameId: "supabase-started-game-1",
      status: "active",
      turnIndex: 0,
      entryKind: "adjective",
      rowCount: 15,
      rows: Array.from({ length: 15 }, (_, rowIndex) => ({
        rowIndex,
        value: "",
      })),
    });
    assert.equal(JSON.stringify(activeTurn).includes("profile-id"), false);
    assert.equal(JSON.stringify(activeTurn).includes("auth-account"), false);
  });

  it("submits active Started Game Turns through a Supabase RPC", async () => {
    const supabase = createFakePendingGameSupabase({
      creatorProfile,
      inviteeProfile,
    });
    const repository = createSupabasePendingGameRepository({ supabase });

    await repository.createPendingGameFromHandle({
      creatorAccountId: creatorProfile.accountId,
      inviteeHandle: inviteeProfile.handle,
      rowCount: 15,
    });
    await repository.acceptPendingGameInvite({
      accountId: inviteeProfile.accountId,
      pendingGameId: "supabase-pending-game-1",
    });
    const startedGame = await repository.startPendingGame({
      creatorAccountId: creatorProfile.accountId,
      pendingGameId: "supabase-pending-game-1",
    });
    const activeTurn = await repository.loadActiveStartedGameTurn({
      accountId: creatorProfile.accountId,
      gameId: startedGame.id,
    });

    const submittedTurn = await repository.submitStartedGameTurn({
      accountId: creatorProfile.accountId,
      turnId: activeTurn.id,
      entries: activeTurn.rows.map((row) => ({
        rowIndex: row.rowIndex,
        value: `brisk-${row.rowIndex}`,
      })),
    });

    assert.deepEqual(submittedTurn, {
      id: "supabase-started-game-1-turn-1",
      gameId: "supabase-started-game-1",
      status: "submitted",
    });
    assert.deepEqual(supabase.rpcCalls, ["submit_started_game_turn"]);
    assert.equal(supabase.submittedEntryRows.length, 15);
    assert.equal(
      await repository.loadActiveStartedGameTurn({
        accountId: creatorProfile.accountId,
        gameId: startedGame.id,
      }),
      null,
    );
  });

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
    assert.deepEqual(supabase.rpcParams, []);
    assert.equal(dashboard.awaitingYourEntries.length, 1);
    assert.equal(
      dashboard.awaitingYourEntries[0].currentSection.entryKind,
      "adjective",
    );
    assert.deepEqual(dashboard.completedBatches[0].phrases, [
      "Brisk teapot cloud",
    ]);
  });

  it("loads completed multiplayer history through Supabase RPC", async () => {
    const supabase = createFakePendingGameSupabase({
      creatorProfile,
      inviteeProfile,
    });
    const repository = createSupabasePendingGameRepository({ supabase });

    const history = await repository.listCompletedMultiplayerHistory({
      accountId: creatorProfile.accountId,
    });

    assert.deepEqual(supabase.rpcCalls, ["list_completed_multiplayer_history"]);
    assert.deepEqual(supabase.rpcParams, []);
    assert.deepEqual(history.batches, [
      {
        id: "supabase-completed-game-1",
        pendingGameId: "supabase-completed-pending-game-1",
        rowCount: 1,
        participants: [
          { handle: creatorProfile.handle },
          { handle: inviteeProfile.handle },
        ],
        phrases: ["Brisk teapot cloud"],
        revealed: true,
      },
    ]);
  });

  it("loads paginated completed multiplayer history through Supabase RPC parameters", async () => {
    const supabase = createFakePendingGameSupabase({
      creatorProfile,
      inviteeProfile,
    });
    const repository = createSupabasePendingGameRepository({ supabase });

    const history = await repository.listCompletedMultiplayerHistory({
      accountId: creatorProfile.accountId,
      cursor: {
        completedOrder: 2,
        gameId: "supabase-completed-game-2",
      },
      pageSize: 2,
    });

    assert.deepEqual(supabase.rpcCalls, ["list_completed_multiplayer_history"]);
    assert.deepEqual(supabase.rpcParams, [
      {
        after_completed_order: 2,
        after_game_id: "supabase-completed-game-2",
        page_size: 2,
      },
    ]);
    assert.equal(history.hasMore, true);
    assert.deepEqual(history.nextCursor, {
      completedOrder: 1,
      gameId: "supabase-completed-game-1",
    });
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
    assert.deepEqual(supabase.rpcParams, [
      {
        submitted_entries: [{ rowIndex: 0, value: "brisk" }],
        target_assignment_id: "supabase-section-1",
      },
    ]);
    assert.deepEqual(result, {
      gameId: "supabase-started-game-1",
      id: "supabase-section-1",
      status: "submitted",
    });
  });

  it("rejects empty submit participant-section RPC row arrays", async () => {
    const supabase = createFakePendingGameSupabase({
      creatorProfile,
      inviteeProfile,
    });
    supabase.rpc = async () => ({ data: [], error: null });
    const repository = createSupabasePendingGameRepository({ supabase });

    await assert.rejects(
      () =>
        repository.submitMultiplayerSection({
          accountId: creatorProfile.accountId,
          sectionId: "supabase-section-1",
          entries: [{ rowIndex: 0, value: "brisk" }],
        }),
      /Could not submit Multiplayer section: expected exactly one returned row\./,
    );
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
    assert.deepEqual(supabase.rpcParams, [
      {
        target_game_id: "supabase-started-game-1",
      },
    ]);
    assert.deepEqual(revealed.phrases, ["Brisk teapot cloud"]);
  });

  it("cancels creator-owned games through a Supabase RPC", async () => {
    const supabase = createFakePendingGameSupabase({
      creatorProfile,
      inviteeProfile,
    });
    const repository = createSupabasePendingGameRepository({ supabase });

    await repository.createPendingGameFromHandle({
      creatorAccountId: creatorProfile.accountId,
      inviteeHandle: inviteeProfile.handle,
      rowCount: 15,
    });
    await repository.acceptPendingGameInvite({
      accountId: inviteeProfile.accountId,
      pendingGameId: "supabase-pending-game-1",
    });
    await repository.startPendingGame({
      creatorAccountId: creatorProfile.accountId,
      pendingGameId: "supabase-pending-game-1",
    });

    const cancelledGame = await repository.cancelCreatedGame({
      creatorAccountId: creatorProfile.accountId,
      pendingGameId: "supabase-pending-game-1",
    });

    assert.deepEqual(supabase.rpcCalls.at(-1), "cancel_created_game");
    assert.deepEqual(supabase.rpcParams.at(-1), {
      target_pending_game_id: "supabase-pending-game-1",
    });
    assert.deepEqual(cancelledGame, {
      id: "supabase-pending-game-1",
      status: "cancelled",
      templateId: "default-adjective-noun-noun",
      rowCount: 15,
      startedGameId: "supabase-started-game-1",
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
          inviteStatus: "accepted",
          profileId: inviteeProfile.profileId,
          handle: inviteeProfile.handle,
          gamerName: inviteeProfile.gamerName,
          avatarKey: inviteeProfile.avatarKey,
        },
      ],
    });
    assert.equal(JSON.stringify(cancelledGame).includes("auth-account"), false);
  });

  it("recovers pre-start cancellation notifications from Supabase rows", async () => {
    const supabase = createFakePendingGameSupabase({
      creatorProfile,
      inviteeProfile,
    });
    const repository = createSupabasePendingGameRepository({ supabase });

    await repository.createPendingGameFromHandle({
      creatorAccountId: creatorProfile.accountId,
      inviteeHandle: inviteeProfile.handle,
      rowCount: 15,
    });
    await repository.acceptPendingGameInvite({
      accountId: inviteeProfile.accountId,
      pendingGameId: "supabase-pending-game-1",
    });
    await repository.cancelCreatedGame({
      creatorAccountId: creatorProfile.accountId,
      pendingGameId: "supabase-pending-game-1",
    });

    const notifications = await repository.listInAppNotifications({
      accountId: inviteeProfile.accountId,
    });

    assert.deepEqual(notifications, [
      {
        id: "supabase-notification-2",
        type: "game_cancelled",
        status: "unread",
        message:
          "@creator-one cancelled a batch with @creator-one and @invitee-two.",
        createdAt: "2026-01-01T00:00:01.000Z",
        targetPendingGameId: "supabase-pending-game-1",
      },
    ]);
  });

  it("rejects empty reveal multiplayer batch RPC row arrays", async () => {
    const supabase = createFakePendingGameSupabase({
      creatorProfile,
      inviteeProfile,
    });
    supabase.rpc = async () => ({ data: [], error: null });
    const repository = createSupabasePendingGameRepository({ supabase });

    await assert.rejects(
      () =>
        repository.revealMultiplayerBatch({
          accountId: creatorProfile.accountId,
          gameId: "supabase-started-game-1",
        }),
      /Could not reveal Multiplayer batch: expected exactly one returned row\./,
    );
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

    assert.deepEqual(notifications, [
      {
        id: "supabase-notification-1",
        type: "entries_needed",
        status: "unread",
        message:
          "You can submit entries to a batch with @creator-one and @invitee-two.",
        createdAt: "2026-01-01T00:00:00.000Z",
        targetGameId: "supabase-started-game-1",
      },
    ]);
    assert.deepEqual(supabase.tableCalls, [
      "in_app_notifications",
      "in_app_notifications",
    ]);
    assert.deepEqual(supabase.queryCalls, [
      {
        method: "select",
        projection:
          "id, notification_type, notification_status, message, target_game_id, target_pending_game_id, created_at",
        tableName: "in_app_notifications",
      },
      {
        column: "account_id",
        method: "eq",
        tableName: "in_app_notifications",
        value: creatorProfile.accountId,
      },
      {
        column: "created_at",
        method: "order",
        options: { ascending: false },
        tableName: "in_app_notifications",
      },
      {
        count: 20,
        method: "limit",
        tableName: "in_app_notifications",
      },
      {
        method: "update",
        row: { notification_status: "read" },
        tableName: "in_app_notifications",
      },
      {
        column: "id",
        method: "eq",
        tableName: "in_app_notifications",
        value: "supabase-notification-1",
      },
      {
        column: "account_id",
        method: "eq",
        tableName: "in_app_notifications",
        value: creatorProfile.accountId,
      },
      {
        method: "select",
        projection:
          "id, notification_type, notification_status, message, target_game_id, target_pending_game_id, created_at",
        tableName: "in_app_notifications",
      },
    ]);
    assert.deepEqual(
      await repository.listInAppNotifications({
        accountId: creatorProfile.accountId,
      }),
      [
        {
          id: "supabase-notification-1",
          type: "entries_needed",
          status: "read",
          message:
            "You can submit entries to a batch with @creator-one and @invitee-two.",
          createdAt: "2026-01-01T00:00:00.000Z",
          targetGameId: "supabase-started-game-1",
        },
      ],
    );
  });

  it("wires app Pending Game creation behind local test and hosted repositories", async () => {
    const repository = createLocalTestPendingGameRepository({
      createPendingGameId: () => "local-pending-game-1",
      profiles: [creatorProfile, inviteeProfile],
    });
    const pendingGame = await repository.createPendingGameFromHandle({
      creatorAccountId: creatorProfile.accountId,
      inviteeHandle: inviteeProfile.handle,
      rowCount: 20,
    });
    const appSource = readFileSync(new URL("../assets/app.js", import.meta.url), "utf8");

    assert.equal(pendingGame.id, "local-pending-game-1");
    assert.match(appSource, /createLocalTestPendingGameRepository/);
    assert.match(
      appSource,
      /pendingGameRepository = createSupabasePendingGameRepository\(\{ supabase \}\)/,
    );
  });
});

function createFakePendingGameSupabase({
  creatorProfile,
  inviteeProfile,
  pendingGameExpiresAt = "2999-01-01T00:00:00.000Z",
}) {
  const state = {
    creatorProfile,
    inviteeProfile,
    gameParticipants: [],
    gameTurns: [],
    inAppNotifications: [
      {
        id: "supabase-notification-1",
        account_id: creatorProfile.accountId,
        created_at: "2026-01-01T00:00:00.000Z",
        message:
          "You can submit entries to a batch with @creator-one and @invitee-two.",
        notification_status: "unread",
        notification_type: "entries_needed",
        target_game_id: "supabase-started-game-1",
      },
    ],
    pendingGame: null,
    pendingGameExpiresAt,
    participants: [],
    queryCalls: [],
    submittedEntries: [],
    startedGames: [],
  };

  return {
    get submittedEntryRows() {
      return state.submittedEntries;
    },
    get startedGameRows() {
      return state.startedGames;
    },
    get queryCalls() {
      return state.queryCalls;
    },
    rpcCalls: [],
    rpcParams: [],
    tableCalls: [],
    from(tableName) {
      assert.ok(
        [
          "account_profiles",
          "account_profile_directory",
          "games",
          "game_turns",
          "game_participants",
          "in_app_notifications",
          "pending_games",
          "pending_game_participants",
        ].includes(tableName),
      );
      this.tableCalls.push(tableName);
      return new FakePendingGameQuery(tableName, state);
    },
    async rpc(functionName, params) {
      this.rpcCalls.push(functionName);
      if (params) {
        this.rpcParams.push(params);
      }

      if (functionName === "list_multiplayer_dashboard") {
        assert.equal(arguments.length, 1);
        return {
          data: createFakeMultiplayerDashboard({
            creatorProfile,
            inviteeProfile,
          }),
          error: null,
        };
      }

      if (functionName === "list_completed_multiplayer_history") {
        if (params) {
          assert.deepEqual(Object.keys(params).sort(), [
            "after_completed_order",
            "after_game_id",
            "page_size",
          ]);
        } else {
          assert.equal(arguments.length, 1);
        }
        return {
          data: createFakeCompletedMultiplayerHistory({
            creatorProfile,
            inviteeProfile,
            paginated: Boolean(params),
          }),
          error: null,
        };
      }

      if (functionName === "submit_multiplayer_section") {
        assert.deepEqual(Object.keys(params).sort(), [
          "submitted_entries",
          "target_assignment_id",
        ]);
        normaliseFakeSubmittedEntries(params.submitted_entries, {
          rowCount: params.submitted_entries.length,
        });
        return {
          data: [
            {
              assignment_id: params.target_assignment_id,
              game_id: "supabase-started-game-1",
              status: "submitted",
            },
          ],
          error: null,
        };
      }

      if (functionName === "reveal_multiplayer_batch") {
        assert.deepEqual(Object.keys(params), ["target_game_id"]);
        return {
          data: [
            {
              game_id: params.target_game_id,
              phrases: ["Brisk teapot cloud"],
              revealed: true,
            },
          ],
          error: null,
        };
      }

      if (functionName === "cancel_created_game") {
        assert.deepEqual(Object.keys(params), ["target_pending_game_id"]);
        if (
          !state.pendingGame ||
          state.pendingGame.id !== params.target_pending_game_id
        ) {
          return {
            data: null,
            error: { message: "game is not cancellable" },
          };
        }

        const startedGame = state.startedGames.find(
          (candidate) =>
            candidate.pending_game_id === params.target_pending_game_id,
        );
        state.pendingGame = {
          ...state.pendingGame,
          status: "cancelled",
        };
        state.inAppNotifications.push({
          id: "supabase-notification-2",
          account_id: inviteeProfile.accountId,
          created_at: "2026-01-01T00:00:01.000Z",
          message:
            "@creator-one cancelled a batch with @creator-one and @invitee-two.",
          notification_status: "unread",
          notification_type: "game_cancelled",
          target_game_id: startedGame?.id ?? null,
          target_pending_game_id: startedGame
            ? null
            : params.target_pending_game_id,
        });

        return {
          data: [
            {
              ...state.pendingGame,
              started_game_id: startedGame?.id ?? null,
            },
          ],
          error: null,
        };
      }

      assert.equal(functionName, "submit_started_game_turn");

      const turn = state.gameTurns.find(
        (candidate) => candidate.id === params.target_turn_id,
      );
      if (!turn) {
        return {
          data: null,
          error: { message: "turn not found" },
        };
      }

      const earliestUnsubmittedTurn = state.gameTurns
        .filter(
          (candidate) =>
            candidate.game_id === turn.game_id &&
            candidate.status !== "submitted",
        )
        .toSorted((left, right) => left.turn_index - right.turn_index)[0];
      if (earliestUnsubmittedTurn?.id !== turn.id) {
        return {
          data: null,
          error: { message: "turn is not active" },
        };
      }

      const submittedEntries = normaliseFakeSubmittedEntries(
        params.submitted_entries,
        { rowCount: turn.row_count },
      );
      state.submittedEntries.push(
        ...submittedEntries.map((entry) => ({
          game_id: turn.game_id,
          row_index: entry.rowIndex,
          turn_id: turn.id,
          value: entry.value,
        })),
      );
      turn.status = "submitted";

      return {
        data: {
          game_id: turn.game_id,
          status: turn.status,
          turn_id: turn.id,
        },
        error: null,
      };
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

  update(row) {
    if (this.tableName === "in_app_notifications") {
      assert.deepEqual(row, { notification_status: "read" });
    }
    this.state.queryCalls.push({
      method: "update",
      row,
      tableName: this.tableName,
    });
    this.updatedRow = row;
    return this;
  }

  select(projection) {
    this.state.queryCalls.push({
      method: "select",
      projection,
      tableName: this.tableName,
    });
    return this;
  }

  order(column, options = {}) {
    this.state.queryCalls.push({
      column,
      method: "order",
      options,
      tableName: this.tableName,
    });
    this.orderBy = { column, ascending: options.ascending !== false };
    return this;
  }

  limit(count) {
    this.state.queryCalls.push({
      count,
      method: "limit",
      tableName: this.tableName,
    });
    this.limitCount = count;
    return this;
  }

  eq(column, value) {
    this.state.queryCalls.push({
      column,
      method: "eq",
      tableName: this.tableName,
      value,
    });
    this.filters[column] = value;
    return this;
  }

  in(column, values) {
    this.filters[column] = new Set(values);
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
    if (rows.length > 1) {
      return {
        data: null,
        error: { message: "multiple rows returned" },
      };
    }
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
      return [this.state.creatorProfile, this.state.inviteeProfile]
        .filter((profile) => profile.accountId === this.filters.account_id)
        .map(toAccountProfileRow);
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
        expires_at: this.state.pendingGameExpiresAt,
        invitee_profile_id: this.insertedRow.invitee_profile_id,
        ...(this.insertedRow.nudge_timeout_hours
          ? { nudge_timeout_hours: this.insertedRow.nudge_timeout_hours }
          : {}),
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

    if (this.tableName === "pending_games") {
      return [this.state.pendingGame].filter(
        (row) => row && matchesFilters(row, this.filters),
      );
    }

    if (this.tableName === "pending_game_participants" && this.updatedRow) {
      const updatedRows = this.state.participants.filter((row) =>
        matchesFilters(row, this.filters),
      );
      this.state.participants = this.state.participants.map((row) =>
        matchesFilters(row, this.filters) ? { ...row, ...this.updatedRow } : row,
      );
      if (this.updatedRow.invite_status === "declined") {
        this.state.pendingGame = {
          ...this.state.pendingGame,
          status: "cancelled",
        };
      }
      return updatedRows.map((row) => ({ ...row, ...this.updatedRow }));
    }

    if (this.tableName === "games" && this.insertedRow) {
      const pendingGame = this.state.pendingGame;
      const isAccepted =
        pendingGame?.id === this.insertedRow.pending_game_id &&
        pendingGame.status === "pending" &&
        this.state.participants.every(
          (participant) => participant.invite_status === "accepted",
        );

      if (!isAccepted) {
        return [];
      }

      this.state.pendingGame = {
        ...pendingGame,
        status: "started",
      };
      const startedGame = {
        id: "supabase-started-game-1",
        pending_game_id: pendingGame.id,
        template_id: pendingGame.template_id,
        row_count: pendingGame.row_count,
        ...(pendingGame.nudge_timeout_hours
          ? { nudge_timeout_hours: pendingGame.nudge_timeout_hours }
          : {}),
        status: "started",
        slot_allocation: createFakeSlotAllocation({
          creatorProfile: this.state.creatorProfile,
          inviteeProfile: this.state.inviteeProfile,
        }),
        slot_order: [
          { slot_id: "adjective", entry_kind: "adjective" },
          { slot_id: "noun-1", entry_kind: "noun" },
          { slot_id: "noun-2", entry_kind: "noun" },
        ],
      };
      this.state.startedGames.push(startedGame);
      this.state.gameParticipants = this.state.participants.map((participant) =>
        toStartedParticipantRow(participant, { gameId: startedGame.id }),
      );
      this.state.gameTurns = createFakeStartedGameTurns({
        creatorProfile: this.state.creatorProfile,
        inviteeProfile: this.state.inviteeProfile,
        startedGame,
      });
      return [startedGame];
    }

    if (this.tableName === "games") {
      return this.state.startedGames.filter((row) => matchesFilters(row, this.filters));
    }

    if (this.tableName === "game_participants") {
      return this.state.gameParticipants.filter((row) =>
        matchesFilters(row, this.filters),
      );
    }

    if (this.tableName === "game_turns") {
      return this.state.gameTurns
        .filter((row) => matchesFilters(row, this.filters))
        .filter((row) => {
          const earliestUnsubmittedTurn = this.state.gameTurns
            .filter(
              (turn) =>
                turn.game_id === row.game_id && turn.status !== "submitted",
            )
            .toSorted((left, right) => left.turn_index - right.turn_index)[0];

          return earliestUnsubmittedTurn?.id === row.id;
        });
    }

    if (this.tableName === "in_app_notifications" && this.updatedRow) {
      const updatedRows = this.state.inAppNotifications.filter((row) =>
        matchesFilters(row, this.filters),
      );
      this.state.inAppNotifications = this.state.inAppNotifications.map((row) =>
        matchesFilters(row, this.filters) ? { ...row, ...this.updatedRow } : row,
      );
      return updatedRows.map((row) => ({ ...row, ...this.updatedRow }));
    }

    if (this.tableName === "in_app_notifications") {
      const rows = this.state.inAppNotifications.filter((row) =>
        matchesFilters(row, this.filters),
      );
      if (this.orderBy) {
        rows.sort((left, right) => {
          const direction = this.orderBy.ascending ? 1 : -1;
          if (left[this.orderBy.column] === right[this.orderBy.column]) {
            return 0;
          }
          return left[this.orderBy.column] < right[this.orderBy.column]
            ? -direction
            : direction;
        });
      }
      return typeof this.limitCount === "number"
        ? rows.slice(0, this.limitCount)
        : rows;
    }

    if (this.tableName === "pending_game_participants") {
      return this.state.participants.filter(
        (row) => matchesFilters(row, this.filters),
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

function toStartedParticipantRow(participant, { gameId }) {
  return {
    game_id: gameId,
    profile_id: participant.profile_id,
    handle: participant.handle,
    gamer_name: participant.gamer_name,
    avatar_key: participant.avatar_key,
    participant_role: participant.participant_role,
  };
}

function createFakeMultiplayerDashboard({ creatorProfile, inviteeProfile }) {
  return {
    awaitingYourEntries: [
      {
        id: "supabase-started-game-1",
        pendingGameId: "supabase-pending-game-1",
        rowCount: 1,
        participants: [
          { handle: creatorProfile.handle },
          { handle: inviteeProfile.handle },
        ],
        currentSection: {
          id: "supabase-section-1",
          entryKind: "adjective",
          sectionCount: 1,
          sectionIndex: 0,
          rows: [{ rowIndex: 0, value: "" }],
        },
      },
    ],
    awaitingOtherPlayerEntries: [],
    completedBatches: [
      {
        id: "supabase-completed-game-1",
        pendingGameId: "supabase-completed-pending-game-1",
        rowCount: 1,
        participants: [
          { handle: creatorProfile.handle },
          { handle: inviteeProfile.handle },
        ],
        phrases: ["Brisk teapot cloud"],
        revealed: true,
      },
    ],
  };
}

function createFakeCompletedMultiplayerHistory({
  creatorProfile,
  inviteeProfile,
  paginated = false,
}) {
  const history = {
    batches: createFakeMultiplayerDashboard({
      creatorProfile,
      inviteeProfile,
    }).completedBatches,
  };

  if (paginated) {
    history.has_more = true;
    history.next_cursor = {
      completed_order: 1,
      game_id: "supabase-completed-game-1",
    };
  }

  return history;
}

function createFakeSlotAllocation({ creatorProfile, inviteeProfile }) {
  return [
    {
      slot_id: "adjective",
      entry_kind: "adjective",
      participant_profile_id: creatorProfile.profileId,
    },
    {
      slot_id: "noun-1",
      entry_kind: "noun",
      participant_profile_id: inviteeProfile.profileId,
    },
    {
      slot_id: "noun-2",
      entry_kind: "noun",
      participant_profile_id: inviteeProfile.profileId,
    },
  ];
}

function createFakeStartedGameTurns({ creatorProfile, inviteeProfile, startedGame }) {
  return [
    {
      id: `${startedGame.id}-turn-1`,
      game_id: startedGame.id,
      status: "active",
      turn_index: 0,
      slot_id: "adjective",
      entry_kind: "adjective",
      participant_profile_id: creatorProfile.profileId,
      row_count: startedGame.row_count,
    },
    {
      id: `${startedGame.id}-turn-2`,
      game_id: startedGame.id,
      status: "active",
      turn_index: 1,
      slot_id: "noun-1",
      entry_kind: "noun",
      participant_profile_id: inviteeProfile.profileId,
      row_count: startedGame.row_count,
    },
    {
      id: `${startedGame.id}-turn-3`,
      game_id: startedGame.id,
      status: "active",
      turn_index: 2,
      slot_id: "noun-2",
      entry_kind: "noun",
      participant_profile_id: inviteeProfile.profileId,
      row_count: startedGame.row_count,
    },
  ];
}

function normaliseFakeSubmittedEntries(entries, { rowCount }) {
  assert.equal(Array.isArray(entries), true);
  assert.equal(entries.length, rowCount);

  const rowIndexes = entries.map((entry) => entry.rowIndex).toSorted(
    (left, right) => left - right,
  );
  assert.deepEqual(
    rowIndexes,
    Array.from({ length: rowCount }, (_, rowIndex) => rowIndex),
  );
  assert.equal(
    entries.every((entry) => typeof entry.value === "string" && entry.value),
    true,
  );

  return entries;
}

function matchesFilters(row, filters) {
  return Object.entries(filters).every(([column, value]) =>
    value instanceof Set ? value.has(row[column]) : row[column] === value,
  );
}

function createSequenceId(prefix) {
  let sequence = 0;
  return () => {
    sequence += 1;
    return `${prefix}-${sequence}`;
  };
}

function createPlayerTestCreatorProfile() {
  return {
    ...creatorProfile,
    handle: "player-test-account",
    gamerName: "Player Test Account",
  };
}

function createSubmittedEntries(rows, prefix) {
  return rows.map((row) => ({
    rowIndex: row.rowIndex,
    value: `${prefix}-${row.rowIndex}`,
  }));
}

async function startAcceptedLocalGame(repository) {
  const pendingGame = await repository.createPendingGameFromHandle({
    creatorAccountId: creatorProfile.accountId,
    inviteeHandle: inviteeProfile.handle,
    rowCount: 10,
  });
  await repository.acceptPendingGameInvite({
    accountId: inviteeProfile.accountId,
    pendingGameId: pendingGame.id,
  });
  return repository.startPendingGame({
    creatorAccountId: creatorProfile.accountId,
    pendingGameId: pendingGame.id,
  });
}

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
        value: `${prefix}-${section.sectionIndex === 0 ? "a" : "b"}-${
          row.rowIndex
        }`,
      })),
    });
  }
}

async function completeAcceptedLocalGame(
  repository,
  { adjectivePrefix, nounPrefix },
) {
  await startAcceptedLocalGame(repository);
  await submitAllCurrentSections(
    repository,
    inviteeProfile.accountId,
    nounPrefix,
  );
  await submitAllCurrentSections(
    repository,
    creatorProfile.accountId,
    adjectivePrefix,
  );
}
