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

function createFakePendingGameSupabase({ creatorProfile, inviteeProfile }) {
  const state = {
    creatorProfile,
    inviteeProfile,
    gameParticipants: [],
    gameTurns: [],
    pendingGame: null,
    participants: [],
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
    rpcCalls: [],
    tableCalls: [],
    from(tableName) {
      assert.ok(
        [
          "account_profiles",
          "account_profile_directory",
          "games",
          "game_turns",
          "game_participants",
          "pending_games",
          "pending_game_participants",
        ].includes(tableName),
      );
      this.tableCalls.push(tableName);
      return new FakePendingGameQuery(tableName, state);
    },
    async rpc(functionName, params) {
      assert.equal(functionName, "submit_started_game_turn");
      this.rpcCalls.push(functionName);

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
    this.updatedRow = row;
    return this;
  }

  select() {
    return this;
  }

  eq(column, value) {
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
