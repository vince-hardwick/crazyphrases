# In-App Browser Verification Runbook

## Purpose

Use the Codex in-app browser for user-observable browser verification, especially when checking `dev` and `test` deployments protected by Cloudflare Access. This keeps the automated interaction visible in the Codex side pane and reuses the user's authenticated browser context.

Use Edge-backed or standalone Playwright only as a fallback after reporting why the in-app browser path is blocked. That fallback is not equivalent when the user wants to watch the run.

## Preferred Verification Path

1. Open the Browser skill instructions for the current Codex session.
2. Connect to the `iab` browser through the Browser plugin's `browser-client` module.
3. Set browser visibility to `true` before interaction when the user wants to observe the run.
4. Use the currently selected tab if available; otherwise create a new in-app tab.
5. Navigate to the deployed environment URL, normally `https://dev.crazyphrases.com/` or `https://test.crazyphrases.com/`.
6. If Cloudflare Access appears, yield to the user to complete authentication in the visible browser.
7. Use the Browser plugin's Playwright API for snapshots, locators, clicks, fills, and targeted assertions.
8. Keep the browser visible until the observed smoke run has finished.

Do not treat shell network access, deployment approval, or environment detection as authority to mutate a live environment. Deployment authority remains the approved GitHub Environment workflow.

## Expected Smoke Shape For Anonymous Solo

For the anonymous solo MVP, a deployment smoke should check:

- The page loads as Crazy Phrases.
- The help panel opens and closes.
- Phrase count selection is visible before start.
- Entry controls are hidden before `Start batch`.
- Selecting 10 phrases changes setup copy to `10 phrases selected`.
- `Start batch` reveals one active section and disables row-count controls.
- Attempting to activate a different row count after start does not clear entered text.
- `Start again` asks for confirmation when entries exist and returns to phrase-count selection.
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
