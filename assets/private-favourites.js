import { renderPhrases } from "./game-state.js?v=__ASSET_VERSION__";

const DEFAULT_TEMPLATE_ID = "default-adjective-noun-noun";
const LOCAL_TEST_PRIVATE_PHRASE_FAVOURITES_SCHEMA = 1;
const LOCAL_TEST_PRIVATE_PHRASE_FAVOURITES_KEY_PREFIX =
  "crazyphrases.localTest.privatePhraseFavourites.v1.";
const LOCAL_TEST_PRIVATE_BATCH_FAVOURITES_SCHEMA = 1;
const LOCAL_TEST_PRIVATE_BATCH_FAVOURITES_KEY_PREFIX =
  "crazyphrases.localTest.privateBatchFavourites.v1.";
const PRIVATE_PHRASE_FAVOURITES_TABLE = "private_phrase_favourites";
const PRIVATE_BATCH_FAVOURITES_TABLE = "private_batch_favourites";

export function createMemoryPrivateFavouritesRepository({
  createId = defaultCreateId,
  now = () => new Date().toISOString(),
} = {}) {
  const phraseFavouritesByAccount = new Map();
  const batchFavouritesByAccount = new Map();

  return {
    async savePhraseFavourite({ accountId, favourite }) {
      assertAccountId(accountId);
      assertPhraseFavouriteSnapshot(favourite);

      const accountFavourites = getAccountFavourites(
        phraseFavouritesByAccount,
        accountId,
      );
      const fingerprint = createFavouriteFingerprint(favourite);
      const existing = accountFavourites.find(
        (record) => record.fingerprint === fingerprint,
      );

      if (existing) {
        return cloneFavouriteRecord(existing.record);
      }

      const record = {
        id: createId(),
        accountId,
        favourite: cloneFavourite(favourite),
        createdAt: now(),
      };
      accountFavourites.push({
        fingerprint,
        record,
      });

      return cloneFavouriteRecord(record);
    },

    async listPhraseFavourites({ accountId }) {
      assertAccountId(accountId);

      return getAccountFavourites(phraseFavouritesByAccount, accountId).map(
        ({ record }) => cloneFavouriteRecord(record),
      );
    },

    async removePhraseFavourite({ accountId, favouriteId }) {
      assertAccountId(accountId);
      assertFavouriteId(favouriteId);

      removeFavouriteRecord(
        getAccountFavourites(phraseFavouritesByAccount, accountId),
        favouriteId,
      );
    },

    async saveBatchFavourite({ accountId, favourite }) {
      assertAccountId(accountId);
      assertBatchFavouriteSnapshot(favourite);

      const accountFavourites = getAccountFavourites(
        batchFavouritesByAccount,
        accountId,
      );
      const fingerprint = createFavouriteFingerprint(favourite);
      const existing = accountFavourites.find(
        (record) => record.fingerprint === fingerprint,
      );

      if (existing) {
        return cloneFavouriteRecord(existing.record);
      }

      const record = {
        id: createId(),
        accountId,
        favourite: cloneFavourite(favourite),
        createdAt: now(),
      };
      accountFavourites.push({
        fingerprint,
        record,
      });

      return cloneFavouriteRecord(record);
    },

    async listBatchFavourites({ accountId }) {
      assertAccountId(accountId);

      return getAccountFavourites(batchFavouritesByAccount, accountId).map(
        ({ record }) => cloneFavouriteRecord(record),
      );
    },

    async removeBatchFavourite({ accountId, favouriteId }) {
      assertAccountId(accountId);
      assertFavouriteId(favouriteId);

      removeFavouriteRecord(
        getAccountFavourites(batchFavouritesByAccount, accountId),
        favouriteId,
      );
    },
  };
}

export function createLocalTestPrivateFavouritesRepository(
  storage,
  {
    createId = defaultCreateId,
    failureMode = null,
    now = () => new Date().toISOString(),
  } = {},
) {
  const listAttempts = {
    phrases: new Map(),
    batches: new Map(),
  };

  return {
    async savePhraseFavourite({ accountId, favourite }) {
      assertAccountId(accountId);
      assertPhraseFavouriteSnapshot(favourite);

      const storedFavourites = loadStoredPhraseFavourites(storage, { accountId });
      const fingerprint = createFavouriteFingerprint(favourite);
      const existing = storedFavourites.find(
        (record) => record.fingerprint === fingerprint,
      );

      if (existing) {
        return cloneFavouriteRecord(existing.record);
      }

      const record = {
        id: createId(),
        accountId,
        favourite: cloneFavourite(favourite),
        createdAt: now(),
      };
      storedFavourites.push({
        fingerprint,
        record,
      });
      saveStoredPhraseFavourites(storage, {
        accountId,
        favourites: storedFavourites,
      });

      return cloneFavouriteRecord(record);
    },

    async listPhraseFavourites({ accountId }) {
      assertAccountId(accountId);
      await prepareLocalTestPrivateFavouritesList({
        accountId,
        failureMode,
        listAttempts: listAttempts.phrases,
      });

      if (failureMode === "load-fails") {
        throw new Error("Local test private favourite load failed.");
      }

      return loadStoredPhraseFavourites(storage, { accountId }).map(
        ({ record }) => cloneFavouriteRecord(record),
      );
    },

    async removePhraseFavourite({ accountId, favouriteId }) {
      assertAccountId(accountId);
      assertFavouriteId(favouriteId);

      if (failureMode === "remove-fails") {
        throw new Error("Local test private favourite remove failed.");
      }

      const storedFavourites = loadStoredPhraseFavourites(storage, { accountId });
      removeFavouriteRecord(storedFavourites, favouriteId);
      saveStoredPhraseFavourites(storage, {
        accountId,
        favourites: storedFavourites,
      });
    },

    async saveBatchFavourite({ accountId, favourite }) {
      assertAccountId(accountId);
      assertBatchFavouriteSnapshot(favourite);

      const storedFavourites = loadStoredBatchFavourites(storage, { accountId });
      const fingerprint = createFavouriteFingerprint(favourite);
      const existing = storedFavourites.find(
        (record) => record.fingerprint === fingerprint,
      );

      if (existing) {
        return cloneFavouriteRecord(existing.record);
      }

      const record = {
        id: createId(),
        accountId,
        favourite: cloneFavourite(favourite),
        createdAt: now(),
      };
      storedFavourites.push({
        fingerprint,
        record,
      });
      saveStoredBatchFavourites(storage, {
        accountId,
        favourites: storedFavourites,
      });

      return cloneFavouriteRecord(record);
    },

    async listBatchFavourites({ accountId }) {
      assertAccountId(accountId);
      await prepareLocalTestPrivateFavouritesList({
        accountId,
        failureMode,
        listAttempts: listAttempts.batches,
      });

      if (failureMode === "load-fails") {
        throw new Error("Local test private favourite load failed.");
      }

      return loadStoredBatchFavourites(storage, { accountId }).map(
        ({ record }) => cloneFavouriteRecord(record),
      );
    },

    async removeBatchFavourite({ accountId, favouriteId }) {
      assertAccountId(accountId);
      assertFavouriteId(favouriteId);

      if (failureMode === "remove-fails") {
        throw new Error("Local test private favourite remove failed.");
      }

      const storedFavourites = loadStoredBatchFavourites(storage, { accountId });
      removeFavouriteRecord(storedFavourites, favouriteId);
      saveStoredBatchFavourites(storage, {
        accountId,
        favourites: storedFavourites,
      });
    },
  };
}

async function prepareLocalTestPrivateFavouritesList({
  accountId,
  failureMode,
  listAttempts,
}) {
  if (failureMode === "load-race") {
    await delayLocalTestPrivateFavouritesList(
      accountId === "test-account" ? 500 : 50,
    );
  }

  if (failureMode !== "load-fails-once") {
    return;
  }

  const attemptCount = listAttempts.get(accountId) ?? 0;
  listAttempts.set(accountId, attemptCount + 1);

  if (attemptCount === 0) {
    throw new Error("Local test private favourite load failed.");
  }
}

async function delayLocalTestPrivateFavouritesList(delayMs) {
  await new Promise((resolve) => {
    globalThis.setTimeout(resolve, delayMs);
  });
}

export function createSupabasePrivateFavouritesRepository({ supabase }) {
  if (!supabase || typeof supabase.from !== "function") {
    throw new Error("A Supabase client is required.");
  }

  return {
    async savePhraseFavourite({ accountId, favourite }) {
      assertAccountId(accountId);
      assertPhraseFavouriteSnapshot(favourite);

      const sourceFingerprint = createFavouriteFingerprint(favourite);
      const response = await supabase
        .from(PRIVATE_PHRASE_FAVOURITES_TABLE)
        .insert({
          account_id: accountId,
          favourite: cloneFavourite(favourite),
          source_fingerprint: sourceFingerprint,
        })
        .select("id, account_id, favourite, created_at")
        .maybeSingle();

      if (isUniqueConstraintError(response?.error)) {
        return loadSupabasePhraseFavouriteByFingerprint({
          supabase,
          accountId,
          sourceFingerprint,
        });
      }

      assertNoSupabaseError(response, "Could not save private Phrase Favourite");
      return recoverSupabasePhraseFavouriteRecord(response.data, { accountId });
    },

    async listPhraseFavourites({ accountId }) {
      assertAccountId(accountId);

      const response = await supabase
        .from(PRIVATE_PHRASE_FAVOURITES_TABLE)
        .select("id, account_id, favourite, created_at")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });

      assertNoSupabaseError(response, "Could not load private Phrase Favourites");
      return (response.data ?? []).map((row) =>
        recoverSupabasePhraseFavouriteRecord(row, { accountId }),
      );
    },

    async removePhraseFavourite({ accountId, favouriteId }) {
      assertAccountId(accountId);
      assertFavouriteId(favouriteId);

      const response = await supabase
        .from(PRIVATE_PHRASE_FAVOURITES_TABLE)
        .delete()
        .eq("account_id", accountId)
        .eq("id", favouriteId);

      assertNoSupabaseError(response, "Could not remove private Phrase Favourite");
    },

    async saveBatchFavourite({ accountId, favourite }) {
      assertAccountId(accountId);
      assertBatchFavouriteSnapshot(favourite);

      const sourceFingerprint = createFavouriteFingerprint(favourite);
      const response = await supabase
        .from(PRIVATE_BATCH_FAVOURITES_TABLE)
        .insert({
          account_id: accountId,
          favourite: cloneFavourite(favourite),
          source_fingerprint: sourceFingerprint,
        })
        .select("id, account_id, favourite, created_at")
        .maybeSingle();

      if (isUniqueConstraintError(response?.error)) {
        return loadSupabaseBatchFavouriteByFingerprint({
          supabase,
          accountId,
          sourceFingerprint,
        });
      }

      assertNoSupabaseError(response, "Could not save private Batch Favourite");
      return recoverSupabaseBatchFavouriteRecord(response.data, { accountId });
    },

    async listBatchFavourites({ accountId }) {
      assertAccountId(accountId);

      const response = await supabase
        .from(PRIVATE_BATCH_FAVOURITES_TABLE)
        .select("id, account_id, favourite, created_at")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });

      assertNoSupabaseError(response, "Could not load private Batch Favourites");
      return (response.data ?? []).map((row) =>
        recoverSupabaseBatchFavouriteRecord(row, { accountId }),
      );
    },

    async removeBatchFavourite({ accountId, favouriteId }) {
      assertAccountId(accountId);
      assertFavouriteId(favouriteId);

      const response = await supabase
        .from(PRIVATE_BATCH_FAVOURITES_TABLE)
        .delete()
        .eq("account_id", accountId)
        .eq("id", favouriteId);

      assertNoSupabaseError(response, "Could not remove private Batch Favourite");
    },
  };
}

export function createPhraseFavouriteSnapshot(game, { rowIndex, wordBank } = {}) {
  assertRevealedSignedInSoloGame(game);

  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= game.rowCount) {
    throw new Error("A valid phrase row index is required.");
  }

  return {
    type: "phrase",
    sourceMode: game.mode,
    templateId: DEFAULT_TEMPLATE_ID,
    rowIndex,
    phraseText: renderPhrases(game, { wordBank })[rowIndex],
    entries: game.sections.map((section) => {
      const value = section.rows[rowIndex].value;

      return {
        entryKind: section.kind,
        value,
        displayValue: normalizeEntryForDisplay(value, {
          entryKind: section.kind,
          wordBank,
        }),
      };
    }),
  };
}

export function createBatchFavouriteSnapshot(game, { wordBank } = {}) {
  assertRevealedSignedInSoloGame(game);

  const phrases = renderPhrases(game, { wordBank });

  return {
    type: "batch",
    sourceMode: game.mode,
    templateId: DEFAULT_TEMPLATE_ID,
    rowCount: game.rowCount,
    phrases,
    rows: phrases.map((phraseText, rowIndex) => ({
      rowIndex,
      phraseText,
      entries: game.sections.map((section) => {
        const value = section.rows[rowIndex].value;

        return {
          entryKind: section.kind,
          value,
          displayValue: normalizeEntryForDisplay(value, {
            entryKind: section.kind,
            wordBank,
          }),
        };
      }),
    })),
  };
}

export function areFavouriteSnapshotsEqual(left, right) {
  if (
    !(isPhraseFavouriteSnapshot(left) || isBatchFavouriteSnapshot(left)) ||
    !(isPhraseFavouriteSnapshot(right) || isBatchFavouriteSnapshot(right))
  ) {
    return false;
  }

  return createCanonicalJson(left) === createCanonicalJson(right);
}

function assertAccountId(accountId) {
  if (typeof accountId !== "string" || accountId.trim() === "") {
    throw new Error("A signed-in Account id is required.");
  }
}

function assertFavouriteId(favouriteId) {
  if (typeof favouriteId !== "string" || favouriteId.trim() === "") {
    throw new Error("A private Favourite id is required.");
  }
}

function assertRevealedSignedInSoloGame(game) {
  if (game?.mode !== "signed-in-solo" || game.revealed !== true) {
    throw new Error("A revealed signed-in Solo Game is required.");
  }
}

function assertPhraseFavouriteSnapshot(favourite) {
  if (!isPhraseFavouriteSnapshot(favourite)) {
    throw new Error("A valid Phrase Favourite snapshot is required.");
  }
}

function assertBatchFavouriteSnapshot(favourite) {
  if (!isBatchFavouriteSnapshot(favourite)) {
    throw new Error("A valid Batch Favourite snapshot is required.");
  }
}

function isPhraseFavouriteSnapshot(favourite) {
  return (
    favourite?.type === "phrase" &&
    favourite.sourceMode === "signed-in-solo" &&
    favourite.templateId === DEFAULT_TEMPLATE_ID &&
    Number.isInteger(favourite.rowIndex) &&
    typeof favourite.phraseText === "string" &&
    favourite.phraseText.trim() !== "" &&
    Array.isArray(favourite.entries)
  );
}

function isBatchFavouriteSnapshot(favourite) {
  return (
    favourite?.type === "batch" &&
    favourite.sourceMode === "signed-in-solo" &&
    favourite.templateId === DEFAULT_TEMPLATE_ID &&
    Number.isInteger(favourite.rowCount) &&
    Array.isArray(favourite.phrases) &&
    favourite.phrases.length === favourite.rowCount &&
    favourite.phrases.every(
      (phrase) => typeof phrase === "string" && phrase.trim() !== "",
    ) &&
    Array.isArray(favourite.rows) &&
    favourite.rows.length === favourite.rowCount
  );
}

function getAccountFavourites(favouritesByAccount, accountId) {
  if (!favouritesByAccount.has(accountId)) {
    favouritesByAccount.set(accountId, []);
  }

  return favouritesByAccount.get(accountId);
}

function removeFavouriteRecord(accountFavourites, favouriteId) {
  const existingIndex = accountFavourites.findIndex(
    ({ record }) => record.id === favouriteId,
  );

  if (existingIndex !== -1) {
    accountFavourites.splice(existingIndex, 1);
  }
}

function loadStoredPhraseFavourites(storage, { accountId }) {
  try {
    const serialized = storage.getItem(getLocalTestPhraseFavouritesKey(accountId));

    if (typeof serialized !== "string" || serialized.trim() === "") {
      return [];
    }

    const payload = JSON.parse(serialized);

    if (
      payload?.schemaVersion !== LOCAL_TEST_PRIVATE_PHRASE_FAVOURITES_SCHEMA ||
      payload.accountId !== accountId ||
      !Array.isArray(payload.favourites)
    ) {
      return [];
    }

    return payload.favourites
      .filter(isStoredFavouriteRecord)
      .map(({ fingerprint, record }) => ({
        fingerprint,
        record: cloneFavouriteRecord(record),
      }));
  } catch {
    return [];
  }
}

function loadStoredBatchFavourites(storage, { accountId }) {
  try {
    const serialized = storage.getItem(getLocalTestBatchFavouritesKey(accountId));

    if (typeof serialized !== "string" || serialized.trim() === "") {
      return [];
    }

    const payload = JSON.parse(serialized);

    if (
      payload?.schemaVersion !== LOCAL_TEST_PRIVATE_BATCH_FAVOURITES_SCHEMA ||
      payload.accountId !== accountId ||
      !Array.isArray(payload.favourites)
    ) {
      return [];
    }

    return payload.favourites
      .filter(isStoredFavouriteRecord)
      .map(({ fingerprint, record }) => ({
        fingerprint,
        record: cloneFavouriteRecord(record),
      }));
  } catch {
    return [];
  }
}

function saveStoredPhraseFavourites(storage, { accountId, favourites }) {
  storage.setItem(
    getLocalTestPhraseFavouritesKey(accountId),
    JSON.stringify({
      schemaVersion: LOCAL_TEST_PRIVATE_PHRASE_FAVOURITES_SCHEMA,
      accountId,
      favourites,
    }),
  );
}

function saveStoredBatchFavourites(storage, { accountId, favourites }) {
  storage.setItem(
    getLocalTestBatchFavouritesKey(accountId),
    JSON.stringify({
      schemaVersion: LOCAL_TEST_PRIVATE_BATCH_FAVOURITES_SCHEMA,
      accountId,
      favourites,
    }),
  );
}

function getLocalTestPhraseFavouritesKey(accountId) {
  return `${LOCAL_TEST_PRIVATE_PHRASE_FAVOURITES_KEY_PREFIX}${encodeURIComponent(
    accountId,
  )}`;
}

function getLocalTestBatchFavouritesKey(accountId) {
  return `${LOCAL_TEST_PRIVATE_BATCH_FAVOURITES_KEY_PREFIX}${encodeURIComponent(
    accountId,
  )}`;
}

function isStoredFavouriteRecord(candidate) {
  try {
    return (
      typeof candidate?.fingerprint === "string" &&
      candidate.fingerprint.trim() !== "" &&
      isFavouriteRecord(candidate.record)
    );
  } catch {
    return false;
  }
}

function createFavouriteFingerprint(favourite) {
  return JSON.stringify(favourite);
}

function createCanonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(createCanonicalJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${createCanonicalJson(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function cloneFavourite(favourite) {
  return JSON.parse(JSON.stringify(favourite));
}

function cloneFavouriteRecord(record) {
  return {
    ...record,
    favourite: cloneFavourite(record.favourite),
  };
}

function isFavouriteRecord(record) {
  return (
    typeof record?.id === "string" &&
    record.id.trim() !== "" &&
    typeof record.accountId === "string" &&
    record.accountId.trim() !== "" &&
    typeof record.createdAt === "string" &&
    record.createdAt.trim() !== "" &&
    (isPhraseFavouriteSnapshot(record.favourite) ||
      isBatchFavouriteSnapshot(record.favourite))
  );
}

async function loadSupabasePhraseFavouriteByFingerprint({
  supabase,
  accountId,
  sourceFingerprint,
}) {
  const response = await supabase
    .from(PRIVATE_PHRASE_FAVOURITES_TABLE)
    .select("id, account_id, favourite, created_at")
    .eq("account_id", accountId)
    .eq("source_fingerprint", sourceFingerprint)
    .maybeSingle();

  assertNoSupabaseError(response, "Could not load private Phrase Favourite");

  if (!response.data) {
    throw new Error("Private Phrase Favourite could not be found after duplicate save.");
  }

  return recoverSupabasePhraseFavouriteRecord(response.data, { accountId });
}

async function loadSupabaseBatchFavouriteByFingerprint({
  supabase,
  accountId,
  sourceFingerprint,
}) {
  const response = await supabase
    .from(PRIVATE_BATCH_FAVOURITES_TABLE)
    .select("id, account_id, favourite, created_at")
    .eq("account_id", accountId)
    .eq("source_fingerprint", sourceFingerprint)
    .maybeSingle();

  assertNoSupabaseError(response, "Could not load private Batch Favourite");

  if (!response.data) {
    throw new Error("Private Batch Favourite could not be found after duplicate save.");
  }

  return recoverSupabaseBatchFavouriteRecord(response.data, { accountId });
}

function recoverSupabasePhraseFavouriteRecord(row, { accountId }) {
  const record = {
    id: row?.id,
    accountId: row?.account_id,
    favourite: row?.favourite,
    createdAt: row?.created_at,
  };

  if (record.accountId !== accountId || !isFavouriteRecord(record)) {
    throw new Error("A valid private Phrase Favourite row is required.");
  }

  return cloneFavouriteRecord(record);
}

function recoverSupabaseBatchFavouriteRecord(row, { accountId }) {
  const record = {
    id: row?.id,
    accountId: row?.account_id,
    favourite: row?.favourite,
    createdAt: row?.created_at,
  };

  if (
    record.accountId !== accountId ||
    !isFavouriteRecord(record) ||
    !isBatchFavouriteSnapshot(record.favourite)
  ) {
    throw new Error("A valid private Batch Favourite row is required.");
  }

  return cloneFavouriteRecord(record);
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

function isUniqueConstraintError(error) {
  return error?.code === "23505";
}

function defaultCreateId() {
  return globalThis.crypto?.randomUUID?.() ?? `phrase-favourite-${Date.now()}`;
}

function normalizeEntryForDisplay(value, { entryKind, wordBank }) {
  const cleanedValue = cleanWhitespace(value);
  const candidate = getWordBankCandidates(wordBank, entryKind).find(
    (word) => candidateKey(word) === candidateKey(cleanedValue),
  );

  return candidate ?? cleanedValue;
}

function cleanWhitespace(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function getWordBankCandidates(wordBank, entryKind) {
  return (wordBank?.entryKinds?.[entryKind] ?? [])
    .map((candidate) => candidate.trim())
    .filter(Boolean);
}

function candidateKey(candidate) {
  return candidate.trim().toLowerCase();
}
