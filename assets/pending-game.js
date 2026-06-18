export const DEFAULT_TEMPLATE_ID = "default-adjective-noun-noun";
const ALLOWED_ROW_COUNTS = new Set([10, 15, 20, 25, 30]);

export function createTestPendingGameRepository({
  createPendingGameId = defaultCreatePendingGameId,
  createStartedGameId = defaultCreateStartedGameId,
  createNotificationId = defaultCreateNotificationId,
  profiles = [],
} = {}) {
  const normalisedProfiles = profiles.map(normaliseProfile);
  const profilesByAccountId = new Map(
    normalisedProfiles.map((profile) => [profile.accountId, profile]),
  );
  const profilesByHandle = new Map(
    normalisedProfiles.map((profile) => [profile.handle, profile]),
  );
  const accountIdsByProfileId = new Map(
    normalisedProfiles.map((profile) => [profile.profileId, profile.accountId]),
  );
  const pendingGames = [];
  const assignedSections = [];
  const completedMultiplayerBatches = [];
  const inAppNotifications = [];
  const revealedMultiplayerBatches = [];
  const startedTurns = [];
  let multiplayerCompletionOrder = 0;

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
          ["pending", "started"].includes(pendingGame.status) &&
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

    async startPendingGame({ creatorAccountId, pendingGameId }) {
      assertAccountId(creatorAccountId);
      assertText(pendingGameId, "A Pending Game id is required.");

      const creatorProfile = profilesByAccountId.get(creatorAccountId);
      const pendingGameIndex = pendingGames.findIndex(
        (pendingGame) =>
          pendingGame.id === pendingGameId &&
          pendingGame.status === "pending" &&
          pendingGame.participants.some(
            (participant) =>
              participant.role === "creator" &&
              participant.profileId === creatorProfile?.profileId,
          ),
      );

      if (pendingGameIndex < 0) {
        throw new Error("Pending Game is not ready to start.");
      }

      const pendingGame = pendingGames[pendingGameIndex];
      const startedGame = createStartedGameDto({
        id: createStartedGameId(),
        pendingGame,
      });
      if (
        pendingGame.participants.some(
          (participant) => participant.inviteStatus !== "accepted",
        )
      ) {
        throw new Error("Pending Game is not ready to start.");
      }

      pendingGames[pendingGameIndex] = createPendingGameDto({
        id: pendingGame.id,
        rowCount: pendingGame.rowCount,
        startedGameId: startedGame.id,
        status: "started",
        templateId: pendingGame.templateId,
        participants: pendingGame.participants,
      });

      startedTurns.push(...createStartedGameTurns({ pendingGame, startedGame }));
      assignedSections.push(
        ...createStartedGameAssignedSections({ pendingGame, startedGame }),
      );
      inAppNotifications.push(
        ...createGameStartedNotifications({
          accountIdsByProfileId,
          createNotificationId,
          participants: pendingGame.participants,
          startedGame,
        }),
      );

      return startedGame;
    },

    async listMultiplayerDashboard({ accountId }) {
      assertAccountId(accountId);

      const profile = profilesByAccountId.get(accountId);
      if (!profile) {
        return createEmptyMultiplayerDashboard();
      }

      return createMultiplayerDashboard({
        assignedSections,
        completedMultiplayerBatches,
        pendingGames,
        profile,
        revealedMultiplayerBatches,
      });
    },

    async listInAppNotifications({ accountId }) {
      assertAccountId(accountId);

      return inAppNotifications
        .filter((notification) => notification.accountId === accountId)
        .map(toNotificationDto);
    },

    async submitMultiplayerSection({ accountId, entries, sectionId }) {
      assertAccountId(accountId);
      assertText(sectionId, "A multiplayer section id is required.");

      const profile = profilesByAccountId.get(accountId);
      const section = assignedSections.find(
        (candidate) => candidate.id === sectionId,
      );
      if (
        !profile ||
        !section ||
        section.participantProfileId !== profile.profileId
      ) {
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

      if (
        isGameComplete({ assignedSections, gameId: section.gameId }) &&
        !isBatchCompleted({
          completedMultiplayerBatches,
          gameId: section.gameId,
        })
      ) {
        multiplayerCompletionOrder += 1;
        completedMultiplayerBatches.push({
          completedOrder: multiplayerCompletionOrder,
          gameId: section.gameId,
        });
        inAppNotifications.push(
          ...createBatchCompleteNotifications({
            accountIdsByProfileId,
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

      return {
        id: section.id,
        gameId: section.gameId,
        status: section.status,
      };
    },

    async revealMultiplayerBatch({ accountId, gameId }) {
      assertAccountId(accountId);
      assertText(gameId, "A Started Game id is required.");

      const profile = profilesByAccountId.get(accountId);
      if (
        !profile ||
        !isStartedGameParticipant({ gameId, pendingGames, profile })
      ) {
        throw new Error("Multiplayer batch was not found.");
      }

      if (!isGameComplete({ assignedSections, gameId })) {
        throw new Error("Multiplayer batch is not complete.");
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

    async loadActiveStartedGameTurn({ accountId, gameId }) {
      assertAccountId(accountId);
      assertText(gameId, "A Started Game id is required.");

      const profile = profilesByAccountId.get(accountId);
      if (!profile) {
        return null;
      }

      const nextTurn = startedTurns
        .filter((turn) => turn.gameId === gameId && turn.status !== "submitted")
        .toSorted((left, right) => left.turnIndex - right.turnIndex)[0];

      if (!nextTurn || nextTurn.participantProfileId !== profile.profileId) {
        return null;
      }

      return createStartedGameTurnDto(nextTurn);
    },

    async submitStartedGameTurn({ accountId, entries, turnId }) {
      assertAccountId(accountId);
      assertText(turnId, "A Started Game Turn id is required.");

      const profile = profilesByAccountId.get(accountId);
      const turn = startedTurns.find((candidate) => candidate.id === turnId);
      if (!profile || !turn || turn.participantProfileId !== profile.profileId) {
        throw new Error("Started Game Turn is not active for this Account.");
      }

      const nextTurn = startedTurns
        .filter(
          (candidate) =>
            candidate.gameId === turn.gameId && candidate.status !== "submitted",
        )
        .toSorted((left, right) => left.turnIndex - right.turnIndex)[0];
      if (nextTurn?.id !== turn.id) {
        throw new Error("Started Game Turn is not active for this Account.");
      }

      turn.entries = normaliseSubmittedEntries(entries, {
        rowCount: turn.rowCount,
      });
      turn.status = "submitted";

      return {
        id: turn.id,
        gameId: turn.gameId,
        status: turn.status,
      };
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

          const startedGameId = await loadStartedGameId({
            pendingGameRow,
            supabase,
          });

          return recoverPendingGame({
            participantRows: participantResponse.data,
            pendingGameRow,
            startedGameId,
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
        .in("status", ["pending", "started"]);
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

          const startedGameId = await loadStartedGameId({
            pendingGameRow,
            supabase,
          });

          return recoverPendingGame({
            participantRows: participantResponse.data,
            pendingGameRow,
            startedGameId,
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

    async startPendingGame({ creatorAccountId, pendingGameId }) {
      assertAccountId(creatorAccountId);
      assertText(pendingGameId, "A Pending Game id is required.");

      const startedGameResponse = await supabase
        .from("games")
        .insert({
          pending_game_id: pendingGameId,
        })
        .select("id, pending_game_id, template_id, row_count, status")
        .single();
      assertNoSupabaseError(startedGameResponse, "Could not start Pending Game");

      const participantResponse = await supabase
        .from("game_participants")
        .select(
          "profile_id, handle, gamer_name, avatar_key, participant_role",
        )
        .eq("game_id", startedGameResponse.data.id);
      assertNoSupabaseError(
        participantResponse,
        "Could not load Started Game participants",
      );

      return recoverStartedGame({
        participantRows: participantResponse.data,
        startedGameRow: startedGameResponse.data,
      });
    },

    async loadActiveStartedGameTurn({ accountId, gameId }) {
      assertAccountId(accountId);
      assertText(gameId, "A Started Game id is required.");

      const profileResponse = await supabase
        .from("account_profiles")
        .select("profile_id")
        .eq("account_id", accountId)
        .maybeSingle();
      assertNoSupabaseError(
        profileResponse,
        "Could not load Account Profile",
      );

      if (!profileResponse.data) {
        return null;
      }

      const turnResponse = await supabase
        .from("game_turns")
        .select("id, game_id, status, turn_index, entry_kind, row_count")
        .eq("game_id", gameId)
        .eq("participant_profile_id", profileResponse.data.profile_id)
        .eq("status", "active")
        .maybeSingle();
      assertNoSupabaseError(
        turnResponse,
        "Could not load active Started Game Turn",
      );

      return turnResponse.data
        ? recoverStartedGameTurn(turnResponse.data)
        : null;
    },

    async submitStartedGameTurn({ accountId, entries, turnId }) {
      assertAccountId(accountId);
      assertText(turnId, "A Started Game Turn id is required.");

      const submissionResponse = await supabase.rpc(
        "submit_started_game_turn",
        {
          submitted_entries: normaliseSubmittedEntries(entries, {
            rowCount: entries?.length ?? 0,
          }),
          target_turn_id: turnId,
        },
      );
      assertNoSupabaseError(
        submissionResponse,
        "Could not submit Started Game Turn",
      );

      return recoverSubmittedStartedGameTurn(submissionResponse.data);
    },
  };
}

function createPendingGameDto({
  id,
  participants,
  rowCount,
  startedGameId,
  status,
  templateId,
}) {
  return {
    id,
    status,
    templateId,
    rowCount,
    participants,
    ...(startedGameId ? { startedGameId } : {}),
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

function createStartedGameDto({ id, pendingGame }) {
  return {
    id,
    pendingGameId: pendingGame.id,
    status: "started",
    templateId: pendingGame.templateId,
    rowCount: pendingGame.rowCount,
    participants: pendingGame.participants.map(createStartedParticipantDto),
    setup: {
      slotAllocation: "resolved",
      slotOrder: "resolved",
    },
  };
}

function createStartedParticipantDto(participant) {
  return {
    role: participant.role,
    profileId: participant.profileId,
    handle: participant.handle,
    gamerName: participant.gamerName,
    avatarKey: participant.avatarKey,
  };
}

function createStartedGameTurns({ pendingGame, startedGame }) {
  const creator = pendingGame.participants.find(
    (participant) => participant.role === "creator",
  );
  const invitee = pendingGame.participants.find(
    (participant) => participant.role === "invitee",
  );

  return [
    {
      id: `${startedGame.id}-turn-1`,
      gameId: startedGame.id,
      status: "active",
      turnIndex: 0,
      slotId: "adjective",
      entryKind: "adjective",
      participantProfileId: creator.profileId,
      rowCount: pendingGame.rowCount,
      entries: [],
    },
    {
      id: `${startedGame.id}-turn-2`,
      gameId: startedGame.id,
      status: "active",
      turnIndex: 1,
      slotId: "noun-1",
      entryKind: "noun",
      participantProfileId: invitee.profileId,
      rowCount: pendingGame.rowCount,
      entries: [],
    },
    {
      id: `${startedGame.id}-turn-3`,
      gameId: startedGame.id,
      status: "active",
      turnIndex: 2,
      slotId: "noun-2",
      entryKind: "noun",
      participantProfileId: invitee.profileId,
      rowCount: pendingGame.rowCount,
      entries: [],
    },
  ];
}

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

function createStartedGameTurnDto(turn) {
  return {
    id: turn.id,
    gameId: turn.gameId,
    status: turn.status,
    turnIndex: turn.turnIndex,
    entryKind: turn.entryKind,
    rowCount: turn.rowCount,
    rows: Array.from({ length: turn.rowCount }, (_, rowIndex) => ({
      rowIndex,
      value: "",
    })),
  };
}

function createGameStartedNotifications({
  accountIdsByProfileId,
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
    accountId: accountIdsByProfileId.get(participant.profileId),
    createdAt: new Date(0).toISOString(),
    message,
    status: "unread",
    targetGameId: startedGame.id,
    type: "entries_needed",
  }));
}

function createParticipantNotificationMessage({ participants, text }) {
  const handles = participants.map((participant) => `@${participant.handle}`);

  if (handles.length === 1) {
    return `${text} ${handles[0]}.`;
  }

  return `${text} ${handles.slice(0, -1).join(", ")} and ${handles.at(-1)}.`;
}

function createEmptyMultiplayerDashboard() {
  return {
    awaitingYourEntries: [],
    awaitingOtherPlayerEntries: [],
    completedBatches: [],
  };
}

function createMultiplayerDashboard({
  assignedSections,
  completedMultiplayerBatches,
  pendingGames,
  profile,
  revealedMultiplayerBatches,
}) {
  return {
    awaitingYourEntries: createCurrentSectionBatches({
      assignedSections,
      pendingGames,
      profile,
    }),
    awaitingOtherPlayerEntries: createWaitingSectionBatches({
      assignedSections,
      pendingGames,
      profile,
    }),
    completedBatches: createCompletedBatches({
      assignedSections,
      completedMultiplayerBatches,
      pendingGames,
      profile,
      revealedMultiplayerBatches,
    }),
  };
}

function createCurrentSectionBatches({ assignedSections, pendingGames, profile }) {
  const gameIdsForProfile = new Set(
    assignedSections
      .filter((section) => section.participantProfileId === profile.profileId)
      .map((section) => section.gameId),
  );
  const currentSections = Array.from(gameIdsForProfile)
    .map((gameId) =>
      findCurrentAssignedSection({
        assignedSections,
        gameId,
        participantProfileId: profile.profileId,
      }),
    )
    .filter(Boolean)
    .toSorted(
      (left, right) =>
        left.participantSectionIndex - right.participantSectionIndex,
    );

  return currentSections.flatMap((section) => {
    const pendingGame = pendingGames.find(
      (candidate) => candidate.startedGameId === section.gameId,
    );
    if (!pendingGame) {
      return [];
    }

    return [
      {
        id: section.gameId,
        pendingGameId: pendingGame.id,
        rowCount: pendingGame.rowCount,
        participants: pendingGame.participants.map(toMultiplayerParticipantDto),
        currentSection: createCurrentSectionDto(section, {
          sectionCount: assignedSections.filter(
            (candidate) =>
              candidate.gameId === section.gameId &&
              candidate.participantProfileId === section.participantProfileId,
          ).length,
        }),
      },
    ];
  });
}

function createWaitingSectionBatches({ assignedSections, pendingGames, profile }) {
  return pendingGames.flatMap((pendingGame) => {
    if (
      pendingGame.status !== "started" ||
      !pendingGame.startedGameId ||
      !pendingGame.participants.some(
        (participant) => participant.profileId === profile.profileId,
      )
    ) {
      return [];
    }

    const currentSection = findCurrentAssignedSection({
      assignedSections,
      gameId: pendingGame.startedGameId,
      participantProfileId: profile.profileId,
    });
    if (currentSection) {
      return [];
    }

    const hasOtherIncompleteSections = assignedSections.some(
      (section) =>
        section.gameId === pendingGame.startedGameId &&
        section.participantProfileId !== profile.profileId &&
        section.status !== "submitted",
    );
    if (!hasOtherIncompleteSections) {
      return [];
    }

    return [
      {
        id: pendingGame.startedGameId,
        pendingGameId: pendingGame.id,
        rowCount: pendingGame.rowCount,
        participants: pendingGame.participants.map(toMultiplayerParticipantDto),
      },
    ];
  });
}

function createCompletedBatches({
  assignedSections,
  completedMultiplayerBatches,
  pendingGames,
  profile,
  revealedMultiplayerBatches,
}) {
  return completedMultiplayerBatches
    .toSorted((left, right) => right.completedOrder - left.completedOrder)
    .flatMap((completedBatch) => {
      const pendingGame = pendingGames.find(
        (candidate) => candidate.startedGameId === completedBatch.gameId,
      );
      if (
        !pendingGame ||
        pendingGame.status !== "started" ||
        !pendingGame.participants.some(
          (participant) => participant.profileId === profile.profileId,
        ) ||
        !isGameComplete({ assignedSections, gameId: completedBatch.gameId })
      ) {
        return [];
      }

      return [
        {
          id: pendingGame.startedGameId,
          pendingGameId: pendingGame.id,
          rowCount: pendingGame.rowCount,
          participants: pendingGame.participants.map(
            toMultiplayerParticipantDto,
          ),
          revealed: isBatchRevealed({
            gameId: pendingGame.startedGameId,
            profileId: profile.profileId,
            revealedMultiplayerBatches,
          }),
        },
      ];
    })
    .slice(0, 5);
}

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

function toMultiplayerParticipantDto(participant) {
  return {
    handle: participant.handle,
  };
}

function createCurrentSectionDto(section, { sectionCount }) {
  const entriesByRowIndex = new Map(
    section.entries.map((entry) => [entry.rowIndex, entry.value]),
  );

  return {
    id: section.id,
    entryKind: section.entryKind,
    sectionIndex: section.participantSectionIndex,
    sectionCount,
    rows: Array.from({ length: section.rowCount }, (_, rowIndex) => ({
      rowIndex,
      value: entriesByRowIndex.get(rowIndex) ?? "",
    })),
  };
}

function toNotificationDto(notification) {
  return {
    id: notification.id,
    type: notification.type,
    status: notification.status,
    message: notification.message,
    targetGameId: notification.targetGameId,
  };
}

function createBatchCompleteNotifications({
  accountIdsByProfileId,
  createNotificationId,
  finalSubmitterAccountId,
  participants,
  startedGameId,
}) {
  const message = createParticipantNotificationMessage({
    participants,
    text: "A batch is complete with",
  });

  return participants.map((participant) => {
    const accountId = accountIdsByProfileId.get(participant.profileId);

    return {
      id: createNotificationId(),
      accountId,
      createdAt: new Date(0).toISOString(),
      message,
      status: accountId === finalSubmitterAccountId ? "read" : "unread",
      targetGameId: startedGameId,
      type: "batch_complete",
    };
  });
}

function findStartedGameParticipants({ gameId, pendingGames }) {
  return (
    pendingGames.find((pendingGame) => pendingGame.startedGameId === gameId)
      ?.participants ?? []
  );
}

function isStartedGameParticipant({ gameId, pendingGames, profile }) {
  return findStartedGameParticipants({ gameId, pendingGames }).some(
    (participant) => participant.profileId === profile.profileId,
  );
}

function isGameComplete({ assignedSections, gameId }) {
  const gameSections = assignedSections.filter(
    (section) => section.gameId === gameId,
  );
  return (
    gameSections.length > 0 &&
    gameSections.every((section) => section.status === "submitted")
  );
}

function isBatchCompleted({ completedMultiplayerBatches, gameId }) {
  return completedMultiplayerBatches.some((batch) => batch.gameId === gameId);
}

function renderMultiplayerPhrases({ assignedSections, gameId }) {
  const submittedSections = assignedSections
    .filter((section) => section.gameId === gameId)
    .toSorted(
      (left, right) =>
        slotRenderOrder(left.slotId) - slotRenderOrder(right.slotId),
    );

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
  const order = ["adjective", "noun-1", "noun-2"].indexOf(slotId);
  if (order < 0) {
    throw new Error(`Unknown multiplayer slot id: ${slotId}.`);
  }

  return order;
}

function upsertRevealState({
  gameId,
  profileId,
  revealedMultiplayerBatches,
}) {
  if (
    !isBatchRevealed({
      gameId,
      profileId,
      revealedMultiplayerBatches,
    })
  ) {
    revealedMultiplayerBatches.push({ gameId, profileId });
  }
}

function isBatchRevealed({ gameId, profileId, revealedMultiplayerBatches }) {
  return revealedMultiplayerBatches.some(
    (batch) => batch.gameId === gameId && batch.profileId === profileId,
  );
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

function normaliseSubmittedEntries(entries, { rowCount }) {
  if (!Array.isArray(entries) || entries.length !== rowCount) {
    throw new Error("Submit one Entry for every row.");
  }

  const entriesByRow = new Map();
  for (const entry of entries) {
    if (
      !Number.isInteger(entry?.rowIndex) ||
      entry.rowIndex < 0 ||
      entry.rowIndex >= rowCount ||
      entriesByRow.has(entry.rowIndex)
    ) {
      throw new Error("Submit one Entry for every row.");
    }

    entriesByRow.set(
      entry.rowIndex,
      assertText(entry.value, "Every submitted Entry needs text."),
    );
  }

  if (entriesByRow.size !== rowCount) {
    throw new Error("Submit one Entry for every row.");
  }

  return Array.from({ length: rowCount }, (_, rowIndex) => ({
    rowIndex,
    value: entriesByRow.get(rowIndex),
  }));
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

function defaultCreateStartedGameId() {
  return globalThis.crypto?.randomUUID?.() ?? `started-game-${Date.now()}`;
}

function defaultCreateNotificationId() {
  return globalThis.crypto?.randomUUID?.() ?? `notification-${Date.now()}`;
}

function recoverProfile(row) {
  return {
    profileId: assertText(row?.profile_id, "A profile id is required."),
    handle: normaliseHandle(row?.handle),
    gamerName: assertText(row?.gamer_name, "A Gamer Name is required."),
    avatarKey: assertText(row?.avatar_key, "An Avatar key is required."),
  };
}

function recoverPendingGame({ participantRows, pendingGameRow, startedGameId }) {
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
    startedGameId,
    participants,
  });
}

async function loadStartedGameId({ pendingGameRow, supabase }) {
  if (pendingGameRow.status !== "started") {
    return null;
  }

  const startedGameResponse = await supabase
    .from("games")
    .select("id")
    .eq("pending_game_id", pendingGameRow.id)
    .maybeSingle();
  assertNoSupabaseError(startedGameResponse, "Could not load Started Game");

  return startedGameResponse.data?.id ?? null;
}

function recoverStartedGame({ participantRows, startedGameRow }) {
  const participants = participantRows
    .map((row) => ({
      role: row.participant_role,
      profileId: row.profile_id,
      handle: row.handle,
      gamerName: row.gamer_name,
      avatarKey: row.avatar_key,
    }))
    .toSorted((left, right) => roleOrder(left.role) - roleOrder(right.role));

  return {
    id: assertText(startedGameRow?.id, "A Started Game id is required."),
    pendingGameId: assertText(
      startedGameRow?.pending_game_id,
      "A Pending Game id is required.",
    ),
    status: startedGameRow.status,
    templateId: startedGameRow.template_id,
    rowCount: startedGameRow.row_count,
    participants,
    setup: {
      slotAllocation: "resolved",
      slotOrder: "resolved",
    },
  };
}

function recoverStartedGameTurn(turnRow) {
  return createStartedGameTurnDto({
    id: assertText(turnRow?.id, "A Started Game Turn id is required."),
    gameId: assertText(turnRow?.game_id, "A Started Game id is required."),
    status: turnRow.status,
    turnIndex: turnRow.turn_index,
    entryKind: turnRow.entry_kind,
    rowCount: turnRow.row_count,
  });
}

function recoverSubmittedStartedGameTurn(turnRow) {
  return {
    id: assertText(
      turnRow?.turn_id ?? turnRow?.id,
      "A Started Game Turn id is required.",
    ),
    gameId: assertText(turnRow?.game_id, "A Started Game id is required."),
    status: turnRow.status,
  };
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
