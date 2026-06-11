const DEFAULT_SECTIONS = [
  { kind: "adjective", label: "Fill these adjectives" },
  { kind: "noun", label: "Fill these nouns" },
  { kind: "noun", label: "Fill these nouns" },
];

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
  };
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

export function renderPhrases(game) {
  return Array.from({ length: game.rowCount }, (_, rowIndex) => {
    const phrase = game.sections
      .map((section) => section.rows[rowIndex].value)
      .join(" ");

    return capitalizeFirst(cleanWhitespace(phrase));
  });
}

function assertStarted(game) {
  if (!game.started) {
    throw new Error("Start the batch before entering words.");
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

function shuffledIndexes(length, random) {
  const indexes = Array.from({ length }, (_, index) => index);

  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const offset = Math.floor(random() * (index + 1));
    const swapIndex = index - offset;
    [indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]];
  }

  return indexes;
}
