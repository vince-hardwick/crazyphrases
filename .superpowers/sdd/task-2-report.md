# Task 2 Report: Class-Based Row-Count Selected State

## What Changed
- Added selected-index class assertions to the browser smoke helper for the row-count segmented control.
- Set the default setup markup to expose `is-selected-index-2` on `[data-row-count-options]`.
- Replaced the JavaScript row-count inline style mutation with class updates that keep exactly one `is-selected-index-N` class on the segmented control.
- Replaced the segmented-control custom-property dependency in CSS with explicit `is-selected-index-0` through `is-selected-index-4` rules.
- Restored the strict repository hygiene matcher so direct `.style` mutations are rejected again.

## Tests And Output
- `npm test -- tests/browser-smoke.test.mjs tests/repository-hygiene.test.mjs`
  - PASS: 104 tests, 0 failures.
- `npm test -- tests/repository-hygiene.test.mjs tests/clipboard.test.mjs`
  - PASS: 5 tests, 0 failures.

## RED Evidence
- After tightening `tests/repository-hygiene.test.mjs` and extending `assertRowCountSelected`, `npm test -- tests/browser-smoke.test.mjs tests/repository-hygiene.test.mjs` failed.
- `tests/browser-smoke.test.mjs` failed because `[data-row-count-options]` exposed no `is-selected-index-N` class.
- `tests/repository-hygiene.test.mjs` failed because `assets/app.js` still called `rowCountButtons[0]?.parentElement?.style.setProperty("--selected-index", ...)`.

## GREEN Evidence
- After the class-based implementation landed in `index.html`, `assets/app.js`, and `assets/site.css`, `npm test -- tests/browser-smoke.test.mjs tests/repository-hygiene.test.mjs` passed.
- The follow-up `npm test -- tests/repository-hygiene.test.mjs tests/clipboard.test.mjs` also passed, confirming Task 1 clipboard coverage still holds under the restored hygiene rule.

## Files Changed
- `tests/repository-hygiene.test.mjs`
- `tests/browser-smoke.test.mjs`
- `index.html`
- `assets/app.js`
- `assets/site.css`
- `.superpowers/sdd/task-1-report.md`
- `.superpowers/sdd/task-2-report.md`

## Self-Review
- The row-count control now exposes explicit class-based visual state that matches the selected button index and survives the existing game-state transitions covered by smoke tests.
- The implementation stays within the approved scope: no product copy, routing, account/session, or layout changes.
- The strict inline-style hygiene boundary is back in force for first-party production UI files, including `.style.setProperty(...)`.

## Concerns
- No functional concerns from the requested scope. The browser smoke suite is broad and took roughly two minutes to complete, but it passed cleanly.
