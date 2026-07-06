# Task 3 Report: Shared Route Headings And Compact Labels

## What changed

- Added RED/GREEN browser smoke coverage in `tests/browser-smoke.test.mjs` for:
  - `.route-heading` on reveal, Favourites, Settings, Multiplayer, and signed-out route gates.
  - `.compact-label` on the solo setup label, Settings profile labels, and Multiplayer field labels.
  - matching computed heading text styles across equivalent route-level headings.
- Updated `index.html` so:
  - `Phrases per batch` uses `class="control-label compact-label"`.
  - `Completed phrase batch` uses `class="route-heading"`.
- Updated `assets/app.js` so shared classes are applied by the route renderers:
  - `renderFavouritesHeading`
  - `ensurePendingGamePanel`
  - `renderSignInRequiredGate`
  - `ensureAccountProfilePanel`
  - `createProfileInputField`
  - `createProfileAvatarField`
- Updated `assets/site.css` so:
  - `.compact-label` owns the compact label text treatment.
  - `.route-heading` owns the shared route heading treatment.
  - `.route-gate .route-heading` resets the gate heading margin.
  - `.account-profile-panel` joins the shared panel surface styling and uses the compact panel spacing from the brief.
  - the old Settings-specific heading block was removed.

## RED evidence

Command:

```bash
npm test -- tests/browser-smoke.test.mjs
```

Result: FAIL

Relevant failures:

```text
not ok 1 - completes the full flow in a mobile-constrained viewport
error: Expected values to be strictly equal:
false !== true
stack: assertCompactLabel ... tests/browser-smoke.test.mjs:107:5
```

```text
not ok 8 - renders equivalent route headings and compact labels through shared classes
error: Expected values to be strictly equal:
false !== true
stack: assertCompactLabel ... tests/browser-smoke.test.mjs:549:5
```

Interpretation: the shared `.compact-label` and `.route-heading` classes were not yet applied consistently.

## GREEN evidence

Command:

```bash
npm test -- tests/browser-smoke.test.mjs
```

Result: PASS

Summary:

```text
ok 8 - renders equivalent route headings and compact labels through shared classes
...
# tests 103
# pass 103
# fail 0
```

## Tests and output

- `npm test -- tests/browser-smoke.test.mjs`
  - RED run: failed on missing shared classes.
  - GREEN run: passed, `103` tests passed, `0` failed.

## Files changed

- `tests/browser-smoke.test.mjs`
- `index.html`
- `assets/app.js`
- `assets/site.css`
- `.superpowers/sdd/task-3-report.md`

## Self-review

- Kept all production styling in `assets/site.css`; no inline styles or style tags were added.
- Preserved the existing class-based row-count selected-state handling.
- Kept the task scoped to the four owned production files plus this report.
- Left unrelated untracked files under `assets/img/` untouched.
- Preserved existing copy, routes, and account/session behaviour.

## Concerns

- The brief’s sample compared the Favourites heading locator after navigating away from the Favourites route. In this app, that heading is unmounted on route change, so the final smoke test preserves the Favourites computed style snapshot before navigation and compares later headings against that snapshot. The behavioural intent remains the same: equivalent route headings share the same computed text style.
