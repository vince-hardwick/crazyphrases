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
  const pendingGames = [];

  return {
    async createPendingGameFromHandle({
      creatorAccountId,
      inviteeHandle,
      rowCount = 20,
    }) {
      assertAccountId(creatorAccountId);
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

      const pendingGame = createPendingGameDto({
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
      pendingGames.push(pendingGame);
      return pendingGame;
    },

    async listIncomingPendingGameInvites({ accountId }) {
      assertAccountId(accountId);

      const inviteeProfile = profilesByAccountId.get(accountId);
      if (!inviteeProfile) {
        return [];
      }

      return pendingGames.filter(
        (pendingGame) =>
          pendingGame.status === "pending" &&
          pendingGame.participants.some(
            (participant) =>
              participant.role === "invitee" &&
              participant.profileId === inviteeProfile.profileId,
          ),
      );
    },

    async listCreatedPendingGames({ accountId }) {
      assertAccountId(accountId);

      const creatorProfile = profilesByAccountId.get(accountId);
      if (!creatorProfile) {
        return [];
      }

      return pendingGames.filter((pendingGame) =>
        pendingGame.participants.some(
          (participant) =>
            participant.role === "creator" &&
            participant.profileId === creatorProfile.profileId,
        ),
      );
    },

    async acceptPendingGameInvite({ accountId, pendingGameId }) {
      assertAccountId(accountId);
      assertText(pendingGameId, "A Pending Game id is required.");

      const inviteeProfile = profilesByAccountId.get(accountId);
      const pendingGameIndex = findIncomingPendingGameIndex({
        inviteeProfile,
        pendingGameId,
        pendingGames,
      });
      if (pendingGameIndex < 0) {
        throw new Error("Pending Game invite was not found.");
      }

      const pendingGame = pendingGames[pendingGameIndex];
      const updatedPendingGame = createPendingGameDto({
        id: pendingGame.id,
        rowCount: pendingGame.rowCount,
        status: pendingGame.status,
        templateId: pendingGame.templateId,
        participants: pendingGame.participants.map((participant) =>
          participant.role === "invitee" &&
          participant.profileId === inviteeProfile.profileId
            ? { ...participant, inviteStatus: "accepted" }
            : participant,
        ),
      });
      pendingGames[pendingGameIndex] = updatedPendingGame;
      return updatedPendingGame;
    },

    async declinePendingGameInvite({ accountId, pendingGameId }) {
      assertAccountId(accountId);
      assertText(pendingGameId, "A Pending Game id is required.");

      const inviteeProfile = profilesByAccountId.get(accountId);
      const pendingGameIndex = findIncomingPendingGameIndex({
        inviteeProfile,
        pendingGameId,
        pendingGames,
      });
      if (pendingGameIndex < 0) {
        throw new Error("Pending Game invite was not found.");
      }

      const pendingGame = pendingGames[pendingGameIndex];
      const updatedPendingGame = createPendingGameDto({
        id: pendingGame.id,
        rowCount: pendingGame.rowCount,
        status: "cancelled",
        templateId: pendingGame.templateId,
        participants: pendingGame.participants.map((participant) =>
          participant.role === "invitee" &&
          participant.profileId === inviteeProfile.profileId
            ? { ...participant, inviteStatus: "declined" }
            : participant,
        ),
      });
      pendingGames[pendingGameIndex] = updatedPendingGame;
      return updatedPendingGame;
    },
  };
}

export function createLocalTestPendingGameRepository(options = {}) {
  return createTestPendingGameRepository(options);
}

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
      assertNoSupabaseError(
        creatorResponse,
        "Could not load creator Account Profile",
      );

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

    async listCreatedPendingGames({ accountId }) {
      assertAccountId(accountId);

      const pendingGameResponse = await supabase
        .from("pending_games")
        .select("id, template_id, row_count, status")
        .eq("creator_account_id", accountId);
      assertNoSupabaseError(
        pendingGameResponse,
        "Could not load created Pending Games",
      );

      return Promise.all(
        pendingGameResponse.data.map(async (pendingGameRow) => {
          const participantResponse = await supabase
            .from("pending_game_participants")
            .select(
              "profile_id, handle, gamer_name, avatar_key, participant_role, invite_status",
            )
            .eq("pending_game_id", pendingGameRow.id);
          assertNoSupabaseError(
            participantResponse,
            "Could not load Pending Game participants",
          );

          return recoverPendingGame({
            participantRows: participantResponse.data,
            pendingGameRow,
          });
        }),
      );
    },

    async listIncomingPendingGameInvites({ accountId }) {
      assertAccountId(accountId);

      const inviteeResponse = await supabase
        .from("account_profiles")
        .select("profile_id, handle, gamer_name, avatar_key")
        .eq("account_id", accountId)
        .maybeSingle();
      assertNoSupabaseError(
        inviteeResponse,
        "Could not load invitee Account Profile",
      );

      if (!inviteeResponse.data) {
        return [];
      }

      const inviteeProfile = recoverProfile(inviteeResponse.data);
      const pendingGameResponse = await supabase
        .from("pending_games")
        .select("id, template_id, row_count, status")
        .eq("invitee_profile_id", inviteeProfile.profileId)
        .eq("status", "pending");
      assertNoSupabaseError(
        pendingGameResponse,
        "Could not load incoming Pending Game invites",
      );

      return Promise.all(
        pendingGameResponse.data.map(async (pendingGameRow) => {
          const participantResponse = await supabase
            .from("pending_game_participants")
            .select(
              "profile_id, handle, gamer_name, avatar_key, participant_role, invite_status",
            )
            .eq("pending_game_id", pendingGameRow.id);
          assertNoSupabaseError(
            participantResponse,
            "Could not load Pending Game participants",
          );

          return recoverPendingGame({
            participantRows: participantResponse.data,
            pendingGameRow,
          });
        }),
      );
    },

    async acceptPendingGameInvite({ accountId, pendingGameId }) {
      assertAccountId(accountId);
      assertText(pendingGameId, "A Pending Game id is required.");

      const inviteeResponse = await supabase
        .from("account_profiles")
        .select("profile_id, handle, gamer_name, avatar_key")
        .eq("account_id", accountId)
        .maybeSingle();
      assertNoSupabaseError(
        inviteeResponse,
        "Could not load invitee Account Profile",
      );

      if (!inviteeResponse.data) {
        throw new Error("Invitee Account Profile is required.");
      }

      const inviteeProfile = recoverProfile(inviteeResponse.data);
      const acceptResponse = await supabase
        .from("pending_game_participants")
        .update({
          account_id: accountId,
          invite_status: "accepted",
        })
        .eq("pending_game_id", pendingGameId)
        .eq("profile_id", inviteeProfile.profileId)
        .eq("participant_role", "invitee")
        .eq("invite_status", "pending")
        .select("pending_game_id")
        .single();
      assertNoSupabaseError(
        acceptResponse,
        "Could not accept Pending Game invite",
      );

      const pendingGameResponse = await supabase
        .from("pending_games")
        .select("id, template_id, row_count, status")
        .eq("id", pendingGameId)
        .single();
      assertNoSupabaseError(
        pendingGameResponse,
        "Could not load Pending Game",
      );

      const participantResponse = await supabase
        .from("pending_game_participants")
        .select(
          "profile_id, handle, gamer_name, avatar_key, participant_role, invite_status",
        )
        .eq("pending_game_id", pendingGameId);
      assertNoSupabaseError(
        participantResponse,
        "Could not load Pending Game participants",
      );

      return recoverPendingGame({
        participantRows: participantResponse.data,
        pendingGameRow: pendingGameResponse.data,
      });
    },

    async declinePendingGameInvite({ accountId, pendingGameId }) {
      assertAccountId(accountId);
      assertText(pendingGameId, "A Pending Game id is required.");

      const inviteeResponse = await supabase
        .from("account_profiles")
        .select("profile_id, handle, gamer_name, avatar_key")
        .eq("account_id", accountId)
        .maybeSingle();
      assertNoSupabaseError(
        inviteeResponse,
        "Could not load invitee Account Profile",
      );

      if (!inviteeResponse.data) {
        throw new Error("Invitee Account Profile is required.");
      }

      const inviteeProfile = recoverProfile(inviteeResponse.data);
      const declineResponse = await supabase
        .from("pending_game_participants")
        .update({
          account_id: accountId,
          invite_status: "declined",
        })
        .eq("pending_game_id", pendingGameId)
        .eq("profile_id", inviteeProfile.profileId)
        .eq("participant_role", "invitee")
        .eq("invite_status", "pending")
        .select("pending_game_id")
        .single();
      assertNoSupabaseError(
        declineResponse,
        "Could not decline Pending Game invite",
      );

      const pendingGameResponse = await supabase
        .from("pending_games")
        .select("id, template_id, row_count, status")
        .eq("id", pendingGameId)
        .single();
      assertNoSupabaseError(
        pendingGameResponse,
        "Could not load Pending Game",
      );

      const participantResponse = await supabase
        .from("pending_game_participants")
        .select(
          "profile_id, handle, gamer_name, avatar_key, participant_role, invite_status",
        )
        .eq("pending_game_id", pendingGameId);
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

function findIncomingPendingGameIndex({
  inviteeProfile,
  pendingGameId,
  pendingGames,
}) {
  if (!inviteeProfile) {
    return -1;
  }

  return pendingGames.findIndex(
    (pendingGame) =>
      pendingGame.id === pendingGameId &&
      pendingGame.status === "pending" &&
      pendingGame.participants.some(
        (participant) =>
          participant.role === "invitee" &&
          participant.profileId === inviteeProfile.profileId,
      ),
  );
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
