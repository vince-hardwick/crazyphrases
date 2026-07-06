# UI Style Rationalisation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove first-party inline styling and rationalise equivalent headings, compact labels, and interactive states without changing routes, account authority, labels, or data behaviour.

**Architecture:** `assets/site.css` remains the single first-party styling surface. JavaScript updates DOM classes, data attributes, and ARIA state only; tests enforce the source boundary and visible behaviour. The work is split into independently testable slices so each slice can be reviewed and committed without waiting for the whole polish pass.

**Tech Stack:** Static HTML, linked CSS, vanilla ES modules, Font Awesome class icons, Node `node:test`, and Playwright browser smoke tests.

## Global Constraints

- Keep first-party CSS in linked stylesheet files.
- Avoid first-party inline `style` attributes and style tags wherever practical.
- Use class attributes and CSS class selectors for programmatic visual state.
- Preserve existing product behaviour, account/session authority, routes, labels, and deployment rules.
- Do not redesign the brand, colour palette, page layout, or information architecture.
- Do not add new navigation destinations, menu items, or account features.
- Do not mutate hosted account, profile, favourite, or game data as part of verification.
- Do not attempt to control third-party runtime internals such as Font Awesome kit implementation details.
- Maintain UK English in user-facing copy and domain documentation.

---

## File Structure

- Modify `tests/repository-hygiene.test.mjs`: add a source-level guard against first-party inline style APIs in production UI files.
- Modify `tests/clipboard.test.mjs`: assert the clipboard fallback textarea receives the stylesheet-backed class and no inline style writes.
- Modify `tests/browser-smoke.test.mjs`: extend existing smoke coverage for selected row-count classes, route-heading classes, compact-label classes, and shared focus affordances.
- Modify `index.html`: add the static selected-index class, compact label class, and route-heading class to existing static markup.
- Modify `assets/clipboard.js`: replace fallback textarea inline style writes with a class assignment.
- Modify `assets/app.js`: replace row-count inline custom-property writes with class updates and add shared heading/label classes to JavaScript-rendered route surfaces.
- Modify `assets/site.css`: add the clipboard fallback class, class-based segmented-control selected-index rules, shared route-heading/compact-label rules, and rationalised interaction-family selectors.
- Modify `docs/product-rules.md`: remove the remaining contradiction that says labelled account-menu rows have hover/focus tooltip text.
- Modify `docs/superpowers/specs/2026-07-06-ui-style-rationalisation-design.md`: mark implementation complete after source, test, and product-rule updates land.
- Modify `docs/superpowers/README.md`: route future workers to product rules/source/tests after completion.

## Task 1: Inline Style Boundary And Clipboard Fallback

**Files:**
- Modify: `tests/repository-hygiene.test.mjs`
- Modify: `tests/clipboard.test.mjs`
- Modify: `assets/clipboard.js`
- Modify: `assets/site.css`

**Interfaces:**
- Consumes: existing `writePlainText(text, options)` export from `assets/clipboard.js`.
- Produces: `.clipboard-fallback-textarea` CSS class used by the clipboard fallback textarea.

- [ ] **Step 1: Write the failing source-hygiene test**

In `tests/repository-hygiene.test.mjs`, change the imports to:

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
```

Add these helpers below `gitAttribute`:

```js
function sourceLines(path) {
  return readFileSync(new URL(path, projectRoot), "utf8").split(/\r?\n/);
}

function assertSourceDoesNotMatch(path, ruleName, pattern) {
  sourceLines(path).forEach((line, index) => {
    assert.equal(
      pattern.test(line),
      false,
      `${path}:${index + 1} uses ${ruleName}: ${line.trim()}`,
    );
  });
}
```

Add this test inside `describe("repository hygiene", () => { ... })`:

```js
  it("keeps first-party production UI styling out of inline style APIs", () => {
    const productionUiFiles = [
      "index.html",
      "assets/app.js",
      "assets/clipboard.js",
    ];
    const inlineStyleRules = [
      { name: "style tag", pattern: /<style\b/i },
      { name: "style attribute", pattern: /\sstyle\s*=/i },
      { name: "direct element.style mutation", pattern: /\.style(?:\.|\[)/ },
      {
        name: "style attribute mutation",
        pattern: /\.setAttribute\(\s*["']style["']/,
      },
      {
        name: "runtime style element creation",
        pattern: /\.createElement\(\s*["']style["']/,
      },
    ];

    for (const filePath of productionUiFiles) {
      for (const rule of inlineStyleRules) {
        assertSourceDoesNotMatch(filePath, rule.name, rule.pattern);
      }
    }
  });
```

- [ ] **Step 2: Write the failing clipboard class test**

In the first test in `tests/clipboard.test.mjs`, after `assert.equal(textarea.readOnly, true);`, add:

```js
    assert.equal(textarea.className, "clipboard-fallback-textarea");
    assert.deepEqual(textarea.style, {});
```

In `createClipboardFallbackDocument`, change the fake textarea object to include `className`:

```js
      const element = {
        className: "",
        focused: false,
        readOnly: false,
        removed: false,
        selectionRange: null,
        selected: false,
        style: {},
        value: "",
        focus() {
          this.focused = true;
        },
        remove() {
          this.removed = true;
        },
        select() {
          this.selected = true;
        },
        setSelectionRange(start, end) {
          this.selectionRange = [start, end];
        },
      };
```

- [ ] **Step 3: Run the focused tests and verify they fail**

Run:

```bash
npm test -- tests/repository-hygiene.test.mjs tests/clipboard.test.mjs
```

Expected: FAIL. The hygiene test reports `.style` writes in `assets/clipboard.js`; the clipboard test reports an empty class name.

- [ ] **Step 4: Move clipboard fallback styling to CSS**

In `assets/clipboard.js`, replace the four `textarea.style.*` assignments with:

```js
  textarea.className = "clipboard-fallback-textarea";
```

In `assets/site.css`, add this class near the global utility rules after `[hidden]`:

```css
.clipboard-fallback-textarea {
  position: fixed;
  top: 0;
  left: -9999px;
  opacity: 0;
}
```

- [ ] **Step 5: Run the focused tests and verify they pass**

Run:

```bash
npm test -- tests/repository-hygiene.test.mjs tests/clipboard.test.mjs
```

Expected: PASS for both test files.

- [ ] **Step 6: Commit Task 1**

```bash
git add tests/repository-hygiene.test.mjs tests/clipboard.test.mjs assets/clipboard.js assets/site.css
git commit -m "Remove clipboard inline style fallback"
```

## Task 2: Class-Based Row-Count Selected State

**Files:**
- Modify: `tests/browser-smoke.test.mjs`
- Modify: `index.html`
- Modify: `assets/app.js`
- Modify: `assets/site.css`

**Interfaces:**
- Consumes: existing `[data-row-count-options]` segmented control and `[data-row-count]` buttons.
- Produces: exactly one `is-selected-index-N` class on `[data-row-count-options]`, where `N` is the selected button index from 0 to 4.

- [ ] **Step 1: Extend the row-count smoke assertion**

Replace `assertRowCountSelected` in `tests/browser-smoke.test.mjs` with:

```js
async function assertRowCountSelected(page, rowCount) {
  assert.equal(
    await page.locator(`[data-row-count="${rowCount}"]`).getAttribute("aria-pressed"),
    "true",
  );

  const expectedIndex = ["10", "15", "20", "25", "30"].indexOf(rowCount);
  assert.notEqual(expectedIndex, -1);
  const selectedIndexClasses = await page
    .locator("[data-row-count-options]")
    .evaluate((control) =>
      [...control.classList]
        .filter((className) => className.startsWith("is-selected-index-"))
        .sort(),
    );

  assert.deepEqual(selectedIndexClasses, [`is-selected-index-${expectedIndex}`]);
}
```

- [ ] **Step 2: Run the browser smoke test and verify it fails on selected-index classes**

Run:

```bash
npm test -- tests/browser-smoke.test.mjs
```

Expected: FAIL before implementation because `[data-row-count-options]` does not yet expose `is-selected-index-N` classes.

- [ ] **Step 3: Add the static selected-index default**

In `index.html`, change the row-count container to:

```html
            <div class="segmented-control is-selected-index-2" data-row-count-options>
```

- [ ] **Step 4: Replace the JavaScript inline custom-property write**

In `assets/app.js`, add this constant below `const rowCountButtons = [...document.querySelectorAll("[data-row-count]")];`:

```js
const rowCountSelectedIndexClasses = rowCountButtons.map(
  (_button, index) => `is-selected-index-${index}`,
);
```

Add this helper above `updateRowCountButtons`:

```js
function updateRowCountSelectedIndexClass(selectedIndex) {
  const rowCountControl = rowCountButtons[0]?.parentElement;
  if (!rowCountControl) {
    return;
  }

  rowCountControl.classList.remove(...rowCountSelectedIndexClasses);
  rowCountControl.classList.add(
    `is-selected-index-${Math.max(selectedIndex, 0)}`,
  );
}
```

Replace the start of `updateRowCountButtons` with:

```js
function updateRowCountButtons(rowCount) {
  const selectedIndex = rowCountButtons.findIndex(
    (button) => Number(button.dataset.rowCount) === rowCount,
  );
  updateRowCountSelectedIndexClass(selectedIndex);
  rowCountButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(Number(button.dataset.rowCount) === rowCount));
    button.disabled = game.started;
  });
}
```

- [ ] **Step 5: Replace the CSS custom-property dependency with classes**

In `assets/site.css`, replace the `transform` inside `.segmented-control::before` with:

```css
  transform: translateX(calc(2 * (100% + var(--segment-gap))));
```

Add these rules below `.segmented-control::before`:

```css
.segmented-control.is-selected-index-0::before {
  transform: translateX(calc(0 * (100% + var(--segment-gap))));
}

.segmented-control.is-selected-index-1::before {
  transform: translateX(calc(1 * (100% + var(--segment-gap))));
}

.segmented-control.is-selected-index-2::before {
  transform: translateX(calc(2 * (100% + var(--segment-gap))));
}

.segmented-control.is-selected-index-3::before {
  transform: translateX(calc(3 * (100% + var(--segment-gap))));
}

.segmented-control.is-selected-index-4::before {
  transform: translateX(calc(4 * (100% + var(--segment-gap))));
}
```

- [ ] **Step 6: Run the browser smoke test and source-hygiene guard**

Run:

```bash
npm test -- tests/browser-smoke.test.mjs tests/repository-hygiene.test.mjs
```

Expected: PASS. Row-count highlight alignment still passes for 10, 30, and 10 again, and the source-hygiene guard no longer finds the inline `--selected-index` write.

- [ ] **Step 7: Commit Task 2**

```bash
git add tests/browser-smoke.test.mjs index.html assets/app.js assets/site.css
git commit -m "Use class based row count selected state"
```

## Task 3: Shared Route Headings And Compact Labels

**Files:**
- Modify: `tests/browser-smoke.test.mjs`
- Modify: `index.html`
- Modify: `assets/app.js`
- Modify: `assets/site.css`

**Interfaces:**
- Consumes: existing route renderers for reveal, Favourites, Multiplayer, Settings, and signed-in route gates.
- Produces: `.route-heading` on equivalent route-level headings and `.compact-label` on compact field/control labels.

- [ ] **Step 1: Add browser assertions for route-heading and compact-label classes**

In `tests/browser-smoke.test.mjs`, add these helpers near the existing visual assertion helpers:

```js
async function assertRouteHeading(locator) {
  assert.equal(await locator.evaluate((element) => element.classList.contains("route-heading")), true);
}

async function assertCompactLabel(locator) {
  assert.equal(await locator.evaluate((element) => element.classList.contains("compact-label")), true);
}

async function readTextStyle(locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      color: style.color,
      fontSize: Number.parseFloat(style.fontSize),
      fontWeight: Number.parseFloat(style.fontWeight),
      lineHeight: style.lineHeight,
    };
  });
}

async function assertMatchingTextStyle(first, second) {
  const firstStyle = await readTextStyle(first);
  const secondStyle = await readTextStyle(second);

  assert.deepEqual(secondStyle, firstStyle);
}
```

In the first solo smoke test, replace the existing reveal heading wait with:

```js
    const revealHeading = page.getByRole("heading", {
      name: "Completed phrase batch",
      level: 2,
    });
    await revealHeading.waitFor({ state: "visible" });
    await assertRouteHeading(revealHeading);
```

Replace the two existing `assertMatchingPlainHeadingStyles` calls that compare `.control-label` with `[data-section-progress]` with:

```js
    await assertCompactLabel(page.locator(".control-label"));
```

Add this new smoke test near the existing route/account smoke tests:

```js
  it("renders equivalent route headings and compact labels through shared classes", async () => {
    if (!staticServer) {
      staticServer = await startStaticServer();
    }
    if (!browser) {
      browser = await chromium.launch();
    }

    const context = await browser.newContext({
      viewport: { width: 920, height: 700 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await assertCompactLabel(page.locator(".control-label"));

    await signInWithLocalTestAccount(page);
    await openFavouritesRoute(page);
    const favouritesHeading = page.getByRole("heading", {
      name: "Favourites",
      level: 2,
    });
    await assertRouteHeading(favouritesHeading);

    await openSettingsRouteFromAccountMenu(page);
    const settingsPanel = page.getByRole("region", { name: "Settings" });
    const settingsHeading = settingsPanel.getByRole("heading", {
      name: "Settings",
      level: 2,
    });
    await assertRouteHeading(settingsHeading);
    await assertMatchingTextStyle(favouritesHeading, settingsHeading);
    await assertCompactLabel(settingsPanel.locator(".account-profile-field").first());
    await assertCompactLabel(settingsPanel.locator(".account-profile-avatar-label"));

    await openMultiplayerRoute(page);
    const multiplayerHeading = page.getByRole("heading", {
      name: "Invite by email or Gamer Tag",
      level: 2,
    });
    await assertRouteHeading(multiplayerHeading);
    await assertMatchingTextStyle(favouritesHeading, multiplayerHeading);
    await assertCompactLabel(page.locator(".pending-game-field").first());

    const anonymousContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const anonymousPage = await anonymousContext.newPage();
    const assertAnonymousNoConsoleErrors = trackConsoleErrors(anonymousPage);
    await anonymousPage.goto(`${staticServer.origin}/#/settings`);
    const settingsGateHeading = anonymousPage.getByRole("heading", {
      name: "Sign in to view Settings",
      level: 2,
    });
    await assertRouteHeading(settingsGateHeading);
    await assertNoHorizontalOverflow(anonymousPage);
    assertAnonymousNoConsoleErrors();
    await anonymousContext.close();

    await assertNoHorizontalOverflow(page);
    assertNoConsoleErrors();
  });
```

- [ ] **Step 2: Run the browser smoke test and verify it fails on missing shared classes**

Run:

```bash
npm test -- tests/browser-smoke.test.mjs
```

Expected: FAIL because route headings and compact labels are not yet consistently classed.

- [ ] **Step 3: Add shared classes to static markup**

In `index.html`, change the setup label and reveal heading to:

```html
            <h3 class="control-label compact-label">Phrases per batch</h3>
```

```html
            <h2 class="route-heading">Completed phrase batch</h2>
```

- [ ] **Step 4: Add shared classes to JavaScript-rendered route headings**

In `assets/app.js`, set `title.className = "route-heading";` in both `renderFavouritesHeading` and `ensurePendingGamePanel` immediately after each route-level `h2` is created.

In `renderSignInRequiredGate`, add the class after creating the heading:

```js
  const heading = document.createElement("h2");
  heading.className = "route-heading";
```

In `ensureAccountProfilePanel`, replace the simple heading creation with:

```js
  const heading = document.createElement("div");
  heading.className = "section-heading";

  const title = document.createElement("h2");
  title.className = "route-heading";
  title.textContent = "Settings";
  heading.append(title);
```

The existing `accountProfilePanel.append(heading, form, unsavedConfirmation);` line remains correct after this replacement.

- [ ] **Step 5: Add compact-label classes to JavaScript-rendered field labels**

In `assets/app.js`, change the pending-game label class assignments to:

```js
  lookupKeyLabel.className = "pending-game-field compact-label";
```

```js
  rowCountLabel.className = "pending-game-field compact-label";
```

```js
  nudgeTimeoutLabel.className = "pending-game-field compact-label";
```

In `createProfileInputField`, change the field class to:

```js
  field.className = "account-profile-field compact-label";
```

In `createProfileAvatarField`, change the avatar label class to:

```js
  galleryLabel.className = "account-profile-avatar-label compact-label";
```

- [ ] **Step 6: Rationalise route-heading and compact-label CSS**

In `assets/site.css`, replace `.control-label, .section-kicker, .progress-text` with:

```css
.section-kicker,
.progress-text {
  margin: 0;
  color: var(--muted);
  font-size: 0.95rem;
  font-weight: 400;
}

.compact-label {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
  font-weight: 800;
  line-height: 1.2;
}

.control-label {
  margin-bottom: 8px;
}
```

Replace `.section-heading h2` with:

```css
.route-heading {
  margin: 6px 0 0;
  color: var(--ink);
  font-size: clamp(1.7rem, 5vw, 2.6rem);
  font-weight: 800;
  line-height: 1.1;
}
```

Add this rule near `.route-gate h2, .route-gate p`:

```css
.route-gate .route-heading {
  margin: 0;
}
```

Change the panel-surface selector to include Settings:

```css
.help-panel,
.game-panel,
.pending-game-panel,
.favourites-panel,
.account-profile-panel {
  border-radius: 8px;
  background: var(--surface);
  box-shadow: var(--shadow);
}
```

Replace the existing compact account profile panel block with:

```css
.account-profile-panel {
  margin: 0 0 16px;
  padding: clamp(18px, 4vw, 28px);
}
```

Delete the existing `.account-profile-panel h2` block; `.route-heading` owns the
Settings heading style after this task.

Keep `.account-profile-form`, `.account-profile-field`, `.account-profile-avatar-field`, and descendant input rules below it.

- [ ] **Step 7: Run browser smoke and verify heading/label assertions pass**

Run:

```bash
npm test -- tests/browser-smoke.test.mjs
```

Expected: PASS. Route headings share computed heading style, compact labels expose `.compact-label`, and no horizontal overflow appears.

- [ ] **Step 8: Commit Task 3**

```bash
git add tests/browser-smoke.test.mjs index.html assets/app.js assets/site.css
git commit -m "Rationalise route headings and compact labels"
```

## Task 4: Interaction Family State Rationalisation

**Files:**
- Modify: `tests/browser-smoke.test.mjs`
- Modify: `assets/site.css`

**Interfaces:**
- Consumes: existing button, menu, tab, segmented-control, tooltip, and popover selectors.
- Produces: shared hover and focus treatment by control family while preserving visible labels, accessible names, tooltip rules, active states, and disabled states.

- [ ] **Step 1: Add smoke coverage for shared focus affordances**

In `tests/browser-smoke.test.mjs`, add this helper near the existing visual assertion helpers:

```js
async function assertVisibleFocusRing(locator) {
  await locator.focus();
  const focusStyle = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineColor: style.outlineColor,
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
    };
  });

  assert.equal(focusStyle.outlineStyle, "solid");
  assert.ok(
    focusStyle.outlineWidth >= 4,
    `Expected at least a 4px focus ring, got ${focusStyle.outlineWidth}px`,
  );
  assert.notEqual(focusStyle.outlineColor, "rgba(0, 0, 0, 0)");
}
```

Add this smoke test near the existing interaction polish smoke tests:

```js
  it("uses visible focus treatment across equivalent interaction families", async () => {
    if (!staticServer) {
      staticServer = await startStaticServer();
    }
    if (!browser) {
      browser = await chromium.launch();
    }

    const context = await browser.newContext({
      viewport: { width: 920, height: 700 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await assertVisibleFocusRing(page.getByRole("button", { name: "Enable dark mode" }));
    await assertVisibleFocusRing(page.getByRole("button", { name: "Start batch" }));
    await assertVisibleFocusRing(page.getByRole("button", { name: "10" }));

    await signInWithLocalTestAccount(page);
    await assertVisibleFocusRing(page.getByRole("link", { name: "Favourites" }));

    const playButton = page.getByRole("button", { name: "Play" });
    await playButton.click();
    await assertVisibleFocusRing(page.getByRole("menuitem", { name: "Solo play" }));

    await page.keyboard.press("Escape");
    await openFavouritesRoute(page);
    await assertVisibleFocusRing(page.getByRole("tab", { name: "Batches" }));

    await openSettingsRouteFromAccountMenu(page);
    const settingsPanel = page.getByRole("region", { name: "Settings" });
    await assertVisibleFocusRing(settingsPanel.getByRole("button", { name: "Save profile" }));
    await assertVisibleFocusRing(
      settingsPanel.getByRole("button", { name: "Reset profile changes" }),
    );

    const accountMenuButton = page.getByRole("button", {
      name: LOCAL_TEST_PROFILE_TOOLTIP,
    });
    await accountMenuButton.click();
    const accountMenu = page.getByRole("menu", { name: "Account menu" });
    await accountMenu.waitFor({ state: "visible" });
    await assertVisibleFocusRing(accountMenu.getByRole("menuitem", { name: "Settings" }));
    await expectNoTooltip(accountMenu.getByRole("menuitem", { name: "Settings" }));
    await expectNoTooltip(accountMenu.getByRole("menuitem", { name: "Sign out" }));

    await assertNoHorizontalOverflow(page);
    assertNoConsoleErrors();
  });
```

- [ ] **Step 2: Run the browser smoke test and capture current gaps**

Run:

```bash
npm test -- tests/browser-smoke.test.mjs
```

Expected: FAIL if any family lacks the shared focus ring. Current likely gaps are `.primary-nav-link`, `.favourites-tab`, and `.notification-mark-all-read`; do not remove existing passing tests.

- [ ] **Step 3: Rationalise focus selectors**

In `assets/site.css`, replace the focus selector group with:

```css
.entry-row input:focus-visible,
.dice-button:focus-visible,
.icon-button:focus-visible,
.primary-nav-link:focus-visible,
.play-menu-item:focus-visible,
.account-profile-avatar-option:focus-visible,
.account-profile-avatar-upload-button:focus-visible,
.account-menu-item:focus-visible,
.notification-item:focus-visible,
.notification-mark-read:focus-visible,
.notification-mark-all-read:focus-visible,
.text-button:focus-visible,
.favourite-row:focus-visible,
.favourites-tab:focus-visible,
.segmented-control button:focus-visible,
.primary-button:focus-visible,
.secondary-button:focus-visible,
.danger-button:focus-visible {
  outline: 4px solid var(--ring);
  outline-offset: 2px;
}
```

- [ ] **Step 4: Rationalise menu/list row hover and focus selectors**

In `assets/site.css`, replace the separate `.account-menu-item:hover` rule and the play-menu hover/focus/current rule with:

```css
.play-menu-item:hover,
.play-menu-item:focus-visible,
.play-menu-item[aria-current="page"],
.account-menu-item:hover,
.account-menu-item:focus-visible {
  background: var(--surface-soft);
}
```

Keep the `outline` rule out of this block; focus outline is owned by the shared focus selector.

- [ ] **Step 5: Rationalise command disabled selectors**

In `assets/site.css`, replace the disabled button selector with:

```css
.primary-button:disabled,
.secondary-button:disabled,
.danger-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
```

- [ ] **Step 6: Keep Start batch and Start again visual parity passing**

Run:

```bash
npm test -- tests/browser-smoke.test.mjs
```

Expected: PASS, including the existing `renders Start batch and Start again as matching setup actions` test and the account-menu tooltip tests.

- [ ] **Step 7: Commit Task 4**

```bash
git add tests/browser-smoke.test.mjs assets/site.css
git commit -m "Rationalise interaction focus and hover states"
```

## Task 5: Product Rule And Status Ledger Closeout

**Files:**
- Modify: `docs/product-rules.md`
- Modify: `docs/superpowers/specs/2026-07-06-ui-style-rationalisation-design.md`
- Modify: `docs/superpowers/README.md`

**Interfaces:**
- Consumes: completed implementation and passing tests from Tasks 1 through 4.
- Produces: current documentation that routes future agents to product rules/source/tests rather than the implementation plan.

- [ ] **Step 1: Fix the account-menu tooltip contradiction in product rules**

In `docs/product-rules.md`, replace the account-menu wording:

```markdown
`Settings` uses Font Awesome `sliders`, and `Sign out` uses Font Awesome
`arrow-right-from-bracket`. Their visible menu text and hover/focus tooltip text use
```

with:

```markdown
`Settings` uses Font Awesome `sliders`, and `Sign out` uses Font Awesome
`arrow-right-from-bracket`. Their visible menu text uses default font weight, and
because these rows are visibly labelled they do not expose duplicate hover/focus
tooltips.
```

- [ ] **Step 2: Promote the implemented UI style boundary to product rules**

Add this paragraph to the Account/Profile affordance and navigation style area of `docs/product-rules.md`, after the header tooltip paragraph:

```markdown
First-party UI styling belongs in linked stylesheets. App-owned JavaScript may update
classes, data attributes, and ARIA state to reflect visual state, but must not create
first-party inline `style` attributes, `style` tags, or direct `element.style` writes for
production UI styling. Route-level headings, compact field labels, top-nav icons,
text-labelled command buttons, menu rows, segmented controls, icon-only utility actions,
text links, and popover internals use their shared CSS families before adding local
one-off interaction rules.
```

- [ ] **Step 3: Update the spec status**

In `docs/superpowers/specs/2026-07-06-ui-style-rationalisation-design.md`, replace the `## Status` section with:

```markdown
## Status

Historical/completed. Implemented through the UI style rationalisation plan and promoted
to product rules after source and smoke-test verification.

Current authority is `docs/product-rules.md`, `assets/site.css`, `assets/app.js`,
`assets/clipboard.js`, `tests/repository-hygiene.test.mjs`,
`tests/clipboard.test.mjs`, and `tests/browser-smoke.test.mjs`.
```

- [ ] **Step 4: Update the superpowers status ledger**

In `docs/superpowers/README.md`, replace the spec row with:

```markdown
| `specs/2026-07-06-ui-style-rationalisation-design.md` | Historical/completed. Implemented through `plans/2026-07-06-ui-style-rationalisation.md`; future changes should use product rules, source files, and tests as authority. | `docs/product-rules.md`, `assets/site.css`, `assets/app.js`, `assets/clipboard.js`, `tests/repository-hygiene.test.mjs`, `tests/clipboard.test.mjs`, `tests/browser-smoke.test.mjs` |
```

Add this plan row near the other active/completed plan rows:

```markdown
| `plans/2026-07-06-ui-style-rationalisation.md` | Historical/completed. Do not execute as an active plan after the implementation commit is promoted. | `docs/product-rules.md`, `assets/site.css`, `assets/app.js`, `assets/clipboard.js`, `tests/repository-hygiene.test.mjs`, `tests/clipboard.test.mjs`, `tests/browser-smoke.test.mjs` |
```

- [ ] **Step 5: Run documentation/source validation**

Run:

```bash
rg -n "TB[D]|TO[DO]|FIX[ME]|unclea[r]" docs/superpowers/plans/2026-07-06-ui-style-rationalisation.md docs/superpowers/specs/2026-07-06-ui-style-rationalisation-design.md docs/superpowers/README.md docs/product-rules.md
git diff --check
```

Expected: the `rg` command exits with no matches and `git diff --check` exits 0.

- [ ] **Step 6: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS for all Node and browser smoke tests.

- [ ] **Step 7: Commit Task 5**

```bash
git add docs/product-rules.md docs/superpowers/specs/2026-07-06-ui-style-rationalisation-design.md docs/superpowers/README.md
git commit -m "Document UI style rationalisation rules"
```

## Final Verification

- [ ] **Step 1: Confirm no uncommitted implementation changes remain**

Run:

```bash
git status --short --branch
```

Expected: clean working tree apart from unrelated user-owned untracked assets, if they are still present.

- [ ] **Step 2: Run final verification**

Run:

```bash
npm test
git diff --check HEAD~5..HEAD
```

Expected: all tests pass and whitespace validation exits 0.

- [ ] **Step 3: Push the branch**

Run:

```bash
git push
```

Expected: branch push succeeds and the pull request updates.

## Execution Notes

- Keep the existing account-menu `Settings` and `Sign out` rows free of `data-tooltip` and `tooltip-action`.
- Keep header tooltip stacking above open popovers.
- Keep `Start batch` and `Start again` rendered through the same `.primary-button.setup-button` family.
- Do not broaden source-hygiene scanning to third-party injected runtime DOM. The guard covers first-party source files in the repository.
- Do not stage or commit unrelated untracked image assets unless the owner explicitly brings them into this slice.
