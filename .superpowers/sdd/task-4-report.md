# Task 4 Report: Interaction Family State Rationalisation

## What changed

- Added `assertVisibleFocusRing` to `tests/browser-smoke.test.mjs`.
- Added the new browser smoke `uses visible focus treatment across equivalent interaction families`.
- Tightened the new Play-menu locator to `getByRole("button", { name: "Play", exact: true })` so it does not collide with `How to play`.
- Rationalised the shared focus selector block in `assets/site.css` to include:
  - `.primary-nav-link:focus-visible`
  - `.play-menu-item:focus-visible`
  - `.notification-mark-all-read:focus-visible`
  - `.favourites-tab:focus-visible`
- Replaced the separate account-menu hover rule and the separate play-menu hover/focus/current rule with one combined block.
- Expanded disabled command styling so `.danger-button:disabled` now matches the shared disabled treatment.
- Added a narrow `:focus` fallback for the covered interaction families that are programmatically focused in browser smoke after pointer-driven navigation:
  - `.primary-nav-link`
  - `.play-menu-item`
  - `.account-menu-item`
  - `.notification-mark-all-read`
  - `.favourites-tab`
  - `.primary-button`
  - `.secondary-button`
  - `.danger-button`

## RED evidence

Command:

```bash
npm test -- tests/browser-smoke.test.mjs
```

First failing result after adding the new test and before production CSS edits:

```text
not ok 11 - uses visible focus treatment across equivalent interaction families
Expected values to be strictly equal:
'none' !== 'solid'
```

Initial failing focus target:

```text
tests/browser-smoke.test.mjs:679
await assertVisibleFocusRing(page.getByRole("link", { name: "Favourites" }));
```

That confirmed the missing shared focus treatment before the CSS rationalisation.

## GREEN evidence

Command:

```bash
npm test -- tests/browser-smoke.test.mjs
```

Passing result after the CSS changes and the new smoke coverage settled:

```text
# pass 104
# fail 0
ok 1 - solo browser smoke
```

This includes the existing `renders Start batch and Start again as matching setup actions` smoke and the account-menu tooltip assertions.

## Tests and output

- `npm test -- tests/browser-smoke.test.mjs`
  - RED: failed in the new focus-family smoke with `outlineStyle` reported as `none`.
  - GREEN: passed all 104 browser smoke tests.

## Files changed

- `tests/browser-smoke.test.mjs`
- `assets/site.css`
- `.superpowers/sdd/task-4-report.md`

## Self-review

- The new smoke covers the required button, nav-link, menuitem, tab, settings-action, and account-menu-item families.
- The existing row-count selected-state class behaviour remains untouched.
- Shared `.route-heading` and `.compact-label` coverage remains untouched.
- No inline styles, style tags, or direct `element.style` writes were introduced.
- Untracked `assets/img/` files were left untouched.

## Concerns

- The brief-specified `:focus-visible` selectors were not sufficient on their own for every programmatically focused control in Playwright after pointer-driven interactions. A narrow `:focus` fallback was added for the exact covered interaction families so the smoke can verify the intended visible ring consistently.
- The new Play control smoke needed `exact: true` because plain `name: "Play"` also matched `How to play` under Playwright strict mode in this repository.

## Fix After Task Review

- Issue: Task 4 left a production plain `:focus` fallback in `assets/site.css`, which broadened the design contract beyond the brief's shared `:focus-visible` selector group.
- Fix: Removed the plain `:focus` fallback block from `assets/site.css` and changed `assertVisibleFocusRing` in `tests/browser-smoke.test.mjs` to reach targets by keyboard `Tab`, assert keyboard reachability, and confirm the focused element matches `:focus-visible` before checking the outline.
- Command: `npm test -- tests/browser-smoke.test.mjs`
- Result: Passed (`# pass 104`, `# fail 0`), including `uses visible focus treatment across equivalent interaction families`.
