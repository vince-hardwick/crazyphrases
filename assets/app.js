import {
  BUILT_IN_AVATAR_KEYS,
  DEFAULT_BUILT_IN_AVATAR_KEY,
  createAccountShell,
  createBuiltInAvatarDescriptor,
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
  createLocalTestAccountProfileRepository,
  createSupabaseAccountProfileRepository,
} from "./account-profile.js?v=__ASSET_VERSION__";
import {
  createLocalTestAvatarStorageRepository,
  createSupabaseAvatarStorageRepository,
  createUploadedAvatarObjectPath,
} from "./avatar-storage.js?v=__ASSET_VERSION__";
import {
  createLocalTestSignedInSoloGameRepository,
  createSupabaseSignedInSoloGameRepository,
} from "./signed-in-game-storage.js?v=__ASSET_VERSION__";
import { createSignedInGameSession } from "./signed-in-game-session.js?v=__ASSET_VERSION__";
import {
  areFavouriteSnapshotsEqual,
  createLocalTestPrivateFavouritesRepository,
  createBatchFavouriteSnapshot,
  createPhraseFavouriteSnapshot,
  createSupabasePrivateFavouritesRepository,
} from "./private-favourites.js?v=__ASSET_VERSION__";
import {
  createLocalTestPendingGameRepository,
  createSupabasePendingGameRepository,
} from "./pending-game.js?v=__ASSET_VERSION__";

const wordBankUrl = "assets/word-bank-seed.json?v=__ASSET_VERSION__";
const FONT_AWESOME_KIT_SCRIPT_URL = "https://kit.fontawesome.com/613901cfcc.js";
const COMPLETED_MULTIPLAYER_HISTORY_PAGE_SIZE = 20;
const AVATAR_UPLOAD_MAX_BYTES = 1024 * 1024;
const AVATAR_UPLOAD_MIN_DIMENSION = 128;
const AVATAR_UPLOAD_MAX_DIMENSION = 1024;
const AVATAR_UPLOAD_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const AVATAR_UPLOAD_COPY = {
  invalidType: "Choose a JPEG, PNG, or WebP image.",
  oversizedFile: "Choose an image smaller than 1 MB.",
  undersizedImage: "Choose an image at least 128 by 128 pixels.",
  oversizedDimensions: "Choose an image no larger than 1024 by 1024 pixels.",
  unreadableImage: "This image could not be read. Choose another file.",
  uploadFailure: "Avatar could not be uploaded. Try again.",
  saveFailureAfterUpload:
    "Profile could not be saved. Your previous avatar is still active.",
};
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
const notificationShell = document.querySelector("[data-notification-shell]");
const notificationToggle = document.querySelector("[data-notification-toggle]");
const notificationPanel = document.querySelector("[data-notification-panel]");
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
const accountShellElement = document.querySelector("[data-account-shell]");
const accountStatus = document.querySelector("[data-account-status]");
const accountDetail = document.querySelector("[data-account-detail]");
const testSignInButton = document.querySelector("[data-test-sign-in-button]");
const testInviteeSignInButton = document.querySelector(
  "[data-test-invitee-sign-in-button]",
);
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
const localTestPrivateFavouritesRepository =
  createLocalTestPrivateFavouritesRepository(window.localStorage, {
    failureMode: getLocalTestPrivateFavouritesFailureMode(),
  });
const localTestAvatarStorageRepository = createLocalTestAvatarStorageRepository(
  window.localStorage,
  {
    failureMode: getLocalTestAvatarStorageFailureMode(),
  },
);
let signedInGameSession = localTestSignedInGameSession;
let privateFavouritesRepository = localTestPrivateFavouritesRepository;
const localTestProfiles = [
  {
    accountId: "test-account",
    profileId: "test-profile",
    handle: "player-test-account",
    gamerName: "Player",
    avatarKey: "spark",
  },
  {
    accountId: "invitee-auth-account",
    profileId: "invitee-profile",
    handle: "invitee-two",
    gamerName: "Invitee Two",
    avatarKey: "paper",
  },
];
const localTestCreatorProfile = localTestProfiles[0];
const localTestInviteeProfile = localTestProfiles[1];
const localTestAccountProfileRepository = createLocalTestAccountProfileRepository(
  window.localStorage,
  {
    failureMode: getLocalTestAccountProfileFailureMode(),
    initialProfiles: localTestProfiles,
  },
);
const localTestPendingGameRepository = createLocalTestPendingGameRepository({
  completedHistorySeedCount: getLocalTestPendingGameSeedCount(),
  createPendingGameId: createLocalTestPendingGameId,
  failureMode: getLocalTestPendingGameFailureMode(),
  pendingGameInviteExpiryMs: getLocalTestPendingGameInviteExpiryMs(),
  profiles: localTestProfiles,
});
let pendingGameRepository = localTestPendingGameRepository;
let accountProfileRepository = localTestAccountProfileRepository;
let avatarStorageRepository = localTestAvatarStorageRepository;
let phraseFavourites = [];
let batchFavourites = [];
let saveBatchButton = null;
let pendingGamePanel = null;
let pendingGameHandleInput = null;
let pendingGameRowCountSelect = null;
let pendingGameNudgeTimeoutSelect = null;
let pendingGameStatus = null;
let pendingGameSummary = null;
let pendingGameIncomingList = null;
let multiplayerDashboardMount = null;
let completedMultiplayerHistoryPanel = null;
let currentPendingGame = null;
let createdPendingGames = [];
let incomingPendingGameInvites = [];
let multiplayerDashboard = createEmptyMultiplayerDashboard();
let completedMultiplayerHistory = createEmptyCompletedMultiplayerHistory();
let inAppNotifications = [];
let accountProfilePanel = null;
let accountProfileDraftAvatar = null;
let accountProfilePreviewRequestId = 0;
let favouritesPanel = null;
let favouritesStatus = null;
let phraseFavouritesList = null;

loadFontAwesomeKit();
loadWordBank();
renderAccountShell(accountShell);
void initialiseHostedAuth();

testSignInButton.addEventListener("click", async () => {
  await applyLocalTestAccountShell(localTestCreatorProfile);
});

testInviteeSignInButton.addEventListener("click", async () => {
  await applyLocalTestAccountShell(localTestInviteeProfile);
});

async function applyLocalTestAccountShell(profile) {
  signedInGameSession = localTestSignedInGameSession;
  privateFavouritesRepository = localTestPrivateFavouritesRepository;
  pendingGameRepository = localTestPendingGameRepository;
  accountProfileRepository = localTestAccountProfileRepository;
  avatarStorageRepository = localTestAvatarStorageRepository;
  const currentProfile = await accountProfileRepository.ensureOwnProfile({
    accountId: profile.accountId,
  });
  await applyAccountShell(
    createAccountShell({
      account: { id: profile.accountId },
      profile: currentProfile,
    }),
  );
}

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
  renderFavourites();
});

helpToggle.addEventListener("click", () => {
  const isExpanded = helpToggle.getAttribute("aria-expanded") === "true";
  helpToggle.setAttribute("aria-expanded", String(!isExpanded));
  helpPanel.hidden = isExpanded;
});

notificationToggle.addEventListener("click", () => {
  const isExpanded = notificationToggle.getAttribute("aria-expanded") === "true";
  notificationToggle.setAttribute("aria-expanded", String(!isExpanded));
  notificationPanel.hidden = isExpanded;

  if (!isExpanded) {
    renderNotificationDropdown();
    void markUnreadNotificationsRead();
  }
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

  void startAgain();
});

confirmStartAgainButton.addEventListener("click", () => {
  void startAgain();
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
  if (event.target.closest("[data-save-batch-button]")) {
    void saveBatchFavourite();
    return;
  }

  const phraseSaveButton = event.target.closest("[data-save-phrase-index]");

  if (phraseSaveButton) {
    void savePhraseFavourite(Number(phraseSaveButton.dataset.savePhraseIndex));
    return;
  }

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
renderPendingGamePanel();
renderFavourites();

function renderGame() {
  hideStartAgainConfirmation();
  updateGamePhase();
  updateSetupControls();

  if (!game.started) {
    entryForm.hidden = true;
    revealPanel.hidden = true;
    clearRevealSurface();
    progress.textContent = "";
    return;
  }

  if (game.revealed) {
    entryForm.hidden = true;
    revealPanel.hidden = false;
    if (accountShell.persistenceAuthority.type === "account") {
      const currentSaveBatchButton = ensureSaveBatchButton();
      currentSaveBatchButton.disabled = isBatchFavouriteSaved();
      currentSaveBatchButton.textContent = currentSaveBatchButton.disabled
        ? "Saved"
        : "Save batch";
    } else {
      removeSaveBatchButton();
    }
    progress.textContent = "";
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
  clearRevealSurface();
  progress.textContent = "";
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
  testInviteeSignInButton.hidden =
    shell.mode !== "anonymous-solo" ||
    hostedAuthAvailable ||
    !isLocalTestAuthAvailable();
  googleSignInButton.hidden =
    shell.mode !== "anonymous-solo" || !hostedAuthAvailable;
  emailSignInForm.hidden = shell.mode !== "anonymous-solo" || !hostedAuthAvailable;
  signOutButton.hidden = shell.mode !== "signed-in";
  notificationShell.hidden = shell.mode !== "signed-in";
  if (shell.mode !== "signed-in") {
    notificationToggle.setAttribute("aria-expanded", "false");
    notificationPanel.hidden = true;
    notificationPanel.replaceChildren();
  }
  renderAccountProfilePanel(shell);
  updateNotificationToggle();
}

function renderAccountProfilePanel(shell) {
  if (shell.mode !== "signed-in") {
    removeAccountProfilePanel();
    return;
  }

  const panel = ensureAccountProfilePanel();
  const gamerName = panel.querySelector("[data-account-profile-gamer-name]");
  const handle = panel.querySelector("[data-account-profile-handle]");
  const avatar = panel.querySelector("[data-account-profile-avatar]");
  const activeAvatar = shell.profile.avatar ?? createBuiltInAvatarDescriptor(
    shell.profile.avatarKey,
  );

  gamerName.value = shell.profile.gamerName;
  handle.value = shell.profile.handle;
  avatar.value =
    activeAvatar.type === "built-in"
      ? activeAvatar.key
      : DEFAULT_BUILT_IN_AVATAR_KEY;
  clearDraftAvatarPreviewUrl();
  accountProfileDraftAvatar = null;
  void renderAccountProfileAvatarPreview(panel, activeAvatar);
}

function ensureAccountProfilePanel() {
  if (accountProfilePanel) {
    return accountProfilePanel;
  }

  accountProfilePanel = document.createElement("section");
  accountProfilePanel.className = "account-profile-panel";
  accountProfilePanel.dataset.accountProfilePanel = "";
  accountProfilePanel.setAttribute("aria-label", "Profile");

  const heading = document.createElement("h2");
  heading.textContent = "Profile";

  const form = document.createElement("form");
  form.className = "account-profile-form";
  form.dataset.accountProfileForm = "";
  form.noValidate = true;
  form.addEventListener("submit", saveAccountProfile);

  const gamerNameField = createProfileInputField({
    datasetKey: "accountProfileGamerName",
    label: "Gamer Name",
    required: false,
  });
  const handleField = createProfileInputField({
    datasetKey: "accountProfileHandle",
    label: "Handle",
  });
  const avatarField = createProfileAvatarField();
  const status = document.createElement("p");
  const submitButton = document.createElement("button");

  status.className = "account-profile-status";
  status.dataset.accountProfileStatus = "";
  status.setAttribute("aria-live", "polite");
  submitButton.type = "submit";
  submitButton.className = "text-button";
  submitButton.textContent = "Save profile";

  form.append(
    gamerNameField,
    handleField,
    avatarField,
    submitButton,
    status,
  );
  accountProfilePanel.append(heading, form);
  accountShellElement.append(accountProfilePanel);

  return accountProfilePanel;
}

function createProfileInputField({ datasetKey, label, required = true }) {
  const field = document.createElement("label");
  const input = document.createElement("input");

  field.className = "account-profile-field";
  field.textContent = label;
  input.type = "text";
  input.dataset[datasetKey] = "";
  input.required = required;
  field.append(input);
  return field;
}

function createProfileAvatarField() {
  const field = document.createElement("div");
  const selectLabel = document.createElement("label");
  const select = document.createElement("select");
  const preview = document.createElement("div");
  const uploadLabel = document.createElement("label");
  const uploadInput = document.createElement("input");

  field.className = "account-profile-avatar-field";
  selectLabel.className = "account-profile-field";
  selectLabel.textContent = "Avatar";
  select.dataset.accountProfileAvatar = "";
  select.addEventListener("change", () => {
    const panel = ensureAccountProfilePanel();
    clearAccountProfileUploadInput(panel);
    accountProfileDraftAvatar = createBuiltInAvatarDescriptor(select.value);
    setAccountProfileStatus("");
    void renderAccountProfileAvatarPreview(panel, accountProfileDraftAvatar);
  });
  for (const avatarKey of BUILT_IN_AVATAR_KEYS) {
    const option = document.createElement("option");
    option.value = avatarKey;
    option.textContent = formatProfileLabel(avatarKey);
    select.append(option);
  }
  selectLabel.append(select);

  preview.className = "account-profile-avatar-preview";
  preview.dataset.accountProfileAvatarPreview = "";
  preview.setAttribute("aria-live", "polite");

  uploadLabel.className = "account-profile-upload-field";
  uploadLabel.textContent = "Upload image";
  uploadInput.type = "file";
  uploadInput.accept = "image/jpeg,image/png,image/webp";
  uploadInput.dataset.accountProfileUploadedAvatarInput = "";
  uploadInput.addEventListener("change", () => {
    void selectUploadedAvatarFile(uploadInput.files?.[0] ?? null);
  });
  uploadLabel.append(uploadInput);

  field.append(selectLabel, preview, uploadLabel);
  return field;
}

function removeAccountProfilePanel() {
  clearDraftAvatarPreviewUrl();
  accountProfileDraftAvatar = null;
  accountProfilePanel?.remove();
  accountProfilePanel = null;
}

function formatProfileLabel(value) {
  return String(value ?? "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

async function renderAccountProfileAvatarPreview(panel, avatarDescriptor) {
  const preview = panel.querySelector("[data-account-profile-avatar-preview]");
  if (!preview) {
    return;
  }

  const requestId = (accountProfilePreviewRequestId += 1);
  preview.replaceChildren();
  preview.removeAttribute("role");
  preview.removeAttribute("aria-label");

  if (avatarDescriptor?.type === "uploaded-draft") {
    renderUploadedAvatarPreview(preview, avatarDescriptor.previewUrl);
    return;
  }

  if (avatarDescriptor?.type === "uploaded") {
    const publicUrl = await avatarStorageRepository.getPublicUrl({
      objectPath: avatarDescriptor.objectPath,
    });
    if (requestId !== accountProfilePreviewRequestId || !publicUrl) {
      return;
    }

    renderUploadedAvatarPreview(preview, publicUrl);
    return;
  }

  const builtInAvatar = createBuiltInAvatarDescriptor(avatarDescriptor?.key);
  const icon = document.createElement("i");
  icon.className = `fa-solid fa-${builtInAvatar.key}`;
  icon.dataset.accountProfileBuiltInAvatarIcon = "";
  icon.dataset.avatarKey = builtInAvatar.key;
  icon.setAttribute("aria-hidden", "true");
  preview.setAttribute("role", "img");
  preview.setAttribute(
    "aria-label",
    `Selected ${formatProfileLabel(builtInAvatar.key)}`,
  );
  preview.append(icon);
}

function renderUploadedAvatarPreview(preview, imageUrl) {
  const image = document.createElement("img");
  image.alt = "Uploaded image";
  image.dataset.accountProfileUploadedAvatarImage = "";
  image.src = imageUrl;
  preview.setAttribute("role", "img");
  preview.setAttribute("aria-label", "Selected uploaded image");
  preview.append(image);
}

async function selectUploadedAvatarFile(file) {
  const panel = ensureAccountProfilePanel();
  setAccountProfileStatus("");

  if (!file) {
    return;
  }

  const validation = await validateUploadedAvatarFile(file);
  if (!validation.valid) {
    clearDraftAvatarPreviewUrl();
    accountProfileDraftAvatar = null;
    setAccountProfileStatus(validation.message);
    await renderAccountProfileAvatarPreview(panel, accountShell.profile.avatar);
    return;
  }

  clearDraftAvatarPreviewUrl();
  accountProfileDraftAvatar = {
    type: "uploaded-draft",
    byteSize: file.size,
    contentType: file.type,
    file,
    height: validation.height,
    previewUrl: URL.createObjectURL(file),
    width: validation.width,
  };
  await renderAccountProfileAvatarPreview(panel, accountProfileDraftAvatar);
}

async function validateUploadedAvatarFile(file) {
  if (!AVATAR_UPLOAD_CONTENT_TYPES.has(file.type)) {
    return {
      valid: false,
      message: AVATAR_UPLOAD_COPY.invalidType,
    };
  }

  if (file.size > AVATAR_UPLOAD_MAX_BYTES) {
    return {
      valid: false,
      message: AVATAR_UPLOAD_COPY.oversizedFile,
    };
  }

  try {
    const dimensions = await decodeImageDimensions(file);
    if (
      dimensions.width < AVATAR_UPLOAD_MIN_DIMENSION ||
      dimensions.height < AVATAR_UPLOAD_MIN_DIMENSION
    ) {
      return {
        valid: false,
        message: AVATAR_UPLOAD_COPY.undersizedImage,
      };
    }

    if (
      dimensions.width > AVATAR_UPLOAD_MAX_DIMENSION ||
      dimensions.height > AVATAR_UPLOAD_MAX_DIMENSION
    ) {
      return {
        valid: false,
        message: AVATAR_UPLOAD_COPY.oversizedDimensions,
      };
    }

    return {
      valid: true,
      ...dimensions,
    };
  } catch {
    return {
      valid: false,
      message: AVATAR_UPLOAD_COPY.unreadableImage,
    };
  }
}

async function decodeImageDimensions(file) {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    const dimensions = {
      height: bitmap.height,
      width: bitmap.width,
    };
    bitmap.close?.();
    return dimensions;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", reject, { once: true });
      image.src = objectUrl;
    });
    return {
      height: image.naturalHeight,
      width: image.naturalWidth,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function uploadDraftAvatar({ draft }) {
  let objectPath = null;

  try {
    objectPath = createUploadedAvatarObjectPath({
      contentType: draft.contentType,
    });
    await avatarStorageRepository.registerPendingUpload({
      accountId: accountShell.accountId,
      byteSize: draft.byteSize,
      contentType: draft.contentType,
      height: draft.height,
      objectPath,
      profileId: accountShell.profile.profileId,
      width: draft.width,
    });
    await avatarStorageRepository.uploadAvatarObject({
      contentType: draft.contentType,
      file: draft.file,
      objectPath,
    });

    return {
      type: "uploaded",
      objectPath,
    };
  } catch {
    if (objectPath) {
      await cleanupUploadedAvatar(objectPath);
    }

    throw new Error(AVATAR_UPLOAD_COPY.uploadFailure);
  }
}

async function cleanupUploadedAvatar(objectPath) {
  try {
    await avatarStorageRepository.cleanupPendingUpload({ objectPath });
  } catch {
    // Cleanup is best-effort; the save path still reports failure.
  }
}

function clearAccountProfileUploadInput(panel) {
  const uploadInput = panel.querySelector(
    "[data-account-profile-uploaded-avatar-input]",
  );
  if (uploadInput) {
    uploadInput.value = "";
  }
  clearDraftAvatarPreviewUrl();
}

function clearDraftAvatarPreviewUrl() {
  if (accountProfileDraftAvatar?.type === "uploaded-draft") {
    URL.revokeObjectURL(accountProfileDraftAvatar.previewUrl);
  }
}

function setAccountProfileStatus(message) {
  const status = accountProfilePanel?.querySelector("[data-account-profile-status]");
  if (status) {
    status.textContent = message;
  }
}

async function saveAccountProfile(event) {
  event.preventDefault();

  if (accountShell.persistenceAuthority.type !== "account") {
    return;
  }

  const panel = ensureAccountProfilePanel();
  const gamerName = panel.querySelector("[data-account-profile-gamer-name]");
  const handle = panel.querySelector("[data-account-profile-handle]");
  const avatar = panel.querySelector("[data-account-profile-avatar]");
  const status = panel.querySelector("[data-account-profile-status]");
  let uploadedObjectPath = null;

  status.textContent = "";

  try {
    const avatarDescriptor =
      accountProfileDraftAvatar?.type === "uploaded-draft"
        ? await uploadDraftAvatar({ draft: accountProfileDraftAvatar })
        : accountProfileDraftAvatar?.type === "built-in"
          ? accountProfileDraftAvatar
          : createBuiltInAvatarDescriptor(avatar.value);
    if (avatarDescriptor.type === "uploaded") {
      uploadedObjectPath = avatarDescriptor.objectPath;
    }

    const profile = await accountProfileRepository.updateOwnProfile({
      accountId: accountShell.accountId,
      profile: {
        avatar: avatarDescriptor,
        gamerName: gamerName.value,
        handle: handle.value,
      },
    });
    accountShell = createAccountShell({
      account: { id: accountShell.accountId },
      profile,
    });
    renderAccountShell(accountShell);
    panel.querySelector("[data-account-profile-status]").textContent =
      "Profile saved.";
  } catch (error) {
    if (uploadedObjectPath) {
      await cleanupUploadedAvatar(uploadedObjectPath);
      status.textContent = AVATAR_UPLOAD_COPY.saveFailureAfterUpload;
    } else {
      status.textContent = getProfileSaveFailureMessage(error);
    }
  }
}

function getProfileSaveFailureMessage(error) {
  if (error instanceof Error && error.message === AVATAR_UPLOAD_COPY.uploadFailure) {
    return AVATAR_UPLOAD_COPY.uploadFailure;
  }

  if (error instanceof Error && /already in use/i.test(error.message)) {
    return "Handle is already in use.";
  }

  if (error instanceof Error && /at least 3/i.test(error.message)) {
    return "Handle must be at least 3 characters.";
  }

  return "Profile could not be saved. Try again.";
}

function isLocalTestAuthAvailable() {
  return ["127.0.0.1", "localhost"].includes(window.location.hostname);
}

function loadFontAwesomeKit() {
  if (isLocalTestAuthAvailable()) {
    return;
  }

  const script = document.createElement("script");
  script.src = FONT_AWESOME_KIT_SCRIPT_URL;
  script.crossOrigin = "anonymous";
  document.head.append(script);
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

function getLocalTestPrivateFavouritesFailureMode() {
  if (!isLocalTestAuthAvailable()) {
    return null;
  }

  const failureMode = new URLSearchParams(window.location.search).get(
    "testPrivateFavourites",
  );

  if (failureMode === "remove-fails") {
    return failureMode;
  }

  return null;
}

function getLocalTestAccountProfileFailureMode() {
  if (!isLocalTestAuthAvailable()) {
    return null;
  }

  const failureMode = new URLSearchParams(window.location.search).get(
    "testAccountProfile",
  );

  if (failureMode === "save-fails") {
    return failureMode;
  }

  return null;
}

function getLocalTestAvatarStorageFailureMode() {
  if (!isLocalTestAuthAvailable()) {
    return null;
  }

  const failureMode = new URLSearchParams(window.location.search).get(
    "testAvatarStorage",
  );

  if (["upload-fails", "cleanup-fails"].includes(failureMode)) {
    return failureMode;
  }

  return null;
}

function getLocalTestPendingGameFailureMode() {
  if (!isLocalTestAuthAvailable()) {
    return null;
  }

  const failureMode = new URLSearchParams(window.location.search).get(
    "testPendingGame",
  );

  if (
    [
      "history-fails",
      "history-load-more-fails",
      "reveal-fails",
      "reveal-fails-once",
    ].includes(failureMode)
  ) {
    return failureMode;
  }

  return null;
}

function getLocalTestPendingGameSeedCount() {
  if (!isLocalTestAuthAvailable()) {
    return 0;
  }

  const testMode = new URLSearchParams(window.location.search).get(
    "testPendingGame",
  );

  return ["history-pages", "history-load-more-fails"].includes(testMode)
    ? 21
    : 0;
}

function getLocalTestPendingGameInviteExpiryMs() {
  if (!isLocalTestAuthAvailable()) {
    return undefined;
  }

  const testMode = new URLSearchParams(window.location.search).get(
    "testPendingGame",
  );

  return testMode === "expire-immediately" ? 0 : undefined;
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

  const actions = document.createElement("div");
  actions.className = "phrase-actions";

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "secondary-button phrase-copy-button";
  copyButton.dataset.copyPhraseIndex = String(phraseIndex);
  copyButton.textContent = "Copy";
  copyButton.ariaLabel = `Copy phrase ${phraseIndex + 1}`;

  actions.append(copyButton);

  if (accountShell.persistenceAuthority.type === "account") {
    const isSaved = isPhraseFavouriteSaved(phraseIndex);
    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "secondary-button phrase-copy-button";
    saveButton.dataset.savePhraseIndex = String(phraseIndex);
    saveButton.textContent = isSaved ? "Saved" : "Save";
    saveButton.disabled = isSaved;
    saveButton.ariaLabel = isSaved
      ? `Phrase ${phraseIndex + 1} saved`
      : `Save phrase ${phraseIndex + 1}`;
    actions.append(saveButton);
  }

  item.append(phraseText, actions);
  return item;
}

function renderFavourites() {
  const isSignedIn = accountShell.persistenceAuthority.type === "account";

  if (!isSignedIn) {
    removeFavouritesPanel();
    return;
  }

  ensureFavouritesPanel();

  const favouriteItems = [
    ...batchFavourites.map(renderBatchFavourite),
    ...phraseFavourites.map(renderPhraseFavourite),
  ];

  favouritesStatus.textContent =
    favouriteItems.length === 0 ? "No favourites yet." : "";
  phraseFavouritesList.replaceChildren(...favouriteItems);
}

function renderPendingGamePanel() {
  const isSignedIn = accountShell.persistenceAuthority.type === "account";

  if (!isSignedIn) {
    removePendingGamePanel();
    return;
  }

  ensurePendingGamePanel();
  renderCreatedPendingGames();
  renderIncomingPendingGameInvites();
  renderMultiplayerDashboardMount();
  renderNotificationDropdown();
}

function ensureSaveBatchButton() {
  if (saveBatchButton) {
    return saveBatchButton;
  }

  saveBatchButton = document.createElement("button");
  saveBatchButton.type = "button";
  saveBatchButton.className = "secondary-button";
  saveBatchButton.dataset.saveBatchButton = "";
  copyStatus.before(saveBatchButton);
  return saveBatchButton;
}

function removeSaveBatchButton() {
  saveBatchButton?.remove();
  saveBatchButton = null;
}

function clearRevealSurface() {
  removeSaveBatchButton();
  phraseList.replaceChildren();
  revealDetails.replaceChildren();
  copyStatus.textContent = "";
}

function ensurePendingGamePanel() {
  if (pendingGamePanel) {
    return pendingGamePanel;
  }

  pendingGamePanel = document.createElement("section");
  pendingGamePanel.className = "pending-game-panel";
  pendingGamePanel.dataset.pendingGamePanel = "";

  const heading = document.createElement("div");
  heading.className = "section-heading";

  const kicker = document.createElement("p");
  kicker.className = "section-kicker";
  kicker.textContent = "Multiplayer";

  const title = document.createElement("h2");
  title.textContent = "Invite by Handle";

  const form = document.createElement("form");
  form.className = "pending-game-form";
  form.dataset.pendingGameForm = "";
  form.addEventListener("submit", createPendingGameInvite);

  const handleLabel = document.createElement("label");
  handleLabel.className = "pending-game-field";
  handleLabel.textContent = "Handle";

  pendingGameHandleInput = document.createElement("input");
  pendingGameHandleInput.type = "text";
  pendingGameHandleInput.autocomplete = "off";
  pendingGameHandleInput.placeholder = "invitee-two";
  pendingGameHandleInput.dataset.pendingGameHandleInput = "";
  pendingGameHandleInput.required = true;

  const rowCountLabel = document.createElement("label");
  rowCountLabel.className = "pending-game-field";
  rowCountLabel.textContent = "Phrases";

  pendingGameRowCountSelect = document.createElement("select");
  pendingGameRowCountSelect.dataset.pendingGameRowCount = "";
  for (const rowCount of [10, 15, 20, 25, 30]) {
    const option = document.createElement("option");
    option.value = String(rowCount);
    option.textContent = String(rowCount);
    option.selected = rowCount === 20;
    pendingGameRowCountSelect.append(option);
  }

  const nudgeTimeoutLabel = document.createElement("label");
  nudgeTimeoutLabel.className = "pending-game-field";
  nudgeTimeoutLabel.textContent = "Nudge after";

  pendingGameNudgeTimeoutSelect = document.createElement("select");
  pendingGameNudgeTimeoutSelect.dataset.pendingGameNudgeTimeout = "";
  for (const nudgeTimeoutHours of [24, 48, 72, 168]) {
    const option = document.createElement("option");
    option.value = String(nudgeTimeoutHours);
    option.textContent = formatNudgeTimeoutHours(nudgeTimeoutHours);
    option.selected = nudgeTimeoutHours === 48;
    pendingGameNudgeTimeoutSelect.append(option);
  }

  const submitButton = document.createElement("button");
  submitButton.className = "primary-button pending-game-submit";
  submitButton.type = "submit";
  submitButton.textContent = "Create invite";

  pendingGameStatus = document.createElement("p");
  pendingGameStatus.className = "pending-game-status";
  pendingGameStatus.dataset.pendingGameStatus = "";
  pendingGameStatus.setAttribute("aria-live", "polite");

  pendingGameSummary = document.createElement("div");
  pendingGameSummary.className = "pending-game-summary";
  pendingGameSummary.dataset.pendingGameSummary = "";
  pendingGameSummary.hidden = true;

  pendingGameIncomingList = document.createElement("div");
  pendingGameIncomingList.className = "pending-game-summary";
  pendingGameIncomingList.dataset.pendingGameIncoming = "";
  pendingGameIncomingList.hidden = true;

  multiplayerDashboardMount = document.createElement("div");
  multiplayerDashboardMount.dataset.multiplayerDashboardMount = "";

  completedMultiplayerHistoryPanel = document.createElement("section");
  completedMultiplayerHistoryPanel.className = "pending-game-summary";
  completedMultiplayerHistoryPanel.dataset.completedMultiplayerHistory = "";
  completedMultiplayerHistoryPanel.hidden = true;

  heading.append(kicker, title);
  handleLabel.append(pendingGameHandleInput);
  rowCountLabel.append(pendingGameRowCountSelect);
  nudgeTimeoutLabel.append(pendingGameNudgeTimeoutSelect);
  form.append(handleLabel, rowCountLabel, nudgeTimeoutLabel, submitButton);
  pendingGamePanel.append(
    heading,
    form,
    pendingGameStatus,
    pendingGameSummary,
    pendingGameIncomingList,
    multiplayerDashboardMount,
    completedMultiplayerHistoryPanel,
  );
  gamePanel.after(pendingGamePanel);
  return pendingGamePanel;
}

function removePendingGamePanel() {
  pendingGamePanel?.remove();
  pendingGamePanel = null;
  pendingGameHandleInput = null;
  pendingGameRowCountSelect = null;
  pendingGameNudgeTimeoutSelect = null;
  pendingGameStatus = null;
  pendingGameSummary = null;
  pendingGameIncomingList = null;
  multiplayerDashboardMount = null;
  completedMultiplayerHistoryPanel = null;
  currentPendingGame = null;
  multiplayerDashboard = createEmptyMultiplayerDashboard();
  completedMultiplayerHistory = createEmptyCompletedMultiplayerHistory();
  inAppNotifications = [];
}

async function createPendingGameInvite(event) {
  event.preventDefault();

  if (accountShell.persistenceAuthority.type !== "account") {
    return;
  }

  pendingGameStatus.textContent = "";

  try {
    const pendingGame = await pendingGameRepository.createPendingGameFromHandle({
      creatorAccountId: accountShell.accountId,
      inviteeHandle: pendingGameHandleInput.value,
      nudgeTimeoutHours: Number(pendingGameNudgeTimeoutSelect.value),
      rowCount: Number(pendingGameRowCountSelect.value),
    });
    const invitee = pendingGame.participants.find(
      (participant) => participant.role === "invitee",
    );

    currentPendingGame = pendingGame;
    createdPendingGames = upsertPendingGame(createdPendingGames, pendingGame);
    pendingGameHandleInput.value = "";
    renderCreatedPendingGames();
    pendingGameStatus.textContent =
      `Game invite created. Waiting for @${invitee.handle} to accept.`;
  } catch (error) {
    currentPendingGame = null;
    pendingGameSummary.hidden = true;
    pendingGameSummary.replaceChildren();
    pendingGameStatus.textContent = getPendingGameFailureMessage(error);
  }
}

function renderCreatedPendingGames() {
  renderPendingGameList({
    container: pendingGameSummary,
    includeCancelActions: true,
    headingText: "Created invites",
    includeResponseActions: false,
    includeStartActions: true,
    pendingGames: createdPendingGames,
  });
}

function renderIncomingPendingGameInvites() {
  renderPendingGameList({
    container: pendingGameIncomingList,
    includeCancelActions: false,
    headingText: "Incoming invites",
    includeResponseActions: true,
    includeStartActions: false,
    pendingGames: incomingPendingGameInvites,
  });
}

function renderPendingGameList({
  container,
  headingText,
  includeCancelActions,
  includeResponseActions,
  includeStartActions,
  pendingGames,
}) {
  if (!container) {
    return;
  }

  if (pendingGames.length === 0) {
    container.hidden = true;
    container.replaceChildren();
    return;
  }

  const heading = document.createElement("p");
  heading.className = "pending-game-row-count";
  heading.textContent = headingText;

  container.hidden = false;
  container.replaceChildren(
    heading,
    ...pendingGames.map((pendingGame) =>
      renderPendingGameCard(pendingGame, {
        includeCancelActions,
        includeResponseActions,
        includeStartActions,
      }),
    ),
  );
}

function renderPendingGameCard(
  pendingGame,
  { includeCancelActions, includeResponseActions, includeStartActions },
) {
  const card = document.createElement("div");
  card.className = "pending-game-card";

  const rowCount = document.createElement("p");
  rowCount.className = "pending-game-row-count";
  rowCount.textContent = `${pendingGame.rowCount} phrases`;

  const state = document.createElement("p");
  state.className = "pending-game-row-count";
  state.textContent = getPendingGameStateLabel(pendingGame);

  const nudgeTimeout = document.createElement("p");
  nudgeTimeout.className = "pending-game-row-count";
  nudgeTimeout.textContent = pendingGame.nudgeTimeoutHours
    ? `Nudge after ${formatNudgeTimeoutHours(pendingGame.nudgeTimeoutHours)}`
    : "";

  const participantList = document.createElement("ul");
  participantList.className = "pending-game-participants";
  participantList.replaceChildren(
    ...pendingGame.participants.map(renderPendingGameParticipant),
  );

  card.append(
    rowCount,
    state,
    ...(pendingGame.nudgeTimeoutHours ? [nudgeTimeout] : []),
    participantList,
  );

  const invitee = pendingGame.participants.find(
    (participant) => participant.role === "invitee",
  );
  if (
    includeResponseActions &&
    pendingGame.status === "pending" &&
    invitee?.inviteStatus === "pending"
  ) {
    card.append(renderPendingGameResponseActions(pendingGame));
  }
  if (includeStartActions && isPendingGameReadyToStart(pendingGame)) {
    card.append(renderPendingGameStartActions(pendingGame));
  }
  if (includeCancelActions && isPendingGameCancellable(pendingGame)) {
    card.append(renderPendingGameCancelActions(pendingGame));
  }

  return card;
}

function isPendingGameReadyToStart(pendingGame) {
  return (
    pendingGame.status === "pending" &&
    pendingGame.participants.every(
      (participant) => participant.inviteStatus === "accepted",
    )
  );
}

function isPendingGameCancellable(pendingGame) {
  if (!["pending", "started"].includes(pendingGame.status)) {
    return false;
  }

  if (!pendingGame.startedGameId) {
    return true;
  }

  return !multiplayerDashboard.completedBatches.some(
    (batch) => batch.id === pendingGame.startedGameId && batch.revealed,
  );
}

function getPendingGameStateLabel(pendingGame) {
  if (pendingGame.status === "started") {
    return "Started";
  }

  if (pendingGame.status === "cancelled") {
    return "Cancelled";
  }

  if (pendingGame.status === "expired") {
    return "Expired";
  }

  return "Waiting for responses";
}

function formatNudgeTimeoutHours(nudgeTimeoutHours) {
  if (nudgeTimeoutHours === 24) {
    return "1 day";
  }

  if (nudgeTimeoutHours % 24 === 0) {
    return `${nudgeTimeoutHours / 24} days`;
  }

  return `${nudgeTimeoutHours} hours`;
}

function renderPendingGameCancelActions(pendingGame) {
  const invitee = pendingGame.participants.find(
    (participant) => participant.role === "invitee",
  );
  const actions = document.createElement("div");
  actions.className = "pending-game-actions";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "danger-button";
  cancelButton.textContent = "Cancel game";
  cancelButton.setAttribute(
    "aria-label",
    `Cancel game with @${invitee.handle}`,
  );
  cancelButton.addEventListener("click", () => {
    void cancelCreatedGame(pendingGame.id);
  });

  actions.append(cancelButton);
  return actions;
}

function renderPendingGameResponseActions(pendingGame) {
  const creator = pendingGame.participants.find(
    (participant) => participant.role === "creator",
  );
  const actions = document.createElement("div");
  actions.className = "pending-game-actions";

  const acceptButton = document.createElement("button");
  acceptButton.type = "button";
  acceptButton.className = "secondary-button";
  acceptButton.textContent = "Accept";
  acceptButton.setAttribute(
    "aria-label",
    `Accept invite from @${creator.handle}`,
  );
  acceptButton.addEventListener("click", () => {
    void respondToPendingGameInvite(pendingGame.id, "accept");
  });

  const declineButton = document.createElement("button");
  declineButton.type = "button";
  declineButton.className = "danger-button";
  declineButton.textContent = "Decline";
  declineButton.setAttribute(
    "aria-label",
    `Decline invite from @${creator.handle}`,
  );
  declineButton.addEventListener("click", () => {
    void respondToPendingGameInvite(pendingGame.id, "decline");
  });

  actions.append(acceptButton, declineButton);
  return actions;
}

function renderPendingGameStartActions(pendingGame) {
  const invitee = pendingGame.participants.find(
    (participant) => participant.role === "invitee",
  );
  const actions = document.createElement("div");
  actions.className = "pending-game-actions";

  const startButton = document.createElement("button");
  startButton.type = "button";
  startButton.className = "secondary-button";
  startButton.textContent = "Start game";
  startButton.setAttribute(
    "aria-label",
    `Start game with @${invitee.handle}`,
  );
  startButton.addEventListener("click", () => {
    void startPendingGame(pendingGame.id);
  });

  actions.append(startButton);
  return actions;
}

function renderPendingGameParticipant(participant) {
  const item = document.createElement("li");

  const handle = document.createElement("span");
  handle.textContent = `@${participant.handle}`;

  const status = document.createElement("strong");
  status.textContent = getPendingGameParticipantStatusLabel(participant);

  item.append(handle, status);
  return item;
}

function getPendingGameParticipantStatusLabel(participant) {
  if (participant.inviteStatus === "accepted") {
    return "Accepted";
  }

  if (participant.inviteStatus === "declined") {
    return "Declined";
  }

  return "Invited";
}

async function respondToPendingGameInvite(pendingGameId, response) {
  if (accountShell.persistenceAuthority.type !== "account") {
    return;
  }

  pendingGameStatus.textContent = "";

  try {
    const pendingGame =
      response === "accept"
        ? await pendingGameRepository.acceptPendingGameInvite({
            accountId: accountShell.accountId,
            pendingGameId,
          })
        : await pendingGameRepository.declinePendingGameInvite({
            accountId: accountShell.accountId,
            pendingGameId,
          });

    if (
      incomingPendingGameInvites.some((candidate) => candidate.id === pendingGame.id) ||
      isCurrentAccountPendingGameParticipant(pendingGame, "invitee")
    ) {
      incomingPendingGameInvites = upsertPendingGame(
        incomingPendingGameInvites,
        pendingGame,
      );
    }
    if (
      createdPendingGames.some((candidate) => candidate.id === pendingGame.id) ||
      isCurrentAccountPendingGameParticipant(pendingGame, "creator")
    ) {
      createdPendingGames = upsertPendingGame(createdPendingGames, pendingGame);
    }
    renderPendingGamePanel();
    pendingGameStatus.textContent =
      response === "accept" ? "Game invite accepted." : "Game invite declined.";
  } catch {
    pendingGameStatus.textContent = "Game invite could not be updated. Try again.";
  }
}

async function cancelCreatedGame(pendingGameId) {
  if (accountShell.persistenceAuthority.type !== "account") {
    return;
  }

  pendingGameStatus.textContent = "";

  try {
    const pendingGame = await pendingGameRepository.cancelCreatedGame({
      creatorAccountId: accountShell.accountId,
      pendingGameId,
    });
    createdPendingGames = upsertPendingGame(createdPendingGames, pendingGame);
    await loadMultiplayerDashboard();
    renderPendingGamePanel();
    pendingGameStatus.textContent = "Game cancelled.";
  } catch {
    pendingGameStatus.textContent = "Game could not be cancelled. Try again.";
  }
}

async function startPendingGame(pendingGameId) {
  if (accountShell.persistenceAuthority.type !== "account") {
    return;
  }

  pendingGameStatus.textContent = "";

  try {
    const startedGame = await pendingGameRepository.startPendingGame({
      creatorAccountId: accountShell.accountId,
      pendingGameId,
    });
    createdPendingGames = upsertPendingGame(
      createdPendingGames,
      createPendingGameFromStartedGame(startedGame),
    );
    await loadMultiplayerDashboard();
    renderPendingGamePanel();
    pendingGameStatus.textContent =
      multiplayerDashboard.awaitingYourEntries.length > 0
        ? "Game started. Your turn is ready."
        : "Game started. Waiting for another participant.";
  } catch {
    pendingGameStatus.textContent = "Game could not be started. Try again.";
  }
}

function createPendingGameFromStartedGame(startedGame) {
  return {
    id: startedGame.pendingGameId,
    startedGameId: startedGame.id,
    status: startedGame.status,
    templateId: startedGame.templateId,
    rowCount: startedGame.rowCount,
    participants: startedGame.participants.map((participant) => ({
      ...participant,
      inviteStatus: "accepted",
    })),
  };
}

function renderMultiplayerDashboardMount() {
  multiplayerDashboardMount.replaceChildren(renderMultiplayerDashboard());
}

function renderMultiplayerDashboard() {
  const dashboard = document.createElement("div");
  dashboard.className = "multiplayer-dashboard";
  dashboard.dataset.multiplayerDashboard = "";
  const completedBucket = renderMultiplayerBucket({
    headingText: "Batches completed",
    items: multiplayerDashboard.completedBatches,
    renderItem: renderCompletedMultiplayerBatch,
  });
  const historyButton = document.createElement("button");
  historyButton.className = "secondary-button";
  historyButton.type = "button";
  historyButton.textContent = "View all completed batches";
  historyButton.addEventListener("click", () => {
    void openCompletedMultiplayerHistory();
  });
  completedBucket.append(historyButton);

  dashboard.replaceChildren(
    renderMultiplayerBucket({
      headingText: "Awaiting your entries",
      items: multiplayerDashboard.awaitingYourEntries,
      renderItem: renderAwaitingYourEntries,
    }),
    renderMultiplayerBucket({
      headingText: "Awaiting other player entries",
      items: multiplayerDashboard.awaitingOtherPlayerEntries,
      renderItem: renderAwaitingOtherPlayerEntries,
    }),
    completedBucket,
  );
  return dashboard;
}

function renderMultiplayerBucket({ headingText, items, renderItem }) {
  const section = document.createElement("section");
  section.className = "multiplayer-bucket";
  const heading = document.createElement("h3");
  heading.textContent = headingText;
  section.append(heading);
  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "pending-game-row-count";
    empty.textContent = "Nothing here yet.";
    section.append(empty);
    return section;
  }
  section.append(...items.map(renderItem));
  return section;
}

function renderAwaitingYourEntries(gameSummary) {
  const card = document.createElement("div");
  card.className = "pending-game-card";
  card.append(renderMultiplayerParticipantSummary(gameSummary));
  card.append(renderMultiplayerSectionForm(gameSummary.currentSection));
  return card;
}

function renderAwaitingOtherPlayerEntries(gameSummary) {
  const card = document.createElement("div");
  card.className = "pending-game-card";
  card.append(renderMultiplayerParticipantSummary(gameSummary));
  const waiting = document.createElement("p");
  waiting.className = "pending-game-row-count";
  waiting.textContent = "Awaiting other player entries.";
  card.append(waiting);
  return card;
}

function renderCompletedMultiplayerBatch(batchSummary) {
  const card = document.createElement("div");
  card.className = "pending-game-card";
  card.append(renderMultiplayerParticipantSummary(batchSummary));
  if (!batchSummary.revealed) {
    const revealButton = document.createElement("button");
    revealButton.className = "secondary-button";
    revealButton.type = "button";
    revealButton.textContent = "Reveal phrases";
    revealButton.addEventListener("click", () => {
      void revealMultiplayerBatch(batchSummary.id);
    });
    card.append(revealButton);
    return card;
  }
  const heading = document.createElement("h3");
  heading.textContent = "Your crazy phrases";
  const list = document.createElement("ol");
  list.className = "phrase-list";
  list.replaceChildren(
    ...batchSummary.phrases.map((phrase) => {
      const item = document.createElement("li");
      item.textContent = phrase;
      return item;
    }),
  );
  card.append(heading, list);
  return card;
}

async function openCompletedMultiplayerHistory() {
  if (accountShell.persistenceAuthority.type !== "account") {
    return;
  }

  pendingGameStatus.textContent = "";
  multiplayerDashboardMount.hidden = true;
  completedMultiplayerHistoryPanel.hidden = false;
  renderCompletedMultiplayerHistoryLoading();

  try {
    completedMultiplayerHistory = await loadCompletedMultiplayerHistoryPage();
    renderCompletedMultiplayerHistory();
  } catch {
    renderCompletedMultiplayerHistoryError();
  }
}

async function loadCompletedMultiplayerHistoryPage({ cursor } = {}) {
  return pendingGameRepository.listCompletedMultiplayerHistory({
    accountId: accountShell.accountId,
    ...(cursor ? { cursor } : {}),
    pageSize: COMPLETED_MULTIPLAYER_HISTORY_PAGE_SIZE,
  });
}

async function loadMoreCompletedMultiplayerHistory() {
  if (
    !completedMultiplayerHistory.hasMore ||
    !completedMultiplayerHistory.nextCursor
  ) {
    return;
  }

  const existingBatches = completedMultiplayerHistory.batches;
  completedMultiplayerHistory = {
    ...completedMultiplayerHistory,
    loadMoreError: false,
    loadingMore: true,
  };
  renderCompletedMultiplayerHistory();

  try {
    const nextPage = await loadCompletedMultiplayerHistoryPage({
      cursor: completedMultiplayerHistory.nextCursor,
    });
    completedMultiplayerHistory = {
      ...nextPage,
      batches: [...existingBatches, ...nextPage.batches],
    };
  } catch {
    completedMultiplayerHistory = {
      ...completedMultiplayerHistory,
      batches: existingBatches,
      loadMoreError: true,
      loadingMore: false,
    };
  }

  renderCompletedMultiplayerHistory();
}

function showMultiplayerDashboard() {
  completedMultiplayerHistoryPanel.hidden = true;
  multiplayerDashboardMount.hidden = false;
}

function renderCompletedMultiplayerHistoryLoading() {
  renderCompletedMultiplayerHistoryShell([
    createPendingGameNote("Loading completed batches..."),
  ]);
}

function renderCompletedMultiplayerHistoryError() {
  const retryButton = document.createElement("button");
  retryButton.className = "secondary-button";
  retryButton.type = "button";
  retryButton.textContent = "Retry";
  retryButton.addEventListener("click", () => {
    void openCompletedMultiplayerHistory();
  });

  renderCompletedMultiplayerHistoryShell([
    createPendingGameNote("Completed batches could not be loaded. Try again."),
    retryButton,
  ]);
}

function renderCompletedMultiplayerHistory() {
  const children =
    completedMultiplayerHistory.batches.length === 0
      ? [createPendingGameNote("No completed multiplayer batches yet.")]
      : completedMultiplayerHistory.batches.map(renderCompletedHistoryBatch);

  if (completedMultiplayerHistory.loadMoreError) {
    children.push(
      createPendingGameNote(
        "More completed batches could not be loaded. Try again.",
      ),
    );
  }
  if (completedMultiplayerHistory.hasMore) {
    children.push(renderCompletedHistoryLoadMore());
  }

  renderCompletedMultiplayerHistoryShell(children);
}

function renderCompletedHistoryLoadMore() {
  const loadMoreButton = document.createElement("button");
  loadMoreButton.className = "secondary-button";
  loadMoreButton.type = "button";
  loadMoreButton.textContent = completedMultiplayerHistory.loadingMore
    ? "Loading more..."
    : "Load more";
  loadMoreButton.disabled = Boolean(completedMultiplayerHistory.loadingMore);
  loadMoreButton.addEventListener("click", () => {
    void loadMoreCompletedMultiplayerHistory();
  });
  return loadMoreButton;
}

function renderCompletedMultiplayerHistoryShell(children) {
  const heading = document.createElement("h3");
  heading.textContent = "Completed multiplayer history";

  const actions = document.createElement("div");
  actions.className = "pending-game-actions";

  const backButton = document.createElement("button");
  backButton.className = "secondary-button";
  backButton.type = "button";
  backButton.textContent = "Back to dashboard";
  backButton.addEventListener("click", showMultiplayerDashboard);
  actions.append(backButton);

  completedMultiplayerHistoryPanel.replaceChildren(heading, actions, ...children);
}

function renderCompletedHistoryBatch(batchSummary) {
  const card = document.createElement("div");
  card.className = "pending-game-card";
  card.append(renderMultiplayerParticipantSummary(batchSummary));

  if (!batchSummary.revealed) {
    const revealButton = document.createElement("button");
    revealButton.className = "secondary-button";
    revealButton.type = "button";
    revealButton.textContent = "Reveal phrases";
    revealButton.addEventListener("click", () => {
      void revealMultiplayerBatch(batchSummary.id);
    });
    card.append(createPendingGameNote("Not revealed yet."), revealButton);
    return card;
  }

  const list = document.createElement("ol");
  list.className = "phrase-list";
  list.replaceChildren(
    ...batchSummary.phrases.map((phrase) => {
      const item = document.createElement("li");
      item.textContent = phrase;
      return item;
    }),
  );
  card.append(list);
  return card;
}

function createPendingGameNote(text) {
  const note = document.createElement("p");
  note.className = "pending-game-row-count";
  note.textContent = text;
  return note;
}

function renderMultiplayerParticipantSummary(batchSummary) {
  const summary = document.createElement("p");
  summary.className = "pending-game-row-count";
  summary.textContent = `Batch with ${batchSummary.participants
    .map((participant) => `@${participant.handle}`)
    .join(" and ")}.`;
  return summary;
}

function renderMultiplayerSectionForm(currentSection) {
  const form = document.createElement("form");
  form.className = "started-game-turn-form";
  form.addEventListener("submit", (event) => {
    void submitMultiplayerSection(event, currentSection);
  });

  const heading = document.createElement("div");
  heading.className = "section-heading";

  const kicker = document.createElement("p");
  kicker.className = "section-kicker";
  kicker.textContent =
    `Section ${currentSection.sectionIndex + 1} of ${currentSection.sectionCount}`;

  const title = document.createElement("h3");
  title.textContent = getMultiplayerSectionTitle(currentSection.entryKind);

  const list = document.createElement("div");
  list.className = "started-game-turn-list";
  list.replaceChildren(
    ...currentSection.rows.map((row) =>
      renderMultiplayerSectionRow(row, currentSection),
    ),
  );

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.className = "primary-button";
  submitButton.textContent = "Submit section";

  heading.append(kicker, title);
  form.append(heading, list, submitButton);
  return form;
}

function renderMultiplayerSectionRow(row, currentSection) {
  const label = document.createElement("label");
  label.className = "started-game-turn-row";

  const text = document.createElement("span");
  text.textContent = `Phrase ${row.rowIndex + 1}`;

  const input = document.createElement("input");
  input.type = "text";
  input.autocomplete = "off";
  input.required = true;
  input.value = row.value;
  input.dataset.multiplayerSectionInput = String(row.rowIndex);
  input.placeholder =
    currentSection.entryKind === "adjective" ? "brisk" : "teapot";

  label.append(text, input);
  return label;
}

function renderNotificationDropdown() {
  updateNotificationToggle();
  notificationPanel.replaceChildren(
    ...inAppNotifications.map((notification) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "notification-item";
      item.textContent = `${getNotificationMessage(notification)} ${
        notification.status === "unread" ? "Unread" : "Read"
      }`;
      item.addEventListener("click", () => {
        void markNotificationRead(notification.id);
      });
      return item;
    }),
  );
}

function updateNotificationToggle() {
  const unreadCount = inAppNotifications.filter(
    (notification) => notification.status === "unread",
  ).length;
  const label =
    unreadCount === 0
      ? "Notifications"
      : `Notifications, ${unreadCount} unread`;
  notificationToggle.setAttribute("aria-label", label);
  notificationToggle.dataset.unreadCount = String(unreadCount);
}

function getMultiplayerSectionTitle(entryKind) {
  return entryKind === "adjective" ? "Fill these adjectives" : "Fill these nouns";
}

async function submitMultiplayerSection(event, currentSection) {
  event.preventDefault();
  const form = event.currentTarget;
  const entries = [...form.querySelectorAll("[data-multiplayer-section-input]")]
    .map((input) => ({
      rowIndex: Number(input.dataset.multiplayerSectionInput),
      value: input.value,
    }));

  pendingGameStatus.textContent = "";

  try {
    await pendingGameRepository.submitMultiplayerSection({
      accountId: accountShell.accountId,
      entries,
      sectionId: currentSection.id,
    });
    await refreshMultiplayerSurfaces();
  } catch {
    pendingGameStatus.textContent = "Section could not be submitted. Try again.";
  }
}

async function revealMultiplayerBatch(gameId) {
  pendingGameStatus.textContent = "";

  try {
    const revealed = await pendingGameRepository.revealMultiplayerBatch({
      accountId: accountShell.accountId,
      gameId,
    });
    multiplayerDashboard.completedBatches = multiplayerDashboard.completedBatches.map(
      (batch) => batch.id === gameId ? { ...batch, ...revealed } : batch,
    );
    completedMultiplayerHistory.batches = completedMultiplayerHistory.batches.map(
      (batch) => batch.id === gameId ? { ...batch, ...revealed } : batch,
    );
    renderPendingGamePanel();
    if (completedMultiplayerHistoryPanel && !completedMultiplayerHistoryPanel.hidden) {
      renderCompletedMultiplayerHistory();
    }
  } catch {
    try {
      await loadMultiplayerDashboard();
      renderPendingGamePanel();
    } catch {
      // Keep the existing dashboard visible if recovery loading also fails.
    }
    pendingGameStatus.textContent = "Phrases could not be revealed. Try again.";
  }
}

async function refreshMultiplayerSurfaces() {
  await loadMultiplayerDashboard();
  renderPendingGamePanel();
}

async function markUnreadNotificationsRead() {
  await Promise.all(
    inAppNotifications
      .filter((notification) => notification.status === "unread")
      .map((notification) => markNotificationRead(notification.id)),
  );
}

async function markNotificationRead(notificationId) {
  const notification = inAppNotifications.find(
    (candidate) => candidate.id === notificationId,
  );
  if (!notification || notification.status === "read") {
    return;
  }

  try {
    const updatedNotification =
      typeof pendingGameRepository.markInAppNotificationRead === "function"
        ? await pendingGameRepository.markInAppNotificationRead({
            accountId: accountShell.accountId,
            notificationId,
          })
        : { ...notification, status: "read" };
    inAppNotifications = inAppNotifications.map((candidate) =>
      candidate.id === notificationId
        ? { ...candidate, ...updatedNotification, status: "read" }
        : candidate,
    );
    renderNotificationDropdown();
  } catch {
    pendingGameStatus.textContent = "Notification could not be updated. Try again.";
  }
}

function getNotificationMessage(notification) {
  return notification.message.replace(
    /^A batch is complete with (.+)\.$/,
    "Batch with $1 is now complete and available to reveal.",
  );
}

async function loadPendingGameLists() {
  if (accountShell.persistenceAuthority.type !== "account") {
    createdPendingGames = [];
    incomingPendingGameInvites = [];
    multiplayerDashboard = createEmptyMultiplayerDashboard();
    completedMultiplayerHistory = createEmptyCompletedMultiplayerHistory();
    inAppNotifications = [];
    return;
  }

  try {
    [createdPendingGames, incomingPendingGameInvites] = await Promise.all([
      pendingGameRepository.listCreatedPendingGames({
        accountId: accountShell.accountId,
      }),
      pendingGameRepository.listIncomingPendingGameInvites({
        accountId: accountShell.accountId,
      }),
    ]);
    await loadMultiplayerDashboard();
  } catch {
    createdPendingGames = [];
    incomingPendingGameInvites = [];
    multiplayerDashboard = createEmptyMultiplayerDashboard();
    completedMultiplayerHistory = createEmptyCompletedMultiplayerHistory();
    inAppNotifications = [];
    authMessage.textContent = "Game invites could not be loaded. Try again.";
  }
}

async function loadMultiplayerDashboard() {
  if (accountShell.persistenceAuthority.type !== "account") {
    multiplayerDashboard = createEmptyMultiplayerDashboard();
    inAppNotifications = [];
    return;
  }

  [multiplayerDashboard, inAppNotifications] = await Promise.all([
    pendingGameRepository.listMultiplayerDashboard({
      accountId: accountShell.accountId,
    }),
    pendingGameRepository.listInAppNotifications({
      accountId: accountShell.accountId,
    }),
  ]);
}

function createEmptyMultiplayerDashboard() {
  return {
    awaitingYourEntries: [],
    awaitingOtherPlayerEntries: [],
    completedBatches: [],
  };
}

function createEmptyCompletedMultiplayerHistory() {
  return {
    batches: [],
    hasMore: false,
    nextCursor: null,
  };
}

function upsertPendingGame(pendingGames, pendingGame) {
  const existingIndex = pendingGames.findIndex(
    (candidate) => candidate.id === pendingGame.id,
  );

  if (existingIndex < 0) {
    return [pendingGame, ...pendingGames];
  }

  return pendingGames.map((candidate, index) =>
    index === existingIndex ? pendingGame : candidate,
  );
}

function isCurrentAccountPendingGameParticipant(pendingGame, role) {
  return pendingGame.participants.some(
    (participant) =>
      participant.role === role &&
      participant.handle === accountShell.profile?.handle,
  );
}

function ensureFavouritesPanel() {
  if (favouritesPanel) {
    return favouritesPanel;
  }

  favouritesPanel = document.createElement("section");
  favouritesPanel.className = "favourites-panel";
  favouritesPanel.dataset.favouritesPanel = "";
  favouritesPanel.addEventListener("click", handleFavouritesPanelClick);

  const heading = document.createElement("div");
  heading.className = "section-heading";

  const kicker = document.createElement("p");
  kicker.className = "section-kicker";
  kicker.textContent = "Favourites";

  const title = document.createElement("h2");
  title.textContent = "Saved favourites";

  favouritesStatus = document.createElement("p");
  favouritesStatus.className = "favourites-status";
  favouritesStatus.dataset.favouritesStatus = "";
  favouritesStatus.setAttribute("aria-live", "polite");

  phraseFavouritesList = document.createElement("ol");
  phraseFavouritesList.className = "favourites-list";
  phraseFavouritesList.dataset.phraseFavouritesList = "";

  heading.append(kicker, title);
  favouritesPanel.append(heading, favouritesStatus, phraseFavouritesList);
  (pendingGamePanel ?? gamePanel).after(favouritesPanel);
  return favouritesPanel;
}

function removeFavouritesPanel() {
  favouritesPanel?.remove();
  favouritesPanel = null;
  favouritesStatus = null;
  phraseFavouritesList = null;
}

function handleFavouritesPanelClick(event) {
  const phraseRemoveButton = event.target.closest(
    "[data-remove-phrase-favourite-id]",
  );

  if (phraseRemoveButton) {
    void removePhraseFavourite(phraseRemoveButton.dataset.removePhraseFavouriteId);
    return;
  }

  const batchRemoveButton = event.target.closest(
    "[data-remove-batch-favourite-id]",
  );

  if (batchRemoveButton) {
    void removeBatchFavourite(batchRemoveButton.dataset.removeBatchFavouriteId);
  }
}

function renderPhraseFavourite(record) {
  const item = document.createElement("li");

  const phraseText = document.createElement("span");
  phraseText.dataset.favouritePhraseText = "";
  phraseText.textContent = record.favourite.phraseText;

  const actions = document.createElement("div");
  actions.className = "favourite-actions";

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "secondary-button favourite-remove-button";
  removeButton.dataset.removePhraseFavouriteId = record.id;
  removeButton.textContent = "Remove";
  removeButton.ariaLabel = `Remove phrase favourite: ${record.favourite.phraseText}`;

  actions.append(removeButton);
  item.append(phraseText, actions);
  return item;
}

function renderBatchFavourite(record) {
  const item = document.createElement("li");
  const content = document.createElement("div");

  const title = document.createElement("h3");
  title.className = "batch-favourite-title";
  title.textContent = "Batch Favourite";

  const detail = document.createElement("p");
  detail.className = "batch-favourite-detail";
  detail.textContent = `${record.favourite.rowCount} phrases`;

  const list = document.createElement("ol");
  list.className = "batch-favourite-phrases";
  list.replaceChildren(
    ...record.favourite.phrases.map((phrase) => {
      const phraseItem = document.createElement("li");
      phraseItem.textContent = phrase;
      return phraseItem;
    }),
  );

  const actions = document.createElement("div");
  actions.className = "favourite-actions";

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "secondary-button favourite-remove-button";
  removeButton.dataset.removeBatchFavouriteId = record.id;
  removeButton.textContent = "Remove";
  removeButton.ariaLabel = "Remove batch favourite";

  content.append(title, detail, list);
  actions.append(removeButton);
  item.append(content, actions);
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

async function startAgain() {
  const rowCount = game.rowCount;

  if (accountShell.persistenceAuthority.type === "account") {
    try {
      await signedInGameSession.deleteCurrentGame({
        accountId: accountShell.accountId,
      });
      authMessage.textContent = "";
    } catch {
      authMessage.textContent =
        "Account-backed progress could not be replaced. Keep this tab open and try again.";
      renderGame();
      return;
    }
  }

  game = createCurrentModeSoloGame({ rowCount });
  void persistGame();
  renderGame();
  renderFavourites();
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

async function savePhraseFavourite(rowIndex) {
  if (accountShell.persistenceAuthority.type !== "account") {
    return;
  }

  try {
    const favourite = createPhraseFavouriteSnapshot(game, {
      rowIndex,
      wordBank,
    });
    const savedFavourite = await privateFavouritesRepository.savePhraseFavourite({
      accountId: accountShell.accountId,
      favourite,
    });
    phraseFavourites = upsertFavouriteRecord(phraseFavourites, savedFavourite);
    renderGame();
    renderFavourites();
    copyStatus.textContent = "Phrase favourite saved.";
  } catch {
    copyStatus.textContent = "Phrase favourite could not be saved. Try again.";
  }
}

async function saveBatchFavourite() {
  if (accountShell.persistenceAuthority.type !== "account") {
    return;
  }

  try {
    const favourite = createBatchFavouriteSnapshot(game, {
      wordBank,
    });
    const savedFavourite = await privateFavouritesRepository.saveBatchFavourite({
      accountId: accountShell.accountId,
      favourite,
    });
    batchFavourites = upsertFavouriteRecord(batchFavourites, savedFavourite);
    renderGame();
    renderFavourites();
    copyStatus.textContent = "Batch favourite saved.";
  } catch {
    copyStatus.textContent = "Batch favourite could not be saved. Try again.";
  }
}

async function removePhraseFavourite(favouriteId) {
  if (accountShell.persistenceAuthority.type !== "account") {
    return;
  }

  try {
    await privateFavouritesRepository.removePhraseFavourite({
      accountId: accountShell.accountId,
      favouriteId,
    });
    phraseFavourites = phraseFavourites.filter(
      (record) => record.id !== favouriteId,
    );
    renderGame();
    renderFavourites();
    if (hasSavedFavourites()) {
      favouritesStatus.textContent = "Phrase favourite removed.";
    }
  } catch {
    favouritesStatus.textContent =
      "Phrase favourite could not be removed. Try again.";
  }
}

async function removeBatchFavourite(favouriteId) {
  if (accountShell.persistenceAuthority.type !== "account") {
    return;
  }

  try {
    await privateFavouritesRepository.removeBatchFavourite({
      accountId: accountShell.accountId,
      favouriteId,
    });
    batchFavourites = batchFavourites.filter((record) => record.id !== favouriteId);
    renderGame();
    renderFavourites();
    if (hasSavedFavourites()) {
      favouritesStatus.textContent = "Batch favourite removed.";
    }
  } catch {
    favouritesStatus.textContent =
      "Batch favourite could not be removed. Try again.";
  }
}

function hasSavedFavourites() {
  return phraseFavourites.length + batchFavourites.length > 0;
}

function upsertFavouriteRecord(records, record) {
  const existingIndex = records.findIndex((candidate) => candidate.id === record.id);

  if (existingIndex === -1) {
    return [record, ...records];
  }

  return records.map((candidate, index) =>
    index === existingIndex ? record : candidate,
  );
}

function isPhraseFavouriteSaved(phraseIndex) {
  if (accountShell.persistenceAuthority.type !== "account" || !game.revealed) {
    return false;
  }

  const favourite = createPhraseFavouriteSnapshot(game, {
    rowIndex: phraseIndex,
    wordBank,
  });

  return phraseFavourites.some((record) =>
    areFavouriteSnapshotsEqual(record.favourite, favourite),
  );
}

function isBatchFavouriteSaved() {
  if (accountShell.persistenceAuthority.type !== "account" || !game.revealed) {
    return false;
  }

  const favourite = createBatchFavouriteSnapshot(game, {
    wordBank,
  });

  return batchFavourites.some((record) =>
    areFavouriteSnapshotsEqual(record.favourite, favourite),
  );
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

    const hostedAccountProfileRepository =
      createSupabaseAccountProfileRepository({ supabase });
    const hostedAvatarStorageRepository =
      createSupabaseAvatarStorageRepository({ supabase });

    hostedAuthSession = createSupabaseAuthSession({
      profileRepository: hostedAccountProfileRepository,
      supabase,
    });
    accountProfileRepository = hostedAccountProfileRepository;
    avatarStorageRepository = hostedAvatarStorageRepository;
    hostedAuthAvailable = true;
    signedInGameSession = createSignedInGameSession({
      repository: createSupabaseSignedInSoloGameRepository({ supabase }),
    });
    privateFavouritesRepository = createSupabasePrivateFavouritesRepository({
      supabase,
    });
    pendingGameRepository = createSupabasePendingGameRepository({ supabase });

    await applyAccountShell(await hostedAuthSession.loadAccountShell());
  } catch {
    hostedAuthSession = null;
    hostedAuthAvailable = false;
    signedInGameSession = localTestSignedInGameSession;
    privateFavouritesRepository = localTestPrivateFavouritesRepository;
    pendingGameRepository = localTestPendingGameRepository;
    accountProfileRepository = localTestAccountProfileRepository;
    avatarStorageRepository = localTestAvatarStorageRepository;
    authMessage.textContent = "Sign in unavailable.";
    renderAccountShell(accountShell);
  }
}

async function applyAccountShell(shell) {
  accountShell = shell;

  if (accountShell.persistenceAuthority.type === "account") {
    await loadSignedInCurrentGame();
    await loadPhraseFavourites();
    await loadBatchFavourites();
    await loadPendingGameLists();
  } else {
    signedInGameSession.reset();
    game =
      loadCurrentAnonymousSoloGame(window.localStorage) ??
      createAnonymousSoloGame({ rowCount: 20 });
    phraseFavourites = [];
    batchFavourites = [];
    createdPendingGames = [];
    incomingPendingGameInvites = [];
    multiplayerDashboard = createEmptyMultiplayerDashboard();
    inAppNotifications = [];
    hidePersistenceRecovery();
  }

  renderAccountShell(accountShell);
  renderGame();
  renderPendingGamePanel();
  renderFavourites();
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
  phraseFavourites = [];
  batchFavourites = [];
  createdPendingGames = [];
  incomingPendingGameInvites = [];
  hidePersistenceRecovery();
  renderAccountShell(accountShell);
  renderGame();
  renderPendingGamePanel();
  renderFavourites();
}

async function loadPhraseFavourites() {
  if (accountShell.persistenceAuthority.type !== "account") {
    phraseFavourites = [];
    renderFavourites();
    return;
  }

  try {
    phraseFavourites = await privateFavouritesRepository.listPhraseFavourites({
      accountId: accountShell.accountId,
    });
  } catch {
    phraseFavourites = [];
    authMessage.textContent = "Private favourites could not be loaded. Try again.";
  }

  renderFavourites();
}

async function loadBatchFavourites() {
  if (accountShell.persistenceAuthority.type !== "account") {
    batchFavourites = [];
    renderFavourites();
    return;
  }

  try {
    batchFavourites = await privateFavouritesRepository.listBatchFavourites({
      accountId: accountShell.accountId,
    });
  } catch {
    batchFavourites = [];
    authMessage.textContent = "Private favourites could not be loaded. Try again.";
  }

  renderFavourites();
}

function showPersistenceRecovery(message) {
  persistenceRecoveryMessage.textContent = message;
  persistenceRecovery.hidden = false;
}

function hidePersistenceRecovery() {
  persistenceRecovery.hidden = true;
  persistenceRecoveryMessage.textContent = "";
}

function getPendingGameFailureMessage(error) {
  if (error instanceof Error && /own handle/i.test(error.message)) {
    return "Choose another Handle; this one belongs to you.";
  }

  if (error instanceof Error && /handle/i.test(error.message)) {
    return "Handle not found. Check the Handle and try again.";
  }

  return "Game invite could not be created. Try again.";
}

function createLocalTestPendingGameId() {
  return `local-pending-game-${Date.now()}`;
}
