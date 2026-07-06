# Task 1 Report: Inline Style Boundary And Clipboard Fallback

## What Changed
- Moved the clipboard fallback textarea positioning out of `assets/clipboard.js` and onto a shared `.clipboard-fallback-textarea` CSS class in `assets/site.css`.
- Updated the clipboard fallback test to assert the textarea class name and confirm the fake textarea starts without inline style state.
- Added a repository hygiene test that checks the first-party UI files for inline style APIs, with the direct `.style.setProperty()` CSS custom property update in `assets/app.js` intentionally excluded from the direct style-mutation matcher because it is existing UI state management rather than clipboard fallback styling.

## Tests And Output
- Ran: `npm test -- tests/repository-hygiene.test.mjs tests/clipboard.test.mjs`
- Result after implementation: pass.

## RED Evidence
- Initial focused run failed in `tests/clipboard.test.mjs` because the fallback textarea still had an empty `className` instead of `clipboard-fallback-textarea`.
- Initial focused run also failed in `tests/repository-hygiene.test.mjs` because the hygiene rule matched an existing `const style = ...` variable in `assets/app.js`, which was not the intended target.

## GREEN Evidence
- Final focused run passed all 5 tests across both suites.
- Clipboard fallback now assigns the shared class name and the tests confirm no inline style object state is required for the fallback.

## Files Changed
- `tests/repository-hygiene.test.mjs`
- `tests/clipboard.test.mjs`
- `assets/clipboard.js`
- `assets/site.css`

## Self-Review
- The clipboard fallback no longer carries inline positioning values in script.
- The new stylesheet rule keeps the fallback hidden and off-screen without changing runtime behaviour.
- The hygiene test is narrower than the original brief matcher so it does not flag the existing CSS custom property update in `assets/app.js`.

## Concerns
- The hygiene matcher was adjusted from the brief to avoid a false positive against existing UI state management in `assets/app.js`. That keeps the test useful, but it is a slight deviation from the literal matcher text in the brief.

## Fix After Task Review
- Review issue: Task 1 weakened the direct inline-style hygiene matcher by carving out `.style.setProperty(...)`, which left first-party runtime style mutation outside the guard.
- Fix: restored the strict direct style mutation pattern so `.style.` and `.style[...]` are both rejected again, then removed the row-count selected-state inline style mutation by moving that state onto `is-selected-index-N` classes on `[data-row-count-options]`.
- Tests run:
  - `npm test -- tests/browser-smoke.test.mjs tests/repository-hygiene.test.mjs`
  - `npm test -- tests/repository-hygiene.test.mjs tests/clipboard.test.mjs`
- Result: pass. The browser smoke suite now asserts exactly one selected-index class for the row-count control, the repository hygiene guard catches direct style mutation again, and Task 1 clipboard coverage remains green.
