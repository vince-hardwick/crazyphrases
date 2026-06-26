# Signed-in Favourites Design

**Status:** Active design spec awaiting written-spec review. The brainstorming
design is approved; next action is user review of this written spec, then
`$superpowers:writing-plans` creates the implementation plan. Current durable
product authority lives in `docs/product-rules.md` and deferrals live in
`docs/backlog.md`.

**Date:** 2026-06-26

## Goal

Add the first dedicated signed-in Favourites destination for Crazy Phrases as a
focused static SPA slice. The slice lets a signed-in participant browse and
manage private Phrase Favourites and Batch Favourites without expanding the
saved-output platform beyond the accepted first-slice rules.

## Source Authorities

- `docs/product-rules.md#signed-in-favourites`
- `docs/product-rules.md#signed-in-navigation`
- `docs/product-rules.md#icon-first-actions`
- `docs/backlog.md#private-phrase-and-batch-favourites-follow-up-slice`
- `docs/backlog.md#dedicated-favourites-destination`
- `docs/backlog.md#icon-first-favourite-and-copy-actions`
- `docs/backlog.md#favourites-remove-undo`

If this spec and the product rules conflict, `docs/product-rules.md` wins. This
spec records the approved implementation-shaped design and should not become a
new source of product authority after implementation tickets are published.

## Chosen Approach

Use the first-slice dedicated Favourites approach.

The implementation should add a signed-in `#/favourites` destination inside the
existing static single-page app. It should implement the accepted tabs, rows,
actions, status behaviour, confirmation flows, and focus recovery rules without
adding deferred platform features.

The rejected alternatives were:

- a broader saved-output platform with pagination, grouping, source links,
  undo, and future sharing hooks;
- a minimal patch to the current inline favourites surface.

The broader platform is too large and would reopen deferred decisions. The
inline patch conflicts with the accepted dedicated-destination direction.

## Scope

The first slice includes:

- a signed-in-only `#/favourites` hash route;
- `Phrases` and `Batches` tabs;
- independent Phrase Favourite and Batch Favourite loading, empty, error, and
  retry states;
- compact Phrase Favourite rows;
- compact Batch Favourite rows with inline expansion;
- icon-first copy, supported share, and remove controls;
- visible hover/focus tooltips for icon-only row actions;
- direct touch activation without tap-to-preview tooltips;
- saved snapshot copy/share payloads;
- row-local copy/share status;
- row-local remove confirmation, pending, success, failure, and focus recovery;
- active-tab removal success status;
- narrow viewport wrapping without overflow menus;
- signed-in route gating and anonymous DOM absence.

## Out Of Scope

The first slice does not include:

- pagination, `Load more`, search, or filtering;
- duplicate grouping or merging;
- links back to the source game or reveal;
- using original reveal date instead of favourite saved date;
- remove undo;
- saved-count badges in the global header;
- Avatar-based compact participant indicators unless already available without
  new data-loading scope;
- Web Share API support;
- public share links;
- new public publishing behaviour;
- a frontend framework migration;
- server-level route rewrites.

## Route And Auth Model

The route remains a lightweight hash route in the static SPA. The accepted
destination is `#/favourites`.

Anonymous visitors may use `#/play/solo`, but anonymous visits to
`#/favourites` show a sign-in-required gate for the requested destination. The
app must not mount account-only favourites DOM or fetch private saved-output
data until a valid Account session exists.

If sign-in completes from a preserved `#/favourites` request, the app may return
the participant to `#/favourites`. Explicit sign-out from `#/favourites` clears
account-only UI, closes account-related menus, discards preserved requested
destination state, and resets the route to `#/play/solo`.

Detecting the hash route never grants account authority. Session state and the
backend permissions remain the authority for private data.

## Destination Layout

`#/favourites` has two tabs:

- `Phrases`
- `Batches`

Entering the destination loads Phrase Favourites and Batch Favourites in
parallel. Each tab owns its own visible loading, empty, error, and retry state.
Switching between tabs does not navigate away from `#/favourites`.

The global signed-in header keeps `Play` and `Favourites` visible as primary
navigation controls. `Favourites` may be represented by the Font Awesome
Classic Solid `heart` icon with accessible name `Favourites`. When icon-only, it
shows a visible hover/focus tooltip reading `Favourites`.

## Phrase Favourite Rows

Phrase rows are compact and content-first. A row shows:

- Font Awesome `quote-right`;
- saved phrase text as the primary content;
- favourite saved date;
- brief participant indicator;
- phrase-level copy, supported share, and remove actions.

The compact row does not show source batch metadata, original reveal date,
relative date labels, or per-phrase ordering. Long phrase text may clamp in the
compact row. The full saved phrase remains available through copy/share
payloads, accessibility text, and a browser tooltip where practical.

## Batch Favourite Rows

Batch rows are compact by default. A row shows:

- Font Awesome `file-lines`;
- favourite saved date;
- phrase count;
- brief participant indicator;
- `View phrases`;
- batch-level copy, supported share, and remove actions.

The compact row must not show a one-line phrase preview, full phrase list, game
setup metadata, original reveal date, relative date labels, or per-phrase
controls before expansion.

`View phrases` expands the selected Batch Favourite inline under the row and
stays on `#/favourites`. Expanded content shows the full saved phrase list in
original saved order. It does not show visible numbering, bullets, a visible
`Phrases` heading, per-phrase actions, extra metadata, or a nested route.

Only one Batch Favourite may be expanded at a time. Activating `View phrases`
on another batch collapses the previous batch, expands the new batch, and keeps
focus on the newly activated disclosure control.

## Participant And Date Display

Favourite row dates show when the output was saved as a favourite, not when the
original batch was revealed. Visible dates use fixed UK English `D Mon YYYY`
format, such as `26 Jun 2026`. Accessibility text may state the same date, for
example `Saved 26 Jun 2026`, without a hidden timestamp or separate date
tooltip.

Participant indicators are brief and text-first:

- `Solo` for solo batches;
- `You` for the current Account;
- one named other participant where useful;
- a remaining count, such as `You + @alex + 2` or `@alex + 3`.

Compact rows keep the full participant list out of the row.

## Icon Actions

The first icon-first pass is limited to familiar utility actions:

- save/remove favourite state;
- copy plaintext;
- invoke an already-supported share path;
- remove saved favourites.

Dedicated Favourites rows use:

- Font Awesome `copy` for copy;
- Font Awesome `share-nodes` for supported share;
- Font Awesome `heart-circle-minus` for remove.

Icon-only row actions show a lightweight visible tooltip on hover and focus
when their text label is not already visible. Tooltip text matches the
accessible name in meaning and does not add state, metadata, or explanatory
copy.

Touch-only devices do not get tap-to-preview tooltips. Tapping the control
performs the action directly.

On narrow `#/favourites` rows, copy, share, and remove remain separate visible
icon buttons instead of collapsing into an overflow menu. They may wrap into a
compact action row if horizontal space is constrained, as long as hit areas stay
mobile-safe and the row avoids horizontal overflow.

## Copy And Share

Copy is always available.

Share appears only when an existing supported share path is available and Share
Consent rules allow it. Otherwise omit share rather than showing a disabled
control.

The first slice does not add Web Share API, public share links, or new public
publishing behaviour.

Copy/share payloads use immutable saved snapshots:

- phrase copy/share sends only the saved phrase text;
- batch copy/share sends the saved phrase list in original row order using the
  existing plaintext batch format;
- copied/shared text does not include participant indicators, saved dates, or
  internal IDs.

## Copy And Share Status

Copy/share success or failure appears beside the affected row through
row-local polite live status.

Fixed status copy:

- `Phrase copied.`
- `Batch copied.`
- `Could not copy phrase.`
- `Could not copy batch.`
- `Phrase shared.`
- `Batch shared.`
- `Could not share phrase.`
- `Could not share batch.`

Only the running copy/share action is pending-disabled.

The current visible tab shows at most one copy/share status at a time. Starting
a new copy/share row action clears existing copy/share statuses in that tab
before showing the new status beside the affected row.

Copy/share success status auto-clears after 2 seconds. Copy/share failure
status remains visible until the participant retries, triggers another row
action, switches tabs, leaves `#/favourites`, retries or reloads the list, or
signs out. Failure status persists only while the failed row remains visible in
the current tab.

## Remove Confirmation

Removing a saved favourite requires a row-local inline confirmation before
mutation.

The type-specific question is:

- `Remove phrase favourite?`
- `Remove batch favourite?`

The actions are:

- `Remove`, using Font Awesome `heart-circle-minus`;
- `Cancel`, using Font Awesome `circle-left`.

When the confirmation opens, focus `Cancel`, not `Remove`, so an accidental
confirmation keypress is non-destructive. Do not add explanatory copy such as
`This only removes it from Favourites.`, and avoid `delete` language because
the underlying phrase, batch, or game remains intact.

Only one remove confirmation can be open at a time. Opening remove on another
row silently cancels the existing confirmation, restores that row's previous
normal state, and opens the new confirmation with `Cancel` focused.

While confirmation is open, the affected row action cluster contains only the
confirmation controls; copy, share, and `View phrases` / `Hide phrases` are
hidden for that row. Other rows may remain interactive.

Opening remove clears any visible copy/share status in the current tab. Cancel
or `Escape` returns focus to that row's remove action, restores the normal
action cluster, preserves previous expanded/collapsed state, and does not
restore old copy/share status.

If the participant switches tabs, leaves `#/favourites`, retries or reloads the
list, or signs out while a non-pending confirmation is open, silently cancel the
confirmation with no status message.

## Remove Pending And Settlement

While confirmed removal is pending:

- keep the confirmation visible;
- disable `Remove` and `Cancel`;
- mark the row action area busy;
- show row-local polite pending copy:
  - `Removing phrase favourite...`
  - `Removing batch favourite...`

Do not block tab changes, route changes, sign-out, or list reloads while the
mutation is pending. Let the in-flight request settle naturally.

If the row or list unmounted before settlement, do not show stale success or
failure status and do not restore focus. Returning to `#/favourites` relies on a
fresh list load to show real saved state.

If pending removal settles while `#/favourites` remains mounted but the
participant is no longer viewing the source tab, resolve silently in the
inactive tab. Success removes the row from that tab's loaded state. Failure
restores the row's normal action cluster without stale confirmation, status
message, or focus movement.

## Remove Success

On confirmed removal success in the active tab:

- remove the row;
- if it is an expanded Batch Favourite, remove the row and expanded phrase
  group together with no separate collapse animation or intermediate collapsed
  state;
- show `Phrase favourite removed.` or `Batch favourite removed.` near the top
  of the current tab in an active-tab polite status area;
- auto-clear that status after 2 seconds;
- clear that status immediately if the participant switches tabs;
- do not use a toast;
- do not leave a placeholder where the removed row used to be;
- do not offer undo in the first slice.

Render the active-tab status area only while it has an active message. Do not
reserve blank vertical space when no message is active.

If removal leaves the active tab empty, immediately show that tab's normal empty
state and keep the removal success message as active-tab polite status until it
auto-clears or the participant switches tabs. Do not refetch the list, reload
both lists, automatically switch tabs, or navigate away from `#/favourites`.

## Remove Failure

If confirmed removal fails while the source row is still mounted and active:

- keep the row visible;
- keep the confirmation open;
- show `Could not remove phrase favourite.` or
  `Could not remove batch favourite.` as row-local polite status;
- re-enable `Remove` and `Cancel`;
- focus `Cancel` again so retrying removal requires another explicit move to
  `Remove`.

Keep the failure message visible while that remove confirmation remains open.
Clear it when the participant retries `Remove`, cancels, opens remove on
another row, switches tabs, leaves `#/favourites`, retries or reloads the list,
or signs out.

## Focus Recovery

After successful active-tab removal, move keyboard focus to a non-destructive
target:

1. next saved-item row container if one follows;
2. previous saved-item row container if there is no next row;
3. active tab's empty-state heading if no rows remain.

Do not move focus to the active-tab status message. Do not focus another
`Remove` button by default. The status message is announced through the polite
status area while focus stays in the list context.

Saved-item row containers are programmatic focus recovery targets only, not
normal tab stops. While focused, they show the app's normal focus-ring
treatment, not a selected-row highlight. The row must not look selected, pinned,
or specially marked after focus moves away.

The row container accessible label summarises the row, for example:

- `Phrase favourite, saved 26 Jun 2026, Solo`
- `Batch favourite, 6 phrases, saved 26 Jun 2026, You + @alex + 2`

`Tab` from a programmatically focused saved-item row container moves to that
row's first normal action, usually copy. `Shift+Tab` follows normal reverse tab
order; do not trap focus, jump to the removed row, or create a special reverse
path.

`Enter` and `Space` on a programmatically focused saved-item row container do
not copy, share, remove, expand, open, or otherwise activate anything.
Activation belongs only to the row's normal controls.

## Implementation Structure

Keep implementation inside the existing static SPA structure.

Recommended boundaries:

- route/view selection owns `#/favourites`, signed-in gating, tab state, and
  sign-out cleanup;
- Favourites data access loads Phrase and Batch favourites in parallel for the
  signed-in Account only;
- row rendering is split by Phrase Favourite and Batch Favourite row types;
- shared utilities handle icon actions, tooltips, statuses, confirmation state,
  and focus recovery;
- copy/share/remove handlers operate on saved snapshot records;
- existing auth/session authority gates private data.

The implementation plan should avoid persistence changes unless tests expose a
missing contract. Start with routing and anonymous DOM absence, then loading and
empty/error states, then row rendering/actions, then removal/status/focus edge
cases.

## Validation

Required coverage:

- anonymous `#/favourites` renders only the sign-in gate, with no account-only
  Favourites DOM and no private-data fetch;
- signed-in `#/favourites` loads Phrases and Batches independently with
  loading, empty, error, and retry states;
- phrase and batch rows render accepted icons, saved dates, participant
  indicators, action availability, tooltips, and accessible names;
- compact batch rows do not show phrase previews or forbidden metadata;
- expanded batches preserve saved phrase order without visible numbering,
  bullets, per-phrase actions, extra metadata, or nested routes;
- copy/share use saved snapshots and produce accepted row-local status
  behaviour;
- removal confirmation, pending, success, failure, inactive-tab settlement,
  no-undo behaviour, active-tab status placement, and status clearing work as
  specified;
- focus recovery works for next row, previous row, and empty-state heading;
- programmatic row focus shows the standard focus ring, does not imply
  selection, `Tab` enters the row actions, `Shift+Tab` follows normal reverse
  order, and `Enter` / `Space` do not activate the row;
- narrow viewport rows have no horizontal overflow, keep mobile-safe hit areas,
  and keep copy/share/remove as visible icon buttons rather than overflow-menu
  actions.

Browser smoke testing should cover signed-in and anonymous flows, console
cleanliness, and responsive layout. The implementation should not be reported
complete unless these checks pass or the blocker is explicitly documented.
