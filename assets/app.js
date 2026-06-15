import {
  createAccountShell,
  createSignedOutShell,
} from "./account-shell.js?v=__ASSET_VERSION__";
import {
  createAnonymousSoloGame,
  createSignedInSoloGame,
  formatBatchCopyText,
  formatPhraseCopyText,
  generateEntryCandidate,
  getActiveSection,
  getRevealDetails,
  getStartAgainConfirmation,
  needsStartAgainConfirmation,
  renderPhrases,
  revealBatch,
  startGame,
  submitActiveSection,
  updateEntry,
} from "./game-state.js?v=__ASSET_VERSION__";
import { writePlainText } from "./clipboard.js?v=__ASSET_VERSION__";
import {
  loadCurrentAnonymousSoloGame,
  saveCurrentAnonymousSoloGame,
} from "./local-game-storage.js?v=__ASSET_VERSION__";
import { createBrowserSupabaseClient } from "./supabase-browser-client.js?v=__ASSET_VERSION__";
import { SUPABASE_RUNTIME_CONFIG } from "./supabase-config.js?v=__ASSET_VERSION__";
import { createSupabaseAuthSession } from "./supabase-auth-session.js?v=__ASSET_VERSION__";
import {
  createLocalTestSignedInSoloGameRepository,
  createSupabaseSignedInSoloGameRepository,
} from "./signed-in-game-storage.js?v=__ASSET_VERSION__";
import { createSignedInGameSession } from "./signed-in-game-session.js?v=__ASSET_VERSION__";

const wordBankUrl = "assets/word-bank-seed.json?v=__ASSET_VERSION__";
const rowCountButtons = [...document.querySelectorAll("[data-row-count]")];
const startButton = document.querySelector("[data-start-button]");
const startAgainButton = document.querySelector("[data-start-again-button]");
const startAgainConfirmation = document.querySelector(
  "[data-start-again-confirmation]",
);
const startAgainConfirmationMessage = document.querySelector(
  "[data-start-again-confirmation-message]",
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
const revealDetails = document.querySelector("[data-reveal-details]");
const copyStatus = document.querySelector("[data-copy-status]");
const accountStatus = document.querySelector("[data-account-status]");
const accountDetail = document.querySelector("[data-account-detail]");
const testSignInButton = document.querySelector("[data-test-sign-in-button]");
const googleSignInButton = document.querySelector("[data-google-sign-in-button]");
const emailSignInForm = document.querySelector("[data-email-sign-in-form]");
const emailSignInInput = document.querySelector("[data-email-sign-in-input]");
const authMessage = document.querySelector("[data-auth-message]");
const signOutButton = document.querySelector("[data-sign-out-button]");
const persistenceRecovery = document.querySelector("[data-persistence-recovery]");
const persistenceRecoveryMessage = document.querySelector(
  "[data-persistence-recovery-message]",
);
const retryCurrentGameButton = document.querySelector("[data-retry-current-game]");
const startNewCurrentGameButton = document.querySelector(
  "[data-start-new-current-game]",
);

const loadFailureMessage =
  "Account-backed progress could not be loaded. Retry, or start a new batch without deleting saved progress.";

let game =
  loadCurrentAnonymousSoloGame(window.localStorage) ??
  createAnonymousSoloGame({ rowCount: 20 });
let wordBank = null;
let accountShell = createSignedOutShell();
let hostedAuthSession = null;
let hostedAuthAvailable = false;
const localTestSignedInGameSession = createSignedInGameSession({
  repository: createLocalTestSignedInSoloGameRepository(window.localStorage, {
    failureMode: getLocalTestPersistenceFailureMode(),
  }),
});
let signedInGameSession = localTestSignedInGameSession;

loadWordBank();
renderAccountShell(accountShell);
void initialiseHostedAuth();

testSignInButton.addEventListener("click", async () => {
  signedInGameSession = localTestSignedInGameSession;
  await applyAccountShell(
    createAccountShell({
      account: { id: "test-account" },
      profile: null,
    }),
  );
});

googleSignInButton.addEventListener("click", async () => {
  authMessage.textContent = "";

  try {
    await hostedAuthSession?.signInWithGoogle();
  } catch {
    authMessage.textContent = "Google sign-in is unavailable.";
  }
});

emailSignInForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authMessage.textContent = "";

  try {
    await hostedAuthSession?.sendEmailMagicLink({
      email: emailSignInInput.value,
    });
    emailSignInInput.value = "";
    authMessage.textContent = "Check your email for the sign-in link.";
  } catch {
    authMessage.textContent = "Could not send sign-in email.";
  }
});

signOutButton.addEventListener("click", async () => {
  authMessage.textContent = "";

  try {
    if (hostedAuthSession) {
      await hostedAuthSession.signOut();
    }
  } catch {
    authMessage.textContent = "Could not sign out.";
    return;
  }

  applySignedOutShell();
});

retryCurrentGameButton.addEventListener("click", () => {
  void loadSignedInCurrentGame();
});

startNewCurrentGameButton.addEventListener("click", () => {
  signedInGameSession.reset();
  game = createCurrentModeSoloGame({ rowCount: 20 });
  hidePersistenceRecovery();
  renderGame();
});

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
    game = createCurrentModeSoloGame({ rowCount });
    void persistGame();
    renderGame();
  });
});

startButton.addEventListener("click", () => {
  game = startGame(game);
  void persistGame();
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
  void persistGame();
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
  void persistGame();
  renderGame();
  entryList.querySelector(`[data-row-index="${rowIndex}"]`)?.focus();
});

entryForm.addEventListener("submit", (event) => {
  event.preventDefault();

  game = submitActiveSection(game);

  if (game.activeSectionIndex >= game.sectionOrder.length) {
    game = revealBatch(game);
  }

  void persistGame();
  renderGame();
});

revealPanel.addEventListener("click", (event) => {
  const phraseCopyButton = event.target.closest("[data-copy-phrase-index]");

  if (phraseCopyButton) {
    const phrases = renderPhrases(game, { wordBank });
    const phrase = phrases[Number(phraseCopyButton.dataset.copyPhraseIndex)];
    void copyText(formatPhraseCopyText(phrase), "Phrase copied.");
    return;
  }

  if (event.target.closest("[data-copy-all-button]")) {
    void copyText(
      formatBatchCopyText(renderPhrases(game, { wordBank })),
      "Batch copied.",
    );
  }
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
    copyStatus.textContent = "";
    phraseList.replaceChildren(
      ...renderPhrases(game, { wordBank }).map(renderPhraseItem),
    );
    revealDetails.replaceChildren(...getRevealDetails(game).map(renderDetailGroup));
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

function renderAccountShell(shell) {
  accountStatus.textContent = shell.statusLabel;
  accountDetail.textContent =
    shell.persistenceAuthority.type === "local-browser"
      ? "Local play in this browser"
      : `@${shell.profile.handle}`;
  testSignInButton.hidden =
    shell.mode !== "anonymous-solo" ||
    hostedAuthAvailable ||
    !isLocalTestAuthAvailable();
  googleSignInButton.hidden =
    shell.mode !== "anonymous-solo" || !hostedAuthAvailable;
  emailSignInForm.hidden = shell.mode !== "anonymous-solo" || !hostedAuthAvailable;
  signOutButton.hidden = shell.mode !== "signed-in";
}

function isLocalTestAuthAvailable() {
  return ["127.0.0.1", "localhost"].includes(window.location.hostname);
}

function getLocalTestPersistenceFailureMode() {
  if (!isLocalTestAuthAvailable()) {
    return null;
  }

  const failureMode = new URLSearchParams(window.location.search).get(
    "testSignedInPersistence",
  );

  if (["save-fails", "load-fails", "conflict-save"].includes(failureMode)) {
    return failureMode;
  }

  return null;
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

function renderPhraseItem(phrase, phraseIndex) {
  const item = document.createElement("li");

  const phraseText = document.createElement("span");
  phraseText.textContent = phrase;

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "secondary-button phrase-copy-button";
  copyButton.dataset.copyPhraseIndex = String(phraseIndex);
  copyButton.textContent = "Copy";
  copyButton.ariaLabel = `Copy phrase ${phraseIndex + 1}`;

  item.append(phraseText, copyButton);
  return item;
}

function renderDetailGroup(group, groupIndex) {
  const section = document.createElement("section");
  section.className = "reveal-detail-group";

  const heading = document.createElement("h3");
  heading.textContent = `Section ${groupIndex + 1}: ${group.label}`;

  const list = document.createElement("ol");
  list.className = "reveal-entry-list";
  list.replaceChildren(
    ...group.entries.map((entry) => {
      const item = document.createElement("li");
      item.textContent = entry;
      return item;
    }),
  );

  section.append(heading, list);
  return section;
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

async function persistGame() {
  if (accountShell.persistenceAuthority.type === "account") {
    if (!game.started) {
      return;
    }

    try {
      await signedInGameSession.saveCurrentGame({
        accountId: accountShell.accountId,
        game,
      });
      authMessage.textContent = "";
    } catch (error) {
      authMessage.textContent = getSaveFailureMessage(error);
    }
    return;
  }

  saveCurrentAnonymousSoloGame(window.localStorage, game);
}

function startAgain() {
  game = createCurrentModeSoloGame({ rowCount: game.rowCount });
  void persistGame();
  renderGame();
}

function createCurrentModeSoloGame({ rowCount }) {
  if (accountShell.persistenceAuthority.type === "account") {
    return createSignedInSoloGame({
      accountId: accountShell.accountId,
      rowCount,
    });
  }

  return createAnonymousSoloGame({ rowCount });
}

function showStartAgainConfirmation() {
  const confirmation = getStartAgainConfirmation(game);
  startAgainConfirmationMessage.textContent = confirmation.message;
  cancelStartAgainButton.textContent = confirmation.cancelLabel;
  confirmStartAgainButton.textContent = confirmation.confirmLabel;
  startAgainConfirmation.hidden = false;
  cancelStartAgainButton.focus();
}

function hideStartAgainConfirmation() {
  startAgainConfirmation.hidden = true;
}

async function copyText(text, successMessage) {
  if (await writePlainText(text)) {
    copyStatus.textContent = successMessage;
    return;
  }

  copyStatus.textContent = "Copy unavailable.";
}

function getSaveFailureMessage(error) {
  if (
    error instanceof Error &&
    /changed before it could be saved/i.test(error.message)
  ) {
    return "Account-backed progress changed in another tab. Reload to see the latest saved game before continuing.";
  }

  return "Account-backed progress could not be saved. Keep this tab open and try again.";
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

async function initialiseHostedAuth() {
  try {
    const supabase = await createBrowserSupabaseClient({
      config: SUPABASE_RUNTIME_CONFIG,
    });

    if (!supabase) {
      return;
    }

    hostedAuthSession = createSupabaseAuthSession({ supabase });
    hostedAuthAvailable = true;
    signedInGameSession = createSignedInGameSession({
      repository: createSupabaseSignedInSoloGameRepository({ supabase }),
    });

    await applyAccountShell(await hostedAuthSession.loadAccountShell());
  } catch {
    hostedAuthSession = null;
    hostedAuthAvailable = false;
    signedInGameSession = localTestSignedInGameSession;
    authMessage.textContent = "Sign in unavailable.";
    renderAccountShell(accountShell);
  }
}

async function applyAccountShell(shell) {
  accountShell = shell;

  if (accountShell.persistenceAuthority.type === "account") {
    await loadSignedInCurrentGame();
  } else {
    signedInGameSession.reset();
    game =
      loadCurrentAnonymousSoloGame(window.localStorage) ??
      createAnonymousSoloGame({ rowCount: 20 });
    hidePersistenceRecovery();
  }

  renderAccountShell(accountShell);
  renderGame();
}

async function loadSignedInCurrentGame() {
  try {
    game =
      (await signedInGameSession.loadCurrentGame({
        accountId: accountShell.accountId,
      })) ?? createCurrentModeSoloGame({ rowCount: 20 });
    hidePersistenceRecovery();
  } catch {
    signedInGameSession.reset();
    game = createCurrentModeSoloGame({ rowCount: 20 });
    showPersistenceRecovery(loadFailureMessage);
  }

  renderAccountShell(accountShell);
  renderGame();
}

function applySignedOutShell() {
  accountShell = createSignedOutShell();
  signedInGameSession.reset();
  game =
    loadCurrentAnonymousSoloGame(window.localStorage) ??
    createAnonymousSoloGame({ rowCount: 20 });
  hidePersistenceRecovery();
  renderAccountShell(accountShell);
  renderGame();
}

function showPersistenceRecovery(message) {
  persistenceRecoveryMessage.textContent = message;
  persistenceRecovery.hidden = false;
}

function hidePersistenceRecovery() {
  persistenceRecovery.hidden = true;
  persistenceRecoveryMessage.textContent = "";
}
