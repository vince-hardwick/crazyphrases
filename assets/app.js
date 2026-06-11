import {
  createAnonymousSoloGame,
  getActiveSection,
  renderPhrases,
  revealBatch,
  submitActiveSection,
  updateEntry,
} from "./game-state.js";

const rowCountButtons = [...document.querySelectorAll("[data-row-count]")];
const helpToggle = document.querySelector("[data-help-toggle]");
const helpPanel = document.querySelector("#help-panel");
const progress = document.querySelector("[data-progress]");
const sectionProgress = document.querySelector("[data-section-progress]");
const sectionTitle = document.querySelector("[data-section-title]");
const entryForm = document.querySelector("[data-entry-form]");
const entryList = document.querySelector("[data-entry-list]");
const nextButton = document.querySelector("[data-next-button]");
const revealPanel = document.querySelector("[data-reveal-panel]");
const phraseList = document.querySelector("[data-phrase-list]");

let game = createAnonymousSoloGame({ rowCount: 20 });

helpToggle.addEventListener("click", () => {
  const isExpanded = helpToggle.getAttribute("aria-expanded") === "true";
  helpToggle.setAttribute("aria-expanded", String(!isExpanded));
  helpPanel.hidden = isExpanded;
});

rowCountButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const rowCount = Number(button.dataset.rowCount);
    game = createAnonymousSoloGame({ rowCount });
    updateRowCountButtons(rowCount);
    renderGame();
  });
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
  updateNextButton();
});

entryForm.addEventListener("submit", (event) => {
  event.preventDefault();

  game = submitActiveSection(game);

  if (game.activeSectionIndex >= game.sectionOrder.length) {
    game = revealBatch(game);
  }

  renderGame();
});

renderGame();

function renderGame() {
  if (game.revealed) {
    entryForm.hidden = true;
    revealPanel.hidden = false;
    progress.textContent = `${game.rowCount} phrases complete`;
    phraseList.replaceChildren(
      ...renderPhrases(game).map((phrase) => {
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
    ...activeSection.rows.map((row, rowIndex) => renderEntryRow(row, rowIndex)),
  );
  updateNextButton();
}

function renderEntryRow(row, rowIndex) {
  const label = document.createElement("label");
  label.className = "entry-row";

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

  label.append(rowNumber, input);
  return label;
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
  });
}
