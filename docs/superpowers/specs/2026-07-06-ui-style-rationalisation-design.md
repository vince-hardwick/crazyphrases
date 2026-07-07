# UI Style Rationalisation Design

## Status

Historical/completed. Implemented through the UI style rationalisation plan and promoted
to product rules after source and smoke-test verification.

Current authority is `docs/product-rules.md`, `assets/site.css`, `assets/app.js`,
`assets/clipboard.js`, `tests/repository-hygiene.test.mjs`,
`tests/clipboard.test.mjs`, and `tests/browser-smoke.test.mjs`.

## Context

The current static app mostly keeps styling in `assets/site.css`, but two
first-party JavaScript paths still apply inline style:

- `assets/clipboard.js` positions the fallback copy textarea with direct
  `.style` assignments.
- `assets/app.js` writes `--selected-index` onto the row-count segmented
  control's inline style.

The UI also has several equivalent route-level panel headings and related
interactive control families that were added across separate slices. These
should be rationalised without flattening every interaction into one generic
state treatment.

There is also a current documentation contradiction to resolve during
implementation: the Account/Profile affordance section says labelled account
menu actions do not expose duplicate hover/focus tooltips, while the later
Account menu section still refers to hover/focus tooltip text for `Settings`
and `Sign out`. The accepted product behaviour is no duplicate tooltip for
visibly labelled account-menu rows.

## Goals

- Keep first-party CSS in linked stylesheet files.
- Avoid first-party inline `style` attributes and style tags wherever practical.
- Use class attributes and CSS class selectors for programmatic visual state.
- Make equivalent route-level headings visually consistent across static and
  JavaScript-rendered panels.
- Rationalise hover, focus, selected, pressed, disabled, and popover states by
  control family rather than by one-off selectors.
- Preserve existing product behaviour, account/session authority, routes,
  labels, and deployment rules.

## Non-Goals

- Do not redesign the brand, colour palette, page layout, or information
  architecture.
- Do not add new navigation destinations, menu items, or account features.
- Do not mutate hosted account, profile, favourite, or game data as part of
  verification.
- Do not attempt to control third-party runtime internals such as Font Awesome
  kit implementation details. The first-party app must not create inline styles
  or style tags; third-party injected internals remain governed by their owning
  integration decisions and runbooks.

## Equivalence Classes

### Route-Level Headings

Treat these as the same visual hierarchy level:

- static reveal heading `Completed phrase batch`;
- JavaScript-rendered Favourites heading `Favourites`;
- JavaScript-rendered Multiplayer heading `Invite by email or Gamer Tag`;
- JavaScript-rendered Settings heading `Settings`;
- signed-in route-gate headings such as `Sign in to view Favourites`,
  `Sign in to view Settings`, and `Sign in to play Multiplayer`;
- future route-level or panel-level destinations with equivalent page/panel
  ownership.

Use a shared route-heading class and styling for this level. Static HTML and
JavaScript-rendered DOM should opt into the same class rather than relying on
element-only selectors.

### Secondary Kicker Text

Treat section kicker text such as `Favourites`, `Multiplayer`, and
`Section 1 of 3` as a secondary context/eyebrow level. It remains lighter and
smaller than route headings.

### Compact Field Labels

Treat labels such as `Phrases per batch`, `Email or Gamer Tag`, `Phrases`,
`Nudge after`, `Gamer Tag`, and `Avatar` as compact field or control labels.
They should share a compact label treatment without changing each component's
layout contract.

## Interaction Families

Use family-based interaction states:

- **Top-nav icon controls**: one 44px footprint, 8px radius, shared hover
  treatment, focus ring, active-route state where applicable, and lightweight
  tooltip only when the visible label is absent.
- **Text-labelled command buttons**: primary, secondary, and danger intents keep
  distinct colour semantics, but each intent has consistent hover, focus, and
  disabled treatment across setup, reveal, route, confirmation, and multiplayer
  surfaces.
- **Menu and list rows**: use subtle background hover, default-weight row text
  unless product rules explicitly require emphasis, and the shared focus ring.
  Labelled menu rows do not duplicate visible labels in tooltips.
- **Segmented controls and tabs**: selected state must remain distinct from
  hover. Non-selected hover treatment should be consistent across row-count
  segmented controls and favourites tabs where the shapes are functionally
  comparable.
- **Icon-only utility actions**: use the shared icon-action footprint, focus
  ring, hover treatment, and tooltip rule. Tooltip text matches the accessible
  action name and appears only where the control has no visible text label.
- **Text links and text buttons**: keep lightweight text treatment with underline
  on hover and visible focus indication.
- **Popover elements**: popovers keep consistent surface styling, stacking, and
  close behaviour, while their row/button internals follow the relevant control
  family.

## Inline CSS Refactor

Move the clipboard fallback textarea styling into `assets/site.css`, for
example a `.clipboard-fallback-textarea` class applied by
`assets/clipboard.js`.

Replace the segmented-control inline custom property with class-based selected
index state on the segmented-control element, for example:

- `.is-selected-index-0`;
- `.is-selected-index-1`;
- `.is-selected-index-2`;
- `.is-selected-index-3`;
- `.is-selected-index-4`.

The JavaScript should remove prior selected-index classes and add the current
one. CSS should move the selected indicator using those classes. The selected
buttons still use `aria-pressed`, and the control remains keyboard and pointer
usable.

## Testing Seams

Confirm these seams before implementation:

- browser smoke seam for visible UI behaviour in `tests/browser-smoke.test.mjs`;
- source/static seam for first-party inline style creation in app-owned HTML and
  JavaScript;
- clipboard module seam if existing clipboard tests cover fallback behaviour.

Expected coverage:

- the app source contains no first-party `<style>` tags, `style=` attributes,
  direct `.style` assignments, `style` attribute writes, or `createElement("style")`
  in production app paths, except documented test/server MIME handling;
- the clipboard fallback still copies through `execCommand("copy")` when the
  async clipboard API is unavailable or fails;
- row-count selection still updates visual selected state and `aria-pressed`
  after selecting each supported row count;
- route-level headings render with the shared route-heading class on reveal,
  route gate, Favourites, Multiplayer, and Settings surfaces;
- representative hover/focus/selected states remain visible for top-nav icon
  controls, command buttons, menu rows, segmented controls/tabs, and icon-only
  row actions;
- no horizontal overflow is introduced in mobile or desktop smoke paths.

## Documentation Closeout

When implemented, promote durable accepted behaviour to `docs/product-rules.md`
and update this status ledger. If any part is intentionally deferred, record the
deferral in `docs/backlog.md` with the trigger and remaining risk.
