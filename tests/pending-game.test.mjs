import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
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
});

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
