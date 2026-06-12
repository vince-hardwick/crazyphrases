const DEFAULT_SECTIONS = [
  { kind: "adjective", label: "Fill these adjectives" },
  { kind: "noun", label: "Fill these nouns" },
  { kind: "noun", label: "Fill these nouns" },
];
const ANONYMOUS_SOLO_STORAGE_SCHEMA = 1;

export function createAnonymousSoloGame({ rowCount = 20, random = Math.random } = {}) {
  const sections = DEFAULT_SECTIONS.map((section) => ({
    ...section,
    rows: Array.from({ length: rowCount }, () => ({ value: "" })),
  }));

  return {
    mode: "anonymous-solo",
    rowCount,
    sections,
    sectionOrder: shuffledIndexes(sections.length, random),
    activeSectionIndex: 0,
    started: false,
    revealed: false,
    usedCandidates: {},
  };
}

export function createSignedInSoloGame({
  accountId,
  rowCount = 20,
  random = Math.random,
} = {}) {
  assertAccountId(accountId);

  return {
    ...createAnonymousSoloGame({ rowCount, random }),
    mode: "signed-in-solo",
    accountId,
  };
}

export function serializeAnonymousSoloGame(game) {
  return JSON.stringify({
    schemaVersion: ANONYMOUS_SOLO_STORAGE_SCHEMA,
    game,
  });
}

export function recoverAnonymousSoloGame(serializedGame) {
  if (typeof serializedGame !== "string" || serializedGame.trim() === "") {
    return null;
  }

  try {
    const payload = JSON.parse(serializedGame);

    if (
      payload?.schemaVersion !== ANONYMOUS_SOLO_STORAGE_SCHEMA ||
      !isRecoverableAnonymousSoloGame(payload.game)
    ) {
      return null;
    }

    return payload.game;
  } catch {
    return null;
  }
}

export function startGame(game) {
  return {
    ...game,
    started: true,
  };
}

export function getActiveSection(game) {
  const sectionIndex = game.sectionOrder[game.activeSectionIndex];
  return game.sections[sectionIndex];
}

export function updateEntry(game, { rowIndex, value }) {
  assertStarted(game);

  if (game.revealed || game.activeSectionIndex >= game.sectionOrder.length) {
    throw new Error("Cannot edit a complete game.");
  }

  const sectionIndex = game.sectionOrder[game.activeSectionIndex];
  const section = game.sections[sectionIndex];

  if (section.locked) {
    throw new Error("Cannot edit a submitted section.");
  }

  return updateSection(game, sectionIndex, {
    ...section,
    rows: section.rows.map((row, index) =>
      index === rowIndex ? { ...row, value } : row,
    ),
  });
}

export function generateEntryCandidate(
  game,
  { rowIndex, wordBank, random = Math.random },
) {
  assertStarted(game);

  const activeSection = getActiveSection(game);
  const candidates = getWordBankCandidates(wordBank, activeSection.kind);

  if (candidates.length === 0) {
    throw new Error(`No candidates available for ${activeSection.kind}.`);
  }

  const candidate = chooseCandidate(candidates, {
    random,
    used: game.usedCandidates?.[activeSection.kind] ?? [],
  });

  const updatedGame = updateEntry(game, { rowIndex, value: candidate });

  return {
    ...updatedGame,
    usedCandidates: {
      ...updatedGame.usedCandidates,
      [activeSection.kind]: [
        ...(updatedGame.usedCandidates?.[activeSection.kind] ?? []),
        candidateKey(candidate),
      ],
    },
  };
}

export function submitActiveSection(game) {
  assertStarted(game);

  const sectionIndex = game.sectionOrder[game.activeSectionIndex];
  const section = game.sections[sectionIndex];

  if (section.rows.some((row) => row.value.trim() === "")) {
    throw new Error("Complete all rows before continuing.");
  }

  const updatedGame = updateSection(game, sectionIndex, {
    ...section,
    locked: true,
  });

  return {
    ...updatedGame,
    activeSectionIndex: game.activeSectionIndex + 1,
  };
}

export function revealBatch(game) {
  assertStarted(game);

  if (game.sections.some((section) => !section.locked)) {
    throw new Error("Cannot reveal until every section is complete.");
  }

  return {
    ...game,
    revealed: true,
  };
}

export function needsStartAgainConfirmation(game) {
  return hasEntries(game);
}

export function getStartAgainConfirmation(game) {
  if (game.revealed) {
    return {
      message:
        "Start a new batch? Your revealed phrases will be cleared from this browser.",
      cancelLabel: "View phrases",
      confirmLabel: "Start new batch",
    };
  }

  return {
    message: "Start again and discard your current entries?",
    cancelLabel: "Keep playing",
    confirmLabel: "Discard entries",
  };
}

export function renderPhrases(game, { wordBank } = {}) {
  return Array.from({ length: game.rowCount }, (_, rowIndex) => {
    const phrase = game.sections
      .map((section) =>
        normalizeEntryForDisplay(section.rows[rowIndex].value, {
          entryKind: section.kind,
          wordBank,
        }),
      )
      .join(" ");

    return capitalizeFirst(cleanWhitespace(phrase));
  });
}

export function formatBatchCopyText(phrases, { title = "Crazy Phrases" } = {}) {
  return [title, ...phrases].join("\n");
}

export function formatPhraseCopyText(phrase) {
  return phrase;
}

export function getRevealDetails(game) {
  return game.sections.map((section) => ({
    label: getRevealDetailLabel(section.kind),
    entries: section.rows.map((row) => row.value),
  }));
}

function assertStarted(game) {
  if (!game.started) {
    throw new Error("Start the batch before entering words.");
  }
}

function assertAccountId(accountId) {
  if (typeof accountId !== "string" || accountId.trim() === "") {
    throw new Error("A signed-in Account id is required.");
  }
}

function updateSection(game, sectionIndex, section) {
  return {
    ...game,
    sections: game.sections.map((candidate, index) =>
      index === sectionIndex ? section : candidate,
    ),
  };
}

function cleanWhitespace(value) {
  return value.trim().replace(/\s+/g, " ");
}

function capitalizeFirst(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getWordBankCandidates(wordBank, entryKind) {
  return (wordBank?.entryKinds?.[entryKind] ?? [])
    .map((candidate) => candidate.trim())
    .filter(Boolean);
}

function normalizeEntryForDisplay(value, { entryKind, wordBank }) {
  const cleanedValue = cleanWhitespace(value);
  const candidate = getWordBankCandidates(wordBank, entryKind).find(
    (word) => candidateKey(word) === candidateKey(cleanedValue),
  );

  return candidate ?? cleanedValue;
}

function chooseCandidate(candidates, { random, used }) {
  const usedCandidateKeys = new Set(used);
  const unusedCandidates = candidates.filter(
    (candidate) => !usedCandidateKeys.has(candidateKey(candidate)),
  );
  const candidatePool =
    unusedCandidates.length > 0 ? unusedCandidates : candidates;

  return candidatePool[Math.floor(random() * candidatePool.length)];
}

function candidateKey(candidate) {
  return candidate.trim().toLowerCase();
}

function getRevealDetailLabel(entryKind) {
  return entryKind === "adjective" ? "Adjectives" : "Nouns";
}

function isRecoverableAnonymousSoloGame(game) {
  return (
    game?.mode === "anonymous-solo" &&
    Number.isInteger(game.rowCount) &&
    Array.isArray(game.sections) &&
    Array.isArray(game.sectionOrder) &&
    Number.isInteger(game.activeSectionIndex)
  );
}

function hasEntries(game) {
  return game.sections.some((section) =>
    section.rows.some((row) => row.value.trim() !== ""),
  );
}

function shuffledIndexes(length, random) {
  const indexes = Array.from({ length }, (_, index) => index);

  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const offset = Math.floor(random() * (index + 1));
    const swapIndex = index - offset;
    [indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]];
  }

  return indexes;
}
