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
  AVATAR_CROP_OUTPUT_SIZE,
  DEFAULT_AVATAR_CROP,
  adjustAvatarCrop,
  calculateAvatarCropLayout,
  createDerivedAvatarFile,
  normaliseAvatarCrop,
} from "./avatar-crop.js?v=__ASSET_VERSION__";
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
  createFavouriteRowModel,
  getBatchFavouriteCopyText,
  getPhraseFavouriteCopyText,
} from "./favourites-view-model.js?v=__ASSET_VERSION__";
import {
  createLocalTestPendingGameRepository,
  createSupabasePendingGameRepository,
} from "./pending-game.js?v=__ASSET_VERSION__";
import { createSignedInRouteHandoff } from "./signed-in-route-handoff.js?v=__ASSET_VERSION__";

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
  cropFailure: "Avatar could not be cropped. Try again.",
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
const headerActions = document.querySelector(".header-actions");
let notificationShell = document.querySelector("[data-notification-shell]");
let notificationToggle = document.querySelector("[data-notification-toggle]");
let notificationPanel = document.querySelector("[data-notification-panel]");
let notificationPanelFeedbackMessage = "";
let notificationPanelOrder = [];
const primaryNav = document.querySelector("[data-primary-nav]");
const playMenuRoot = document.querySelector("[data-play-menu-root]");
const playMenuToggle = document.querySelector("[data-play-menu-toggle]");
const playMenu = document.querySelector("[data-play-menu]");
const routeGate = document.querySelector("[data-route-gate]");
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
const ROUTES = {
  playSolo: "#/play/solo",
  playMultiplayer: "#/play/multiplayer",
  favourites: "#/favourites",
};
const signedInRouteReconciliationDelaysMs = [0, 100, 500, 1500, 3000, 6000, 10000];
const signedInOnlyRoutes = new Set([ROUTES.playMultiplayer, ROUTES.favourites]);
const signedInRouteHandoff = createSignedInRouteHandoff({
  allowedRoutes: signedInOnlyRoutes,
  storage: window.localStorage,
});

let game =
  loadCurrentAnonymousSoloGame(window.localStorage) ??
  createAnonymousSoloGame({ rowCount: 20 });
const initialHashIsSupabaseAuthCallback = isSupabaseAuthCallbackHash(
  window.location.hash,
);
let pendingSupabaseAuthCallbackHash = initialHashIsSupabaseAuthCallback;
let preserveNextAnonymousRouteHandoff = initialHashIsSupabaseAuthCallback;
let currentRoute = normaliseRoute(window.location.hash);
let requestedSignedInRoute = signedInOnlyRoutes.has(currentRoute)
  ? currentRoute
  : null;
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
let favouritesListState = {
  phrases: "idle",
  batches: "idle",
};
let phraseFavouritesLoadRequestId = 0;
let batchFavouritesLoadRequestId = 0;
let activeFavouritesTab = "phrases";
let expandedBatchFavouriteId = null;
let activeFavouritesStatus = "";
let activeFavouritesStatusTimer = null;
let rowActionStatus = {
  phrases: null,
  batches: null,
};
let rowActionStatusTimer = null;
let favouriteCopyRequestIds = {
  phrases: 0,
  batches: 0,
};
let favouriteRouteCopyLock = null;
let favouriteRouteCopyLockId = 0;
let openRemoveConfirmation = null;
let favouriteRemoveRequestId = 0;
let activeFavouriteRemoveRequest = null;
let batchFavouriteToggleButton = null;
let favouriteToggleRequestId = 0;
let pendingFavouriteToggleRequests = [];
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
let accountProfileCropGuideTimer = null;
let accountProfilePreviewRequestId = 0;
let favouritesPanel = null;

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

playMenuToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  setPlayMenuOpen(playMenu.hidden);
});

playMenu.addEventListener("click", (event) => {
  if (event.target.closest("[data-play-menu-item]")) {
    setPlayMenuOpen(false);
  }
});

document.addEventListener("click", (event) => {
  if (playMenu.hidden || playMenuRoot.contains(event.target)) {
    return;
  }

  setPlayMenuOpen(false);
});

document.addEventListener("click", (event) => {
  if (
    !notificationPanel ||
    notificationPanel.hidden ||
    notificationShell?.contains(event.target)
  ) {
    return;
  }

  closeNotificationPanel({ returnFocus: true });
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }

  if (!playMenu.hidden) {
    setPlayMenuOpen(false);
    playMenuToggle.focus();
  }

  if (notificationPanel && !notificationPanel.hidden) {
    closeNotificationPanel({ returnFocus: true });
  }
});

function handleNotificationToggleClick(event) {
  event.stopPropagation();
  const isExpanded = notificationToggle.getAttribute("aria-expanded") === "true";
  if (isExpanded) {
    closeNotificationPanel({ returnFocus: true });
    return;
  }

  openNotificationPanel();
}

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
  if (event.target.closest("[data-toggle-batch-favourite]")) {
    void toggleBatchFavourite();
    return;
  }

  const phraseFavouriteButton = event.target.closest(
    "[data-toggle-phrase-favourite-index]",
  );

  if (phraseFavouriteButton) {
    void togglePhraseFavourite(
      Number(phraseFavouriteButton.dataset.togglePhraseFavouriteIndex),
    );
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

window.addEventListener("hashchange", () => {
  const requestedHashRoute = window.location.hash;
  currentRoute = normaliseRoute(requestedHashRoute);
  if (requestedHashRoute && requestedHashRoute !== currentRoute) {
    ensureHashRoute(currentRoute);
    return;
  }

  if (accountShell.persistenceAuthority.type !== "account") {
    updateAnonymousRequestedSignedInRoute(currentRoute, {
      preserveStoredHandoff: preserveNextAnonymousRouteHandoff,
    });
  }
  preserveNextAnonymousRouteHandoff = false;
  renderRoute();
});

if (window.location.hash && window.location.hash !== currentRoute) {
  if (initialHashIsSupabaseAuthCallback) {
    renderRoute();
  } else {
    ensureHashRoute(currentRoute);
  }
} else {
  renderRoute();
}

function normaliseRoute(hash) {
  if (
    hash === ROUTES.playSolo ||
    hash === ROUTES.playMultiplayer ||
    hash === ROUTES.favourites
  ) {
    return hash;
  }

  return ROUTES.playSolo;
}

function ensureHashRoute(route) {
  if (window.location.hash === route) {
    return;
  }

  window.location.hash = route;
}

function setPlayMenuOpen(isOpen) {
  playMenu.hidden = !isOpen;
  playMenuToggle.setAttribute("aria-expanded", String(isOpen));
}

function scheduleSignedInRouteHashReconciliation(route) {
  if (!signedInOnlyRoutes.has(route)) {
    return;
  }

  for (const delayMs of signedInRouteReconciliationDelaysMs) {
    window.setTimeout(() => {
      if (
        accountShell.persistenceAuthority.type !== "account" ||
        currentRoute !== route ||
        window.location.hash === route
      ) {
        return;
      }

      ensureHashRoute(route);
    }, delayMs);
  }
}

function isSupabaseAuthCallbackHash(hash) {
  if (!hash || hash.startsWith("#/")) {
    return false;
  }

  const params = new URLSearchParams(hash.slice(1));

  return (
    params.has("access_token") ||
    params.has("refresh_token") ||
    (params.has("error") && params.has("error_description"))
  );
}

function resolvePendingSupabaseAuthCallbackHash() {
  if (!pendingSupabaseAuthCallbackHash) {
    return;
  }

  pendingSupabaseAuthCallbackHash = false;

  if (!isSupabaseAuthCallbackHash(window.location.hash)) {
    return;
  }

  preserveNextAnonymousRouteHandoff = true;
  ensureHashRoute(currentRoute);
}

function preserveCurrentSignedInRouteForHostedAuth() {
  if (signedInOnlyRoutes.has(currentRoute)) {
    requestedSignedInRoute = currentRoute;
    signedInRouteHandoff.preserve(currentRoute);
    return;
  }

  requestedSignedInRoute = null;
  signedInRouteHandoff.clear();
}

function updateAnonymousRequestedSignedInRoute(
  route,
  { preserveStoredHandoff = false } = {},
) {
  if (signedInOnlyRoutes.has(route)) {
    requestedSignedInRoute = route;
    return;
  }

  requestedSignedInRoute = null;
  if (preserveStoredHandoff) {
    return;
  }

  signedInRouteHandoff.clear();
}

function renderRoute() {
  const isSignedIn = accountShell.persistenceAuthority.type === "account";
  const routeNeedsAccount = signedInOnlyRoutes.has(currentRoute);

  primaryNav.hidden = accountShell.mode !== "signed-in";
  updatePrimaryNavState();

  if (routeNeedsAccount && !isSignedIn) {
    gamePanel.hidden = true;
    removePendingGamePanel();
    removeFavouritesPanel();
    renderSignInRequiredGate(currentRoute);
    return;
  }

  routeGate.hidden = true;
  routeGate.replaceChildren();

  if (currentRoute === ROUTES.favourites) {
    gamePanel.hidden = true;
    removePendingGamePanel();
    renderFavourites();
    return;
  }

  if (currentRoute === ROUTES.playMultiplayer) {
    gamePanel.hidden = true;
    removeFavouritesPanel();
    renderPendingGamePanel();
    return;
  }

  gamePanel.hidden = false;
  removeFavouritesPanel();
  renderGame();
  if (accountShell.persistenceAuthority.type === "account") {
    removePendingGamePanel();
    renderNotificationDropdown();
  } else {
    removePendingGamePanel();
  }
}

function renderSignInRequiredGate(route) {
  const heading = document.createElement("h2");
  heading.textContent =
    route === ROUTES.favourites
      ? "Sign in to view Favourites"
      : "Sign in to play Multiplayer";

  const copy = document.createElement("p");
  copy.textContent =
    "Use an Account-backed session to open this private destination.";

  routeGate.replaceChildren(heading, copy);
  routeGate.hidden = false;
}

function updatePrimaryNavState() {
  primaryNav.querySelectorAll("[data-route-link]").forEach((link) => {
    const linkRoute = link.getAttribute("href");
    const isCurrentRoute =
      link.dataset.routeLink === "play"
        ? currentRoute.startsWith("#/play/")
        : linkRoute === currentRoute;

    if (isCurrentRoute) {
      link.setAttribute("aria-current", "page");
      return;
    }

    link.removeAttribute("aria-current");
  });

  primaryNav.querySelectorAll("[data-play-menu-item]").forEach((item) => {
    if (item.getAttribute("href") === currentRoute) {
      item.setAttribute("aria-current", "page");
      return;
    }

    item.removeAttribute("aria-current");
  });
}

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
      const currentBatchFavouriteButton = ensureBatchFavouriteToggleButton();
      const savedBatch = findBatchFavouriteRecordForCurrentReveal();
      currentBatchFavouriteButton.disabled = isFavouriteTogglePending({
        type: "batch",
      });
      currentBatchFavouriteButton.className =
        "secondary-button icon-action-button";
      currentBatchFavouriteButton.dataset.toggleBatchFavourite = "";
      currentBatchFavouriteButton.ariaLabel = savedBatch
        ? "Remove batch from favourites"
        : "Save batch as favourite";
      currentBatchFavouriteButton.setAttribute(
        "aria-pressed",
        String(Boolean(savedBatch)),
      );
      currentBatchFavouriteButton.replaceChildren(
        createFontAwesomeIcon(savedBatch ? "solid" : "regular", "heart"),
        createScreenReaderText(currentBatchFavouriteButton.ariaLabel),
      );
    } else {
      removeBatchFavouriteToggleButton();
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
  if (shell.mode === "signed-in") {
    ensureNotificationShell();
    notificationShell.hidden = false;
  } else {
    removeNotificationShell();
  }
  renderAccountProfilePanel(shell);
  updateNotificationToggle();
}

function ensureNotificationShell() {
  if (notificationShell && notificationToggle && notificationPanel) {
    return;
  }

  notificationShell = document.createElement("div");
  notificationShell.className = "notification-shell";
  notificationShell.dataset.notificationShell = "";

  notificationToggle = document.createElement("button");
  notificationToggle.className = "icon-button notification-button";
  notificationToggle.type = "button";
  notificationToggle.setAttribute("aria-expanded", "false");
  notificationToggle.setAttribute("aria-controls", "notification-panel");
  notificationToggle.dataset.notificationToggle = "";
  notificationToggle.addEventListener("click", handleNotificationToggleClick);

  notificationPanel = document.createElement("div");
  notificationPanel.className = "notification-panel";
  notificationPanel.id = "notification-panel";
  notificationPanel.role = "region";
  notificationPanel.setAttribute("aria-label", "Notifications");
  notificationPanel.tabIndex = -1;
  notificationPanel.dataset.notificationPanel = "";
  notificationPanel.hidden = true;

  notificationShell.append(notificationToggle, notificationPanel);
  headerActions.insertBefore(notificationShell, helpToggle);
}

function removeNotificationShell() {
  notificationShell?.remove();
  notificationShell = null;
  notificationToggle = null;
  notificationPanel = null;
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
  const cropControls = createAvatarCropControls();

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

  field.append(selectLabel, preview, uploadLabel, cropControls);
  return field;
}

function createAvatarCropControls() {
  const controls = document.createElement("div");
  const editor = document.createElement("div");
  const cropBox = document.createElement("div");
  const cropGuide = document.createElement("div");
  const actions = document.createElement("div");
  const zoomOutButton = document.createElement("button");
  const zoomInButton = document.createElement("button");
  const resetButton = document.createElement("button");

  controls.className = "account-profile-crop-controls";
  controls.dataset.accountProfileCropControls = "";
  controls.hidden = true;

  editor.className = "account-profile-crop-editor";
  editor.dataset.accountProfileCropEditor = "";
  editor.tabIndex = 0;
  editor.setAttribute("aria-label", "Avatar crop editor");
  editor.addEventListener("keydown", handleAvatarCropEditorKeydown);
  let dragPoint = null;
  editor.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    dragPoint = {
      x: event.clientX,
      y: event.clientY,
    };
    editor.setPointerCapture?.(event.pointerId);
  });
  editor.addEventListener("pointermove", (event) => {
    if (!dragPoint) {
      return;
    }

    const deltaX = event.clientX - dragPoint.x;
    const deltaY = event.clientY - dragPoint.y;
    dragPoint = {
      x: event.clientX,
      y: event.clientY,
    };
    updateAccountProfileDraftCrop({
      xDelta: deltaX / 4,
      yDelta: deltaY / 4,
    });
  });
  for (const eventName of ["pointercancel", "pointerup"]) {
    editor.addEventListener(eventName, (event) => {
      dragPoint = null;
      editor.releasePointerCapture?.(event.pointerId);
    });
  }

  cropBox.className = "account-profile-crop-box";
  cropBox.dataset.accountProfileCropBox = "";

  cropGuide.className = "account-profile-crop-guide";
  cropGuide.dataset.accountProfileCropGuide = "";
  cropGuide.setAttribute("aria-hidden", "true");
  cropBox.append(cropGuide);
  for (const marker of [
    "top-left",
    "top",
    "top-right",
    "right",
    "bottom-right",
    "bottom",
    "bottom-left",
    "left",
  ]) {
    const element = document.createElement("span");
    element.className = `account-profile-crop-marker is-${marker}`;
    element.dataset.accountProfileCropMarker = marker;
    element.setAttribute("aria-hidden", "true");
    cropBox.append(element);
  }

  zoomOutButton.type = "button";
  zoomOutButton.textContent = "Zoom out";
  zoomOutButton.dataset.accountProfileCropZoomOut = "";
  zoomOutButton.addEventListener("click", () => {
    updateAccountProfileDraftCrop({ scaleDelta: -0.1 });
  });

  zoomInButton.type = "button";
  zoomInButton.textContent = "Zoom in";
  zoomInButton.dataset.accountProfileCropZoomIn = "";
  zoomInButton.addEventListener("click", () => {
    updateAccountProfileDraftCrop({ scaleDelta: 0.1 });
  });

  resetButton.type = "button";
  resetButton.textContent = "Reset crop";
  resetButton.dataset.accountProfileCropReset = "";
  resetButton.addEventListener("click", () => {
    setAccountProfileDraftCrop(DEFAULT_AVATAR_CROP);
  });

  actions.className = "account-profile-crop-actions";
  actions.append(zoomOutButton, zoomInButton, resetButton);
  editor.append(cropBox);
  controls.append(editor, actions);

  return controls;
}

function removeAccountProfilePanel() {
  accountProfilePreviewRequestId += 1;
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
  renderAvatarCropControls(panel, avatarDescriptor);
  preview.replaceChildren();
  preview.removeAttribute("role");
  preview.removeAttribute("aria-label");

  if (avatarDescriptor?.type === "uploaded-draft") {
    renderUploadedAvatarPreview(preview, avatarDescriptor.previewUrl, {
      crop: avatarDescriptor.crop,
    });
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

function renderUploadedAvatarPreview(preview, imageUrl, { crop = null } = {}) {
  const image = document.createElement("img");
  image.alt = "Uploaded image";
  image.dataset.accountProfileUploadedAvatarImage = "";
  image.src = imageUrl;
  if (crop) {
    image.style.transform = `translate(${crop.x}%, ${crop.y}%) scale(${crop.scale})`;
  }
  preview.setAttribute("role", "img");
  preview.setAttribute("aria-label", "Selected uploaded image");
  preview.append(image);
}

function renderAvatarCropControls(panel, avatarDescriptor) {
  const controls = panel.querySelector("[data-account-profile-crop-controls]");
  if (!controls) {
    return;
  }

  const isDraftUpload = avatarDescriptor?.type === "uploaded-draft";
  controls.hidden = !isDraftUpload;
  if (!isDraftUpload) {
    controls
      .querySelector("[data-account-profile-crop-editor-image]")
      ?.remove();
    return;
  }

  const crop = normaliseAvatarCrop(avatarDescriptor.crop);
  renderAvatarCropEditor(panel, avatarDescriptor, crop);
  const editor = controls.querySelector("[data-account-profile-crop-editor]");
  if (editor) {
    editor.dataset.cropScale = String(crop.scale);
    editor.dataset.cropX = String(crop.x);
    editor.dataset.cropY = String(crop.y);
  }
}

function renderAvatarCropEditor(panel, avatarDescriptor, crop) {
  const cropBox = panel.querySelector("[data-account-profile-crop-box]");
  if (!cropBox) {
    return;
  }

  cropBox.querySelector("[data-account-profile-crop-editor-image]")?.remove();
  const image = document.createElement("img");
  const cropBoxSize = cropBox.clientWidth || 220;
  const layout = calculateAvatarCropLayout({
    crop,
    cropBoxSize,
    sourceHeight: avatarDescriptor.height,
    sourceWidth: avatarDescriptor.width,
  });

  image.alt = "Uploaded image crop editor";
  image.className = "account-profile-crop-editor-image";
  image.dataset.accountProfileCropEditorImage = "";
  image.src = avatarDescriptor.previewUrl;
  image.style.height = `${layout.height}px`;
  image.style.transform = `translate(${layout.x}px, ${layout.y}px)`;
  image.style.width = `${layout.width}px`;
  cropBox.prepend(image);
}

function updateAccountProfileDraftCrop(adjustment) {
  if (accountProfileDraftAvatar?.type !== "uploaded-draft") {
    return;
  }

  setAccountProfileDraftCrop(
    adjustAvatarCrop(accountProfileDraftAvatar.crop, adjustment),
  );
}

function setAccountProfileDraftCrop(crop) {
  if (accountProfileDraftAvatar?.type !== "uploaded-draft") {
    return;
  }

  const panel = ensureAccountProfilePanel();
  accountProfileDraftAvatar = {
    ...accountProfileDraftAvatar,
    crop: normaliseAvatarCrop(crop),
  };
  void renderAccountProfileAvatarPreview(panel, accountProfileDraftAvatar);
  showAvatarCropGuide(panel);
}

function handleAvatarCropEditorKeydown(event) {
  const nudge = event.shiftKey ? 15 : 5;
  const keyActions = {
    ArrowDown: { yDelta: nudge },
    ArrowLeft: { xDelta: -nudge },
    ArrowRight: { xDelta: nudge },
    ArrowUp: { yDelta: -nudge },
    "+": { scaleDelta: 0.1 },
    "=": { scaleDelta: 0.1 },
    "-": { scaleDelta: -0.1 },
    _: { scaleDelta: -0.1 },
  };
  const adjustment = keyActions[event.key];
  if (!adjustment) {
    return;
  }

  event.preventDefault();
  updateAccountProfileDraftCrop(adjustment);
}

function showAvatarCropGuide(panel) {
  const guide = panel.querySelector("[data-account-profile-crop-guide]");
  if (!guide) {
    return;
  }

  guide.classList.add("is-active");
  clearTimeout(accountProfileCropGuideTimer);
  accountProfileCropGuideTimer = setTimeout(() => {
    guide.classList.remove("is-active");
  }, 1200);
}

async function selectUploadedAvatarFile(file) {
  if (accountShell.persistenceAuthority.type !== "account") {
    return;
  }

  const accountId = accountShell.accountId;
  const panel = ensureAccountProfilePanel();
  setAccountProfileStatus("");

  if (!file) {
    return;
  }

  const validation = await validateUploadedAvatarFile(file);
  if (!isCurrentAccountSession(accountId)) {
    return;
  }

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
    crop: DEFAULT_AVATAR_CROP,
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

async function uploadDraftAvatar({ accountId, draft, profileId }) {
  let objectPath = null;

  let derivedFile;
  try {
    derivedFile = await createDerivedAvatarFile({
      crop: draft.crop,
      file: draft.file,
    });
  } catch {
    throw new Error(AVATAR_UPLOAD_COPY.cropFailure);
  }

  try {
    objectPath = createUploadedAvatarObjectPath({
      contentType: derivedFile.type,
    });
    await avatarStorageRepository.registerPendingUpload({
      accountId,
      byteSize: derivedFile.size,
      contentType: derivedFile.type,
      height: AVATAR_CROP_OUTPUT_SIZE,
      objectPath,
      profileId,
      width: AVATAR_CROP_OUTPUT_SIZE,
    });
    await avatarStorageRepository.uploadAvatarObject({
      contentType: derivedFile.type,
      file: derivedFile,
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

  const accountId = accountShell.accountId;
  const profileId = accountShell.profile.profileId;
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
        ? await uploadDraftAvatar({
            accountId,
            draft: accountProfileDraftAvatar,
            profileId,
          })
        : accountProfileDraftAvatar?.type === "built-in"
          ? accountProfileDraftAvatar
          : createBuiltInAvatarDescriptor(avatar.value);
    if (avatarDescriptor.type === "uploaded") {
      uploadedObjectPath = avatarDescriptor.objectPath;
    }
    if (!isCurrentAccountSession(accountId)) {
      if (uploadedObjectPath) {
        await cleanupUploadedAvatar(uploadedObjectPath);
      }
      return;
    }

    const profile = await accountProfileRepository.updateOwnProfile({
      accountId,
      profile: {
        avatar: avatarDescriptor,
        gamerName: gamerName.value,
        handle: handle.value,
      },
    });
    if (!isCurrentAccountSession(accountId)) {
      if (uploadedObjectPath) {
        await cleanupUploadedAvatar(uploadedObjectPath);
      }
      return;
    }

    accountShell = createAccountShell({
      account: { id: accountId },
      profile,
    });
    renderAccountShell(accountShell);
    setAccountProfileStatus("Profile saved.");
  } catch (error) {
    if (!isCurrentAccountSession(accountId)) {
      if (uploadedObjectPath) {
        await cleanupUploadedAvatar(uploadedObjectPath);
      }
      return;
    }

    if (uploadedObjectPath) {
      await cleanupUploadedAvatar(uploadedObjectPath);
      status.textContent = AVATAR_UPLOAD_COPY.saveFailureAfterUpload;
    } else {
      status.textContent = getProfileSaveFailureMessage(error);
    }
  }
}

function getProfileSaveFailureMessage(error) {
  if (error instanceof Error && error.message === AVATAR_UPLOAD_COPY.cropFailure) {
    return AVATAR_UPLOAD_COPY.cropFailure;
  }

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
  const failureMode = getLocalTestPrivateFavouritesMode();

  if (
    [
      "remove-fails",
      "remove-fails-after-delay",
      "load-fails",
      "load-fails-once",
      "load-race",
    ].includes(failureMode)
  ) {
    return failureMode === "remove-fails-after-delay"
      ? "remove-fails"
      : failureMode;
  }

  return null;
}

function getLocalTestPrivateFavouritesMode() {
  if (!isLocalTestAuthAvailable()) {
    return null;
  }

  const testMode = new URLSearchParams(window.location.search).get(
    "testPrivateFavourites",
  );

  if (
    [
      "mutation-delays",
      "remove-fails",
      "remove-fails-after-delay",
      "save-fails",
      "load-fails",
      "load-fails-once",
      "load-race",
    ].includes(testMode)
  ) {
    return testMode;
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
    const savedRecord = findPhraseFavouriteRecordForCurrentReveal(phraseIndex);
    const favouriteButton = document.createElement("button");
    favouriteButton.type = "button";
    favouriteButton.className =
      "secondary-button phrase-copy-button icon-action-button";
    favouriteButton.dataset.togglePhraseFavouriteIndex = String(phraseIndex);
    favouriteButton.disabled = isFavouriteTogglePending({
      rowIndex: phraseIndex,
      type: "phrase",
    });
    favouriteButton.ariaLabel = savedRecord
      ? `Remove phrase ${phraseIndex + 1} from favourites`
      : `Save phrase ${phraseIndex + 1} as favourite`;
    favouriteButton.setAttribute("aria-pressed", String(Boolean(savedRecord)));
    favouriteButton.append(
      createFontAwesomeIcon(savedRecord ? "solid" : "regular", "heart"),
      createScreenReaderText(favouriteButton.ariaLabel),
    );
    actions.append(favouriteButton);
  }

  item.append(phraseText, actions);
  return item;
}

function renderFavourites() {
  const isSignedIn = accountShell.persistenceAuthority.type === "account";

  if (!isSignedIn || currentRoute !== ROUTES.favourites) {
    removeFavouritesPanel();
    return;
  }

  const panel = ensureFavouritesPanel();
  const heading = renderFavouritesHeading();
  const tabs = renderFavouritesTabs();
  const status = renderActiveFavouritesStatus();
  refreshStaleFavouritesTab(activeFavouritesTab);
  const body =
    activeFavouritesTab === "phrases"
      ? renderFavouritesTabPanel("phrases")
      : renderFavouritesTabPanel("batches");

  panel.replaceChildren(heading, tabs, ...status, body);
}

function renderFavouritesHeading() {
  const heading = document.createElement("div");
  heading.className = "section-heading";

  const kicker = document.createElement("p");
  kicker.className = "section-kicker";
  kicker.textContent = "Favourites";

  const title = document.createElement("h2");
  title.textContent = "Favourites";

  heading.append(kicker, title);
  return heading;
}

function renderFavouritesTabs() {
  const tabs = document.createElement("div");
  tabs.className = "favourites-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Favourite type");

  tabs.append(
    renderFavouritesTabButton("phrases", "Phrases"),
    renderFavouritesTabButton("batches", "Batches"),
  );
  return tabs;
}

function renderFavouritesTabButton(tab, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "favourites-tab";
  button.dataset.favouritesTab = tab;
  button.setAttribute("role", "tab");
  button.setAttribute("aria-selected", String(activeFavouritesTab === tab));
  button.textContent = label;
  return button;
}

function renderActiveFavouritesStatus() {
  if (activeFavouritesStatus === "") {
    return [];
  }

  const status = document.createElement("p");
  status.className = "favourites-status";
  status.dataset.favouritesStatus = "";
  status.setAttribute("aria-live", "polite");
  status.textContent = activeFavouritesStatus;
  return [status];
}

function renderFavouritesTabPanel(tab) {
  const panel = document.createElement("div");
  panel.className = "favourites-tab-panel";
  panel.dataset.favouritesTabPanel = tab;
  panel.setAttribute("role", "tabpanel");

  const state = favouritesListState[tab];
  const records = tab === "phrases" ? phraseFavourites : batchFavourites;

  if (state === "loading") {
    panel.append(
      createFavouritesStateCopy(
        tab === "phrases"
          ? "Loading phrase favourites..."
          : "Loading batch favourites...",
      ),
    );
    return panel;
  }

  if (state === "error") {
    panel.append(renderFavouritesError(tab));
    return panel;
  }

  if (records.length === 0) {
    panel.append(renderFavouritesEmptyState(tab));
    return panel;
  }

  const list = document.createElement("ol");
  list.className = "favourites-list";
  list.dataset.phraseFavouritesList = "";
  list.replaceChildren(
    ...(tab === "phrases"
      ? phraseFavourites.map(renderPhraseFavourite)
      : batchFavourites.map(renderBatchFavourite)),
  );
  panel.append(list);
  return panel;
}

function createFavouritesStateCopy(text) {
  const copy = document.createElement("p");
  copy.className = "favourites-state-copy";
  copy.textContent = text;
  return copy;
}

function renderFavouritesEmptyState(tab) {
  const empty = document.createElement("div");
  empty.className = "favourites-empty-state";

  const heading = document.createElement("h3");
  heading.tabIndex = -1;
  heading.dataset.favouritesEmptyHeading = tab;
  heading.textContent =
    tab === "phrases" ? "No phrase favourites yet." : "No batch favourites yet.";

  const copy = document.createElement("p");
  copy.textContent =
    tab === "phrases"
      ? "Favourite revealed phrases from Play Solo."
      : "Favourite a revealed batch from Play Solo.";

  const action = document.createElement("a");
  action.className = "secondary-button favourites-empty-action";
  action.href = ROUTES.playSolo;
  action.textContent = "Play Solo";

  empty.append(heading, copy, action);
  return empty;
}

function renderFavouritesError(tab) {
  const error = document.createElement("div");
  error.className = "favourites-error-state";

  const copy = document.createElement("p");
  copy.textContent =
    tab === "phrases"
      ? "Could not load phrase favourites."
      : "Could not load batch favourites.";

  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "secondary-button";
  retry.dataset.retryFavouritesTab = tab;
  retry.ariaLabel =
    tab === "phrases"
      ? "Try loading phrase favourites again"
      : "Try loading batch favourites again";
  retry.textContent = "Try again";

  error.append(copy, retry);
  return error;
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

function ensureBatchFavouriteToggleButton() {
  if (batchFavouriteToggleButton) {
    return batchFavouriteToggleButton;
  }

  batchFavouriteToggleButton = document.createElement("button");
  batchFavouriteToggleButton.type = "button";
  batchFavouriteToggleButton.className = "secondary-button";
  copyStatus.before(batchFavouriteToggleButton);
  return batchFavouriteToggleButton;
}

function removeBatchFavouriteToggleButton() {
  batchFavouriteToggleButton?.remove();
  batchFavouriteToggleButton = null;
}

function createFontAwesomeIcon(style, name) {
  const icon = document.createElement("i");
  icon.className = `fa-${style} fa-${name}`;
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function createScreenReaderText(text) {
  const element = document.createElement("span");
  element.className = "sr-only";
  element.textContent = text;
  return element;
}

function clearRevealSurface() {
  removeBatchFavouriteToggleButton();
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
}

function resetPendingGameState() {
  currentPendingGame = null;
  createdPendingGames = [];
  incomingPendingGameInvites = [];
  multiplayerDashboard = createEmptyMultiplayerDashboard();
  completedMultiplayerHistory = createEmptyCompletedMultiplayerHistory();
  inAppNotifications = [];
}

async function createPendingGameInvite(event) {
  event.preventDefault();

  if (accountShell.persistenceAuthority.type !== "account") {
    return;
  }

  const accountId = accountShell.accountId;
  const inviteeHandle = pendingGameHandleInput.value;
  const nudgeTimeoutHours = Number(pendingGameNudgeTimeoutSelect.value);
  const rowCount = Number(pendingGameRowCountSelect.value);
  pendingGameStatus.textContent = "";

  try {
    const pendingGame = await pendingGameRepository.createPendingGameFromHandle({
      creatorAccountId: accountId,
      inviteeHandle,
      nudgeTimeoutHours,
      rowCount,
    });
    if (!isCurrentAccountSession(accountId)) {
      return;
    }

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
    if (!isCurrentAccountSession(accountId)) {
      return;
    }

    currentPendingGame = null;
    if (pendingGameSummary) {
      pendingGameSummary.hidden = true;
      pendingGameSummary.replaceChildren();
    }
    if (pendingGameStatus) {
      pendingGameStatus.textContent = getPendingGameFailureMessage(error);
    }
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

  const accountId = accountShell.accountId;
  pendingGameStatus.textContent = "";

  try {
    const pendingGame =
      response === "accept"
        ? await pendingGameRepository.acceptPendingGameInvite({
            accountId,
            pendingGameId,
          })
        : await pendingGameRepository.declinePendingGameInvite({
            accountId,
            pendingGameId,
          });
    if (!isCurrentAccountSession(accountId)) {
      return;
    }

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
    if (isCurrentAccountSession(accountId) && pendingGameStatus) {
      pendingGameStatus.textContent = "Game invite could not be updated. Try again.";
    }
  }
}

async function cancelCreatedGame(pendingGameId) {
  if (accountShell.persistenceAuthority.type !== "account") {
    return;
  }

  const accountId = accountShell.accountId;
  pendingGameStatus.textContent = "";

  try {
    const pendingGame = await pendingGameRepository.cancelCreatedGame({
      creatorAccountId: accountId,
      pendingGameId,
    });
    if (!isCurrentAccountSession(accountId)) {
      return;
    }

    createdPendingGames = upsertPendingGame(createdPendingGames, pendingGame);
    if (!(await loadMultiplayerDashboard({ accountId }))) {
      return;
    }

    renderPendingGamePanel();
    pendingGameStatus.textContent = "Game cancelled.";
  } catch {
    if (isCurrentAccountSession(accountId) && pendingGameStatus) {
      pendingGameStatus.textContent = "Game could not be cancelled. Try again.";
    }
  }
}

async function startPendingGame(pendingGameId) {
  if (accountShell.persistenceAuthority.type !== "account") {
    return;
  }

  const accountId = accountShell.accountId;
  pendingGameStatus.textContent = "";

  try {
    const startedGame = await pendingGameRepository.startPendingGame({
      creatorAccountId: accountId,
      pendingGameId,
    });
    if (!isCurrentAccountSession(accountId)) {
      return;
    }

    createdPendingGames = upsertPendingGame(
      createdPendingGames,
      createPendingGameFromStartedGame(startedGame),
    );
    if (!(await loadMultiplayerDashboard({ accountId }))) {
      return;
    }

    renderPendingGamePanel();
    pendingGameStatus.textContent =
      multiplayerDashboard.awaitingYourEntries.length > 0
        ? "Game started. Your turn is ready."
        : "Game started. Waiting for another participant.";
  } catch {
    if (isCurrentAccountSession(accountId) && pendingGameStatus) {
      pendingGameStatus.textContent = "Game could not be started. Try again.";
    }
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

  const accountId = accountShell.accountId;
  pendingGameStatus.textContent = "";
  multiplayerDashboardMount.hidden = true;
  completedMultiplayerHistoryPanel.hidden = false;
  renderCompletedMultiplayerHistoryLoading();

  try {
    completedMultiplayerHistory = await loadCompletedMultiplayerHistoryPage({
      accountId,
    });
    if (!isCurrentAccountSession(accountId)) {
      return;
    }

    renderCompletedMultiplayerHistory();
  } catch {
    if (isCurrentAccountSession(accountId)) {
      renderCompletedMultiplayerHistoryError();
    }
  }
}

async function loadCompletedMultiplayerHistoryPage({
  accountId = accountShell.accountId,
  cursor,
} = {}) {
  return pendingGameRepository.listCompletedMultiplayerHistory({
    accountId,
    ...(cursor ? { cursor } : {}),
    pageSize: COMPLETED_MULTIPLAYER_HISTORY_PAGE_SIZE,
  });
}

async function loadMoreCompletedMultiplayerHistory() {
  if (accountShell.persistenceAuthority.type !== "account") {
    return;
  }

  if (
    !completedMultiplayerHistory.hasMore ||
    !completedMultiplayerHistory.nextCursor
  ) {
    return;
  }

  const existingBatches = completedMultiplayerHistory.batches;
  const accountId = accountShell.accountId;
  completedMultiplayerHistory = {
    ...completedMultiplayerHistory,
    loadMoreError: false,
    loadingMore: true,
  };
  renderCompletedMultiplayerHistory();

  try {
    const nextPage = await loadCompletedMultiplayerHistoryPage({
      accountId,
      cursor: completedMultiplayerHistory.nextCursor,
    });
    if (!isCurrentAccountSession(accountId)) {
      return;
    }

    completedMultiplayerHistory = {
      ...nextPage,
      batches: [...existingBatches, ...nextPage.batches],
    };
  } catch {
    if (!isCurrentAccountSession(accountId)) {
      return;
    }

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
  if (!completedMultiplayerHistoryPanel || !multiplayerDashboardMount) {
    return;
  }

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
  if (!completedMultiplayerHistoryPanel) {
    return;
  }

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
  if (!notificationPanel) {
    return;
  }

  updateNotificationToggle();
  if (inAppNotifications.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "notification-empty";
    emptyState.textContent = "You have no notifications yet.";
    notificationPanel.replaceChildren(emptyState);
    return;
  }

  const renderItems = getNotificationPanelRenderItems();
  const rows = [];
  if (renderItems.some((notification) => notification.status === "unread")) {
    rows.push(renderNotificationBulkReadAction());
  }
  rows.push(...renderItems.map(renderNotificationRow));
  if (notificationPanelFeedbackMessage) {
    const feedback = document.createElement("p");
    feedback.className = "notification-feedback";
    feedback.role = "status";
    feedback.textContent = notificationPanelFeedbackMessage;
    rows.push(feedback);
  }

  notificationPanel.replaceChildren(...rows);
}

function renderNotificationBulkReadAction() {
  const action = document.createElement("div");
  action.className = "notification-actions";

  const button = document.createElement("button");
  const label = "Mark all as read";
  button.type = "button";
  button.className = "notification-mark-all-read";
  button.dataset.notificationMarkAllRead = "";
  button.setAttribute("aria-label", label);
  button.append(
    createFontAwesomeIcon("solid", "list-check"),
    createScreenReaderText(label),
  );
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    void handleNotificationMarkAllRead();
  });

  action.append(button);
  return action;
}

function renderNotificationRow(notification) {
  const message = getNotificationMessage(notification);
  const targetRoute = getNotificationTargetRoute(notification);
  const row = document.createElement("div");
  row.className = "notification-row";
  row.dataset.notificationRow = notification.id;
  row.dataset.notificationStatus = notification.status;
  if (notification.status !== "unread") {
    row.classList.add("notification-row-body-only");
  }

  const item = document.createElement(targetRoute ? "button" : "div");
  if (targetRoute) {
    item.type = "button";
    item.addEventListener("click", () => {
      void handleNotificationItemClick(notification);
    });
  } else {
    item.tabIndex = -1;
  }
  item.className = "notification-item";
  item.dataset.notificationItemId = notification.id;
  item.dataset.notificationStatus = notification.status;
  item.textContent = message;
  item.setAttribute("aria-label", getNotificationAccessibleLabel(notification, message));
  row.append(item);

  if (notification.status === "unread") {
    const markReadButton = document.createElement("button");
    const label = `Mark notification as read: ${message}`;
    markReadButton.type = "button";
    markReadButton.className = "notification-mark-read";
    markReadButton.dataset.notificationMarkRead = notification.id;
    markReadButton.setAttribute("aria-label", label);
    markReadButton.append(
      createFontAwesomeIcon("solid", "circle-check"),
      createScreenReaderText(label),
    );
    markReadButton.addEventListener("click", (event) => {
      event.stopPropagation();
      void handleNotificationMarkRead(notification.id);
    });
    row.append(markReadButton);
  }

  return row;
}

function openNotificationPanel() {
  if (!notificationToggle || !notificationPanel) {
    return;
  }

  notificationToggle.setAttribute("aria-expanded", "true");
  notificationPanel.hidden = false;
  notificationPanelFeedbackMessage = "";
  notificationPanelOrder = getNotificationPanelItems().map(
    (notification) => notification.id,
  );
  renderNotificationDropdown();
  notificationPanel.focus({ preventScroll: true });
}

function getNotificationPanelItems() {
  return inAppNotifications
    .map((notification, index) => ({ index, notification }))
    .sort((left, right) => {
      const statusComparison =
        notificationStatusOrder(left.notification.status) -
        notificationStatusOrder(right.notification.status);
      if (statusComparison !== 0) {
        return statusComparison;
      }

      const timeComparison =
        getNotificationCreatedTime(right.notification) -
        getNotificationCreatedTime(left.notification);
      return timeComparison || left.index - right.index;
    })
    .map(({ notification }) => notification);
}

function getNotificationPanelRenderItems() {
  if (!notificationPanel || notificationPanel.hidden || notificationPanelOrder.length === 0) {
    return getNotificationPanelItems();
  }

  const notificationsById = new Map(
    inAppNotifications.map((notification) => [notification.id, notification]),
  );
  const orderedNotifications = notificationPanelOrder
    .map((id) => notificationsById.get(id))
    .filter(Boolean);
  const orderedIds = new Set(notificationPanelOrder);
  const newNotifications = getNotificationPanelItems().filter(
    (notification) => !orderedIds.has(notification.id),
  );

  if (newNotifications.length > 0) {
    notificationPanelOrder = [
      ...notificationPanelOrder,
      ...newNotifications.map((notification) => notification.id),
    ];
  }

  return [...orderedNotifications, ...newNotifications];
}

function notificationStatusOrder(status) {
  return status === "unread" ? 0 : 1;
}

function getNotificationCreatedTime(notification) {
  const time = Date.parse(notification.createdAt ?? "");
  return Number.isFinite(time) ? time : 0;
}

function getNotificationAccessibleLabel(notification, message) {
  const state = notification.status === "unread" ? "Unread" : "Read";
  const action = getNotificationTargetRoute(notification) ? "Open Multiplayer" : "Notification";
  return `${state}: ${message} ${action}`;
}

function handleNotificationItemClick(notification) {
  closeNotificationPanel();
  void markNotificationRead(notification.id);
  const targetRoute = getNotificationTargetRoute(notification);
  if (
    !targetRoute ||
    accountShell.persistenceAuthority.type !== "account"
  ) {
    return;
  }

  currentRoute = targetRoute;
  ensureHashRoute(targetRoute);
  renderRoute();
}

async function handleNotificationMarkRead(notificationId) {
  const updated = await markNotificationRead(notificationId);
  if (!updated || !notificationPanel || notificationPanel.hidden) {
    return;
  }

  const item = getRenderedNotificationItem(notificationId);
  item?.focus({ preventScroll: true });
}

async function handleNotificationMarkAllRead() {
  if (!notificationPanel || notificationPanel.hidden) {
    return;
  }

  const unreadNotifications = getNotificationPanelRenderItems().filter(
    (notification) => notification.status === "unread",
  );
  if (unreadNotifications.length === 0) {
    return;
  }

  const results = [];
  for (const notification of unreadNotifications) {
    results.push(await persistNotificationRead(notification.id));
  }

  const failedCount = results.filter((updated) => !updated).length;
  const succeededCount = results.length - failedCount;
  if (failedCount === 0) {
    notificationPanelFeedbackMessage = "";
  } else {
    notificationPanelFeedbackMessage =
      succeededCount > 0
        ? "Some notifications could not be marked read. Try again."
        : "Notifications could not be marked read. Try again.";
  }

  renderNotificationDropdown();
  const remainingBulkAction = notificationPanel.querySelector(
    "[data-notification-mark-all-read]",
  );
  if (remainingBulkAction) {
    remainingBulkAction.focus({ preventScroll: true });
  } else {
    notificationPanel.focus({ preventScroll: true });
  }
}

function getRenderedNotificationItem(notificationId) {
  if (!notificationPanel) {
    return null;
  }

  return [...notificationPanel.querySelectorAll("[data-notification-item-id]")]
    .find((item) => item.dataset.notificationItemId === notificationId) ?? null;
}

function closeNotificationPanel({ returnFocus = false } = {}) {
  if (!notificationToggle || !notificationPanel) {
    return;
  }

  notificationToggle.setAttribute("aria-expanded", "false");
  notificationPanel.hidden = true;
  notificationPanelOrder = [];
  if (returnFocus) {
    notificationToggle.focus();
  }
}

function getNotificationTargetRoute(notification) {
  if (notification.targetGameId || notification.targetPendingGameId) {
    return ROUTES.playMultiplayer;
  }

  return null;
}

function updateNotificationToggle() {
  if (!notificationToggle) {
    return;
  }

  const unreadCount = inAppNotifications.filter(
    (notification) => notification.status === "unread",
  ).length;
  const label =
    unreadCount === 0
      ? "Notifications"
      : `Notifications, ${unreadCount} unread`;
  notificationToggle.setAttribute("aria-label", label);
  notificationToggle.dataset.unreadCount = String(unreadCount);

  const children = [
    createFontAwesomeIcon(unreadCount > 0 ? "solid" : "regular", "bell"),
    createScreenReaderText(label),
  ];

  if (unreadCount > 0) {
    const badge = document.createElement("span");
    badge.className = "notification-badge";
    badge.dataset.notificationBadge = "";
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
    children.splice(1, 0, badge);
  }

  notificationToggle.replaceChildren(...children);
}

function getMultiplayerSectionTitle(entryKind) {
  return entryKind === "adjective" ? "Fill these adjectives" : "Fill these nouns";
}

async function submitMultiplayerSection(event, currentSection) {
  event.preventDefault();
  if (accountShell.persistenceAuthority.type !== "account") {
    return;
  }

  const accountId = accountShell.accountId;
  const form = event.currentTarget;
  const entries = [...form.querySelectorAll("[data-multiplayer-section-input]")]
    .map((input) => ({
      rowIndex: Number(input.dataset.multiplayerSectionInput),
      value: input.value,
    }));

  pendingGameStatus.textContent = "";

  try {
    await pendingGameRepository.submitMultiplayerSection({
      accountId,
      entries,
      sectionId: currentSection.id,
    });
    if (!isCurrentAccountSession(accountId)) {
      return;
    }

    await refreshMultiplayerSurfaces();
  } catch {
    if (isCurrentAccountSession(accountId) && pendingGameStatus) {
      pendingGameStatus.textContent = "Section could not be submitted. Try again.";
    }
  }
}

async function revealMultiplayerBatch(gameId) {
  if (accountShell.persistenceAuthority.type !== "account") {
    return;
  }

  const accountId = accountShell.accountId;
  pendingGameStatus.textContent = "";

  try {
    const revealed = await pendingGameRepository.revealMultiplayerBatch({
      accountId,
      gameId,
    });
    if (!isCurrentAccountSession(accountId)) {
      return;
    }

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
      if (!(await loadMultiplayerDashboard({ accountId }))) {
        return;
      }
      renderPendingGamePanel();
    } catch {
      // Keep the existing dashboard visible if recovery loading also fails.
    }
    if (isCurrentAccountSession(accountId) && pendingGameStatus) {
      pendingGameStatus.textContent = "Phrases could not be revealed. Try again.";
    }
  }
}

async function refreshMultiplayerSurfaces() {
  if (accountShell.persistenceAuthority.type !== "account") {
    return;
  }

  const accountId = accountShell.accountId;
  if (!(await loadMultiplayerDashboard({ accountId }))) {
    return;
  }

  renderPendingGamePanel();
}

async function markUnreadNotificationsRead() {
  await Promise.all(
    inAppNotifications
      .filter((notification) => notification.status === "unread")
      .map((notification) => markNotificationRead(notification.id)),
  );
}

async function persistNotificationRead(notificationId) {
  const notification = inAppNotifications.find(
    (candidate) => candidate.id === notificationId,
  );
  if (!notification || notification.status === "read") {
    return false;
  }

  if (accountShell.persistenceAuthority.type !== "account") {
    return false;
  }

  const accountId = accountShell.accountId;
  try {
    const updatedNotification =
      typeof pendingGameRepository.markInAppNotificationRead === "function"
        ? await pendingGameRepository.markInAppNotificationRead({
            accountId,
            notificationId,
          })
        : { ...notification, status: "read" };
    if (!isCurrentAccountSession(accountId)) {
      return false;
    }

    inAppNotifications = inAppNotifications.map((candidate) =>
      candidate.id === notificationId
        ? { ...candidate, ...updatedNotification, status: "read" }
        : candidate,
    );
    return true;
  } catch {
    return false;
  }
}

async function markNotificationRead(notificationId) {
  const attemptedAccountId =
    accountShell.persistenceAuthority.type === "account"
      ? accountShell.accountId
      : null;
  const updated = await persistNotificationRead(notificationId);
  if (updated) {
    notificationPanelFeedbackMessage = "";
    renderNotificationDropdown();
    return true;
  }

  if (attemptedAccountId && isCurrentAccountSession(attemptedAccountId)) {
    notificationPanelFeedbackMessage =
      "Notification could not be marked read. Try again.";
    if (notificationPanel && !notificationPanel.hidden) {
      renderNotificationDropdown();
    } else if (pendingGameStatus) {
      pendingGameStatus.textContent = notificationPanelFeedbackMessage;
    }
  }

  return false;
}

function getNotificationMessage(notification) {
  return notification.message.replace(
    /^A batch is complete with (.+)\.$/,
    "Batch with $1 is now complete and available to reveal.",
  );
}

async function loadPendingGameLists() {
  if (accountShell.persistenceAuthority.type !== "account") {
    resetPendingGameState();
    return;
  }

  const accountId = accountShell.accountId;
  try {
    const [createdGames, incomingInvites] = await Promise.all([
      pendingGameRepository.listCreatedPendingGames({
        accountId,
      }),
      pendingGameRepository.listIncomingPendingGameInvites({
        accountId,
      }),
    ]);
    if (!isCurrentAccountSession(accountId)) {
      return;
    }

    createdPendingGames = createdGames;
    incomingPendingGameInvites = incomingInvites;
    await loadMultiplayerDashboard({ accountId });
  } catch {
    if (!isCurrentAccountSession(accountId)) {
      return;
    }

    resetPendingGameState();
    authMessage.textContent = "Game invites could not be loaded. Try again.";
  }
}

async function loadMultiplayerDashboard({ accountId = accountShell.accountId } = {}) {
  if (accountShell.persistenceAuthority.type !== "account") {
    multiplayerDashboard = createEmptyMultiplayerDashboard();
    inAppNotifications = [];
    return false;
  }

  const [dashboard, notifications] = await Promise.all([
    pendingGameRepository.listMultiplayerDashboard({
      accountId,
    }),
    pendingGameRepository.listInAppNotifications({
      accountId,
    }),
  ]);
  if (!isCurrentAccountSession(accountId)) {
    return false;
  }

  multiplayerDashboard = dashboard;
  inAppNotifications = notifications;
  return true;
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

function isCurrentAccountSession(accountId) {
  return (
    accountShell.persistenceAuthority.type === "account" &&
    accountShell.accountId === accountId
  );
}

function ensureFavouritesPanel() {
  if (favouritesPanel) {
    return favouritesPanel;
  }

  favouritesPanel = document.createElement("section");
  favouritesPanel.className = "favourites-panel favourites-route";
  favouritesPanel.dataset.favouritesPanel = "";
  favouritesPanel.dataset.favouritesRoute = "";
  favouritesPanel.addEventListener("click", handleFavouritesPanelClick);
  favouritesPanel.addEventListener("keydown", handleFavouritesPanelKeydown);

  routeGate.after(favouritesPanel);
  return favouritesPanel;
}

function removeFavouritesPanel() {
  favouritesPanel?.remove();
  favouritesPanel = null;
  activeFavouritesTab = "phrases";
  expandedBatchFavouriteId = null;
  clearFavouritesTransientState();
}

function handleFavouritesPanelClick(event) {
  const tabButton = event.target.closest("[data-favourites-tab]");
  if (tabButton) {
    switchFavouritesTab(tabButton.dataset.favouritesTab);
    return;
  }

  const retryButton = event.target.closest("[data-retry-favourites-tab]");
  if (retryButton) {
    retryFavouritesTab(retryButton.dataset.retryFavouritesTab);
    return;
  }

  const batchDisclosure = event.target.closest(
    "[data-toggle-batch-favourite-phrases]",
  );
  if (batchDisclosure) {
    toggleExpandedBatchFavourite(
      batchDisclosure.dataset.toggleBatchFavouritePhrases,
    );
    return;
  }

  const phraseCopyButton = event.target.closest(
    "[data-copy-phrase-favourite-id]",
  );

  if (phraseCopyButton) {
    void copyPhraseFavourite(
      phraseCopyButton.dataset.copyPhraseFavouriteId,
      phraseCopyButton,
    );
    return;
  }

  const batchCopyButton = event.target.closest("[data-copy-batch-favourite-id]");

  if (batchCopyButton) {
    void copyBatchFavourite(
      batchCopyButton.dataset.copyBatchFavouriteId,
      batchCopyButton,
    );
    return;
  }

  const phraseRemoveConfirm = event.target.closest(
    "[data-confirm-remove-phrase-favourite-id]",
  );

  if (phraseRemoveConfirm) {
    openFavouriteRemoveConfirmation(
      "phrases",
      phraseRemoveConfirm.dataset.confirmRemovePhraseFavouriteId,
    );
    return;
  }

  const batchRemoveConfirm = event.target.closest(
    "[data-confirm-remove-batch-favourite-id]",
  );

  if (batchRemoveConfirm) {
    openFavouriteRemoveConfirmation(
      "batches",
      batchRemoveConfirm.dataset.confirmRemoveBatchFavouriteId,
    );
    return;
  }

  const cancelRemove = event.target.closest("[data-cancel-favourite-remove]");
  if (cancelRemove) {
    cancelFavouriteRemoveConfirmation({ restoreFocus: true });
    return;
  }

  const remove = event.target.closest("[data-remove-confirmed-favourite-id]");
  if (remove) {
    void removeFavouriteFromRoute({
      tab: remove.dataset.removeConfirmedFavouriteTab,
      favouriteId: remove.dataset.removeConfirmedFavouriteId,
    });
  }
}

function handleFavouritesPanelKeydown(event) {
  if (event.key !== "Escape" || !openRemoveConfirmation) {
    return;
  }

  event.preventDefault();
  if (openRemoveConfirmation.pending) {
    return;
  }

  cancelFavouriteRemoveConfirmation({ restoreFocus: true });
}

function switchFavouritesTab(tab) {
  if (!["phrases", "batches"].includes(tab)) {
    return;
  }

  activeFavouritesTab = tab;
  clearFavouritesTransientState();
  renderFavourites();
}

function toggleExpandedBatchFavourite(favouriteId) {
  expandedBatchFavouriteId =
    expandedBatchFavouriteId === favouriteId ? null : favouriteId;
  renderFavourites();
  favouritesPanel
    ?.querySelector(
      `[data-toggle-batch-favourite-phrases="${CSS.escape(favouriteId)}"]`,
    )
    ?.focus();
}

function retryFavouritesTab(tab) {
  clearFavouritesTransientState();
  if (tab === "phrases") {
    void loadPhraseFavourites();
    return;
  }

  if (tab === "batches") {
    expandedBatchFavouriteId = null;
    void loadBatchFavourites();
  }
}

function clearFavouritesTransientState() {
  if (activeFavouritesStatusTimer !== null) {
    window.clearTimeout(activeFavouritesStatusTimer);
    activeFavouritesStatusTimer = null;
  }

  activeFavouritesStatus = "";
  clearRowActionStatusTimer();
  rowActionStatus = {
    phrases: null,
    batches: null,
  };
  invalidateFavouriteCopyRequests();
  invalidateFavouriteRemoveRequest();
  removeVisibleRowActionStatuses();

  openRemoveConfirmation = null;
}

function refreshStaleFavouritesTab(tab) {
  if (favouritesListState[tab] !== "stale") {
    return;
  }

  favouritesListState[tab] = "loading";
  window.setTimeout(() => {
    if (
      accountShell.persistenceAuthority.type !== "account" ||
      currentRoute !== ROUTES.favourites
    ) {
      favouritesListState[tab] = "stale";
      return;
    }

    if (tab === "phrases") {
      void loadPhraseFavourites();
      return;
    }

    if (tab === "batches") {
      void loadBatchFavourites();
    }
  }, 0);
}

function openFavouriteRemoveConfirmation(tab, favouriteId) {
  if (openRemoveConfirmation?.pending) {
    return;
  }

  clearFavouritesTransientState();
  openRemoveConfirmation = {
    tab,
    favouriteId,
    status: "",
    pending: false,
  };
  renderFavourites();
  findFavouriteRemoveCancelButton(favouriteId)?.focus();
}

function cancelFavouriteRemoveConfirmation({ restoreFocus }) {
  const confirmation = openRemoveConfirmation;
  if (confirmation?.pending) {
    return;
  }

  openRemoveConfirmation = null;
  renderFavourites();

  if (restoreFocus && confirmation) {
    findFavouriteRemoveOpenButton(
      confirmation.tab,
      confirmation.favouriteId,
    )?.focus();
  }
}

function renderPhraseFavourite(record) {
  const model = createFavouriteRowModel({
    kind: "phrase",
    record,
    currentHandle: accountShell.profile?.handle,
  });
  const item = document.createElement("li");
  item.className = "favourite-row";
  item.dataset.favouriteRow = record.id;
  item.dataset.favouriteKind = "phrase";
  item.tabIndex = -1;
  item.ariaLabel = model.accessibleLabel;

  const icon = createFontAwesomeIcon("solid", "quote-right");
  icon.classList.add("favourite-row-type-icon");

  const content = document.createElement("div");
  content.className = "favourite-row-content";

  const title = document.createElement("p");
  title.className = "favourite-row-title";
  title.dataset.favouritePhraseText = "";
  title.textContent = model.primaryText;
  title.title = model.primaryText;

  const actions = isFavouriteRemoveConfirmationOpen("phrases", record.id)
    ? renderFavouriteRemoveConfirmation("phrases", record.id)
    : renderPhraseFavouriteActions(record.id);

  content.append(title, renderFavouriteMeta(model));
  item.append(icon, content, actions);
  if (!isFavouriteRemoveConfirmationOpen("phrases", record.id)) {
    appendRowActionStatus(item, "phrases", record.id);
  }
  return item;
}

function renderBatchFavourite(record) {
  const model = createFavouriteRowModel({
    kind: "batch",
    record,
    currentHandle: accountShell.profile?.handle,
  });
  const item = document.createElement("li");
  item.className = "favourite-row";
  item.dataset.favouriteRow = record.id;
  item.dataset.favouriteKind = "batch";
  item.tabIndex = -1;
  item.ariaLabel = model.accessibleLabel;

  const icon = createFontAwesomeIcon("solid", "file-lines");
  icon.classList.add("favourite-row-type-icon");

  const content = document.createElement("div");
  content.className = "favourite-row-content";

  const title = document.createElement("p");
  title.className = "favourite-row-title";
  title.textContent = model.primaryText;

  const detail = document.createElement("p");
  detail.className = "favourite-row-detail";
  detail.textContent = model.detailText;

  const actions = isFavouriteRemoveConfirmationOpen("batches", record.id)
    ? renderFavouriteRemoveConfirmation("batches", record.id)
    : renderBatchFavouriteActions(record.id);

  content.append(title, detail, renderFavouriteMeta(model));
  item.append(icon, content, actions);
  if (expandedBatchFavouriteId === record.id) {
    item.append(renderExpandedBatchFavourite(record));
  }
  if (!isFavouriteRemoveConfirmationOpen("batches", record.id)) {
    appendRowActionStatus(item, "batches", record.id);
  }
  return item;
}

function renderPhraseFavouriteActions(recordId) {
  const actions = document.createElement("div");
  actions.className = "favourite-actions";

  const copyButton = createFavouriteIconActionButton({
    label: "Copy phrase",
    iconName: "copy",
    datasetName: "copyPhraseFavouriteId",
    datasetValue: recordId,
  });
  const removeButton = createFavouriteIconActionButton({
    label: "Remove phrase favourite",
    iconName: "heart-circle-minus",
    datasetName: "confirmRemovePhraseFavouriteId",
    datasetValue: recordId,
  });

  actions.append(copyButton, removeButton);
  return actions;
}

function renderBatchFavouriteActions(recordId) {
  const actions = document.createElement("div");
  actions.className = "favourite-actions";

  const disclosureButton = createBatchFavouriteDisclosureButton(recordId);
  const copyButton = createFavouriteIconActionButton({
    label: "Copy batch",
    iconName: "copy",
    datasetName: "copyBatchFavouriteId",
    datasetValue: recordId,
  });
  const removeButton = createFavouriteIconActionButton({
    label: "Remove batch favourite",
    iconName: "heart-circle-minus",
    datasetName: "confirmRemoveBatchFavouriteId",
    datasetValue: recordId,
  });

  actions.append(disclosureButton, copyButton, removeButton);
  return actions;
}

function renderFavouriteRemoveConfirmation(tab, recordId) {
  const confirmation = openRemoveConfirmation;
  const actions = document.createElement("div");
  actions.className = "favourite-actions favourite-remove-confirmation";
  actions.setAttribute("aria-busy", String(Boolean(confirmation?.pending)));

  const question = document.createElement("p");
  question.className = "favourite-remove-question";
  question.textContent =
    tab === "phrases" ? "Remove phrase favourite?" : "Remove batch favourite?";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "secondary-button icon-action-button";
  cancelButton.dataset.cancelFavouriteRemove = recordId;
  cancelButton.disabled = Boolean(confirmation?.pending);
  cancelButton.replaceChildren(
    createFontAwesomeIcon("solid", "circle-left"),
    "Cancel",
  );

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "danger-button icon-action-button";
  removeButton.dataset.removeConfirmedFavouriteId = recordId;
  removeButton.dataset.removeConfirmedFavouriteTab = tab;
  removeButton.disabled = Boolean(confirmation?.pending);
  removeButton.replaceChildren(
    createFontAwesomeIcon("solid", "heart-circle-minus"),
    "Remove",
  );

  actions.append(question, cancelButton, removeButton);

  if (confirmation?.status) {
    const status = document.createElement("p");
    status.className = "favourite-row-status";
    status.dataset.favouriteRowStatus = "";
    status.setAttribute("aria-live", "polite");
    status.textContent = confirmation.status;
    actions.append(status);
  }

  return actions;
}

function isFavouriteRemoveConfirmationOpen(tab, favouriteId) {
  return (
    openRemoveConfirmation?.tab === tab &&
    openRemoveConfirmation.favouriteId === favouriteId
  );
}

function renderExpandedBatchFavourite(record) {
  const group = document.createElement("div");
  group.className = "expanded-batch-favourite";
  group.dataset.expandedBatchFavourite = record.id;
  group.setAttribute("role", "group");
  group.ariaLabel = "Phrases in this batch favourite";

  const list = document.createElement("ul");
  list.className = "expanded-batch-favourite-list";
  list.replaceChildren(
    ...record.favourite.phrases.map((phrase) => {
      const item = document.createElement("li");
      item.textContent = phrase;
      return item;
    }),
  );

  group.append(list);
  return group;
}

function renderFavouriteMeta(model) {
  const meta = document.createElement("p");
  meta.className = "favourite-row-meta";

  const savedDate = document.createElement("span");
  savedDate.className = "favourite-row-date";
  savedDate.ariaLabel = model.savedDateAccessibleText;
  savedDate.textContent = model.savedDateText || "Saved date unavailable";

  const participant = document.createElement("span");
  participant.className = "favourite-row-participants";
  participant.textContent = model.participantIndicator;

  meta.append(savedDate, participant);
  return meta;
}

function createFavouriteIconActionButton({
  label,
  iconName,
  datasetName,
  datasetValue,
}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className =
    "secondary-button icon-action-button tooltip-action favourite-action-button";
  button.dataset[datasetName] = datasetValue;
  button.dataset.tooltip = label;
  button.ariaLabel = label;
  button.title = label;
  if (isFavouriteRouteCopyDataset(datasetName)) {
    button.disabled = isFavouriteRouteCopyLocked();
  }
  button.replaceChildren(
    createFontAwesomeIcon("solid", iconName),
    createScreenReaderText(label),
  );
  return button;
}

function createBatchFavouriteDisclosureButton(recordId) {
  const isExpanded = expandedBatchFavouriteId === recordId;
  const label = isExpanded ? "Hide phrases" : "View phrases";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary-button favourite-disclosure-button";
  button.dataset.toggleBatchFavouritePhrases = recordId;
  button.setAttribute("aria-expanded", String(isExpanded));
  button.textContent = label;
  button.ariaLabel = label;
  return button;
}

function appendRowActionStatus(item, tab, recordId) {
  const status = rowActionStatus[tab];
  if (!status || status.recordId !== recordId) {
    return;
  }

  const statusElement = document.createElement("p");
  statusElement.className = "favourite-row-status";
  statusElement.dataset.favouriteRowStatus = "";
  statusElement.setAttribute("aria-live", "polite");
  statusElement.textContent = status.message;
  item.append(statusElement);
}

function setRowActionStatus(tab, recordId, message, { autoClear = false } = {}) {
  clearRowActionStatusTimer();
  rowActionStatus[tab] = { recordId, message };
  renderRowActionStatus(tab, recordId);

  if (!autoClear) {
    return;
  }

  rowActionStatusTimer = window.setTimeout(() => {
    const status = rowActionStatus[tab];
    if (status?.recordId === recordId && status?.message === message) {
      rowActionStatus[tab] = null;
      removeVisibleRowActionStatuses(tab);
    }
    rowActionStatusTimer = null;
  }, 2000);
}

function clearRowActionStatus(tab) {
  clearRowActionStatusTimer();
  rowActionStatus[tab] = null;
  removeVisibleRowActionStatuses(tab);
}

function renderRowActionStatus(tab, recordId) {
  if (currentRoute !== ROUTES.favourites || activeFavouritesTab !== tab) {
    return;
  }

  removeVisibleRowActionStatuses(tab);

  const row = findVisibleFavouriteRow(tab, recordId);
  const status = rowActionStatus[tab];
  if (!row || !status || status.recordId !== recordId) {
    return;
  }

  const statusElement = document.createElement("p");
  statusElement.className = "favourite-row-status";
  statusElement.dataset.favouriteRowStatus = "";
  statusElement.setAttribute("aria-live", "polite");
  statusElement.textContent = status.message;
  row.append(statusElement);
}

function removeVisibleRowActionStatuses(tab = activeFavouritesTab) {
  if (!favouritesPanel || currentRoute !== ROUTES.favourites) {
    return;
  }

  const kind = tab === "phrases" ? "phrase" : "batch";
  favouritesPanel
    .querySelectorAll(
      `[data-favourite-kind="${kind}"] [data-favourite-row-status]`,
    )
    .forEach((status) => status.remove());
}

function findVisibleFavouriteRow(tab, recordId) {
  if (!favouritesPanel) {
    return null;
  }

  const kind = tab === "phrases" ? "phrase" : "batch";
  return (
    [...favouritesPanel.querySelectorAll(`[data-favourite-kind="${kind}"]`)].find(
      (row) => row.dataset.favouriteRow === recordId,
    ) ?? null
  );
}

function clearRowActionStatusTimer() {
  if (rowActionStatusTimer === null) {
    return;
  }

  window.clearTimeout(rowActionStatusTimer);
  rowActionStatusTimer = null;
}

function createFavouriteCopyRequest(tab, favouriteId, initiatingButton) {
  if (
    currentRoute !== ROUTES.favourites ||
    activeFavouritesTab !== tab ||
    accountShell.persistenceAuthority.type !== "account" ||
    isFavouriteRouteCopyLocked()
  ) {
    return null;
  }

  const record = getFavouriteRecordForTab(tab, favouriteId);
  if (!record) {
    return null;
  }

  const lockId = (favouriteRouteCopyLockId += 1);
  const request = {
    accountId: accountShell.accountId,
    favouriteId,
    focusTarget: createFavouriteCopyFocusTarget({
      favouriteId,
      initiatingButton,
      tab,
    }),
    lockId,
    requestId: (favouriteCopyRequestIds[tab] += 1),
    tab,
  };
  favouriteRouteCopyLock = {
    favouriteId,
    lockId,
    tab,
  };
  setFavouriteRouteCopyButtonsDisabled(true);
  return request;
}

function isCurrentFavouriteCopyRequest(request) {
  return (
    request &&
    currentRoute === ROUTES.favourites &&
    activeFavouritesTab === request.tab &&
    accountShell.persistenceAuthority.type === "account" &&
    accountShell.accountId === request.accountId &&
    favouriteCopyRequestIds[request.tab] === request.requestId &&
    Boolean(getFavouriteRecordForTab(request.tab, request.favouriteId))
  );
}

function isFavouriteRouteCopyDataset(datasetName) {
  return (
    datasetName === "copyPhraseFavouriteId" ||
    datasetName === "copyBatchFavouriteId"
  );
}

function isFavouriteRouteCopyLocked() {
  return favouriteRouteCopyLock !== null;
}

function releaseFavouriteRouteCopyLock(request) {
  if (favouriteRouteCopyLock?.lockId !== request.lockId) {
    return;
  }

  favouriteRouteCopyLock = null;
  setFavouriteRouteCopyButtonsDisabled(false);
}

function setFavouriteRouteCopyButtonsDisabled(disabled) {
  favouritesPanel
    ?.querySelectorAll(
      "[data-copy-phrase-favourite-id], [data-copy-batch-favourite-id]",
    )
    .forEach((button) => {
      button.disabled = disabled;
    });
}

function createFavouriteCopyFocusTarget({ favouriteId, initiatingButton, tab }) {
  return {
    favouriteId,
    restoreIfFocusLost: document.activeElement === initiatingButton,
    tab,
  };
}

function restoreFavouriteCopyFocus(focusTarget) {
  if (!focusTarget?.restoreIfFocusLost) {
    return;
  }

  const activeElement = document.activeElement;
  if (
    activeElement &&
    activeElement !== document.body &&
    activeElement.isConnected
  ) {
    return;
  }

  const button = findFavouriteCopyButton(
    focusTarget.tab,
    focusTarget.favouriteId,
  );
  if (!button || button.disabled) {
    return;
  }

  button.focus();
}

function findFavouriteCopyButton(tab, favouriteId) {
  if (!favouritesPanel) {
    return null;
  }

  const datasetName =
    tab === "phrases" ? "copyPhraseFavouriteId" : "copyBatchFavouriteId";
  const selector =
    tab === "phrases"
      ? "[data-copy-phrase-favourite-id]"
      : "[data-copy-batch-favourite-id]";
  return (
    [...favouritesPanel.querySelectorAll(selector)].find(
      (button) => button.dataset[datasetName] === favouriteId,
    ) ?? null
  );
}

function getFavouriteRecordForTab(tab, favouriteId) {
  const records = tab === "phrases" ? phraseFavourites : batchFavourites;
  return records.find((candidate) => candidate.id === favouriteId) ?? null;
}

function invalidateFavouriteCopyRequests(tab) {
  if (tab) {
    favouriteCopyRequestIds[tab] += 1;
    return;
  }

  favouriteCopyRequestIds.phrases += 1;
  favouriteCopyRequestIds.batches += 1;
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
  const context = captureCurrentRevealFavouriteContext();

  if (!context) {
    return;
  }

  const favourite = createPhraseFavouriteSnapshot(game, {
    rowIndex,
    wordBank,
  });
  const pendingRequest = addPendingFavouriteToggleRequest(context, {
    rowIndex,
    type: "phrase",
  });
  renderCurrentFavouritePendingSurface(context);

  try {
    await waitForLocalTestPrivateFavouritesMutation();
    assertLocalTestPrivateFavouriteSaveAllowed();
    const savedFavourite = await privateFavouritesRepository.savePhraseFavourite({
      accountId: context.accountId,
      favourite,
    });
    removePendingFavouriteToggleRequest(pendingRequest);

    if (!isSameActiveAccount(context)) {
      return;
    }

    phraseFavourites = upsertFavouriteRecord(phraseFavourites, savedFavourite);
    renderSuccessfulFavouriteMutationResult(context, "Phrase favourite saved.");
  } catch {
    removePendingFavouriteToggleRequest(pendingRequest);
    renderFailedFavouriteMutationResult(
      context,
      "Could not update phrase favourite.",
    );
  }
}

async function saveBatchFavourite() {
  const context = captureCurrentRevealFavouriteContext();

  if (!context) {
    return;
  }

  const favourite = createBatchFavouriteSnapshot(game, {
    wordBank,
  });
  const pendingRequest = addPendingFavouriteToggleRequest(context, {
    type: "batch",
  });
  renderCurrentFavouritePendingSurface(context);

  try {
    await waitForLocalTestPrivateFavouritesMutation();
    assertLocalTestPrivateFavouriteSaveAllowed();
    const savedFavourite = await privateFavouritesRepository.saveBatchFavourite({
      accountId: context.accountId,
      favourite,
    });
    removePendingFavouriteToggleRequest(pendingRequest);

    if (!isSameActiveAccount(context)) {
      return;
    }

    batchFavourites = upsertFavouriteRecord(batchFavourites, savedFavourite);
    renderSuccessfulFavouriteMutationResult(context, "Batch favourite saved.");
  } catch {
    removePendingFavouriteToggleRequest(pendingRequest);
    renderFailedFavouriteMutationResult(
      context,
      "Could not update batch favourite.",
    );
  }
}

async function togglePhraseFavourite(rowIndex) {
  if (accountShell.persistenceAuthority.type !== "account") {
    return;
  }

  const savedRecord = findPhraseFavouriteRecordForCurrentReveal(rowIndex);

  if (savedRecord) {
    await removeCurrentPhraseFavourite(savedRecord.id, rowIndex);
    return;
  }

  await savePhraseFavourite(rowIndex);
}

async function toggleBatchFavourite() {
  if (accountShell.persistenceAuthority.type !== "account") {
    return;
  }

  const savedRecord = findBatchFavouriteRecordForCurrentReveal();

  if (savedRecord) {
    await removeCurrentBatchFavourite(savedRecord.id);
    return;
  }

  await saveBatchFavourite();
}

async function removeCurrentPhraseFavourite(favouriteId, rowIndex) {
  const context = captureCurrentRevealFavouriteContext();

  if (!context) {
    return;
  }

  const pendingRequest = addPendingFavouriteToggleRequest(context, {
    rowIndex,
    type: "phrase",
  });
  renderCurrentFavouritePendingSurface(context);

  try {
    await waitForLocalTestPrivateFavouritesMutation("remove");
    await privateFavouritesRepository.removePhraseFavourite({
      accountId: context.accountId,
      favouriteId,
    });
    removePendingFavouriteToggleRequest(pendingRequest);

    if (!isSameActiveAccount(context)) {
      return;
    }

    phraseFavourites = phraseFavourites.filter(
      (record) => record.id !== favouriteId,
    );
    renderSuccessfulFavouriteMutationResult(context, "Phrase favourite removed.");
  } catch {
    removePendingFavouriteToggleRequest(pendingRequest);
    renderFailedFavouriteMutationResult(
      context,
      "Could not update phrase favourite.",
    );
  }
}

async function removeCurrentBatchFavourite(favouriteId) {
  const context = captureCurrentRevealFavouriteContext();

  if (!context) {
    return;
  }

  const pendingRequest = addPendingFavouriteToggleRequest(context, {
    type: "batch",
  });
  renderCurrentFavouritePendingSurface(context);

  try {
    await waitForLocalTestPrivateFavouritesMutation("remove");
    await privateFavouritesRepository.removeBatchFavourite({
      accountId: context.accountId,
      favouriteId,
    });
    removePendingFavouriteToggleRequest(pendingRequest);

    if (!isSameActiveAccount(context)) {
      return;
    }

    batchFavourites = batchFavourites.filter((record) => record.id !== favouriteId);
    renderSuccessfulFavouriteMutationResult(context, "Batch favourite removed.");
  } catch {
    removePendingFavouriteToggleRequest(pendingRequest);
    renderFailedFavouriteMutationResult(
      context,
      "Could not update batch favourite.",
    );
  }
}

function captureCurrentRevealFavouriteContext() {
  if (accountShell.persistenceAuthority.type !== "account" || !game.revealed) {
    return null;
  }

  return {
    accountId: accountShell.accountId,
    reveal: createBatchFavouriteSnapshot(game, { wordBank }),
  };
}

function addPendingFavouriteToggleRequest(context, target) {
  const request = {
    ...context,
    ...target,
    id: String((favouriteToggleRequestId += 1)),
  };
  pendingFavouriteToggleRequests = [...pendingFavouriteToggleRequests, request];
  return request;
}

function removePendingFavouriteToggleRequest(request) {
  pendingFavouriteToggleRequests = pendingFavouriteToggleRequests.filter(
    (candidate) => candidate.id !== request.id,
  );
}

function isFavouriteTogglePending(target) {
  return pendingFavouriteToggleRequests.some(
    (request) =>
      request.type === target.type &&
      request.rowIndex === target.rowIndex &&
      isCurrentRevealFavouriteContext(request),
  );
}

function isCurrentRevealFavouriteContext(context) {
  if (
    !isSameActiveAccount(context) ||
    !game.revealed
  ) {
    return false;
  }

  return areFavouriteSnapshotsEqual(
    createBatchFavouriteSnapshot(game, { wordBank }),
    context.reveal,
  );
}

function isSameActiveAccount(context) {
  return (
    accountShell.persistenceAuthority.type === "account" &&
    accountShell.accountId === context.accountId
  );
}

function renderCurrentFavouritePendingSurface(context) {
  if (!isCurrentRevealFavouriteContext(context) || currentRoute !== ROUTES.playSolo) {
    return;
  }

  renderGame();
}

function renderSuccessfulFavouriteMutationResult(context, statusText) {
  if (!isSameActiveAccount(context)) {
    return;
  }

  if (currentRoute === ROUTES.favourites) {
    renderFavourites();
    return;
  }

  if (!isCurrentRevealFavouriteContext(context) || currentRoute !== ROUTES.playSolo) {
    return;
  }

  renderGame();
  copyStatus.textContent = statusText;
}

function renderFailedFavouriteMutationResult(context, statusText) {
  if (!isCurrentRevealFavouriteContext(context) || currentRoute !== ROUTES.playSolo) {
    return;
  }

  renderGame();
  copyStatus.textContent = statusText;
}

async function waitForLocalTestPrivateFavouritesMutation(operation = "mutation") {
  const mode = getLocalTestPrivateFavouritesMode();
  if (
    mode !== "mutation-delays" &&
    (mode !== "remove-fails-after-delay" || operation !== "remove")
  ) {
    return;
  }

  await new Promise((resolve) => {
    window.setTimeout(resolve, 500);
  });
}

function assertLocalTestPrivateFavouriteSaveAllowed() {
  if (getLocalTestPrivateFavouritesMode() === "save-fails") {
    throw new Error("Local test private favourite save failed.");
  }
}

async function copyPhraseFavourite(favouriteId, initiatingButton) {
  const record = getFavouriteRecordForTab("phrases", favouriteId);
  if (!record) {
    return;
  }

  const request = createFavouriteCopyRequest(
    "phrases",
    favouriteId,
    initiatingButton,
  );
  if (!request) {
    return;
  }

  clearRowActionStatus("phrases");
  let copied = false;
  let shouldPublishStatus = false;

  try {
    copied = await writePlainText(getPhraseFavouriteCopyText(record));
    shouldPublishStatus = isCurrentFavouriteCopyRequest(request);
  } catch {
    shouldPublishStatus = isCurrentFavouriteCopyRequest(request);
  } finally {
    releaseFavouriteRouteCopyLock(request);
  }

  if (!shouldPublishStatus) {
    return;
  }

  if (copied) {
    setRowActionStatus("phrases", favouriteId, "Phrase copied.", {
      autoClear: true,
    });
    restoreFavouriteCopyFocus(request.focusTarget);
    return;
  }

  setRowActionStatus("phrases", favouriteId, "Could not copy phrase.");
  restoreFavouriteCopyFocus(request.focusTarget);
}

async function copyBatchFavourite(favouriteId, initiatingButton) {
  const record = getFavouriteRecordForTab("batches", favouriteId);
  if (!record) {
    return;
  }

  const request = createFavouriteCopyRequest(
    "batches",
    favouriteId,
    initiatingButton,
  );
  if (!request) {
    return;
  }

  clearRowActionStatus("batches");
  let copied = false;
  let shouldPublishStatus = false;

  try {
    copied = await writePlainText(getBatchFavouriteCopyText(record));
    shouldPublishStatus = isCurrentFavouriteCopyRequest(request);
  } catch {
    shouldPublishStatus = isCurrentFavouriteCopyRequest(request);
  } finally {
    releaseFavouriteRouteCopyLock(request);
  }

  if (!shouldPublishStatus) {
    return;
  }

  if (copied) {
    setRowActionStatus("batches", favouriteId, "Batch copied.", {
      autoClear: true,
    });
    restoreFavouriteCopyFocus(request.focusTarget);
    return;
  }

  setRowActionStatus("batches", favouriteId, "Could not copy batch.");
  restoreFavouriteCopyFocus(request.focusTarget);
}

async function removeFavouriteFromRoute({ tab, favouriteId }) {
  const confirmation = openRemoveConfirmation;
  if (
    !confirmation ||
    confirmation.pending ||
    confirmation.tab !== tab ||
    confirmation.favouriteId !== favouriteId ||
    !["phrases", "batches"].includes(tab) ||
    accountShell.persistenceAuthority.type !== "account"
  ) {
    return;
  }

  const removedIndex = getFavouriteRemovalIndex(tab, favouriteId);
  if (removedIndex === -1) {
    return;
  }

  const request = createFavouriteRemoveRequest({
    confirmation,
    favouriteId,
    tab,
  });
  confirmation.pending = true;
  confirmation.status =
    tab === "phrases"
      ? "Removing phrase favourite..."
      : "Removing batch favourite...";
  renderFavourites();

  try {
    await waitForLocalTestPrivateFavouritesMutation("remove");
    if (tab === "phrases") {
      await privateFavouritesRepository.removePhraseFavourite({
        accountId: request.accountId,
        favouriteId,
      });
      if (!isCurrentFavouriteRemoveMountedContext(request)) {
        settleStaleFavouriteRemoveRequest(request);
        return;
      }

      phraseFavourites = phraseFavourites.filter(
        (record) => record.id !== favouriteId,
      );
    } else {
      await privateFavouritesRepository.removeBatchFavourite({
        accountId: request.accountId,
        favouriteId,
      });
      if (!isCurrentFavouriteRemoveMountedContext(request)) {
        settleStaleFavouriteRemoveRequest(request);
        return;
      }

      batchFavourites = batchFavourites.filter(
        (record) => record.id !== favouriteId,
      );
      if (expandedBatchFavouriteId === favouriteId) {
        expandedBatchFavouriteId = null;
      }
    }

    if (!isCurrentFavouriteRemoveUiRequest(request)) {
      clearFavouriteRemoveRequest(request);
      renderFavourites();
      return;
    }

    clearFavouriteRemoveRequest(request);
    renderGame();
    handleFavouriteRemovalSuccess({
      tab,
      removedIndex,
      message:
        tab === "phrases"
          ? "Phrase favourite removed."
          : "Batch favourite removed.",
    });
  } catch {
    if (!isCurrentFavouriteRemoveUiRequest(request)) {
      settleStaleFavouriteRemoveRequest(request);
      return;
    }

    completeFavouriteRemoveRequest(request);
    confirmation.pending = false;
    confirmation.status =
      tab === "phrases"
        ? "Could not remove phrase favourite."
        : "Could not remove batch favourite.";
    renderFavourites();
    findFavouriteRemoveCancelButton(favouriteId)?.focus();
  }
}

function createFavouriteRemoveRequest({ confirmation, favouriteId, tab }) {
  const request = {
    accountId: accountShell.accountId,
    activeTab: activeFavouritesTab,
    confirmation,
    favouriteId,
    requestId: (favouriteRemoveRequestId += 1),
    route: currentRoute,
    tab,
  };
  confirmation.requestId = request.requestId;
  activeFavouriteRemoveRequest = request;
  return request;
}

function isCurrentFavouriteRemoveMutationAccount(request) {
  return (
    accountShell.persistenceAuthority.type === "account" &&
    accountShell.accountId === request.accountId
  );
}

function isCurrentFavouriteRemoveMountedContext(request) {
  return (
    isCurrentFavouriteRemoveMutationAccount(request) &&
    request.route === ROUTES.favourites &&
    currentRoute === ROUTES.favourites
  );
}

function isCurrentFavouriteRemoveUiRequest(request) {
  return (
    isCurrentFavouriteRemoveMountedContext(request) &&
    activeFavouritesTab === request.activeTab &&
    activeFavouritesTab === request.tab &&
    openRemoveConfirmation === request.confirmation &&
    openRemoveConfirmation?.requestId === request.requestId &&
    openRemoveConfirmation?.favouriteId === request.favouriteId &&
    openRemoveConfirmation?.tab === request.tab &&
    activeFavouriteRemoveRequest?.requestId === request.requestId
  );
}

function settleStaleFavouriteRemoveRequest(request) {
  clearFavouriteRemoveRequest(request);
  favouritesListState[request.tab] = "stale";
}

function clearFavouriteRemoveRequest(request) {
  completeFavouriteRemoveRequest(request);

  if (openRemoveConfirmation?.requestId === request.requestId) {
    openRemoveConfirmation = null;
  }
}

function completeFavouriteRemoveRequest(request) {
  if (activeFavouriteRemoveRequest?.requestId === request.requestId) {
    activeFavouriteRemoveRequest = null;
  }
}

function invalidateFavouriteRemoveRequest() {
  activeFavouriteRemoveRequest = null;
  favouriteRemoveRequestId += 1;
}

function handleFavouriteRemovalSuccess({ tab, removedIndex, message }) {
  if (currentRoute !== ROUTES.favourites || activeFavouritesTab !== tab) {
    renderFavourites();
    return;
  }

  setActiveFavouritesStatus(message);
  getFavouriteRemovalFocusTarget(tab, removedIndex)?.focus();
}

function setActiveFavouritesStatus(message) {
  if (activeFavouritesStatusTimer !== null) {
    window.clearTimeout(activeFavouritesStatusTimer);
    activeFavouritesStatusTimer = null;
  }

  activeFavouritesStatus = message;
  renderFavourites();

  activeFavouritesStatusTimer = window.setTimeout(() => {
    if (activeFavouritesStatus === message) {
      activeFavouritesStatus = "";
      renderFavourites();
    }

    activeFavouritesStatusTimer = null;
  }, 2000);
}

function getFavouriteRemovalIndex(tab, favouriteId) {
  const records = tab === "phrases" ? phraseFavourites : batchFavourites;
  return records.findIndex((record) => record.id === favouriteId);
}

function getFavouriteRemovalFocusTarget(tab, removedIndex) {
  if (!favouritesPanel) {
    return null;
  }

  const kind = tab === "phrases" ? "phrase" : "batch";
  const rows = [
    ...favouritesPanel.querySelectorAll(`[data-favourite-kind="${kind}"]`),
  ];

  return (
    rows[Math.min(removedIndex, rows.length - 1)] ??
    rows[removedIndex - 1] ??
    favouritesPanel.querySelector(
      `[data-favourites-empty-heading="${CSS.escape(tab)}"]`,
    ) ??
    null
  );
}

function findFavouriteRemoveCancelButton(favouriteId) {
  return favouritesPanel?.querySelector(
    `[data-cancel-favourite-remove="${CSS.escape(favouriteId)}"]`,
  );
}

function findFavouriteRemoveOpenButton(tab, favouriteId) {
  if (!favouritesPanel) {
    return null;
  }

  const datasetName =
    tab === "phrases"
      ? "confirmRemovePhraseFavouriteId"
      : "confirmRemoveBatchFavouriteId";
  const selector =
    tab === "phrases"
      ? "[data-confirm-remove-phrase-favourite-id]"
      : "[data-confirm-remove-batch-favourite-id]";

  return (
    [...favouritesPanel.querySelectorAll(selector)].find(
      (button) => button.dataset[datasetName] === favouriteId,
    ) ?? null
  );
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

function findPhraseFavouriteRecordForCurrentReveal(phraseIndex) {
  if (accountShell.persistenceAuthority.type !== "account" || !game.revealed) {
    return null;
  }

  const favourite = createPhraseFavouriteSnapshot(game, {
    rowIndex: phraseIndex,
    wordBank,
  });

  return (
    phraseFavourites.find((record) =>
      areFavouriteSnapshotsEqual(record.favourite, favourite),
    ) ?? null
  );
}

function findBatchFavouriteRecordForCurrentReveal() {
  if (accountShell.persistenceAuthority.type !== "account" || !game.revealed) {
    return null;
  }

  const favourite = createBatchFavouriteSnapshot(game, {
    wordBank,
  });

  return (
    batchFavourites.find((record) =>
      areFavouriteSnapshotsEqual(record.favourite, favourite),
    ) ?? null
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
      resolvePendingSupabaseAuthCallbackHash();
      return;
    }

    const hostedAccountProfileRepository =
      createSupabaseAccountProfileRepository({ supabase });
    const hostedAvatarStorageRepository =
      createSupabaseAvatarStorageRepository({ supabase });

    hostedAuthSession = createSupabaseAuthSession({
      prepareAuthRedirect: preserveCurrentSignedInRouteForHostedAuth,
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
    resolvePendingSupabaseAuthCallbackHash();
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
    resolvePendingSupabaseAuthCallbackHash();
  }
}

async function applyAccountShell(shell) {
  accountShell = shell;

  if (accountShell.persistenceAuthority.type === "account") {
    await loadSignedInCurrentGame();
    await Promise.all([loadPhraseFavourites(), loadBatchFavourites()]);
    await loadPendingGameLists();
  } else {
    signedInGameSession.reset();
    game =
      loadCurrentAnonymousSoloGame(window.localStorage) ??
      createAnonymousSoloGame({ rowCount: 20 });
    phraseFavourites = [];
    batchFavourites = [];
    invalidateFavouritesListLoads();
    favouritesListState.phrases = "idle";
    favouritesListState.batches = "idle";
    activeFavouritesTab = "phrases";
    expandedBatchFavouriteId = null;
    clearFavouritesTransientState();
    resetPendingGameState();
    hidePersistenceRecovery();
  }

  const restoredSignedInRoute =
    accountShell.persistenceAuthority.type === "account"
      ? requestedSignedInRoute ??
        signedInRouteHandoff.consume({ hasAccountSession: true })
      : null;

  if (
    accountShell.persistenceAuthority.type === "account" &&
    restoredSignedInRoute &&
    signedInOnlyRoutes.has(restoredSignedInRoute)
  ) {
    currentRoute = restoredSignedInRoute;
    requestedSignedInRoute = null;
    signedInRouteHandoff.clear();
    ensureHashRoute(currentRoute);
    scheduleSignedInRouteHashReconciliation(currentRoute);
  } else if (accountShell.persistenceAuthority.type === "account") {
    requestedSignedInRoute = null;
    signedInRouteHandoff.clear();
  }

  renderAccountShell(accountShell);
  renderRoute();
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
  invalidateFavouritesListLoads();
  favouritesListState.phrases = "idle";
  favouritesListState.batches = "idle";
  activeFavouritesTab = "phrases";
  expandedBatchFavouriteId = null;
  clearFavouritesTransientState();
  resetPendingGameState();
  hidePersistenceRecovery();
  requestedSignedInRoute = null;
  signedInRouteHandoff.clear();
  if (signedInOnlyRoutes.has(currentRoute)) {
    currentRoute = ROUTES.playSolo;
    ensureHashRoute(ROUTES.playSolo);
  }
  renderAccountShell(accountShell);
  renderRoute();
}

async function loadPhraseFavourites() {
  const requestId = ++phraseFavouritesLoadRequestId;

  if (accountShell.persistenceAuthority.type !== "account") {
    phraseFavourites = [];
    favouritesListState.phrases = "idle";
    renderRoute();
    return;
  }

  const accountId = accountShell.accountId;
  favouritesListState.phrases = "loading";
  renderRoute();

  try {
    const records = await privateFavouritesRepository.listPhraseFavourites({
      accountId,
    });
    if (!isCurrentFavouritesListLoad("phrases", { accountId, requestId })) {
      return;
    }

    phraseFavourites = records;
    favouritesListState.phrases = "loaded";
  } catch {
    if (!isCurrentFavouritesListLoad("phrases", { accountId, requestId })) {
      return;
    }

    phraseFavourites = [];
    favouritesListState.phrases = "error";
  }

  renderRoute();
}

async function loadBatchFavourites() {
  const requestId = ++batchFavouritesLoadRequestId;

  if (accountShell.persistenceAuthority.type !== "account") {
    batchFavourites = [];
    favouritesListState.batches = "idle";
    renderRoute();
    return;
  }

  const accountId = accountShell.accountId;
  favouritesListState.batches = "loading";
  renderRoute();

  try {
    const records = await privateFavouritesRepository.listBatchFavourites({
      accountId,
    });
    if (!isCurrentFavouritesListLoad("batches", { accountId, requestId })) {
      return;
    }

    batchFavourites = records;
    favouritesListState.batches = "loaded";
  } catch {
    if (!isCurrentFavouritesListLoad("batches", { accountId, requestId })) {
      return;
    }

    batchFavourites = [];
    favouritesListState.batches = "error";
  }

  renderRoute();
}

function invalidateFavouritesListLoads() {
  phraseFavouritesLoadRequestId += 1;
  batchFavouritesLoadRequestId += 1;
}

function isCurrentFavouritesListLoad(tab, { accountId, requestId }) {
  const currentRequestId =
    tab === "phrases"
      ? phraseFavouritesLoadRequestId
      : batchFavouritesLoadRequestId;

  return (
    requestId === currentRequestId &&
    accountShell.persistenceAuthority.type === "account" &&
    accountShell.accountId === accountId
  );
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
