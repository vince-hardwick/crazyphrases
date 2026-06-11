import {
  createAnonymousSoloGame,
  generateEntryCandidate,
  getActiveSection,
  needsStartAgainConfirmation,
  renderPhrases,
  revealBatch,
  startGame,
  submitActiveSection,
  updateEntry,
} from "./game-state.js?v=__ASSET_VERSION__";
import {
  loadCurrentAnonymousSoloGame,
  saveCurrentAnonymousSoloGame,
} from "./local-game-storage.js?v=__ASSET_VERSION__";

const wordBankUrl = "assets/word-bank-seed.json?v=__ASSET_VERSION__";
const rowCountButtons = [...document.querySelectorAll("[data-row-count]")];
const startButton = document.querySelector("[data-start-button]");
const startAgainButton = document.querySelector("[data-start-again-button]");
const startAgainConfirmation = document.querySelector(
  "[data-start-again-confirmation]",
);
const confirmStartAgainButton = document.querySelector("[data-confirm-start-again]");
const cancelStartAgainButton = document.querySelector("[data-cancel-start-again]");
const helpToggle = document.querySelector("[data-help-toggle]");
const helpPanel = document.querySelector("#help-panel");
const gamePanel = document.querySelector("[data-game-panel]");
const progress = document.querySelector("[data-progress]");
const sectionProgress = document.querySelector("[data-section-progress]");
const sectionTitle = document.querySelector("[data-section-title]");
const entryForm = document.querySelector("[data-entry-form]");
const entryList = document.querySelector("[data-entry-list]");
const nextButton = document.querySelector("[data-next-button]");
const revealPanel = document.querySelector("[data-reveal-panel]");
const phraseList = document.querySelector("[data-phrase-list]");

let game =
  loadCurrentAnonymousSoloGame(window.localStorage) ??
  createAnonymousSoloGame({ rowCount: 20 });
let wordBank = null;

loadWordBank();

helpToggle.addEventListener("click", () => {
  const isExpanded = helpToggle.getAttribute("aria-expanded") === "true";
  helpToggle.setAttribute("aria-expanded", String(!isExpanded));
  helpPanel.hidden = isExpanded;
});

rowCountButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (game.started) {
      return;
    }

    const rowCount = Number(button.dataset.rowCount);
    game = createAnonymousSoloGame({ rowCount });
    persistGame();
    renderGame();
  });
});

startButton.addEventListener("click", () => {
  game = startGame(game);
  persistGame();
  renderGame();
});

startAgainButton.addEventListener("click", () => {
  if (needsStartAgainConfirmation(game)) {
    showStartAgainConfirmation();
    return;
  }

  startAgain();
});

confirmStartAgainButton.addEventListener("click", () => {
  startAgain();
});

cancelStartAgainButton.addEventListener("click", () => {
  hideStartAgainConfirmation();
  startAgainButton.focus();
});

startAgainConfirmation.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }

  event.preventDefault();
  hideStartAgainConfirmation();
  startAgainButton.focus();
});

entryForm.addEventListener("input", (event) => {
  const input = event.target.closest("[data-row-index]");

  if (!input) {
    return;
  }

  game = updateEntry(game, {
    rowIndex: Number(input.dataset.rowIndex),
    value: input.value,
  });
  persistGame();
  updateNextButton();
});

entryForm.addEventListener("click", (event) => {
  const diceButton = event.target.closest("[data-dice-row-index]");

  if (!diceButton || !wordBank) {
    return;
  }

  const rowIndex = Number(diceButton.dataset.diceRowIndex);
  game = generateEntryCandidate(game, {
    rowIndex,
    wordBank,
  });
  persistGame();
  renderGame();
  entryList.querySelector(`[data-row-index="${rowIndex}"]`)?.focus();
});

entryForm.addEventListener("submit", (event) => {
  event.preventDefault();

  game = submitActiveSection(game);

  if (game.activeSectionIndex >= game.sectionOrder.length) {
    game = revealBatch(game);
  }

  persistGame();
  renderGame();
});

renderGame();

function renderGame() {
  hideStartAgainConfirmation();
  updateGamePhase();
  updateSetupControls();

  if (!game.started) {
    entryForm.hidden = true;
    revealPanel.hidden = true;
    progress.textContent = `${game.rowCount} phrases selected`;
    return;
  }

  if (game.revealed) {
    entryForm.hidden = true;
    revealPanel.hidden = false;
    progress.textContent = `${game.rowCount} phrases complete`;
    phraseList.replaceChildren(
      ...renderPhrases(game, { wordBank }).map((phrase) => {
        const item = document.createElement("li");
        item.textContent = phrase;
        return item;
      }),
    );
    return;
  }

  const activeSection = getActiveSection(game);
  entryForm.hidden = false;
  revealPanel.hidden = true;
  progress.textContent = `${game.rowCount} phrases`;
  sectionProgress.textContent = `Section ${game.activeSectionIndex + 1} of ${game.sectionOrder.length}`;
  sectionTitle.textContent = activeSection.label;
  entryList.replaceChildren(
    ...activeSection.rows.map((row, rowIndex) =>
      renderEntryRow(row, rowIndex, activeSection.kind),
    ),
  );
  updateNextButton();
}

function renderEntryRow(row, rowIndex, entryKind) {
  const rowElement = document.createElement("div");
  rowElement.className = "entry-row";

  const rowNumber = document.createElement("span");
  rowNumber.className = "row-number";
  rowNumber.textContent = String(rowIndex + 1);

  const input = document.createElement("input");
  input.type = "text";
  input.name = `entry-${rowIndex}`;
  input.autocomplete = "off";
  input.value = row.value;
  input.dataset.rowIndex = String(rowIndex);
  input.ariaLabel = `Entry ${rowIndex + 1}`;

  const diceButton = document.createElement("button");
  diceButton.type = "button";
  diceButton.className = "dice-button";
  diceButton.dataset.diceRowIndex = String(rowIndex);
  diceButton.disabled = !wordBank;
  diceButton.ariaLabel = wordBank
    ? `Generate ${entryKind} for row ${rowIndex + 1}`
    : "Random word unavailable";
  diceButton.title = wordBank
    ? `Generate ${entryKind}`
    : "Random word unavailable";

  rowElement.append(rowNumber, input, diceButton);
  return rowElement;
}

function updateNextButton() {
  const activeSection = getActiveSection(game);
  const isComplete = activeSection.rows.every((row) => row.value.trim() !== "");
  const isLastSection = game.activeSectionIndex === game.sectionOrder.length - 1;
  nextButton.disabled = !isComplete;
  nextButton.textContent = isLastSection ? "Reveal phrases" : "Next section";
}

function updateRowCountButtons(rowCount) {
  rowCountButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(Number(button.dataset.rowCount) === rowCount));
    button.disabled = game.started;
  });
}

function updateSetupControls() {
  updateRowCountButtons(game.rowCount);
  startButton.hidden = game.started;
  startAgainButton.hidden = !game.started;
}

function updateGamePhase() {
  gamePanel.dataset.gamePhase = getGamePhase();
}

function getGamePhase() {
  if (!game.started) {
    return "setup";
  }

  return game.revealed ? "reveal" : "entry";
}

function persistGame() {
  saveCurrentAnonymousSoloGame(window.localStorage, game);
}

function startAgain() {
  game = createAnonymousSoloGame({ rowCount: game.rowCount });
  persistGame();
  renderGame();
}

function showStartAgainConfirmation() {
  startAgainConfirmation.hidden = false;
  cancelStartAgainButton.focus();
}

function hideStartAgainConfirmation() {
  startAgainConfirmation.hidden = true;
}

async function loadWordBank() {
  try {
    const response = await fetch(wordBankUrl);

    if (!response.ok) {
      throw new Error("Word Bank unavailable.");
    }

    wordBank = await response.json();
    renderGame();
  } catch {
    wordBank = null;
    renderGame();
  }
}
