# In-App Browser Verification Runbook

## Purpose

Use the Codex in-app browser for user-observable browser verification, especially when checking `dev` and `test` deployments protected by Cloudflare Access. This keeps the automated interaction visible in the Codex side pane and reuses the user's authenticated browser context.

Use Edge-backed or standalone Playwright only as a fallback after reporting why the in-app browser path is blocked. That fallback is not equivalent when the user wants to watch the run.

## Discovery Rule

When a task mentions browser smoke testing, local frontend verification, localhost, Playwright interaction automation, screenshots, or the in-app Codex browser, use this runbook before trying standalone Playwright, Edge-backed automation, shell-only HTTP checks, or ad hoc browser tooling.

Choose the scenario first:

| Scenario | URL shape | Successful approach |
| --- | --- | --- |
| Local ad hoc static site before deployment | `http://localhost:4173/` | Start or confirm a local server, then drive the visible `iab` tab with the Browser plugin's Playwright API. Use the local fast path below. |
| Deployed `dev` or `test` environment | `https://dev.crazyphrases.com/`, `https://test.crazyphrases.com/` | Use the visible `iab` tab against the deployed URL. Let the user complete Cloudflare Access authentication if prompted, then verify the deployed commit and cache-busted assets. |
| Production environment | `https://www.crazyphrases.com/` | Use the visible `iab` tab only after the documented promotion and approval path. Production is public, but verification does not authorize mutation. |

For local static site work in this repository before any branch deployment, the successful path is:

1. Start or confirm a local static server that the in-app browser can reach.
2. Connect to the Codex in-app browser (`iab`) through the Browser plugin.
3. Set browser visibility to `true`.
4. Use the selected tab when the user already has one open, otherwise create a new tab.
5. Navigate or reload `http://localhost:4173/`.
6. Use the Browser plugin's Playwright API for snapshots, locators, clicks, fills, reloads, and assertions.

Do not rediscover this through standalone Playwright first.

## Deployed Environment Verification Path

1. Open the Browser skill instructions for the current Codex session.
2. Connect to the `iab` browser through the Browser plugin's `browser-client` module.
3. Set browser visibility to `true` before interaction when the user wants to observe the run.
4. Use the currently selected tab if available; otherwise create a new in-app tab.
5. Navigate to the deployed environment URL:
   - `https://dev.crazyphrases.com/` for approved feature-branch inspection.
   - `https://test.crazyphrases.com/` for formal testing after merge to `main`.
   - `https://www.crazyphrases.com/` for post-production verification after promotion approval.
6. If Cloudflare Access appears on `dev` or `test`, yield to the user to complete authentication in the visible browser. Do not replace this with shell access or standalone browser automation; the visible in-app browser is expected to reuse the user's authenticated browser context.
7. Use the Browser plugin's Playwright API for snapshots, locators, clicks, fills, and targeted assertions.
8. For deployed `dev`/`test`/`production`, include the static asset cache check below so the browser is not mixing fresh HTML with stale JavaScript.
9. Keep the browser visible until the observed smoke run has finished.

Do not treat shell network access, deployment approval, or environment detection as authority to mutate a live environment. Deployment authority remains the approved GitHub Environment workflow.

Do not use the local static-server snippet for deployed environments. Live sites are served by the documented GitHub Actions and hosting path, and deployment authority comes from GitHub Environment approvals, not from detecting a hostname or branch.

## Local Static Site Fast Path

For local verification of this static app before deployment to `dev`, `test`, or production, prefer `http://localhost:4173/`.

This local fast path is specifically for ad hoc local files in the current working tree. It is useful before a branch has been deployed or when checking browser behaviour before push. It does not prove that `dev`, `test`, or production received the same files; deployed environments still need the deployed environment path above.

If a shell-launched background server exits immediately or is not reachable from the in-app browser, start the server from the same persistent JavaScript runtime used to control the Browser plugin. This keeps the static server alive while Playwright interactions run.

Use this shape, adjusting only the absolute workspace path if the repository moves:

```js
const httpMod = await import("node:http");
const fsPromises = await import("node:fs/promises");
const pathMod = await import("node:path");

if (globalThis.staticServer4173) {
  await new Promise((resolve) => globalThis.staticServer4173.close(resolve));
}

const workspaceRoot =
  "C:/Users/VinceHardwick/Documents/Development/Web dev/crazyphrases.com";
const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
]);

globalThis.staticServer4173 = httpMod.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, "http://localhost:4173");
    const pathname = decodeURIComponent(requestUrl.pathname);
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
    const filePath = pathMod.resolve(workspaceRoot, relativePath);

    if (!filePath.startsWith(pathMod.resolve(workspaceRoot))) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    const bytes = await fsPromises.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": mimeTypes.get(pathMod.extname(filePath)) ?? "application/octet-stream",
    });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

await new Promise((resolve, reject) => {
  globalThis.staticServer4173.once("error", reject);
  globalThis.staticServer4173.listen(4173, "127.0.0.1", resolve);
});
```

Then connect to the visible in-app browser and use supported Playwright calls:

```js
const visibility = await browser.capabilities.get("visibility");
await visibility.set(true);

let tab = await browser.tabs.selected();
if (!tab) {
  tab = await browser.tabs.new();
}

await tab.goto("http://localhost:4173/");
await tab.playwright.waitForLoadState({ state: "load", timeoutMs: 5000 });
const snapshot = await tab.playwright.domSnapshot();
```

Use `waitForLoadState({ state: "load" })`; do not use `networkidle` in the Browser plugin Playwright wrapper because it is not supported in the current in-app browser runtime.

If the user already has the in-app browser open at `http://localhost:4173/`, attach to the selected tab after the server is running, then reload or navigate through the same `tab` object. A selected tab whose URL says localhost but whose title is `about:blank` or whose DOM snapshot is empty has not loaded the app.

Local smoke runs may restore anonymous solo state from browser local storage. If the setup controls are missing and the page is already in `entry` or `reveal` phase, use the visible `Start again` flow to return to setup before checking phrase-count selection. Do not rely on `tab.playwright.evaluate(() => localStorage.clear())`; the Browser plugin's page-evaluate scope is read-oriented and may not expose `localStorage`.

If `Start again` opens the in-app confirmation panel, click the visible confirmation button for the current phase. During entry, the confirmation button is `Discard entries`. After reveal, the confirmation button is `Start new batch`. The app must not use browser-native `window.confirm` for this flow because it blocks Playwright automation and is not inspectable through normal DOM assertions.

```js
const startAgain = tab.playwright.getByRole("button", { name: "Start again" });
await startAgain.click({});
const startNewBatch = tab.playwright.getByRole("button", { name: "Start new batch" });
const discardEntries = tab.playwright.getByRole("button", { name: "Discard entries" });
const confirmationButton =
  (await startNewBatch.count()) === 1 ? startNewBatch : discardEntries;
await confirmationButton.click({});
await tab.playwright.locator("[data-start-button]").waitFor({
  state: "visible",
  timeoutMs: 5000,
});
```

For live `dev`, `test`, or production verification, skip this local server setup entirely and navigate the visible in-app browser to the deployed HTTPS URL instead.

## Playwright Interaction Notes

Use locators and snapshots from the Browser plugin's Playwright API. For example:

```js
const startButton = tab.playwright.getByRole("button", { name: "Start batch" });
if ((await startButton.count()) !== 1) {
  throw new Error("Expected one Start batch button.");
}
await startButton.click({});
```

When verifying input values, read the DOM property rather than the HTML attribute:

```js
const value = await tab.playwright.evaluate(
  () => document.querySelector("[data-row-index=\"0\"]")?.value ?? null,
);
```

The Browser plugin exposes a limited Playwright surface. Prefer documented methods such as `domSnapshot`, `locator`, `getByRole`, `click`, `fill`, `count`, `waitFor`, `reload`, and `evaluate`. If a method fails because the wrapper does not support it, switch to a documented method instead of falling back to a separate browser.

## Expected Smoke Shape For Anonymous Solo

For the anonymous solo MVP, a deployment smoke should check:

- The page loads as Crazy Phrases.
- The help panel opens and closes.
- Phrase count selection is visible before start.
- Entry controls are hidden before `Start batch`.
- Selecting 10 phrases changes setup copy to `10 phrases selected`.
- `Start batch` reveals one active section and disables row-count controls.
- Attempting to activate a different row count after start does not clear entered text.
- `Start again` asks for phase-specific confirmation when entries or revealed phrases exist and returns to phrase-count selection.
- Completing all three sections reveals the expected number of phrases.
- Revealed phrase text does not contain generated row or phrase numbers.
- Revealed default-template phrases render in adjective-noun-noun order.

Use non-numbered smoke words such as `brisk`, `teapot`, and `ladder` so test data cannot be mistaken for generated numbering. Because anonymous solo randomizes active slot order, the smoke runner must read the visible active section label and fill adjective words only when the page says `Fill these adjectives`, and noun words only when the page says `Fill these nouns`. Do not assume the first visible entry section is the adjective slot.

## Static Asset Cache Check

After a deployment, verify that the page is not mixing fresh HTML with stale JavaScript or CSS. A mixed state can look like a new control appearing in HTML while old behaviour still runs.

For this static site, deployed `index.html` must reference versioned asset URLs stamped with the deployed commit SHA:

```html
assets/site.css?v=<commit-sha>
assets/app.js?v=<commit-sha>
```

Source `index.html` keeps `__ASSET_VERSION__` placeholders. GitHub Actions stamps those placeholders during deployment. If the placeholders are visible on a deployed environment, the deploy workflow did not stamp the file. If unversioned asset URLs are visible, cache-busting has regressed.

Transitive browser module imports must be versioned as well. Source browser modules under `assets/*.js` keep `__ASSET_VERSION__` placeholders for module imports such as `./game-state.js?v=__ASSET_VERSION__` and `./local-game-storage.js?v=__ASSET_VERSION__`. GitHub Actions stamps those placeholders across `assets/*.js` during deployment. This prevents freshly deployed browser modules from importing older cached dependencies.

The deployed `.htaccess` file sets `index.html` to no-store/no-cache and allows long-lived caching for versioned `.css` and `.js` files. If the root URL serves an older commit after a successful deployment, first check whether `.htaccess` was deployed, then consider Cloudflare edge cache or browser cache as the likely remaining layer.

If the visible browser still shows mixed behaviour after a stamped deployment:

1. Hard-refresh the visible in-app tab.
2. Confirm the top-level script URL includes the current deployed commit SHA.
3. Confirm imported browser modules also include the current deployed commit SHA.
4. Confirm the GitHub deployment run deployed the expected branch and SHA.
5. Treat persistent mismatch as a deployment or hosting cache defect, not as a gameplay bug.

## Localhost Notes

The Browser plugin supports localhost targets in principle. If `localhost` or `127.0.0.1` navigation fails with a browser-client error such as `ERR_BLOCKED_BY_CLIENT`, record the exact symptom and do not silently fall back to hidden browser automation.

Preferred recovery order:

1. Retry with the alternate host form, `localhost` or `127.0.0.1`.
2. Confirm the local server is still running and accepting connections.
3. If the in-app browser remains blocked, use the approved `dev` deployment path for user-observed verification.
4. Use standalone Playwright only for local pre-push confidence, and state clearly that it will not be visible in the Codex side pane.

The long-term desired path is for Codex sessions in this repository to use the visible in-app browser for both deployed environment checks and local web-app checks whenever the Browser plugin can reach the target.
