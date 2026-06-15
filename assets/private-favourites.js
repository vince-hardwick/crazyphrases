import { renderPhrases } from "./game-state.js?v=__ASSET_VERSION__";

const DEFAULT_TEMPLATE_ID = "default-adjective-noun-noun";
const LOCAL_TEST_PRIVATE_PHRASE_FAVOURITES_SCHEMA = 1;
const LOCAL_TEST_PRIVATE_PHRASE_FAVOURITES_KEY_PREFIX =
  "crazyphrases.localTest.privatePhraseFavourites.v1.";
const PRIVATE_PHRASE_FAVOURITES_TABLE = "private_phrase_favourites";

export function createMemoryPrivateFavouritesRepository({
  createId = defaultCreateId,
  now = () => new Date().toISOString(),
} = {}) {
  const phraseFavouritesByAccount = new Map();

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
  };
}

export function createLocalTestPrivateFavouritesRepository(
  storage,
  {
    createId = defaultCreateId,
    now = () => new Date().toISOString(),
  } = {},
) {
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

      return loadStoredPhraseFavourites(storage, { accountId }).map(
        ({ record }) => cloneFavouriteRecord(record),
      );
    },
  };
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

function assertAccountId(accountId) {
  if (typeof accountId !== "string" || accountId.trim() === "") {
    throw new Error("A signed-in Account id is required.");
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

function getAccountFavourites(favouritesByAccount, accountId) {
  if (!favouritesByAccount.has(accountId)) {
    favouritesByAccount.set(accountId, []);
  }

  return favouritesByAccount.get(accountId);
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

function getLocalTestPhraseFavouritesKey(accountId) {
  return `${LOCAL_TEST_PRIVATE_PHRASE_FAVOURITES_KEY_PREFIX}${encodeURIComponent(
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
    isPhraseFavouriteSnapshot(record.favourite)
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
