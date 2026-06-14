const LOCAL_TEST_SIGNED_IN_SOLO_GAME_SCHEMA = 1;
const LOCAL_TEST_SIGNED_IN_SOLO_GAME_KEY_PREFIX =
  "crazyphrases.localTest.signedInSolo.currentGame.v1.";
const SIGNED_IN_SOLO_CURRENT_GAMES_TABLE = "signed_in_solo_current_games";

export function createMemorySignedInSoloGameRepository() {
  const currentGames = new Map();

  return {
    async loadCurrentGame({ accountId }) {
      assertAccountId(accountId);

      const game = currentGames.get(accountId);
      return game ? cloneGame(game) : null;
    },

    async saveCurrentGame({ accountId, game }) {
      assertAccountId(accountId);
      assertSignedInGameForAccount({ accountId, game });

      const savedGame = cloneGame(game);
      currentGames.set(accountId, savedGame);
      return cloneGame(savedGame);
    },
  };
}

export function createLocalTestSignedInSoloGameRepository(storage) {
  return {
    async loadCurrentGame({ accountId }) {
      assertAccountId(accountId);

      try {
        return recoverStoredSignedInSoloGame(
          storage.getItem(getLocalTestStorageKey(accountId)),
          { accountId },
        );
      } catch {
        return null;
      }
    },

    async saveCurrentGame({ accountId, game }) {
      assertAccountId(accountId);
      assertSignedInGameForAccount({ accountId, game });

      const savedGame = cloneGame(game);
      storage.setItem(
        getLocalTestStorageKey(accountId),
        JSON.stringify({
          schemaVersion: LOCAL_TEST_SIGNED_IN_SOLO_GAME_SCHEMA,
          accountId,
          game: savedGame,
        }),
      );

      return cloneGame(savedGame);
    },
  };
}

export function createSupabaseSignedInSoloGameRepository({ supabase }) {
  if (!supabase || typeof supabase.from !== "function") {
    throw new Error("A Supabase client is required.");
  }

  async function loadCurrentGameRecord({ accountId }) {
    assertAccountId(accountId);

    const response = await supabase
      .from(SIGNED_IN_SOLO_CURRENT_GAMES_TABLE)
      .select("game, revision")
      .eq("account_id", accountId)
      .maybeSingle();

    assertNoSupabaseError(response, "Could not load current signed-in Solo Game");

    return recoverSupabaseCurrentGameRecord(response.data, { accountId });
  }

  async function saveCurrentGameRecord({ accountId, expectedRevision, game }) {
    assertAccountId(accountId);
    assertSignedInGameForAccount({ accountId, game });

    if (expectedRevision !== undefined) {
      assertExpectedRevision(expectedRevision);

      const response = await supabase
        .from(SIGNED_IN_SOLO_CURRENT_GAMES_TABLE)
        .update({
          game: cloneGame(game),
          revision: expectedRevision + 1,
        })
        .eq("account_id", accountId)
        .eq("revision", expectedRevision)
        .select("game, revision")
        .maybeSingle();

      assertNoSupabaseError(
        response,
        "Could not save current signed-in Solo Game",
      );

      if (!response.data) {
        throw new Error(
          "Current signed-in Solo Game changed before it could be saved.",
        );
      }

      return recoverSupabaseCurrentGameRecord(response.data, { accountId });
    }

    const response = await supabase
      .from(SIGNED_IN_SOLO_CURRENT_GAMES_TABLE)
      .insert({
        account_id: accountId,
        game: cloneGame(game),
      })
      .select("game, revision")
      .single();

    assertNoSupabaseError(response, "Could not save current signed-in Solo Game");

    return recoverSupabaseCurrentGameRecord(response.data, { accountId });
  }

  return {
    async loadCurrentGame({ accountId }) {
      const record = await loadCurrentGameRecord({ accountId });
      return record ? cloneGame(record.game) : null;
    },

    async saveCurrentGame({ accountId, expectedRevision, game }) {
      const record = await saveCurrentGameRecord({
        accountId,
        expectedRevision,
        game,
      });
      return cloneGame(record.game);
    },

    loadCurrentGameRecord,
    saveCurrentGameRecord,
  };
}

function assertAccountId(accountId) {
  if (typeof accountId !== "string" || accountId.trim() === "") {
    throw new Error("A signed-in Account id is required.");
  }
}

function assertSignedInGameForAccount({ accountId, game }) {
  if (game?.mode !== "signed-in-solo") {
    throw new Error("A signed-in Solo Game is required.");
  }

  if (game.accountId !== accountId) {
    throw new Error("Signed-in Solo Game Account id mismatch.");
  }

  if (game.started !== true) {
    throw new Error("A started signed-in Solo Game is required.");
  }

  if (!isValidSignedInSoloGame(game)) {
    throw new Error("A valid signed-in Solo Game payload is required.");
  }
}

function cloneGame(game) {
  return JSON.parse(JSON.stringify(game));
}

function recoverStoredSignedInSoloGame(serializedGame, { accountId }) {
  if (typeof serializedGame !== "string" || serializedGame.trim() === "") {
    return null;
  }

  const payload = JSON.parse(serializedGame);

  if (
    payload?.schemaVersion !== LOCAL_TEST_SIGNED_IN_SOLO_GAME_SCHEMA ||
    payload.accountId !== accountId
  ) {
    return null;
  }

  assertSignedInGameForAccount({ accountId, game: payload.game });

  return cloneGame(payload.game);
}

function getLocalTestStorageKey(accountId) {
  return `${LOCAL_TEST_SIGNED_IN_SOLO_GAME_KEY_PREFIX}${encodeURIComponent(
    accountId,
  )}`;
}

function recoverSupabaseCurrentGameRecord(row, { accountId }) {
  if (!row) {
    return null;
  }

  if (!Number.isInteger(row.revision) || row.revision < 1) {
    throw new Error("A valid signed-in Solo Game revision is required.");
  }

  assertSignedInGameForAccount({ accountId, game: row.game });

  return {
    game: cloneGame(row.game),
    revision: row.revision,
  };
}

function assertExpectedRevision(expectedRevision) {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
    throw new Error("A valid signed-in Solo Game revision is required.");
  }
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

function isValidSignedInSoloGame(game) {
  return (
    Number.isInteger(game.rowCount) &&
    game.rowCount > 0 &&
    Array.isArray(game.sections) &&
    Array.isArray(game.sectionOrder) &&
    hasValidSectionOrder(game) &&
    Number.isInteger(game.activeSectionIndex) &&
    game.activeSectionIndex >= 0 &&
    game.activeSectionIndex <= game.sectionOrder.length &&
    game.sections.every((section) => isValidSection(section, game.rowCount))
  );
}

function hasValidSectionOrder(game) {
  if (game.sectionOrder.length !== game.sections.length) {
    return false;
  }

  return game.sectionOrder
    .toSorted((left, right) => left - right)
    .every((sectionIndex, index) => sectionIndex === index);
}

function isValidSection(section, rowCount) {
  return (
    ["adjective", "noun"].includes(section?.kind) &&
    typeof section.label === "string" &&
    Array.isArray(section.rows) &&
    section.rows.length === rowCount &&
    section.rows.every((row) => typeof row?.value === "string") &&
    (section.locked === undefined || typeof section.locked === "boolean")
  );
}
