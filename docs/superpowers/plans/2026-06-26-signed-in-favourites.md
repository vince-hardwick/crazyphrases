# Signed-in Favourites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved signed-in `#/favourites` destination and supporting favourite-heart behaviour for current revealed output.

**Architecture:** Keep the existing static HTML, CSS, and plain JavaScript app. Add a small hash-route controller in `assets/app.js`, extract pure Favourites row-model helpers to `assets/favourites-view-model.js`, and reuse the existing private-favourites repositories as the Account-backed data authority.

**Tech Stack:** Static HTML, `assets/app.js` ES modules, `assets/site.css`, Node `node:test`, Playwright browser smoke tests, Supabase-backed repository adapters already present in the repo.

---

**Status:** Active implementation plan awaiting execution approach selection.

**Source Spec:** `docs/superpowers/specs/2026-06-26-signed-in-favourites-design.md`

**Current Product Authority:** `docs/product-rules.md#signed-in-favourites`, `docs/product-rules.md#signed-in-navigation`, and `docs/product-rules.md#icon-first-actions`.

## File Structure

- Create `assets/favourites-view-model.js`: pure helpers for row labels, saved-date formatting, participant indicators, copy payloads, and row accessible labels. This keeps date and snapshot formatting out of DOM code.
- Modify `assets/app.js`: add hash-route state, route gating, primary navigation rendering, current-output heart toggles, Favourites destination rendering, tab state, list loading states, row actions, remove confirmation, status timers, and focus recovery.
- Modify `index.html`: add a primary signed-in navigation mount and a sign-in-required route gate mount near the header/main app shell.
- Modify `assets/site.css`: style the primary navigation, route gate, Favourites tabs, rows, icon buttons, visible tooltips, row-local statuses, inline confirmations, programmatic row focus, and narrow viewport wrapping.
- Modify `tests/browser-smoke.test.mjs`: replace inline-favourites assertions with route-based Favourites acceptance coverage and update current-output favourite controls from text save buttons to heart toggles.
- Create `tests/favourites-view-model.test.mjs`: unit coverage for date labels, participant indicators, copy payloads, and row accessible-label helpers.
- Modify `docs/superpowers/README.md`: mark the approved spec as implementation provenance and register this active plan.
- Modify `docs/superpowers/specs/2026-06-26-signed-in-favourites-design.md`: update the status header so future agents do not treat the spec as waiting for review.

## Implementation Tasks

### Task 1: Add Favourites View-Model Helpers

**Files:**

- Create: `assets/favourites-view-model.js`
- Create: `tests/favourites-view-model.test.mjs`

- [ ] **Step 1: Write failing tests for date, participant, copy, and label helpers**

Add `tests/favourites-view-model.test.mjs`:

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createFavouriteRowModel,
  formatFavouriteSavedDate,
  getBatchFavouriteCopyText,
  getPhraseFavouriteCopyText,
} from "../assets/favourites-view-model.js";

describe("favourites view model", () => {
  it("formats saved timestamps as fixed UK English dates", () => {
    assert.equal(
      formatFavouriteSavedDate("2026-06-26T15:31:42.000Z"),
      "26 Jun 2026",
    );
  });

  it("uses Solo as the participant indicator for current solo snapshots", () => {
    const model = createFavouriteRowModel({
      kind: "phrase",
      record: {
        id: "phrase-1",
        accountId: "account-1",
        createdAt: "2026-06-26T15:31:42.000Z",
        favourite: {
          type: "phrase",
          sourceMode: "signed-in-solo",
          templateId: "default-adjective-noun-noun",
          rowIndex: 1,
          phraseText: "Brisk teapot ladder",
          entries: [],
        },
      },
      currentHandle: "player-test-account",
    });

    assert.equal(model.savedDateText, "26 Jun 2026");
    assert.equal(model.savedDateAccessibleText, "Saved 26 Jun 2026");
    assert.equal(model.participantIndicator, "Solo");
    assert.equal(
      model.accessibleLabel,
      "Phrase favourite, saved 26 Jun 2026, Solo",
    );
  });

  it("uses a compact batch accessible label with phrase count", () => {
    const model = createFavouriteRowModel({
      kind: "batch",
      record: {
        id: "batch-1",
        accountId: "account-1",
        createdAt: "2026-06-26T15:31:42.000Z",
        favourite: {
          type: "batch",
          sourceMode: "signed-in-solo",
          templateId: "default-adjective-noun-noun",
          rowCount: 2,
          phrases: ["Brisk teapot ladder", "Calm pencil umbrella"],
          rows: [],
        },
      },
      currentHandle: "player-test-account",
    });

    assert.equal(model.primaryText, "Batch favourite");
    assert.equal(model.detailText, "2 phrases");
    assert.equal(
      model.accessibleLabel,
      "Batch favourite, 2 phrases, saved 26 Jun 2026, Solo",
    );
  });

  it("creates immutable snapshot copy payloads", () => {
    const phraseRecord = {
      favourite: {
        phraseText: "Brisk teapot ladder",
      },
    };
    const batchRecord = {
      favourite: {
        phrases: ["Brisk teapot ladder", "Calm pencil umbrella"],
      },
    };

    assert.equal(getPhraseFavouriteCopyText(phraseRecord), "Brisk teapot ladder");
    assert.equal(
      getBatchFavouriteCopyText(batchRecord),
      "Crazy Phrases\nBrisk teapot ladder\nCalm pencil umbrella",
    );
  });
});
```

- [ ] **Step 2: Run the helper test and verify it fails**

Run:

```bash
npm test -- tests/favourites-view-model.test.mjs
```

Expected: `FAIL` because `assets/favourites-view-model.js` does not exist.

- [ ] **Step 3: Add the helper module**

Create `assets/favourites-view-model.js`:

```js
import {
  formatBatchCopyText,
  formatPhraseCopyText,
} from "./game-state.js?v=__ASSET_VERSION__";

const FIXED_UK_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatFavouriteSavedDate(createdAt) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return FIXED_UK_DATE_FORMATTER.format(date);
}

export function createFavouriteRowModel({ kind, record, currentHandle = "" }) {
  const savedDateText = formatFavouriteSavedDate(record.createdAt);
  const savedDateAccessibleText =
    savedDateText === "" ? "Saved date unavailable" : `Saved ${savedDateText}`;
  const participantIndicator = getParticipantIndicator({
    favourite: record.favourite,
    currentHandle,
  });

  if (kind === "phrase") {
    return {
      id: record.id,
      kind,
      primaryText: record.favourite.phraseText,
      savedDateText,
      savedDateAccessibleText,
      participantIndicator,
      accessibleLabel:
        `Phrase favourite, saved ${savedDateText}, ${participantIndicator}`,
    };
  }

  const phraseCount = record.favourite.rowCount ?? record.favourite.phrases.length;
  const phraseCountText = `${phraseCount} ${phraseCount === 1 ? "phrase" : "phrases"}`;

  return {
    id: record.id,
    kind,
    primaryText: "Batch favourite",
    detailText: phraseCountText,
    savedDateText,
    savedDateAccessibleText,
    participantIndicator,
    accessibleLabel:
      `Batch favourite, ${phraseCountText}, saved ${savedDateText}, ${participantIndicator}`,
  };
}

export function getPhraseFavouriteCopyText(record) {
  return formatPhraseCopyText(record.favourite.phraseText);
}

export function getBatchFavouriteCopyText(record) {
  return formatBatchCopyText(record.favourite.phrases);
}

function getParticipantIndicator({ favourite, currentHandle }) {
  if (favourite.sourceMode === "signed-in-solo") {
    return "Solo";
  }

  const participants = Array.isArray(favourite.participants)
    ? favourite.participants
    : [];

  if (participants.length === 0) {
    return "Solo";
  }

  const normalisedCurrentHandle = normaliseHandle(currentHandle);
  const current = participants.find(
    (participant) => normaliseHandle(participant.handle) === normalisedCurrentHandle,
  );
  const others = participants.filter(
    (participant) => normaliseHandle(participant.handle) !== normalisedCurrentHandle,
  );

  if (!current) {
    return formatParticipantList(others);
  }

  if (others.length === 0) {
    return "You";
  }

  return formatParticipantList([{ displayName: "You", handle: "you" }, ...others]);
}

function formatParticipantList(participants) {
  const labels = participants.map(formatParticipantLabel).filter(Boolean);

  if (labels.length <= 2) {
    return labels.join(" + ");
  }

  return `${labels[0]} + ${labels[1]} + ${labels.length - 2}`;
}

function formatParticipantLabel(participant) {
  if (participant.displayName === "You") {
    return "You";
  }

  const handle = normaliseHandle(participant.handle);
  if (handle !== "") {
    return `@${handle}`;
  }

  return String(participant.gamerName ?? "").trim();
}

function normaliseHandle(handle) {
  return String(handle ?? "").trim().replace(/^@/, "").toLowerCase();
}
```

- [ ] **Step 4: Run the helper test and verify it passes**

Run:

```bash
npm test -- tests/favourites-view-model.test.mjs
```

Expected: `PASS`.

- [ ] **Step 5: Commit the helper slice**

Run:

```bash
git add assets/favourites-view-model.js tests/favourites-view-model.test.mjs
git commit -m "Add favourites view model helpers"
```

Expected: commit succeeds with only the helper module and its unit test staged.

### Task 2: Add Hash Routes, Primary Navigation, and Sign-In Gate

**Files:**

- Modify: `index.html`
- Modify: `assets/app.js`
- Modify: `assets/site.css`
- Modify: `tests/browser-smoke.test.mjs`

- [ ] **Step 1: Write failing browser coverage for route gate and route preservation**

In `tests/browser-smoke.test.mjs`, add this test before the current signed-in persistence tests:

```js
  it("gates the signed-in Favourites route and restores it after sign-in", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(`${staticServer.origin}/#/favourites`);
    await assertTextVisible(page, "Sign in to view Favourites");
    await assertNoFavouriteDom(page);
    assert.equal(await page.locator("[data-favourites-route]").count(), 0);

    await page.getByRole("button", { name: "Test sign in" }).click();
    await assertTextVisible(page, "Account-backed mode");
    assert.equal(new URL(page.url()).hash, "#/favourites");
    await assertTextVisible(page, "Favourites");
    await assertTextVisible(page, "No phrase favourites yet.");
    await assertTextVisible(page, "No batch favourites yet.");
    await assertNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Sign out" }).click();
    await assertTextVisible(page, "Anonymous solo");
    assert.equal(new URL(page.url()).hash, "#/play/solo");
    await assertNoFavouriteDom(page);

    assertNoConsoleErrors();
  });
```

- [ ] **Step 2: Run the browser smoke test and verify it fails**

Run:

```bash
npm test -- tests/browser-smoke.test.mjs
```

Expected: `FAIL` because the app does not recognise `#/favourites` and has no route gate.

- [ ] **Step 3: Add route and navigation mounts to `index.html`**

Add a primary nav after the title block and before `.header-actions`:

```html
        <nav class="primary-nav" aria-label="Primary" data-primary-nav hidden>
          <a class="primary-nav-link" href="#/play/solo" data-route-link="play">
            Play
          </a>
          <a
            class="primary-nav-link primary-nav-icon-link"
            href="#/favourites"
            aria-label="Favourites"
            data-route-link="favourites"
            data-tooltip="Favourites"
          >
            <i class="fa-solid fa-heart" aria-hidden="true"></i>
            <span class="sr-only">Favourites</span>
          </a>
        </nav>
```

Add a route-gate mount immediately before `<section class="game-panel"...>`:

```html
      <section
        class="route-gate"
        data-route-gate
        aria-live="polite"
        hidden
      ></section>
```

- [ ] **Step 4: Add route state and route rendering to `assets/app.js`**

Add the new DOM references near the other top-level queries:

```js
const primaryNav = document.querySelector("[data-primary-nav]");
const routeGate = document.querySelector("[data-route-gate]");
```

Add route constants and state near the other top-level state:

```js
const ROUTES = {
  playSolo: "#/play/solo",
  playMultiplayer: "#/play/multiplayer",
  favourites: "#/favourites",
};

const signedInOnlyRoutes = new Set([ROUTES.playMultiplayer, ROUTES.favourites]);

let currentRoute = normaliseRoute(window.location.hash);
let requestedSignedInRoute = signedInOnlyRoutes.has(currentRoute)
  ? currentRoute
  : null;
```

Add route listeners after the existing click listeners are wired:

```js
window.addEventListener("hashchange", () => {
  currentRoute = normaliseRoute(window.location.hash);
  if (
    accountShell.persistenceAuthority.type !== "account" &&
    signedInOnlyRoutes.has(currentRoute)
  ) {
    requestedSignedInRoute = currentRoute;
  }
  renderRoute();
});
```

Add these route helpers before `renderGame()`:

```js
function normaliseRoute(hash) {
  if (hash === ROUTES.playSolo || hash === ROUTES.playMultiplayer || hash === ROUTES.favourites) {
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
    if (linkRoute === currentRoute || (link.dataset.routeLink === "play" && currentRoute.startsWith("#/play/"))) {
      link.setAttribute("aria-current", "page");
      return;
    }

    link.removeAttribute("aria-current");
  });
}
```

In `applyAccountShell(shell)`, after loading account data but before rendering, restore the preserved signed-in route:

```js
  if (
    accountShell.persistenceAuthority.type === "account" &&
    requestedSignedInRoute
  ) {
    currentRoute = requestedSignedInRoute;
    requestedSignedInRoute = null;
    ensureHashRoute(currentRoute);
  }
```

In `applySignedOutShell()`, reset signed-in-only routes:

```js
  requestedSignedInRoute = null;
  if (signedInOnlyRoutes.has(currentRoute)) {
    currentRoute = ROUTES.playSolo;
    ensureHashRoute(ROUTES.playSolo);
  }
```

Replace final direct calls that currently do `renderGame(); renderPendingGamePanel(); renderFavourites();` with `renderRoute();`.

- [ ] **Step 5: Add route/nav CSS**

Add to `assets/site.css` near header styles:

```css
.primary-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.primary-nav[hidden] {
  display: none;
}

.primary-nav-link {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0 12px;
  color: var(--accent-strong);
  background: var(--surface);
  box-shadow: 0 8px 24px rgba(23, 33, 31, 0.08);
  font-size: 0.84rem;
  font-weight: 800;
  text-decoration: none;
}

.primary-nav-icon-link {
  position: relative;
  width: 44px;
  padding: 0;
}

.primary-nav-link[aria-current="page"] {
  border-color: var(--accent);
  background: var(--surface-soft);
}

.route-gate {
  margin: 0 0 16px;
  border-radius: 8px;
  padding: clamp(18px, 4vw, 28px);
  background: var(--surface);
  box-shadow: var(--shadow);
}

.route-gate h2,
.route-gate p {
  margin: 0;
}

.route-gate p {
  margin-top: 8px;
  color: var(--muted);
  font-weight: 700;
}
```

- [ ] **Step 6: Run the route smoke test and verify it passes**

Run:

```bash
node --test --test-name-pattern "gates the signed-in Favourites route" tests/browser-smoke.test.mjs
```

Expected: `PASS` for the new route-gate test.

- [ ] **Step 7: Commit the routing slice**

Run:

```bash
git add index.html assets/app.js assets/site.css tests/browser-smoke.test.mjs
git commit -m "Add signed-in favourites route gate"
```

Expected: commit succeeds.

### Task 3: Replace Current Reveal Save Buttons with Heart Toggles

**Files:**

- Modify: `assets/app.js`
- Modify: `assets/site.css`
- Modify: `tests/browser-smoke.test.mjs`

- [ ] **Step 1: Update smoke expectations for heart toggle controls**

In the signed-in reveal smoke test, replace save-button expectations with accessible heart-toggle expectations:

```js
    const phraseFavouriteButton = page.getByRole("button", {
      name: "Save phrase 2 as favourite",
    });
    await phraseFavouriteButton.click();
    await assertTextVisible(page, "Phrase favourite saved.");
    await expectFontAwesomeClass(phraseFavouriteButton, "fa-solid", "fa-heart");
    assert.equal(
      await page.getByRole("button", { name: "Remove phrase 2 from favourites" }).isEnabled(),
      true,
    );

    await page.getByRole("button", { name: "Remove phrase 2 from favourites" }).click();
    await assertTextVisible(page, "Phrase favourite removed.");
    assert.equal(
      await page.getByRole("button", { name: "Save phrase 2 as favourite" }).isEnabled(),
      true,
    );
```

For the batch action, use:

```js
    await page.getByRole("button", { name: "Save batch as favourite" }).click();
    await assertTextVisible(page, "Batch favourite saved.");
    await page.getByRole("button", { name: "Remove batch from favourites" }).click();
    await assertTextVisible(page, "Batch favourite removed.");
```

Add this helper near the other test helpers:

```js
async function expectFontAwesomeClass(locator, ...classNames) {
  const icon = locator.locator("i").first();
  const className = await icon.getAttribute("class");
  for (const expectedClass of classNames) {
    assert.equal(className.includes(expectedClass), true);
  }
}
```

- [ ] **Step 2: Run the changed smoke test and verify it fails**

Run:

```bash
npm test -- tests/browser-smoke.test.mjs
```

Expected: `FAIL` because current reveal controls still use text `Save` buttons and disabled `Saved` state.

- [ ] **Step 3: Add current-output favourite record lookup helpers**

In `assets/app.js`, replace `isPhraseFavouriteSaved` and `isBatchFavouriteSaved` with lookup helpers:

```js
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
```

- [ ] **Step 4: Render heart controls for revealed phrase and batch actions**

In `renderPhraseItem`, replace the current save button block with:

```js
  if (accountShell.persistenceAuthority.type === "account") {
    const savedRecord = findPhraseFavouriteRecordForCurrentReveal(phraseIndex);
    const favouriteButton = document.createElement("button");
    favouriteButton.type = "button";
    favouriteButton.className = "secondary-button phrase-copy-button icon-action-button";
    favouriteButton.dataset.togglePhraseFavouriteIndex = String(phraseIndex);
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
```

In `renderGame`, replace batch save button copy with:

```js
      const savedBatch = findBatchFavouriteRecordForCurrentReveal();
      currentSaveBatchButton.disabled = false;
      currentSaveBatchButton.className = "secondary-button icon-action-button";
      currentSaveBatchButton.dataset.toggleBatchFavourite = "";
      currentSaveBatchButton.ariaLabel = savedBatch
        ? "Remove batch from favourites"
        : "Save batch as favourite";
      currentSaveBatchButton.setAttribute("aria-pressed", String(Boolean(savedBatch)));
      currentSaveBatchButton.replaceChildren(
        createFontAwesomeIcon(savedBatch ? "solid" : "regular", "heart"),
        createScreenReaderText(currentSaveBatchButton.ariaLabel),
      );
```

Add these small DOM helpers:

```js
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
```

- [ ] **Step 5: Replace reveal click handling with toggle actions**

In `revealPanel.addEventListener("click", ...)`, replace save selectors with:

```js
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
```

Add toggle functions next to the existing save/remove favourite functions:

```js
async function togglePhraseFavourite(rowIndex) {
  if (accountShell.persistenceAuthority.type !== "account") {
    return;
  }

  const savedRecord = findPhraseFavouriteRecordForCurrentReveal(rowIndex);

  if (savedRecord) {
    await removeCurrentPhraseFavourite(savedRecord.id);
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

async function removeCurrentPhraseFavourite(favouriteId) {
  try {
    await privateFavouritesRepository.removePhraseFavourite({
      accountId: accountShell.accountId,
      favouriteId,
    });
    phraseFavourites = phraseFavourites.filter(
      (record) => record.id !== favouriteId,
    );
    renderGame();
    copyStatus.textContent = "Phrase favourite removed.";
  } catch {
    copyStatus.textContent = "Could not update phrase favourite.";
  }
}

async function removeCurrentBatchFavourite(favouriteId) {
  try {
    await privateFavouritesRepository.removeBatchFavourite({
      accountId: accountShell.accountId,
      favouriteId,
    });
    batchFavourites = batchFavourites.filter((record) => record.id !== favouriteId);
    renderGame();
    copyStatus.textContent = "Batch favourite removed.";
  } catch {
    copyStatus.textContent = "Could not update batch favourite.";
  }
}
```

Update `savePhraseFavourite` and `saveBatchFavourite` failure copy to the accepted toggle copy:

```js
    copyStatus.textContent = "Could not update phrase favourite.";
```

and:

```js
    copyStatus.textContent = "Could not update batch favourite.";
```

- [ ] **Step 6: Add icon button sizing CSS**

Add to `assets/site.css` near button styles:

```css
.icon-action-button {
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
```

- [ ] **Step 7: Run smoke tests for the toggle slice**

Run:

```bash
node --test --test-name-pattern "restores signed-in reveal" tests/browser-smoke.test.mjs
```

Expected: current-output heart assertions pass.

- [ ] **Step 8: Commit the heart-toggle slice**

Run:

```bash
git add assets/app.js assets/site.css tests/browser-smoke.test.mjs
git commit -m "Use heart toggles for revealed favourites"
```

Expected: commit succeeds.

### Task 4: Render the Favourites Destination Tabs and List States

**Files:**

- Modify: `assets/app.js`
- Modify: `assets/site.css`
- Modify: `tests/browser-smoke.test.mjs`

- [ ] **Step 1: Write failing smoke coverage for route tabs, empty states, and list-specific retry**

Add a route-focused assertion after signing in at `#/favourites`:

```js
    await assertFavouriteSurfaceMounted(page);
    await assertTextVisible(page, "No phrase favourites yet.");
    await assertTextVisible(page, "Favourite revealed phrases from Play Solo.");
    await page.getByRole("tab", { name: "Batches" }).click();
    await assertTextVisible(page, "No batch favourites yet.");
    await assertTextVisible(page, "Favourite a revealed batch from Play Solo.");
    assert.equal(new URL(page.url()).hash, "#/favourites");
```

Update `assertFavouriteSurfaceMounted(page)` so it reflects the route shell instead of requiring a list in empty/error states:

```js
async function assertFavouriteSurfaceMounted(page) {
  assert.equal(await page.locator("[data-favourites-panel]").count(), 1);
  assert.equal(await page.locator("[data-favourites-route]").count(), 1);
  assert.equal(await page.getByRole("tab", { name: "Phrases" }).count(), 1);
  assert.equal(await page.getByRole("tab", { name: "Batches" }).count(), 1);
}
```

Update `assertNoFavouriteDom(page)` to include the route-only nodes:

```js
async function assertNoFavouriteDom(page) {
  assert.equal(await page.locator("[data-favourites-panel]").count(), 0);
  assert.equal(await page.locator("[data-favourites-route]").count(), 0);
  assert.equal(await page.locator("[data-favourites-tab-panel]").count(), 0);
  assert.equal(await page.locator("[data-phrase-favourites-list]").count(), 0);
  assert.equal(await page.locator("[data-save-batch-button]").count(), 0);
  assert.equal(await page.locator("[data-save-phrase-index]").count(), 0);
}
```

Add a separate failure-mode test:

```js
  it("shows independent Favourites list errors with list-specific retry", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(`${staticServer.origin}/?testPrivateFavourites=load-fails#/favourites`);
    await page.getByRole("button", { name: "Test sign in" }).click();

    await assertTextVisible(page, "Could not load phrase favourites.");
    assert.equal(
      await page.getByRole("button", { name: "Try loading phrase favourites again" }).isVisible(),
      true,
    );

    await page.getByRole("tab", { name: "Batches" }).click();
    await assertTextVisible(page, "Could not load batch favourites.");
    assert.equal(
      await page.getByRole("button", { name: "Try loading batch favourites again" }).isVisible(),
      true,
    );

    assertNoConsoleErrors();
  });
```

- [ ] **Step 2: Extend local test repository failure mode**

In `assets/private-favourites.js`, extend both local test list methods:

```js
    async listPhraseFavourites({ accountId }) {
      assertAccountId(accountId);

      if (failureMode === "load-fails") {
        throw new Error("Local test private favourite load failed.");
      }

      return loadStoredPhraseFavourites(storage, { accountId }).map(
        ({ record }) => cloneFavouriteRecord(record),
      );
    },
```

and:

```js
    async listBatchFavourites({ accountId }) {
      assertAccountId(accountId);

      if (failureMode === "load-fails") {
        throw new Error("Local test private favourite load failed.");
      }

      return loadStoredBatchFavourites(storage, { accountId }).map(
        ({ record }) => cloneFavouriteRecord(record),
      );
    },
```

Update `getLocalTestPrivateFavouritesFailureMode()` in `assets/app.js`:

```js
  if (["remove-fails", "load-fails"].includes(failureMode)) {
    return failureMode;
  }
```

- [ ] **Step 3: Run the new smoke tests and verify they fail**

Run:

```bash
node --test --test-name-pattern "shows independent Favourites list errors" tests/browser-smoke.test.mjs
```

Expected: `FAIL` because destination tabs and list-specific states are not yet rendered.

- [ ] **Step 4: Add Favourites data state**

Replace `phraseFavourites` and `batchFavourites` top-level state with explicit list state:

```js
let phraseFavourites = [];
let batchFavourites = [];
let favouritesListState = {
  phrases: "idle",
  batches: "idle",
};
let activeFavouritesTab = "phrases";
let expandedBatchFavouriteId = null;
let activeFavouritesStatus = "";
let activeFavouritesStatusTimer = null;
let rowActionStatus = {
  phrases: null,
  batches: null,
};
let openRemoveConfirmation = null;
```

- [ ] **Step 5: Update load functions to set list-specific states**

Change `loadPhraseFavourites()`:

```js
async function loadPhraseFavourites() {
  if (accountShell.persistenceAuthority.type !== "account") {
    phraseFavourites = [];
    favouritesListState.phrases = "idle";
    renderRoute();
    return;
  }

  favouritesListState.phrases = "loading";
  renderRoute();

  try {
    phraseFavourites = await privateFavouritesRepository.listPhraseFavourites({
      accountId: accountShell.accountId,
    });
    favouritesListState.phrases = "loaded";
  } catch {
    phraseFavourites = [];
    favouritesListState.phrases = "error";
  }

  renderRoute();
}
```

Change `loadBatchFavourites()` in the same shape, using `batchFavourites` and `favouritesListState.batches`.

In `applyAccountShell(shell)`, replace sequential favourite loading with parallel loading:

```js
    await loadSignedInCurrentGame();
    await Promise.all([loadPhraseFavourites(), loadBatchFavourites()]);
    await loadPendingGameLists();
```

- [ ] **Step 6: Render destination shell, tabs, and empty/error/loading states**

Replace `ensureFavouritesPanel()` with a route shell that appends after `routeGate`:

```js
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
```

Replace `renderFavourites()` with:

```js
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
```

Add `renderFavouritesTabPanel(tab)`:

```js
function renderFavouritesTabPanel(tab) {
  const panel = document.createElement("div");
  panel.className = "favourites-tab-panel";
  panel.dataset.favouritesTabPanel = tab;
  panel.setAttribute("role", "tabpanel");

  const state = favouritesListState[tab];
  const records = tab === "phrases" ? phraseFavourites : batchFavourites;

  if (state === "loading") {
    panel.append(createFavouritesStateCopy(
      tab === "phrases" ? "Loading phrase favourites..." : "Loading batch favourites...",
    ));
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
```

Add state render helpers:

```js
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
```

- [ ] **Step 7: Add tab/retry click handling**

At the start of `handleFavouritesPanelClick(event)`, add:

```js
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
```

Add helpers:

```js
function switchFavouritesTab(tab) {
  if (!["phrases", "batches"].includes(tab)) {
    return;
  }

  activeFavouritesTab = tab;
  clearFavouritesTransientState();
  renderFavourites();
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
```

- [ ] **Step 8: Add tab/list-state CSS**

Add to `assets/site.css` near current favourites styles:

```css
.favourites-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 14px 0;
}

.favourites-tab {
  min-height: 40px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0 14px;
  color: var(--accent-strong);
  background: var(--surface);
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.favourites-tab[aria-selected="true"] {
  border-color: var(--accent);
  background: var(--surface-soft);
}

.favourites-tab-panel {
  display: grid;
  gap: 12px;
}

.favourites-state-copy,
.favourites-empty-state p,
.favourites-error-state p {
  margin: 0;
  color: var(--muted);
  font-weight: 700;
}

.favourites-empty-state,
.favourites-error-state {
  display: grid;
  gap: 10px;
}

.favourites-empty-state h3 {
  margin: 0;
  font-size: 1rem;
}
```

- [ ] **Step 9: Run route/list tests**

Run:

```bash
node --test --test-name-pattern "gates the signed-in Favourites route|shows independent Favourites list errors" tests/browser-smoke.test.mjs
```

Expected: route gate, tab, empty, and failure tests pass.

- [ ] **Step 10: Commit the destination-shell slice**

Run:

```bash
git add assets/app.js assets/private-favourites.js assets/site.css tests/browser-smoke.test.mjs
git commit -m "Render favourites destination states"
```

Expected: commit succeeds.

### Task 5: Render Phrase and Batch Rows with Copy Status

**Files:**

- Modify: `assets/app.js`
- Modify: `assets/site.css`
- Modify: `tests/browser-smoke.test.mjs`

- [ ] **Step 1: Write failing route-row smoke coverage**

In the signed-in saved favourites flow, after saving a phrase and batch from Play Solo, navigate to Favourites and assert:

```js
    await page.getByRole("link", { name: "Favourites" }).click();
    assert.equal(new URL(page.url()).hash, "#/favourites");

    await assertTextVisible(page, copiedPhrase);
    await assertTextVisible(page, "Solo");
    await page.getByRole("button", { name: "Copy phrase" }).click();
    await assertTextVisible(page, "Phrase copied.");
    assert.equal(await readClipboard(page), copiedPhrase);

    await page.getByRole("tab", { name: "Batches" }).click();
    await assertTextVisible(page, "10 phrases");
    await assertTextVisible(page, "Solo");
    await page.getByRole("button", { name: "Copy batch" }).click();
    await assertTextVisible(page, "Batch copied.");
    assert.equal(normalizeLineEndings(await readClipboard(page)), batchCopy);
```

Add a status-clear assertion:

```js
    await page.waitForTimeout(2100);
    await assertTextHidden(page, "Batch copied.");
```

- [ ] **Step 2: Run the smoke test and verify it fails**

Run:

```bash
node --test --test-name-pattern "restores signed-in reveal" tests/browser-smoke.test.mjs
```

Expected: `FAIL` because rows still use the old inline row renderers and lack row-local copy status.

- [ ] **Step 3: Import view-model helpers**

Add to `assets/app.js` imports:

```js
import {
  createFavouriteRowModel,
  getBatchFavouriteCopyText,
  getPhraseFavouriteCopyText,
} from "./favourites-view-model.js?v=__ASSET_VERSION__";
```

- [ ] **Step 4: Replace phrase row renderer**

Replace `renderPhraseFavourite(record)` with:

```js
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

  const phraseText = document.createElement("span");
  phraseText.className = "favourite-row-title";
  phraseText.dataset.favouritePhraseText = "";
  phraseText.textContent = model.primaryText;
  phraseText.title = model.primaryText;

  const meta = renderFavouriteMeta(model);
  content.append(phraseText, meta);

  const actions = renderFavouriteNormalActions({
    kind: "phrase",
    record,
    includeDisclosure: false,
  });

  item.append(icon, content, actions);
  appendRowActionStatus(item, "phrases", record.id);
  return item;
}
```

Add meta/action helpers:

```js
function renderFavouriteMeta(model) {
  const meta = document.createElement("p");
  meta.className = "favourite-row-meta";

  const saved = document.createElement("span");
  saved.textContent = model.savedDateText;
  saved.ariaLabel = model.savedDateAccessibleText;

  const participants = document.createElement("span");
  participants.textContent = model.participantIndicator;

  meta.append(saved, participants);
  return meta;
}

function renderFavouriteNormalActions({ kind, record, includeDisclosure }) {
  const actions = document.createElement("div");
  actions.className = "favourite-actions";

  if (includeDisclosure) {
    const disclosure = document.createElement("button");
    disclosure.type = "button";
    disclosure.className = "secondary-button";
    disclosure.dataset.toggleBatchFavouritePhrases = record.id;
    const expanded = expandedBatchFavouriteId === record.id;
    disclosure.setAttribute("aria-expanded", String(expanded));
    disclosure.textContent = expanded ? "Hide phrases" : "View phrases";
    actions.append(disclosure);
  }

  actions.append(
    renderFavouriteIconAction({
      label: kind === "phrase" ? "Copy phrase" : "Copy batch",
      iconName: "copy",
      datasetName: kind === "phrase" ? "copyPhraseFavouriteId" : "copyBatchFavouriteId",
      value: record.id,
    }),
    renderFavouriteIconAction({
      label: kind === "phrase" ? "Remove phrase favourite" : "Remove batch favourite",
      iconName: "heart-circle-minus",
      datasetName:
        kind === "phrase" ? "confirmRemovePhraseFavouriteId" : "confirmRemoveBatchFavouriteId",
      value: record.id,
    }),
  );
  return actions;
}

function renderFavouriteIconAction({ label, iconName, datasetName, value }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary-button icon-action-button tooltip-action";
  button.dataset[datasetName] = value;
  button.dataset.tooltip = label;
  button.ariaLabel = label;
  button.append(createFontAwesomeIcon("solid", iconName), createScreenReaderText(label));
  return button;
}
```

- [ ] **Step 5: Replace batch row renderer**

Replace `renderBatchFavourite(record)` with:

```js
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

  const title = document.createElement("h3");
  title.className = "batch-favourite-title favourite-row-title";
  title.textContent = model.primaryText;

  const detail = document.createElement("p");
  detail.className = "batch-favourite-detail";
  detail.textContent = model.detailText;

  content.append(title, renderFavouriteMeta(model), detail);

  const actions = renderFavouriteNormalActions({
    kind: "batch",
    record,
    includeDisclosure: true,
  });

  item.append(icon, content, actions);
  appendRowActionStatus(item, "batches", record.id);

  if (expandedBatchFavouriteId === record.id) {
    item.append(renderExpandedBatchFavourite(record));
  }

  return item;
}
```

- [ ] **Step 6: Add row-local copy status**

Add:

```js
function appendRowActionStatus(item, tab, recordId) {
  const status = rowActionStatus[tab];
  if (!status || status.recordId !== recordId) {
    return;
  }

  const statusElement = document.createElement("p");
  statusElement.className = "favourite-row-status";
  statusElement.setAttribute("aria-live", "polite");
  statusElement.textContent = status.message;
  item.append(statusElement);
}

function setRowActionStatus(tab, recordId, message, { autoClear = false } = {}) {
  clearRowActionStatusTimer();
  rowActionStatus[tab] = { recordId, message };
  renderFavourites();

  if (autoClear) {
    rowActionStatusTimer = setTimeout(() => {
      rowActionStatus[tab] = null;
      renderFavourites();
    }, 2000);
  }
}

function clearRowActionStatusTimer() {
  clearTimeout(rowActionStatusTimer);
  rowActionStatusTimer = null;
}
```

Add `let rowActionStatusTimer = null;` beside `rowActionStatus`.

- [ ] **Step 7: Wire copy actions**

In `handleFavouritesPanelClick(event)`, add copy selectors before remove selectors:

```js
  const phraseCopyButton = event.target.closest("[data-copy-phrase-favourite-id]");
  if (phraseCopyButton) {
    void copyPhraseFavouriteFromRoute(phraseCopyButton.dataset.copyPhraseFavouriteId);
    return;
  }

  const batchCopyButton = event.target.closest("[data-copy-batch-favourite-id]");
  if (batchCopyButton) {
    void copyBatchFavouriteFromRoute(batchCopyButton.dataset.copyBatchFavouriteId);
    return;
  }
```

Add copy functions:

```js
async function copyPhraseFavouriteFromRoute(favouriteId) {
  const record = phraseFavourites.find((candidate) => candidate.id === favouriteId);
  if (!record) {
    return;
  }

  rowActionStatus.phrases = null;
  renderFavourites();

  if (await writePlainText(getPhraseFavouriteCopyText(record))) {
    setRowActionStatus("phrases", favouriteId, "Phrase copied.", { autoClear: true });
    return;
  }

  setRowActionStatus("phrases", favouriteId, "Could not copy phrase.");
}

async function copyBatchFavouriteFromRoute(favouriteId) {
  const record = batchFavourites.find((candidate) => candidate.id === favouriteId);
  if (!record) {
    return;
  }

  rowActionStatus.batches = null;
  renderFavourites();

  if (await writePlainText(getBatchFavouriteCopyText(record))) {
    setRowActionStatus("batches", favouriteId, "Batch copied.", { autoClear: true });
    return;
  }

  setRowActionStatus("batches", favouriteId, "Could not copy batch.");
}
```

- [ ] **Step 8: Add row/action/tooltip CSS**

Add:

```css
.favourite-row {
  grid-template-columns: 28px minmax(0, 1fr) auto;
}

.favourite-row:focus-visible {
  outline: 4px solid var(--ring);
  outline-offset: 2px;
}

.favourite-row-type-icon {
  align-self: start;
  margin-top: 4px;
  color: var(--accent-strong);
}

.favourite-row-content {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.favourite-row-title {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.favourite-row-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  margin: 0;
  color: var(--muted);
  font-size: 0.84rem;
  font-weight: 800;
}

.favourite-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.tooltip-action {
  position: relative;
}

.tooltip-action::after,
.primary-nav-icon-link::after {
  content: attr(data-tooltip);
  position: absolute;
  right: 0;
  bottom: calc(100% + 6px);
  z-index: 20;
  max-width: 220px;
  border-radius: 6px;
  padding: 4px 7px;
  color: var(--accent-contrast);
  background: var(--ink);
  font-size: 0.72rem;
  font-weight: 800;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transform: translateY(2px);
}

.tooltip-action:hover::after,
.tooltip-action:focus-visible::after,
.primary-nav-icon-link:hover::after,
.primary-nav-icon-link:focus-visible::after {
  opacity: 1;
  transform: translateY(0);
}

.favourite-row-status {
  grid-column: 2 / -1;
  margin: 0;
  color: var(--muted);
  font-size: 0.84rem;
  font-weight: 800;
}
```

- [ ] **Step 9: Run row/copy smoke tests**

Run:

```bash
node --test --test-name-pattern "restores signed-in reveal" tests/browser-smoke.test.mjs
```

Expected: phrase and batch row copy assertions pass.

- [ ] **Step 10: Commit the row/copy slice**

Run:

```bash
git add assets/app.js assets/site.css tests/browser-smoke.test.mjs
git commit -m "Render favourites route rows"
```

Expected: commit succeeds.

### Task 6: Add Batch Expansion

**Files:**

- Modify: `assets/app.js`
- Modify: `assets/site.css`
- Modify: `tests/browser-smoke.test.mjs`

- [ ] **Step 1: Write failing smoke coverage for batch expansion**

After navigating to the Batches tab with a saved batch:

```js
    await page.getByRole("button", { name: "View phrases" }).click();
    const expandedBatch = page.locator("[data-expanded-batch-favourite]");
    assert.equal(await expandedBatch.isVisible(), true);
    assert.equal(await expandedBatch.locator("li").count(), 10);
    assert.equal(await expandedBatch.locator("li").first().innerText(), batchCopy.split("\n")[1]);
    assert.equal(await page.getByRole("button", { name: "Hide phrases" }).isVisible(), true);
```

- [ ] **Step 2: Run and verify failure**

Run:

```bash
node --test --test-name-pattern "restores signed-in reveal" tests/browser-smoke.test.mjs
```

Expected: `FAIL` because disclosure handling is not wired.

- [ ] **Step 3: Wire batch disclosure click handling**

In `handleFavouritesPanelClick(event)`, add:

```js
  const batchDisclosure = event.target.closest("[data-toggle-batch-favourite-phrases]");
  if (batchDisclosure) {
    toggleExpandedBatchFavourite(batchDisclosure.dataset.toggleBatchFavouritePhrases);
    return;
  }
```

Add:

```js
function toggleExpandedBatchFavourite(favouriteId) {
  expandedBatchFavouriteId =
    expandedBatchFavouriteId === favouriteId ? null : favouriteId;
  renderFavourites();
  favouritesPanel
    ?.querySelector(`[data-toggle-batch-favourite-phrases="${favouriteId}"]`)
    ?.focus();
}
```

- [ ] **Step 4: Render expanded batch phrase list**

Add:

```js
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
```

- [ ] **Step 5: Add expanded batch CSS**

Add:

```css
.expanded-batch-favourite {
  grid-column: 2 / -1;
}

.expanded-batch-favourite-list {
  display: grid;
  gap: 8px;
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
  font-weight: 700;
}

.expanded-batch-favourite-list li {
  overflow-wrap: anywhere;
}
```

- [ ] **Step 6: Run expansion smoke test**

Run:

```bash
node --test --test-name-pattern "restores signed-in reveal" tests/browser-smoke.test.mjs
```

Expected: batch expansion assertions pass, with no visible numbering or bullets.

- [ ] **Step 7: Commit the expansion slice**

Run:

```bash
git add assets/app.js assets/site.css tests/browser-smoke.test.mjs
git commit -m "Add batch favourite expansion"
```

Expected: commit succeeds.

### Task 7: Add Remove Confirmation, Pending, Success, Failure, and Focus Recovery

**Files:**

- Modify: `assets/app.js`
- Modify: `assets/site.css`
- Modify: `tests/browser-smoke.test.mjs`

- [ ] **Step 1: Write failing smoke coverage for successful phrase removal**

In the Favourites route flow:

```js
    await page.getByRole("button", { name: "Remove phrase favourite" }).click();
    assert.equal(
      await page.getByRole("button", { name: "Cancel" }).evaluate((node) => document.activeElement === node),
      true,
    );
    await assertTextVisible(page, "Remove phrase favourite?");
    await page.getByRole("button", { name: "Remove" }).click();
    await assertTextVisible(page, "Phrase favourite removed.");
    await assertTextVisible(page, "No phrase favourites yet.");
    await page.waitForTimeout(2100);
    await assertTextHidden(page, "Phrase favourite removed.");
```

- [ ] **Step 2: Write failing smoke coverage for failed removal**

Extend the existing removal-failure test so it navigates to `#/favourites` before removing:

```js
    await page.getByRole("link", { name: "Favourites" }).click();
    await page.getByRole("button", { name: "Remove phrase favourite" }).click();
    await page.getByRole("button", { name: "Remove" }).click();
    await assertTextVisible(page, "Could not remove phrase favourite.");
    assert.equal(
      await page.getByRole("button", { name: "Cancel" }).evaluate((node) => document.activeElement === node),
      true,
    );
    await assertFavouriteVisible(page, copiedPhrase);
```

- [ ] **Step 3: Run and verify failure**

Run:

```bash
npm test -- tests/browser-smoke.test.mjs
```

Expected: `FAIL` because remove actions still call repository removal directly.

- [ ] **Step 4: Open row-local confirmation**

Replace old remove click selectors in `handleFavouritesPanelClick(event)` with:

```js
  const phraseRemoveConfirm = event.target.closest("[data-confirm-remove-phrase-favourite-id]");
  if (phraseRemoveConfirm) {
    openFavouriteRemoveConfirmation("phrases", phraseRemoveConfirm.dataset.confirmRemovePhraseFavouriteId);
    return;
  }

  const batchRemoveConfirm = event.target.closest("[data-confirm-remove-batch-favourite-id]");
  if (batchRemoveConfirm) {
    openFavouriteRemoveConfirmation("batches", batchRemoveConfirm.dataset.confirmRemoveBatchFavouriteId);
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
```

Add:

```js
function openFavouriteRemoveConfirmation(tab, favouriteId) {
  clearFavouritesTransientState();
  openRemoveConfirmation = {
    tab,
    favouriteId,
    status: "",
    pending: false,
  };
  renderFavourites();
  favouritesPanel
    ?.querySelector(`[data-cancel-favourite-remove="${favouriteId}"]`)
    ?.focus();
}

function cancelFavouriteRemoveConfirmation({ restoreFocus }) {
  const confirmation = openRemoveConfirmation;
  openRemoveConfirmation = null;
  renderFavourites();

  if (restoreFocus && confirmation) {
    const selector =
      confirmation.tab === "phrases"
        ? `[data-confirm-remove-phrase-favourite-id="${confirmation.favouriteId}"]`
        : `[data-confirm-remove-batch-favourite-id="${confirmation.favouriteId}"]`;
    favouritesPanel?.querySelector(selector)?.focus();
  }
}
```

- [ ] **Step 5: Render confirmation action cluster**

In `renderFavouriteNormalActions`, before normal actions, add:

```js
  if (
    openRemoveConfirmation?.favouriteId === record.id &&
    openRemoveConfirmation.tab === (kind === "phrase" ? "phrases" : "batches")
  ) {
    return renderFavouriteRemoveConfirmation({ kind, record });
  }
```

Add:

```js
function renderFavouriteRemoveConfirmation({ kind, record }) {
  const actions = document.createElement("div");
  actions.className = "favourite-actions favourite-remove-confirmation";
  actions.ariaBusy = String(Boolean(openRemoveConfirmation?.pending));

  const question = document.createElement("p");
  question.className = "favourite-remove-question";
  question.textContent =
    kind === "phrase" ? "Remove phrase favourite?" : "Remove batch favourite?";

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "secondary-button icon-action-button";
  cancel.dataset.cancelFavouriteRemove = record.id;
  cancel.disabled = Boolean(openRemoveConfirmation?.pending);
  cancel.append(createFontAwesomeIcon("solid", "circle-left"), document.createTextNode("Cancel"));

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "danger-button icon-action-button";
  remove.dataset.removeConfirmedFavouriteId = record.id;
  remove.dataset.removeConfirmedFavouriteTab = kind === "phrase" ? "phrases" : "batches";
  remove.disabled = Boolean(openRemoveConfirmation?.pending);
  remove.append(createFontAwesomeIcon("solid", "heart-circle-minus"), document.createTextNode("Remove"));

  actions.append(question, cancel, remove);

  if (openRemoveConfirmation?.status) {
    const status = document.createElement("p");
    status.className = "favourite-row-status";
    status.setAttribute("aria-live", "polite");
    status.textContent = openRemoveConfirmation.status;
    actions.append(status);
  }

  return actions;
}
```

- [ ] **Step 6: Add Escape handling**

Add:

```js
function handleFavouritesPanelKeydown(event) {
  if (event.key !== "Escape" || !openRemoveConfirmation) {
    return;
  }

  event.preventDefault();
  cancelFavouriteRemoveConfirmation({ restoreFocus: true });
}
```

- [ ] **Step 7: Implement route removal settlement**

Add:

```js
async function removeFavouriteFromRoute({ tab, favouriteId }) {
  if (!openRemoveConfirmation || openRemoveConfirmation.favouriteId !== favouriteId) {
    return;
  }

  const removedIndex = getFavouriteRemovalIndex(tab, favouriteId);

  openRemoveConfirmation = {
    ...openRemoveConfirmation,
    pending: true,
    status:
      tab === "phrases"
        ? "Removing phrase favourite..."
        : "Removing batch favourite...",
  };
  renderFavourites();

  try {
    if (tab === "phrases") {
      await privateFavouritesRepository.removePhraseFavourite({
        accountId: accountShell.accountId,
        favouriteId,
      });
      phraseFavourites = phraseFavourites.filter((record) => record.id !== favouriteId);
      openRemoveConfirmation = null;
      renderGame();
      handleFavouriteRemovalSuccess({
        tab,
        favouriteId,
        removedIndex,
        message: "Phrase favourite removed.",
      });
      return;
    }

    await privateFavouritesRepository.removeBatchFavourite({
      accountId: accountShell.accountId,
      favouriteId,
    });
    batchFavourites = batchFavourites.filter((record) => record.id !== favouriteId);
    if (expandedBatchFavouriteId === favouriteId) {
      expandedBatchFavouriteId = null;
    }
    openRemoveConfirmation = null;
    renderGame();
    handleFavouriteRemovalSuccess({
      tab,
      favouriteId,
      removedIndex,
      message: "Batch favourite removed.",
    });
  } catch {
    if (!openRemoveConfirmation || openRemoveConfirmation.favouriteId !== favouriteId) {
      return;
    }

    openRemoveConfirmation = {
      ...openRemoveConfirmation,
      pending: false,
      status:
        tab === "phrases"
          ? "Could not remove phrase favourite."
          : "Could not remove batch favourite.",
    };
    renderFavourites();
    favouritesPanel
      ?.querySelector(`[data-cancel-favourite-remove="${favouriteId}"]`)
      ?.focus();
  }
}
```

Add success handler:

```js
function handleFavouriteRemovalSuccess({ tab, removedIndex, message }) {
  if (currentRoute !== ROUTES.favourites || activeFavouritesTab !== tab) {
    renderRoute();
    return;
  }

  const focusTarget = getFavouriteRemovalFocusTarget(tab, removedIndex);
  setActiveFavouritesStatus(message);
  renderFavourites();
  focusTarget?.();
}

function setActiveFavouritesStatus(message) {
  clearTimeout(activeFavouritesStatusTimer);
  activeFavouritesStatus = message;
  activeFavouritesStatusTimer = setTimeout(() => {
    activeFavouritesStatus = "";
    renderFavourites();
  }, 2000);
}

function getFavouriteRemovalIndex(tab, favouriteId) {
  const records = tab === "phrases" ? phraseFavourites : batchFavourites;
  return records.findIndex((record) => record.id === favouriteId);
}

function getFavouriteRemovalFocusTarget(tab, removedIndex) {
  const records = tab === "phrases" ? phraseFavourites : batchFavourites;
  const targetRecord = records[removedIndex] ?? records[removedIndex - 1] ?? null;

  if (targetRecord) {
    return () =>
      favouritesPanel
        ?.querySelector(`[data-favourite-row="${targetRecord.id}"]`)
        ?.focus();
  }

  return () =>
    favouritesPanel
      ?.querySelector(`[data-favourites-empty-heading="${tab}"]`)
      ?.focus();
}
```

- [ ] **Step 8: Clear transient state on tab and route changes**

Add:

```js
function clearFavouritesTransientState() {
  clearTimeout(activeFavouritesStatusTimer);
  activeFavouritesStatusTimer = null;
  activeFavouritesStatus = "";
  clearRowActionStatusTimer();
  rowActionStatus = {
    phrases: null,
    batches: null,
  };
  if (!openRemoveConfirmation?.pending) {
    openRemoveConfirmation = null;
  }
}
```

Call `clearFavouritesTransientState()` when leaving `#/favourites`, signing out, and retrying a list.

- [ ] **Step 9: Add confirmation CSS**

Add:

```css
.favourite-remove-confirmation {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
}

.favourite-remove-question {
  margin: 0;
  color: var(--ink);
  font-weight: 800;
}

.favourite-remove-confirmation .favourite-row-status {
  grid-column: 1 / -1;
}
```

- [ ] **Step 10: Run removal smoke tests**

Run:

```bash
node --test --test-name-pattern "restores signed-in reveal|warns signed-in players when private favourite removal fails" tests/browser-smoke.test.mjs
```

Expected: successful and failed route removal flows pass, including Cancel focus.

- [ ] **Step 11: Commit the removal slice**

Run:

```bash
git add assets/app.js assets/site.css tests/browser-smoke.test.mjs
git commit -m "Add favourites removal confirmation"
```

Expected: commit succeeds.

### Task 8: Finish Responsive Styling and Anonymous DOM Regression

**Files:**

- Modify: `assets/site.css`
- Modify: `tests/browser-smoke.test.mjs`

- [ ] **Step 1: Add smoke assertions for no horizontal overflow on Favourites rows**

In the route-row smoke test, after rows render:

```js
    await assertNoHorizontalOverflow(page);
    await page.setViewportSize({ width: 360, height: 780 });
    await assertNoHorizontalOverflow(page);
```

Add anonymous DOM absence after visiting `#/favourites` signed out:

```js
    await page.goto(`${staticServer.origin}/#/favourites`);
    await assertTextVisible(page, "Sign in to view Favourites");
    await assertNoFavouriteDom(page);
```

- [ ] **Step 2: Run and verify any layout failures**

Run:

```bash
node --test --test-name-pattern "gates the signed-in Favourites route|restores signed-in reveal" tests/browser-smoke.test.mjs
```

Expected: any failure points to overflow or stale account-only DOM.

- [ ] **Step 3: Add narrow row layout CSS**

Add:

```css
@media (max-width: 560px) {
  .favourite-row {
    grid-template-columns: 24px minmax(0, 1fr);
  }

  .favourite-actions {
    grid-column: 2 / -1;
    justify-content: flex-start;
  }

  .favourite-row-status,
  .expanded-batch-favourite {
    grid-column: 1 / -1;
  }

  .favourite-remove-confirmation {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 4: Run full browser smoke**

Run:

```bash
npm test -- tests/browser-smoke.test.mjs
```

Expected: `PASS` with no horizontal overflow failures and no console errors.

- [ ] **Step 5: Commit responsive and DOM regression coverage**

Run:

```bash
git add assets/site.css tests/browser-smoke.test.mjs
git commit -m "Harden favourites responsive layout"
```

Expected: commit succeeds.

### Task 9: Run Full Verification and Update Planning Status

**Files:**

- Modify: `docs/superpowers/README.md`
- Modify: `docs/superpowers/specs/2026-06-26-signed-in-favourites-design.md`
- Modify: `docs/superpowers/plans/2026-06-26-signed-in-favourites.md`

- [ ] **Step 1: Run the complete test suite**

Run:

```bash
npm test
```

Expected: `PASS` for all Node unit tests and Playwright browser smoke tests.

- [ ] **Step 2: Inspect the working-tree diff**

Run:

```bash
git diff --check
git diff --stat
```

Expected: `git diff --check` exits with no whitespace errors. `git diff --stat` shows only files touched by this plan.

- [ ] **Step 3: Update plan/spec status after implementation completes**

After all implementation tasks pass, update this plan header:

```markdown
**Status:** Historical/completed. Implemented with the signed-in Favourites feature branch and superseded by `docs/product-rules.md`, tests, and the shipped source files for future changes.
```

Update `docs/superpowers/specs/2026-06-26-signed-in-favourites-design.md` status:

```markdown
**Status:** Approved design provenance. Implementation is complete; current product authority lives in `docs/product-rules.md`, deferrals live in `docs/backlog.md`, and regression authority lives in the source files and tests.
```

Update the two rows in `docs/superpowers/README.md` to route future agents away from executing completed documents.

- [ ] **Step 4: Commit implementation closeout**

Run:

```bash
git add docs/superpowers/README.md docs/superpowers/specs/2026-06-26-signed-in-favourites-design.md docs/superpowers/plans/2026-06-26-signed-in-favourites.md
git commit -m "Document favourites implementation closeout"
```

Expected: commit succeeds.

## Self-Review

- Spec coverage: the plan maps route gating, the primary Favourites heart nav, Phrases/Batches tabs, independent list states, route row content, saved-date display, participant indicators, icon-first copy/remove controls, tooltip styling, batch expansion, row-local copy status, remove confirmation, removal pending/failure/success, focus recovery, anonymous DOM absence, and narrow viewport overflow checks.
- Deferred scope: pagination/search, duplicate grouping, source-game links, original reveal dates, saved-count badges, Web Share API, public share links, participant Avatar chips, frontend framework migration, and server rewrites stay out of this plan.
- Consistency check: task snippets consistently use `phrases` and `batches` as tab ids, `record.id` as the row identity, `createdAt` as saved timestamp, `ROUTES.favourites` for `#/favourites`, and `rowActionStatus` for one visible copy/share status per tab.
