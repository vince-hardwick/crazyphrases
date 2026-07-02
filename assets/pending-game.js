export const DEFAULT_TEMPLATE_ID = "default-adjective-noun-noun";
const ALLOWED_ROW_COUNTS = new Set([10, 15, 20, 25, 30]);
const ALLOWED_NUDGE_TIMEOUT_HOURS = new Set([24, 48, 72, 168]);
const COMPLETED_HISTORY_FIRST_PAGE_LIMIT = 20;
const PENDING_GAME_INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export function createTestPendingGameRepository({
  completedHistorySeedCount = 0,
  createPendingGameId = defaultCreatePendingGameId,
  createStartedGameId = defaultCreateStartedGameId,
  createNotificationId = defaultCreateNotificationId,
  failureMode = null,
  now = () => new Date(),
  pendingGameInviteExpiryMs = PENDING_GAME_INVITE_EXPIRY_MS,
  profiles = [],
} = {}) {
  const normalisedProfiles = profiles.map(normaliseProfile);
  const profilesByAccountId = new Map(
    normalisedProfiles.map((profile) => [profile.accountId, profile]),
  );
  const profilesByHandle = new Map(
    normalisedProfiles.map((profile) => [profile.handle, profile]),
  );
  const profilesByEmailLookupKey = new Map(
    normalisedProfiles
      .filter((profile) => profile.emailLookupKey)
      .map((profile) => [profile.emailLookupKey, profile]),
  );
  const profilesByGamerTag = new Map(
    normalisedProfiles.map((profile) => [
      normaliseGamerTagLookupKey(profile.gamerTag),
      profile,
    ]),
  );
  const accountIdsByProfileId = new Map(
    normalisedProfiles.map((profile) => [profile.profileId, profile.accountId]),
  );
  const pendingGames = [];
  const assignedSections = [];
  const completedMultiplayerBatches = [];
  const inAppNotifications = [];
  const pendingGameExpiryTimes = new Map();
  const revealedMultiplayerBatches = [];
  const startedTurns = [];
  let multiplayerCompletionOrder = 0;
  let revealFailureCount = 0;

  seedCompletedMultiplayerHistory({
    assignedSections,
    completedMultiplayerBatches,
    count: completedHistorySeedCount,
    pendingGames,
    profiles: normalisedProfiles,
  });
  multiplayerCompletionOrder = completedMultiplayerBatches.length;

  return {
    async createPendingGameFromHandle({
      creatorAccountId,
      inviteeHandle,
      nudgeTimeoutHours,
      rowCount = 20,
    }) {
      assertAccountId(creatorAccountId);
      assertRowCount(rowCount);
      if (nudgeTimeoutHours !== undefined) {
        assertNudgeTimeoutHours(nudgeTimeoutHours);
      }

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
        nudgeTimeoutHours,
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
      pendingGameExpiryTimes.set(
        pendingGame.id,
        now().getTime() + pendingGameInviteExpiryMs,
      );
      return createEffectivePendingGameDto({
        now,
        pendingGame,
        pendingGameExpiryTimes,
      });
    },

    async createPendingGameFromLookupKey({
      creatorAccountId,
      lookupKey,
      nudgeTimeoutHours,
      rowCount = 20,
    }) {
      assertAccountId(creatorAccountId);
      assertRowCount(rowCount);
      if (nudgeTimeoutHours !== undefined) {
        assertNudgeTimeoutHours(nudgeTimeoutHours);
      }

      const creatorProfile = profilesByAccountId.get(creatorAccountId);
      if (!creatorProfile) {
        throw new Error("Creator Account Profile is required.");
      }

      const lookup = normaliseLookupKey(lookupKey);
      const inviteeProfile =
        lookup.kind === "email"
          ? profilesByEmailLookupKey.get(lookup.value)
          : profilesByGamerTag.get(lookup.value);
      if (!inviteeProfile) {
        throw new Error(missingLookupMessage(lookup.kind));
      }

      if (creatorProfile.profileId === inviteeProfile.profileId) {
        throw new Error("A creator cannot invite their own profile.");
      }

      const pendingGame = createPendingGameDto({
        id: createPendingGameId(),
        nudgeTimeoutHours,
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
      pendingGameExpiryTimes.set(
        pendingGame.id,
        now().getTime() + pendingGameInviteExpiryMs,
      );
      return createEffectivePendingGameDto({
        now,
        pendingGame,
        pendingGameExpiryTimes,
      });
    },

    async listIncomingPendingGameInvites({ accountId }) {
      assertAccountId(accountId);

      const inviteeProfile = profilesByAccountId.get(accountId);
      if (!inviteeProfile) {
        return [];
      }

      return pendingGames
        .filter(
          (pendingGame) =>
            ["pending", "started"].includes(pendingGame.status) &&
            pendingGame.participants.some(
              (participant) =>
                participant.role === "invitee" &&
                participant.profileId === inviteeProfile.profileId,
            ),
        )
        .map((pendingGame) =>
          createEffectivePendingGameDto({
            now,
            pendingGame,
            pendingGameExpiryTimes,
          }),
        );
    },

    async listCreatedPendingGames({ accountId }) {
      assertAccountId(accountId);

      const creatorProfile = profilesByAccountId.get(accountId);
      if (!creatorProfile) {
        return [];
      }

      return pendingGames
        .filter((pendingGame) =>
          pendingGame.participants.some(
            (participant) =>
              participant.role === "creator" &&
              participant.profileId === creatorProfile.profileId,
          ),
        )
        .map((pendingGame) =>
          createEffectivePendingGameDto({
            now,
            pendingGame,
            pendingGameExpiryTimes,
          }),
        );
    },

    async acceptPendingGameInvite({ accountId, pendingGameId }) {
      assertAccountId(accountId);
      assertText(pendingGameId, "A Pending Game id is required.");

      const inviteeProfile = profilesByAccountId.get(accountId);
      const pendingGameIndex = findIncomingPendingGameIndex({
        inviteeProfile,
        now,
        pendingGameId,
        pendingGameExpiryTimes,
        pendingGames,
      });
      if (pendingGameIndex < 0) {
        throw new Error("Pending Game invite was not found.");
      }

      const pendingGame = pendingGames[pendingGameIndex];
      const updatedPendingGame = createPendingGameDto({
        id: pendingGame.id,
        nudgeTimeoutHours: pendingGame.nudgeTimeoutHours,
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
        now,
        pendingGameId,
        pendingGameExpiryTimes,
        pendingGames,
      });
      if (pendingGameIndex < 0) {
        throw new Error("Pending Game invite was not found.");
      }

      const pendingGame = pendingGames[pendingGameIndex];
      const updatedPendingGame = createPendingGameDto({
        id: pendingGame.id,
        nudgeTimeoutHours: pendingGame.nudgeTimeoutHours,
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
          !isPendingGameExpired({ now, pendingGame, pendingGameExpiryTimes }) &&
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
        nudgeTimeoutHours: pendingGame.nudgeTimeoutHours,
        rowCount: pendingGame.rowCount,
        startedGameId: startedGame.id,
        status: "started",
        templateId: pendingGame.templateId,
        participants: pendingGame.participants,
      });

      startedTurns.push(...createStartedGameTurns({ pendingGame, startedGame }));
      assignedSections.push(
        ...createStartedGameAssignedSections({ now, pendingGame, startedGame }),
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

    async cancelCreatedGame({ creatorAccountId, pendingGameId }) {
      assertAccountId(creatorAccountId);
      assertText(pendingGameId, "A Pending Game id is required.");

      const creatorProfile = profilesByAccountId.get(creatorAccountId);
      const pendingGameIndex = pendingGames.findIndex(
        (pendingGame) =>
          pendingGame.id === pendingGameId &&
          ["pending", "started"].includes(pendingGame.status) &&
          !isPendingGameExpired({ now, pendingGame, pendingGameExpiryTimes }) &&
          !hasStartedGameReveal({
            gameId: pendingGame.startedGameId,
            revealedMultiplayerBatches,
          }) &&
          pendingGame.participants.some(
            (participant) =>
              participant.role === "creator" &&
              participant.profileId === creatorProfile?.profileId,
          ),
      );

      if (pendingGameIndex < 0) {
        throw new Error("Game is not cancellable by this creator.");
      }

      const pendingGame = pendingGames[pendingGameIndex];
      const updatedPendingGame = createPendingGameDto({
        id: pendingGame.id,
        nudgeTimeoutHours: pendingGame.nudgeTimeoutHours,
        rowCount: pendingGame.rowCount,
        startedGameId: pendingGame.startedGameId,
        status: "cancelled",
        templateId: pendingGame.templateId,
        participants: pendingGame.participants,
      });
      pendingGames[pendingGameIndex] = updatedPendingGame;

      markActiveGamePromptNotificationsRead({
        inAppNotifications,
        targetGameId: pendingGame.startedGameId,
      });
      inAppNotifications.push(
        ...createGameCancelledNotifications({
          accountIdsByProfileId,
          createNotificationId,
          creatorProfile,
          participants: pendingGame.participants,
          targetGameId: pendingGame.startedGameId,
          targetPendingGameId: pendingGame.id,
        }),
      );

      return updatedPendingGame;
    },

    async listMultiplayerDashboard({ accountId }) {
      assertAccountId(accountId);

      const profile = profilesByAccountId.get(accountId);
      if (!profile) {
        return createEmptyMultiplayerDashboard();
      }

      createOverdueNudgeNotifications({
        accountIdsByProfileId,
        assignedSections,
        createNotificationId,
        inAppNotifications,
        now,
        pendingGames,
        profile,
      });

      return createMultiplayerDashboard({
        assignedSections,
        completedMultiplayerBatches,
        pendingGames,
        profile,
        revealedMultiplayerBatches,
      });
    },

    async listCompletedMultiplayerHistory({ accountId, cursor, pageSize }) {
      assertAccountId(accountId);

      if (
        failureMode === "history-fails" ||
        (failureMode === "history-load-more-fails" && cursor)
      ) {
        throw new Error("Could not load completed Multiplayer history.");
      }

      const profile = profilesByAccountId.get(accountId);
      if (!profile) {
        return createEmptyCompletedMultiplayerHistoryPage();
      }

      return createCompletedMultiplayerHistoryPage({
        assignedSections,
        completedMultiplayerBatches,
        cursor,
        pageSize,
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
      if (isCancelledStartedGame({ gameId: section?.gameId, pendingGames })) {
        throw new Error("Multiplayer game has been cancelled.");
      }
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
      const nextSection = findCurrentAssignedSection({
        assignedSections,
        gameId: section.gameId,
        participantProfileId: section.participantProfileId,
      });
      if (nextSection && !nextSection.activeAt) {
        nextSection.activeAt = now().toISOString();
      }

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

      if (
        failureMode === "reveal-fails" ||
        (failureMode === "reveal-fails-once" && revealFailureCount++ === 0)
      ) {
        throw new Error("Could not reveal Multiplayer batch.");
      }

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

export function createSupabasePendingGameRepository({
  now = () => new Date(),
  supabase,
} = {}) {
  if (!supabase || typeof supabase.from !== "function") {
    throw new Error("A Supabase client is required.");
  }

  return {
    async createPendingGameFromHandle({
      creatorAccountId,
      inviteeHandle,
      nudgeTimeoutHours,
      rowCount = 20,
    }) {
      assertAccountId(creatorAccountId);
      assertRowCount(rowCount);
      if (nudgeTimeoutHours !== undefined) {
        assertNudgeTimeoutHours(nudgeTimeoutHours);
      }

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
          ...(nudgeTimeoutHours ? { nudge_timeout_hours: nudgeTimeoutHours } : {}),
          row_count: rowCount,
          template_id: DEFAULT_TEMPLATE_ID,
        })
        .select("id, template_id, row_count, nudge_timeout_hours, status, expires_at")
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
        now,
        participantRows: participantResponse.data,
        pendingGameRow: pendingGameResponse.data,
      });
    },

    async createPendingGameFromLookupKey({
      creatorAccountId,
      lookupKey,
      nudgeTimeoutHours,
      rowCount = 20,
    }) {
      assertAccountId(creatorAccountId);
      assertRowCount(rowCount);
      if (nudgeTimeoutHours !== undefined) {
        assertNudgeTimeoutHours(nudgeTimeoutHours);
      }

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
      const lookup = normaliseLookupKey(lookupKey);
      const inviteeResponse = await supabase.rpc("lookup_account_profile", {
        lookup_key: lookup.value,
        lookup_kind: lookup.kind,
      });
      assertNoSupabaseError(inviteeResponse, "Could not look up invitee profile");

      const inviteeRow = firstLookupRow(inviteeResponse.data);
      if (!inviteeRow) {
        throw new Error(missingLookupMessage(lookup.kind));
      }

      const inviteeProfile = recoverLookupProfile(inviteeRow);
      if (creatorProfile.profileId === inviteeProfile.profileId) {
        throw new Error("A creator cannot invite their own profile.");
      }

      const pendingGameResponse = await supabase
        .from("pending_games")
        .insert({
          creator_account_id: creatorAccountId,
          creator_profile_id: creatorProfile.profileId,
          invitee_profile_id: inviteeProfile.profileId,
          ...(nudgeTimeoutHours ? { nudge_timeout_hours: nudgeTimeoutHours } : {}),
          row_count: rowCount,
          template_id: DEFAULT_TEMPLATE_ID,
        })
        .select("id, template_id, row_count, nudge_timeout_hours, status, expires_at")
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
        now,
        participantRows: participantResponse.data,
        pendingGameRow: pendingGameResponse.data,
      });
    },

    async listCreatedPendingGames({ accountId }) {
      assertAccountId(accountId);

      const pendingGameResponse = await supabase
        .from("pending_games")
        .select("id, template_id, row_count, nudge_timeout_hours, status, expires_at")
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
            now,
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
        .select("id, template_id, row_count, nudge_timeout_hours, status, expires_at")
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
            now,
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
        .select("id, template_id, row_count, nudge_timeout_hours, status, expires_at")
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
        now,
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
        .select("id, template_id, row_count, nudge_timeout_hours, status, expires_at")
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
        now,
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
        .select("id, pending_game_id, template_id, row_count, nudge_timeout_hours, status")
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

    async cancelCreatedGame({ creatorAccountId, pendingGameId }) {
      assertAccountId(creatorAccountId);
      assertText(pendingGameId, "A Pending Game id is required.");

      const cancelResponse = await supabase.rpc("cancel_created_game", {
        target_pending_game_id: pendingGameId,
      });
      assertNoSupabaseError(cancelResponse, "Could not cancel game");
      const pendingGameRow = recoverSingleSupabaseRow(
        cancelResponse.data,
        "Could not cancel game",
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
        now,
        participantRows: participantResponse.data,
        pendingGameRow,
        startedGameId: pendingGameRow.started_game_id,
      });
    },

    async listMultiplayerDashboard({ accountId }) {
      assertAccountId(accountId);
      const response = await supabase.rpc("list_multiplayer_dashboard");
      assertNoSupabaseError(response, "Could not load Multiplayer dashboard");
      return recoverMultiplayerDashboard(response.data);
    },

    async listCompletedMultiplayerHistory({ accountId, cursor, pageSize }) {
      assertAccountId(accountId);
      const rpcParams = createCompletedMultiplayerHistoryRpcParams({
        cursor,
        pageSize,
      });
      const response = rpcParams
        ? await supabase.rpc("list_completed_multiplayer_history", rpcParams)
        : await supabase.rpc("list_completed_multiplayer_history");
      assertNoSupabaseError(
        response,
        "Could not load completed Multiplayer history",
      );
      return recoverCompletedMultiplayerHistoryPage(response.data);
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
      return recoverSubmittedMultiplayerSection(
        recoverSingleSupabaseRow(
          response.data,
          "Could not submit Multiplayer section",
        ),
      );
    },

    async revealMultiplayerBatch({ accountId, gameId }) {
      assertAccountId(accountId);
      assertText(gameId, "A Started Game id is required.");
      const response = await supabase.rpc("reveal_multiplayer_batch", {
        target_game_id: gameId,
      });
      assertNoSupabaseError(response, "Could not reveal Multiplayer batch");
      return recoverRevealedMultiplayerBatch(
        recoverSingleSupabaseRow(
          response.data,
          "Could not reveal Multiplayer batch",
        ),
      );
    },

    async listInAppNotifications({ accountId }) {
      assertAccountId(accountId);
      const response = await supabase
        .from("in_app_notifications")
        .select(
          "id, notification_type, notification_status, message, target_game_id, target_pending_game_id, target_assignment_id, created_at",
        )
        .eq("account_id", accountId)
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
        })
        .eq("id", notificationId)
        .eq("account_id", accountId)
        .select(
          "id, notification_type, notification_status, message, target_game_id, target_pending_game_id, target_assignment_id, created_at",
        )
        .single();
      assertNoSupabaseError(response, "Could not mark notification read");
      return recoverInAppNotification(response.data);
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
  nudgeTimeoutHours,
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
    ...(nudgeTimeoutHours ? { nudgeTimeoutHours } : {}),
    participants,
    ...(startedGameId ? { startedGameId } : {}),
  };
}

function createEffectivePendingGameDto({
  now,
  pendingGame,
  pendingGameExpiryTimes,
}) {
  if (!isPendingGameExpired({ now, pendingGame, pendingGameExpiryTimes })) {
    return pendingGame;
  }

  return createPendingGameDto({
    ...pendingGame,
    status: "expired",
  });
}

function isPendingGameExpired({ now, pendingGame, pendingGameExpiryTimes }) {
  return (
    pendingGame.status === "pending" &&
    (pendingGameExpiryTimes.get(pendingGame.id) ?? Infinity) <= now().getTime()
  );
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
    ...(pendingGame.nudgeTimeoutHours
      ? { nudgeTimeoutHours: pendingGame.nudgeTimeoutHours }
      : {}),
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

function createStartedGameAssignedSections({ now = () => new Date(), pendingGame, startedGame }) {
  const creator = pendingGame.participants.find(
    (participant) => participant.role === "creator",
  );
  const invitee = pendingGame.participants.find(
    (participant) => participant.role === "invitee",
  );
  const startedAt = now().toISOString();

  return [
    createAssignedSection({
      activeAt: startedAt,
      id: `${startedGame.id}-section-creator-1`,
      entryKind: "adjective",
      gameId: startedGame.id,
      participantProfileId: creator.profileId,
      participantSectionIndex: 0,
      rowCount: pendingGame.rowCount,
      slotId: "adjective",
    }),
    createAssignedSection({
      activeAt: startedAt,
      id: `${startedGame.id}-section-invitee-1`,
      entryKind: "noun",
      gameId: startedGame.id,
      participantProfileId: invitee.profileId,
      participantSectionIndex: 0,
      rowCount: pendingGame.rowCount,
      slotId: "noun-1",
    }),
    createAssignedSection({
      activeAt: null,
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
  activeAt,
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
    activeAt,
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

function seedCompletedMultiplayerHistory({
  assignedSections,
  completedMultiplayerBatches,
  count,
  pendingGames,
  profiles,
}) {
  if (!count) {
    return;
  }

  const creator = profiles[0];
  const invitee = profiles[1];
  if (!creator || !invitee) {
    return;
  }

  for (let index = 1; index <= count; index += 1) {
    const pendingGame = createPendingGameDto({
      id: `seed-pending-game-${index}`,
      rowCount: 10,
      startedGameId: `seed-started-game-${index}`,
      status: "started",
      templateId: DEFAULT_TEMPLATE_ID,
      participants: [
        createParticipantDto(creator, {
          inviteStatus: "accepted",
          role: "creator",
        }),
        createParticipantDto(invitee, {
          inviteStatus: "accepted",
          role: "invitee",
        }),
      ],
    });
    const startedGame = createStartedGameDto({
      id: pendingGame.startedGameId,
      pendingGame,
    });

    pendingGames.push(pendingGame);
    assignedSections.push(
      ...createStartedGameAssignedSections({ pendingGame, startedGame }).map(
        (section) => ({
          ...section,
          entries: Array.from({ length: section.rowCount }, (_, rowIndex) => ({
            rowIndex,
            value: `${section.entryKind}-${index}-${rowIndex}`,
          })),
          status: "submitted",
        }),
      ),
    );
    completedMultiplayerBatches.push({
      completedOrder: index,
      gameId: startedGame.id,
    });
  }
}

function createGameCancelledNotifications({
  accountIdsByProfileId,
  createNotificationId,
  creatorProfile,
  participants,
  targetGameId,
  targetPendingGameId,
}) {
  const acceptedRecipients = participants.filter(
    (participant) =>
      participant.inviteStatus === "accepted" &&
      participant.profileId !== creatorProfile.profileId,
  );
  const message = createParticipantNotificationMessage({
    participants,
    text: `@${creatorProfile.handle} cancelled a batch with`,
  });

  return acceptedRecipients.map((participant) => ({
    id: createNotificationId(),
    accountId: accountIdsByProfileId.get(participant.profileId),
    createdAt: new Date(0).toISOString(),
    message,
    status: "unread",
    ...(targetGameId
      ? { targetGameId }
      : { targetPendingGameId }),
    type: "game_cancelled",
  }));
}

function markActiveGamePromptNotificationsRead({
  inAppNotifications,
  targetGameId,
}) {
  if (!targetGameId) {
    return;
  }

  for (const notification of inAppNotifications) {
    if (
      notification.targetGameId === targetGameId &&
      ["entries_needed", "nudge"].includes(notification.type)
    ) {
      notification.status = "read";
    }
  }
}

function createOverdueNudgeNotifications({
  accountIdsByProfileId,
  assignedSections,
  createNotificationId,
  inAppNotifications,
  now,
  pendingGames,
  profile,
}) {
  const currentTime = now().getTime();
  for (const pendingGame of pendingGames) {
    if (pendingGame.status !== "started" || !pendingGame.nudgeTimeoutHours) {
      continue;
    }

    const participant = pendingGame.participants.find(
      (candidate) => candidate.profileId === profile.profileId,
    );
    const currentSection = findCurrentAssignedSection({
      assignedSections,
      gameId: pendingGame.startedGameId,
      participantProfileId: profile.profileId,
    });
    if (!participant || !currentSection?.activeAt) {
      continue;
    }

    const overdueAt =
      Date.parse(currentSection.activeAt) +
      pendingGame.nudgeTimeoutHours * 60 * 60 * 1000;
    const accountId = accountIdsByProfileId.get(profile.profileId);
    const alreadyNudged = inAppNotifications.some(
      (notification) =>
        notification.accountId === accountId &&
        notification.targetGameId === pendingGame.startedGameId &&
        notification.targetAssignmentId === currentSection.id &&
        notification.type === "nudge",
    );
    if (currentTime < overdueAt || alreadyNudged) {
      continue;
    }

    inAppNotifications.push({
      id: createNotificationId(),
      accountId,
      createdAt: now().toISOString(),
      message: createParticipantNotificationMessage({
        participants: pendingGame.participants,
        text: "A batch is waiting for your entries with",
      }),
      status: "unread",
      targetGameId: pendingGame.startedGameId,
      targetAssignmentId: currentSection.id,
      type: "nudge",
    });
  }
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

function createEmptyCompletedMultiplayerHistoryPage() {
  return { batches: [] };
}

function createCompletedMultiplayerHistoryPage({
  assignedSections,
  completedMultiplayerBatches,
  cursor,
  pageSize,
  pendingGames,
  profile,
  revealedMultiplayerBatches,
}) {
  const allBatches = createCompletedBatches({
    assignedSections,
    completedMultiplayerBatches,
    limit: Number.MAX_SAFE_INTEGER,
    pendingGames,
    profile,
    revealedMultiplayerBatches,
  });

  if (pageSize) {
    const firstBatchIndex = cursor
      ? allBatches.findIndex((batch) => batch.id === cursor.gameId) + 1
      : 0;
    const remainingBatches = allBatches.slice(
      Math.max(0, firstBatchIndex),
    );
    const batches = remainingBatches.slice(0, pageSize);
    const hasMore = remainingBatches.length > batches.length;
    const lastBatch = batches.at(-1);
    const lastCompletedBatch = completedMultiplayerBatches.find(
      (completedBatch) => completedBatch.gameId === lastBatch?.id,
    );

    return {
      batches,
      hasMore,
      nextCursor:
        hasMore && lastCompletedBatch
          ? {
              completedOrder: lastCompletedBatch.completedOrder,
              gameId: lastCompletedBatch.gameId,
            }
          : null,
    };
  }

  return {
    batches: allBatches.slice(0, COMPLETED_HISTORY_FIRST_PAGE_LIMIT),
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
    if (pendingGame.status !== "started") {
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
  limit = 5,
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
          ...createCompletedBatchRevealSummary({
            assignedSections,
            gameId: pendingGame.startedGameId,
            profileId: profile.profileId,
            revealedMultiplayerBatches,
          }),
        },
      ];
    })
    .slice(0, limit);
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

function createCompletedBatchRevealSummary({
  assignedSections,
  gameId,
  profileId,
  revealedMultiplayerBatches,
}) {
  const revealed = isBatchRevealed({
    gameId,
    profileId,
    revealedMultiplayerBatches,
  });

  return {
    revealed,
    ...(revealed
      ? {
          phrases: renderMultiplayerPhrases({
            assignedSections,
            gameId,
          }),
        }
      : {}),
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
    createdAt: notification.createdAt,
    ...(notification.targetGameId
      ? { targetGameId: notification.targetGameId }
      : {}),
    ...(notification.targetPendingGameId
      ? { targetPendingGameId: notification.targetPendingGameId }
      : {}),
    ...(notification.targetAssignmentId
      ? {
          targetAssignmentId: notification.targetAssignmentId,
        }
      : {}),
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

function hasStartedGameReveal({ gameId, revealedMultiplayerBatches }) {
  return Boolean(gameId) && revealedMultiplayerBatches.some(
    (batch) => batch.gameId === gameId,
  );
}

function isCancelledStartedGame({ gameId, pendingGames }) {
  return pendingGames.some(
    (pendingGame) =>
      pendingGame.startedGameId === gameId && pendingGame.status === "cancelled",
  );
}

function findIncomingPendingGameIndex({
  inviteeProfile,
  now,
  pendingGameId,
  pendingGameExpiryTimes,
  pendingGames,
}) {
  if (!inviteeProfile) {
    return -1;
  }

  return pendingGames.findIndex(
    (pendingGame) =>
      pendingGame.id === pendingGameId &&
      pendingGame.status === "pending" &&
      !isPendingGameExpired({ now, pendingGame, pendingGameExpiryTimes }) &&
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
    emailLookupKey: normaliseOptionalEmailLookupKey(
      profile.emailLookupKey ?? profile.email,
    ),
    profileId: assertText(profile.profileId, "A profile id is required."),
    handle: normaliseHandle(profile.handle),
    gamerName: assertText(profile.gamerName, "A Gamer Name is required."),
    gamerTag: assertText(
      profile.gamerTag ?? profile.gamerName,
      "A Gamer Tag is required.",
    ),
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

function assertNudgeTimeoutHours(nudgeTimeoutHours) {
  if (!ALLOWED_NUDGE_TIMEOUT_HOURS.has(nudgeTimeoutHours)) {
    throw new Error("A supported Nudge Timeout is required.");
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

function normaliseLookupKey(lookupKey) {
  const value = assertText(lookupKey, "A lookup key is required.");

  if (value.includes("@")) {
    return {
      kind: "email",
      value: normaliseEmailLookupKey(value),
    };
  }

  return {
    kind: "gamer-tag",
    value: normaliseGamerTagLookupKey(value),
  };
}

function normaliseOptionalEmailLookupKey(email) {
  const value = String(email ?? "").trim();
  return value === "" ? null : normaliseEmailLookupKey(value);
}

function normaliseEmailLookupKey(email) {
  return assertText(email, "A lookup email is required.").toLowerCase();
}

function normaliseGamerTagLookupKey(gamerTag) {
  return assertText(gamerTag, "A Gamer Tag is required.").toLocaleLowerCase("en-GB");
}

function missingLookupMessage(lookupKind) {
  return lookupKind === "email"
    ? "No gamer found under that email address"
    : "No gamer found under that gamer tag.";
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

function recoverLookupProfile(row) {
  return {
    profileId: assertText(row?.profile_id, "A profile id is required."),
    gamerTag: assertText(row?.gamer_tag, "A Gamer Tag is required."),
    avatarKey: assertText(row?.avatar_key, "An Avatar key is required."),
  };
}

function firstLookupRow(data) {
  return Array.isArray(data) ? data[0] ?? null : data;
}

function recoverPendingGame({
  now = () => new Date(),
  participantRows,
  pendingGameRow,
  startedGameId,
}) {
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
    status: isExpiredPendingGameRow({ now, pendingGameRow })
      ? "expired"
      : pendingGameRow.status,
    templateId: pendingGameRow.template_id,
    rowCount: pendingGameRow.row_count,
    nudgeTimeoutHours: pendingGameRow.nudge_timeout_hours,
    startedGameId,
    participants,
  });
}

function isExpiredPendingGameRow({ now, pendingGameRow }) {
  if (pendingGameRow?.status !== "pending" || !pendingGameRow?.expires_at) {
    return false;
  }

  return Date.parse(pendingGameRow.expires_at) <= now().getTime();
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
    ...(startedGameRow.nudge_timeout_hours
      ? { nudgeTimeoutHours: startedGameRow.nudge_timeout_hours }
      : {}),
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

function recoverSingleSupabaseRow(data, message) {
  if (!Array.isArray(data)) {
    throw new Error(`${message}: expected a returned row array.`);
  }

  if (data.length !== 1) {
    throw new Error(`${message}: expected exactly one returned row.`);
  }

  if (!data[0] || typeof data[0] !== "object" || Array.isArray(data[0])) {
    throw new Error(`${message}: expected one returned row object.`);
  }

  return data[0];
}

function recoverMultiplayerDashboard(dashboardRow) {
  return {
    awaitingYourEntries: (
      dashboardRow?.awaitingYourEntries ??
      dashboardRow?.awaiting_your_entries ??
      []
    ).map((batch) =>
      recoverMultiplayerBatch(batch, { includeCurrentSection: true }),
    ),
    awaitingOtherPlayerEntries: (
      dashboardRow?.awaitingOtherPlayerEntries ??
      dashboardRow?.awaiting_other_player_entries ??
      []
    ).map((batch) => recoverMultiplayerBatch(batch)),
    completedBatches: (
      dashboardRow?.completedBatches ??
      dashboardRow?.completed_batches ??
      []
    ).map((batch) =>
      recoverMultiplayerBatch(batch, { includeRevealState: true }),
    ),
  };
}

function recoverCompletedMultiplayerHistoryPage(historyRow) {
  const page = {
    batches: (historyRow?.batches ?? historyRow?.completed_batches ?? []).map(
      (batch) => recoverMultiplayerBatch(batch, { includeRevealState: true }),
    ),
  };
  const hasMore = historyRow?.hasMore ?? historyRow?.has_more;
  const nextCursor = historyRow?.nextCursor ?? historyRow?.next_cursor;

  if (typeof hasMore === "boolean") {
    page.hasMore = hasMore;
    page.nextCursor = nextCursor
      ? {
          completedOrder:
            nextCursor.completedOrder ?? nextCursor.completed_order,
          gameId: assertText(
            nextCursor.gameId ?? nextCursor.game_id,
            "A completed history cursor Game id is required.",
          ),
        }
      : null;
  }

  return page;
}

function createCompletedMultiplayerHistoryRpcParams({ cursor, pageSize }) {
  if (!cursor && !pageSize) {
    return null;
  }

  return {
    ...(cursor
      ? {
          after_completed_order: cursor.completedOrder,
          after_game_id: cursor.gameId,
        }
      : {}),
    ...(pageSize ? { page_size: pageSize } : {}),
  };
}

function recoverMultiplayerBatch(
  batchRow,
  { includeCurrentSection = false, includeRevealState = false } = {},
) {
  return {
    id: assertText(batchRow?.id, "A Started Game id is required."),
    pendingGameId: assertText(
      batchRow?.pendingGameId ?? batchRow?.pending_game_id,
      "A Pending Game id is required.",
    ),
    rowCount: batchRow?.rowCount ?? batchRow?.row_count,
    participants: (batchRow?.participants ?? []).map((participant) => ({
      handle: normaliseHandle(
        assertText(participant?.handle, "A participant Handle is required."),
      ),
    })),
    ...(includeCurrentSection
      ? {
          currentSection: recoverCurrentMultiplayerSection(
            batchRow?.currentSection ?? batchRow?.current_section,
          ),
        }
      : {}),
    ...(includeRevealState
      ? {
          revealed: batchRow?.revealed === true,
          ...(batchRow?.revealed === true
            ? {
                phrases: Array.isArray(batchRow?.phrases)
                  ? batchRow.phrases
                  : [],
              }
            : {}),
        }
      : {}),
  };
}

function recoverCurrentMultiplayerSection(sectionRow) {
  return {
    id: assertText(sectionRow?.id, "A multiplayer section id is required."),
    entryKind: sectionRow?.entryKind ?? sectionRow?.entry_kind,
    sectionIndex:
      sectionRow?.sectionIndex ?? sectionRow?.participant_section_index,
    sectionCount: sectionRow?.sectionCount ?? sectionRow?.section_count,
    rows: (sectionRow?.rows ?? []).map((row) => ({
      rowIndex: row?.rowIndex ?? row?.row_index,
      value: typeof row?.value === "string" ? row.value : "",
    })),
  };
}

function recoverSubmittedMultiplayerSection(sectionRow) {
  return {
    id: assertText(
      sectionRow?.id ?? sectionRow?.assignment_id,
      "A multiplayer section id is required.",
    ),
    gameId: assertText(
      sectionRow?.gameId ?? sectionRow?.game_id,
      "A Started Game id is required.",
    ),
    status: sectionRow.status,
  };
}

function recoverRevealedMultiplayerBatch(batchRow) {
  return {
    gameId: assertText(
      batchRow?.gameId ?? batchRow?.game_id,
      "A Started Game id is required.",
    ),
    phrases: Array.isArray(batchRow?.phrases) ? batchRow.phrases : [],
    revealed: batchRow?.revealed === true,
  };
}

function recoverInAppNotification(notificationRow) {
  const targetGameId = notificationRow?.targetGameId ?? notificationRow?.target_game_id;
  const targetPendingGameId =
    notificationRow?.targetPendingGameId ??
    notificationRow?.target_pending_game_id;
  const targetAssignmentId =
    notificationRow?.targetAssignmentId ??
    notificationRow?.target_assignment_id;

  return {
    id: assertText(notificationRow?.id, "A notification id is required."),
    type: notificationRow?.type ?? notificationRow?.notification_type,
    status: notificationRow?.status ?? notificationRow?.notification_status,
    message: assertText(
      notificationRow?.message,
      "A notification message is required.",
    ),
    createdAt: assertText(
      notificationRow?.createdAt ?? notificationRow?.created_at,
      "A notification created timestamp is required.",
    ),
    ...(targetGameId
      ? {
          targetGameId: assertText(
            targetGameId,
            "A Started Game id is required.",
          ),
        }
      : {
          targetPendingGameId: assertText(
            targetPendingGameId,
            "A Pending Game id is required.",
          ),
        }),
    ...(targetAssignmentId
      ? {
          targetAssignmentId: assertText(
            targetAssignmentId,
            "A multiplayer section id is required.",
          ),
        }
      : {}),
  };
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
