# Product Rules

## Game Play

### Product language

The product primarily uses UK English in user-facing copy.

Use UK spelling such as "favourite" in user-facing copy and domain documentation. Code
identifiers may follow ecosystem conventions when a framework or library strongly
favours US spelling, but UI copy should remain UK English.

Do not expose the domain term "slot" in user-facing copy for MVP. Use natural task
wording such as "Fill these adjectives" or "Next section" while keeping Slot as the
internal/domain term.

For the default template's two noun slots, use neutral user-facing labels only when
needed. During play, the active section can say "Fill these nouns"; progress context can
use phrasing like "Section 2 of 3" without revealing the remaining resolved order.

The app header should not duplicate the browser's domain display when the main title
already identifies the app. In the MVP game flow, do not render `crazyphrases.com` as a
separate header label above the Crazy Phrases title.

MVP setup, entry, and reveal controls should avoid repeating selected row-count text
when the row-count selector already communicates the selected option. The setup action
area should not add status copy such as "10 phrases selected"; the entry action area
should not echo copy such as "10 phrases" next to "Start again"; and the revealed-batch
action area should not repeat the completed batch size next to "Start again".

### Responsive design

MVP UI is responsive from the start, with mobile as the primary constraint. The same
flow should work well on phones and desktop rather than splitting into separate
experiences.

### Signed-in navigation

#### Play navigation

Signed-in navigation uses `Play` as the primary entry point for Game Mode selection
rather than exposing `Solo play` and `Multiplayer` as separate primary navigation items.
The first signed-in navigation shape shows only available Game Modes under `Play`: `Solo
play` and `Multiplayer`.

The future `vs CPU` Game Mode remains deferred and should not appear as a disabled or
coming-soon menu item until CPU-participant games are intentionally brought into scope.
The top-level nav label remains `Play` for both `#/play/solo` and `#/play/multiplayer`;
active route state should mark `Play` as active and mark the current Game Mode inside
the dropdown rather than renaming the top-level control to the active mode.

Selecting `Multiplayer` from the `Play` menu opens a single signed-in Multiplayer
destination. That destination owns invite creation, active multiplayer dashboard
buckets, and the completed-history entry point. Completed multiplayer history remains
reachable from the `Batches completed` dashboard bucket; it should not become a separate
primary navigation item or account-menu item in the first signed-in navigation shape.

#### Signed-in Favourites

Private Phrase Favourites and Batch Favourites are signed-in, Account-backed
saved-output collections. They are created only through explicit participant action
after Reveal; the app must not automatically favourite a Phrase or Batch.

- **Destination ownership**: private favourites belong in the primary signed-in
  `#/favourites` destination, not in account settings and not as an inline saved-output
  browser inside Play or Reveal.
- **Private boundary**: private favourites are private to the Account. Saving a
  favourite does not publish content, create public share links, grant Share Consent, or
  replace plaintext copy/external sharing actions.
- **Auth mounting**: private favourites UI is mounted only while an Account-backed
  signed-in mode is active. Anonymous mode must not keep the favourites panel, save
  controls, or stale private-favourite status copy in the visible or hidden DOM.
  Supabase Auth and Row Level Security remain the authoritative backend security
  boundary.
- **Snapshot boundary**: private favourites store immutable saved-output snapshots
  rather than live references to the current signed-in Solo Game. Clearing or replacing
  the current signed-in Solo Game must not mutate saved favourites.
- **Removal boundary**: removing a private favourite affects only the Account's
  saved-output collection. It must not mutate the current signed-in Solo Game, anonymous
  local play, public discovery state, or future collaborative game history.
- **Independent states**: saving or removing a Batch Favourite toggles only the batch
  heart. It never saves or removes individual Phrase Favourites. Saving or removing a
  Phrase Favourite toggles only that phrase heart and never changes the Batch Favourite
  state or mutates a saved batch snapshot.
- **Batch-heart derivation**: the batch heart must not become Solid merely because every
  phrase in a revealed batch is individually favourited. It is Solid only when that
  exact revealed batch has been explicitly saved as a Batch Favourite.
- **Snapshot matching**: favourite saved-state matching and duplicate prevention use the
  exact revealed output snapshot rather than loose text equality or phrase-list
  equality. Newly generated output starts with Regular hearts even if its phrase text or
  phrase list matches an earlier saved favourite from another revealed target.
- **Duplicate-looking rows**: in the first dedicated Favourites slice, identical phrase
  text or identical phrase lists from different revealed targets remain separate
  newest-first rows. Do not merge, collapse, or visually group them; saved date and
  participant indicator provide the available row context.
- **Source links**: saved favourite rows are snapshot-only in the first slice and must
  not link back to the original Game, Reveal, or completed-history entry that produced
  them.

Play and Reveal surfaces keep only contextual current-output actions: favourite toggle,
copy, and supported share for the current revealed phrase or batch. They must not render
saved-output collection browsing, expanded saved-batch lists, or saved-favourite removal
controls. Browsing, expanding, and removing saved-output collections belongs only in
`#/favourites`.

On Play and Reveal surfaces, item-level favourite controls use Font Awesome Classic
Regular `heart` when the item is not currently a favourite and Font Awesome Classic
Solid `heart` when it is already a favourite. A newly generated batch first reveals all
phrase hearts and the batch heart in Regular state. Restored or re-rendered signed-in
output should resolve persisted favourite state for the current phrase and batch
snapshots before enabling hearts, so previously saved outputs render with Solid hearts.

If restored-output favourite-state lookup fails, render the revealed output normally,
keep copy/share usable, keep the affected heart controls disabled in Regular state, and
show output-local polite status `Could not load favourite state.` with a `Try again`
action that retries only that lookup. Do not navigate, block the route, or refresh
`#/favourites` for this failure.

Toggling a current revealed phrase or batch favourite stays on the current Play or
Reveal surface, updates the heart state in place, and must not navigate to
`#/favourites`, open the collection view, or refresh it in the background. Feedback
stays local to the current output area beside the affected phrase or batch action
cluster, uses polite live status, pending-disables only the affected heart control, and
does not use a global toast, header badge, global nav update, or `#/favourites` refresh.
Do not optimistically switch the Regular/Solid heart state before persistence succeeds:
keep the previous heart state visible while pending, switch only after success, and keep
the previous state with failure copy if persistence fails.

Use the fixed Play/Reveal favourite-toggle status copy `Phrase favourite saved.`, `Batch
favourite saved.`, `Phrase favourite removed.`, `Batch favourite removed.`, `Could not
update phrase favourite.`, and `Could not update batch favourite.`.

Favourite save/remove mutations must be idempotent when the client has stale favourite
state. If a save request discovers the requested favourite already exists, treat the
mutation as success: show Solid heart state and the normal saved success copy. If a
remove request discovers the favourite has already been removed elsewhere, treat the
mutation as success: show Regular heart state on Play and Reveal surfaces, or remove the
row from `#/favourites`, and use the normal removed success copy. Use failure copy only
for real authentication, network, validation, or persistence failures where the
requested final state is unknown or was not achieved.

The `#/favourites` destination uses two internal tabs: `Phrases` and `Batches`. Default
to `Phrases`, preserve the selected tab while the participant stays in the destination,
and keep removal actions scoped to the active list. The selected tab is local UI state
rather than a nested hash route; both tabs remain under `#/favourites` in the first
signed-in navigation shape.

Entering `#/favourites` loads Phrase Favourites and Batch Favourites in parallel. Tab
switching is local and instant once the destination is mounted and must not trigger
fresh list fetches. Each tab owns its loading, error, and empty state; one failed list
must not block use of another list that loaded successfully. Use loading copy `Loading
phrase favourites...` and `Loading batch favourites...`. Use error copy `Could not load
phrase favourites.` and `Could not load batch favourites.`, each with a `Try again`
action that retries only the failed list. Use empty-state headlines `No phrase
favourites yet.` and `No batch favourites yet.`, with brief supporting copy about
favouriting revealed output and the existing `Play Solo` action. Load and render the
full returned lists newest-first in the first slice, without pagination, visible item
limits, `Load more`, search, filtering, or custom sort.

Phrase Favourite rows show the Font Awesome `quote-right` icon, saved phrase text as
primary content, favourite saved date, a brief text-first participant indicator, and
phrase-level copy, share, and remove actions. Do not show source batch metadata,
original reveal date, game setup details, relative date labels, or links back to the
original Game or Reveal by default. Long Phrase Favourite text is clamped to two lines
in the compact row, while the full saved phrase remains available through copy/share
payloads, accessibility text, and a browser tooltip where practical. Do not add a phrase
detail route or per-phrase expand/collapse control in the first slice.

Batch Favourite rows are compact by default. The compact row shows the Font Awesome
`file-lines` icon, favourite saved date, phrase count, a brief text-first participant
indicator, `View phrases`, and batch-level copy, share, and remove actions. It must not
show a one-line phrase-text preview, full phrase list, game setup metadata, original
reveal date, relative date labels, or per-phrase controls before expansion.

Phrase and Batch Favourite rows use the same utility action icons: Font Awesome `copy`
for copy, `share-nodes` for share, and `heart-circle-minus` for remove. Accessible
labels include the item type, such as `Copy phrase`, `Share batch`, or `Remove phrase
favourite`. Icon-only row actions should show a lightweight visible tooltip on hover and
focus when their text label is not already visible. Tooltip text must match the control's
accessible name in meaning and should not add extra state, metadata, or explanatory
copy. Copy is always available. Show the `share-nodes` action only when an existing
supported share delivery path is available and Share Consent rules allow it; otherwise
omit share rather than showing a disabled control. Do not add Web Share API or public
share links in the first dedicated Favourites slice.

On narrow `#/favourites` rows, copy, share, and remove actions remain separate visible
icon buttons rather than collapsing into an overflow menu. They may wrap into a compact
action row when horizontal space is constrained, provided the controls keep mobile-safe
hit areas and the row avoids horizontal overflow.

Copy/share payloads use the immutable saved snapshot. Phrase Favourite copy/share sends
only the saved phrase text. Batch Favourite copy/share sends the saved phrase list in
original row order using the existing plaintext batch format. Copied or shared text must
not include participant indicators, saved dates, or internal IDs. External sharing
remains subject to Share Consent rules.

Copy and share success or failure in `#/favourites` appears beside the affected row
through row-local polite live status. Only the running copy or share action is
pending-disabled. Use fixed row-action status copy `Phrase copied.`, `Batch copied.`,
`Could not copy phrase.`, `Could not copy batch.`, `Phrase shared.`, `Batch shared.`,
`Could not share phrase.`, and `Could not share batch.`. The current tab shows at most
one copy/share status at a time: starting a new copy/share row action clears existing
copy/share statuses in that tab before showing the new status beside the affected row.
Success status messages auto-clear after 2 seconds. Failure status messages stay visible
until the participant retries, triggers another row action, switches between the
`Phrases` and `Batches` tabs, or leaves `#/favourites`; failure status persists only
while the failed row remains visible in the current tab.

A `View phrases` text action expands the selected Batch Favourite inline under the row
and stays on `#/favourites`. Expanded content is a read-only list of the full saved
phrases in original saved order. Do not show visible numbering, bullets, or a visible
`Phrases` heading. Preserve DOM order as saved order and expose the group semantically
as a list or equivalent grouped structure with an accessible label such as `Phrases in
this batch favourite`. Let the group grow the page with normal page scrolling; do not
place it in an internal scroll area. Expanded phrase text wraps rather than clamping,
and expanded batches do not contain per-phrase actions, extra metadata, or a nested
detail route.

The batch disclosure text is `View phrases` when collapsed and `Hide phrases` when
expanded, with `aria-expanded` tied to the inline list. Activating either state keeps
keyboard focus on the same disclosure control. Only one Batch Favourite may be expanded
at a time; activating `View phrases` on a different batch collapses the previous one,
expands the new one, and keeps focus on the newly activated disclosure control. Expanded
Batch Favourite state is local to the mounted `#/favourites` destination. It may stay
expanded while switching between `Phrases` and `Batches` during the same visit, but
resets when the participant leaves `#/favourites`, signs out, retries or reloads the
Batches list, or removes the expanded batch.

Removing a saved favourite from `#/favourites` requires a row-local inline `Remove
favourite` confirmation before mutation. The type-specific question is `Remove phrase
favourite?` or `Remove batch favourite?`, with `Remove` and `Cancel` actions. `Remove`
uses Font Awesome `heart-circle-minus`; `Cancel` uses Font Awesome `circle-left`. When
the confirmation opens, focus `Cancel`, not `Remove`, so an accidental confirmation
keypress is non-destructive. Do not add an explanatory line such as `This only removes
it from Favourites.`, and avoid `delete` language because the underlying phrase, batch,
or game remains intact.

Only one remove confirmation can be open at a time. While it is open, the affected row
action cluster contains only the confirmation controls; hide copy, share, and `View
phrases` / `Hide phrases` for that row. Opening a remove confirmation clears any visible
copy/share status in the current tab; cancelling the confirmation must not restore the
old copy/share status. Other rows may remain interactive. If the participant opens
remove on another row, cancel the existing confirmation silently, restore that row's
normal action cluster and previous expanded or collapsed state, then open the new
confirmation with `Cancel` focused. `Cancel` or `Escape` returns focus to the row's
remove action, restores the normal action cluster, and preserves the previous expanded
or collapsed state.

If the participant switches tabs, leaves `#/favourites`, retries or reloads the list, or
signs out while a non-pending remove confirmation is open, silently cancel the
confirmation with no status message. If the affected row remains mounted, restore its
normal action cluster and previous expanded or collapsed state; if the list is unmounted
or reloaded, do not preserve the confirmation. Returning to `#/favourites` must never
restore an old destructive prompt.

While a confirmed `Remove` mutation is pending, keep the confirmation visible, disable
both `Remove` and `Cancel`, mark the row action area busy, and show row-local polite
pending copy `Removing phrase favourite...` or `Removing batch favourite...`. Do not
block tab changes, route changes, sign-out, or list reloads while the mutation is
pending. Let the in-flight request settle naturally. If the row or list has unmounted
before it settles, do not show stale success or failure status and do not restore focus.
Returning to `#/favourites` should rely on a fresh list load to show the real saved
state.

If a pending removal settles while `#/favourites` remains mounted but the participant is
no longer viewing the source tab, resolve it silently in the inactive tab. Success
removes the row from that tab's loaded state. Failure restores the row's normal action
cluster without a stale confirmation, status message, or focus movement. When the
participant returns to the tab, the row being absent or present is the state signal.

On confirmed removal success in the active tab, remove the row and report status near
the top of the current Favourites tab in an active-tab polite status area with `Phrase
favourite removed.` or `Batch favourite removed.`. Do not use a toast or leave a
placeholder where the removed row used to be. Render the active-tab status area only
while it has an active message; do not reserve blank vertical space when no message is
active. Removal success status auto-clears after 2 seconds. Switching between the
`Phrases` and `Batches` tabs clears any active-tab removal success status immediately;
returning to the original tab must not restore it. If the removed item is an expanded
Batch Favourite, remove the row and its expanded phrase group together with no separate
collapse animation or intermediate collapsed state. If removal leaves the active tab
empty, immediately show that tab's normal empty state and keep the removal success
message as active-tab polite status until it auto-clears or the participant switches
tabs; do not refetch the list, reload both lists, automatically switch tabs, or navigate
away from `#/favourites`. Do not offer undo in the first slice.

After a successful removal makes a row disappear, move keyboard focus to a
non-destructive target: the next saved-item row container if one follows, the previous
saved-item row container if there is no next row, or the active tab's empty-state
heading if no rows remain. Do not move focus to the active-tab status message and do
not focus another `Remove` button by default; the status message is announced through
the polite status area while focus stays in the list context. Saved-item row containers
are programmatic focus recovery targets only, not normal tab stops, but they must show a
standard visible focus indicator while focused. Use the app's normal focus-ring
treatment, not a selected-row highlight; the row must not look selected, pinned, or
specially marked after focus moves away. Their accessible label should summarise the
row, such as `Phrase favourite, saved 26 Jun 2026, Solo` or `Batch favourite, 6 phrases,
saved 26 Jun 2026, You + @alex + 2`; copy, share, remove, and view controls remain the
normal tab stops. Pressing `Tab` from a programmatically focused saved-item row
container moves to that row's first normal action, usually copy, so keyboard flow stays
local to the row focus landed on. Pressing `Shift+Tab` from a programmatically focused
saved-item row container follows the normal reverse tab order; do not trap focus, jump
to the removed row, or create a special reverse path. Pressing `Enter` or `Space` on a
programmatically focused saved-item row container must not copy, share, remove, expand,
open, or otherwise activate anything; keyboard activation belongs only to the row's
normal controls.

If confirmed removal fails while the source row is still mounted and active, keep the
row visible and the confirmation open, show `Could not remove phrase favourite.` or
`Could not remove batch favourite.` as row-local polite status, re-enable `Remove` and
`Cancel`, and focus `Cancel` again so retrying removal requires another explicit move to
`Remove`. Keep the failure message visible while that remove confirmation remains open.
Clear it when the participant retries `Remove`, cancels, opens remove on another row,
switches tabs, leaves `#/favourites`, retries or reloads the list, or signs out.

Favourite row dates show when the output was saved as a favourite, not when the original
batch was revealed. Store the saved timestamp canonically, then render the visible row
date in the participant's current browser timezone as a compact absolute fixed UK
English `D Mon YYYY` date, such as `26 Jun 2026`. Accessibility text may state the same
date as `Saved 26 Jun 2026`; do not expose a hidden full timestamp or a date tooltip
containing different text in the first slice. Do not localise month abbreviations or
date order to browser locale, and do not use relative labels such as `today` or `3 days
ago`. Browser timezone detection is display-only and does not grant data ownership or
mutation authority.

Favourite row participant indicators are brief and text-first. Use `Solo` for solo
batches, `You` for the current Account, and other participants' Gamer Tag where
available. In compact rows, show `Solo` for solo batches; for multiplayer favourites
involving the current Account, show `You` plus up to one named other participant and
then a count, such as `You + Captain Spoon + 2`. If the current Account was not a
participant in an older saved snapshot, show the first known Gamer Tag plus a remaining
count, such as `Captain Spoon + 3`. Keep the full participant list out of the compact
row. Avatar images are not required in the first slice unless they are already available
from existing saved snapshot data without adding data-loading scope.

#### Header controls

Across viewport sizes, `Play` and `Favourites` remain visible as primary signed-in
navigation controls rather than moving behind a hamburger or generic menu button.
`Favourites` may be denoted by a Font Awesome Classic Solid `heart` icon instead of
visible `Favourites` text on any device, provided the control keeps an accessible name
of `Favourites`, mobile-safe hit area, and active-route state. When the control is
icon-only, show a lightweight visible tooltip on hover and focus with the text
`Favourites`; do not include counts, saved-state wording, or route explanations in that
tooltip. The `Favourites` nav heart uses stable icon style; active route state is shown
through nav-control styling and `aria-current`, not by switching the nav icon between
regular and solid styles.
Regular-vs-solid heart changes remain reserved for item-level favourite actions. Do not
show a saved-count badge on the `Favourites` nav heart in the first slice; saved counts
are not urgent notifications and should not force account-scoped favourite-count loading
into the global header. The destination tabs own saved-output loading, empty, and error
state after the participant chooses Favourites.

The Notifications bell remains a utility control, and the account affordance remains the
identity control. The `Play` dropdown and account menu may open as full-width mobile
popovers or sheets on narrow screens.

#### Route model and account gates

The first signed-in navigation implementation remains inside the static single-page app
and uses lightweight hash routes for primary signed-in destinations rather than
introducing a frontend framework or server-level route rewrites. The accepted
destination fragments are `#/play/solo`, `#/play/multiplayer`, and `#/favourites`. The
hash fragment selects the client view; it does not grant account authority, bypass
authentication, or replace backend permissions.

When a signed-in user lands with no hash route or no recognised hash route, the first
signed-in navigation implementation should default to `#/play/solo`; notifications,
invite links, and explicit navigation may still open `#/play/multiplayer` or
`#/favourites`.

Anonymous visitors may play `#/play/solo`, but anonymous visits to signed-in-only routes
such as `#/play/multiplayer` and `#/favourites` should show a sign-in-required gate for
the requested destination, preserve that requested destination through sign-in, and must
not mount account-only DOM or fetch private data until a valid Account session exists.
Anonymous sign-in itself is opened from the top-nav account affordance as a compact
popover rather than a hash route. Opening or closing that popover must not start, clear,
replace, or hide the current anonymous Solo Game, and it must not clear a preserved
signed-in-only destination while the participant is on a sign-in-required gate.
Hosted OAuth and email magic-link starts may preserve only an allowlisted signed-in-only
destination in a client-side handoff for up to ten minutes. That handoff is consumed
only after a valid Account session exists, and it is cleared after consumption,
explicit sign-out, stale anonymous navigation back to `#/play/solo`, unsupported route
input, malformed storage, or expiry.
Supabase Auth callback fragments that carry Auth response parameters, such as
`#access_token=...`, are not route input. The app should leave those fragments
available to Supabase initialisation before canonicalising the visible hash route, and
must not treat that callback cleanup as stale anonymous navigation, including when
the cleanup happens before Account session initialisation has settled.
If hosted Auth SDK cleanup removes the visible hash after the app has consumed a
signed-in-only handoff, the app should reassert the consumed destination during
a bounded post-auth reconciliation window while the internal current route still
matches that destination.
Explicit sign-out from a signed-in-only route should clear account-only UI, close
account and notification menus, discard any preserved requested destination, and reset
the route to `#/play/solo` for anonymous Solo Game play. A fresh anonymous visit to a
bookmarked signed-in-only route may still show the sign-in-required gate.
Any in-flight account-only work that started before sign-out, including Favourites,
Multiplayer, Account Profile, or Notification work, must re-check the current Account
session before mutating client state or DOM. A delayed result from the old Account must
settle silently after sign-out rather than re-mounting account-only UI, restoring a
signed-in-only route, or showing stale status copy.

Moving between hash-route destinations is non-destructive view switching: leaving
`#/play/solo` for `#/favourites` or `#/play/multiplayer` should preserve any in-progress
Solo Game and resume it when the participant returns, without a navigation warning.
Selecting `Play -> Solo play` while a Solo Game is already in progress or revealed
should resume the current Solo destination, not start a new batch. Confirmations remain
attached to destructive game actions such as `Start again` or `Discard entries`, not
ordinary destination changes.

#### Icon-first actions

Contextual favourite, copy, share, and remove actions should use accessible icon-first
controls in the signed-in navigation and Favourites design slice. The first icon-first
pass is limited to familiar utility actions: save or remove favourite state, copy
plaintext, invoke an already-supported share path, and remove saved favourites. Each
icon-first action needs an accessible label, mobile-safe hit area, and explicit
pressed/saved or failure state where applicable. In `#/favourites`, icon-only row
actions also need a visible hover/focus tooltip whose meaning matches the accessible
label and does not add hidden state or metadata. Touch-only devices should not use
tap-to-preview tooltips for these utility actions; tapping the control performs the
action directly, with meaning carried by the accessible name, familiar icon, hit area,
and subsequent state or status feedback.

Use Font Awesome `copy` for copy actions, `share-nodes` for share actions, and
`heart-circle-minus` for remove-favourite actions in the dedicated Favourites
destination. Share actions should appear only where an existing supported share path is
available and Share Consent rules allow it; copy remains available independently.
Anonymous account sign-in uses Font Awesome `circle-user` for the top-nav account
affordance, `google` for Google sign-in, `at` before the email address input, and
`paper-plane` for sending an email magic link. The Google and email magic-link submit
actions are icon-first controls whose tooltip meaning matches their accessible action
name and uses default font weight.
Primary game-flow and confirmation actions, such as `Start batch`, `Reveal phrases`,
`Keep playing`, `Discard entries`, `View phrases`, and `Start new batch`, remain text
buttons.

#### Account menu and panels

Settings, Avatar editing, and sign-out belong under an account affordance built from
the signed-in Account's game-facing identity, such as Avatar and Gamer Tag context.
`Settings` and `Sign out` should not be primary signed-in navigation items in the first
signed-in navigation shape. The account affordance is avatar-first: the signed-in Avatar
is the stable visual target, the Gamer Tag may be shown beside it when space allows, and
narrow layouts may use an avatar-only button with an accessible name such as `Account
menu for Captain Spoon`.

The first account menu contains only `Settings` and `Sign out`. Do not add
`Favourites`, completed history, notifications, social/profile-public links, or separate
`Profile` and `Avatar` menu items to the account menu in this slice. `Settings` uses
Font Awesome `sliders`, and `Sign out` uses Font Awesome
`arrow-right-from-bracket`.

`Settings` opens or routes to a signed-in-only focused editor view or panel for Gamer
Tag and Avatar. The hosted email lookup key is derived from Supabase Auth email and
must not be presented as public identity or a normal editable profile text field unless
a later accepted design explicitly adds Auth-email change behaviour. The implementing
slice must document the accepted Settings route or panel route, preserve signed-in-only
DOM gating, and avoid disrupting the participant's current game context.

Closing the `Settings` panel with unsaved edits should require confirmation. The
Settings editor save control uses Font Awesome `floppy-disk`; the profile edit
undo/cancel control uses Font Awesome `arrow-rotate-left`. If the participant tries to
sign out while a panel has unsaved edits, show confirmation before sign-out proceeds:
`Save` saves first and then signs out, `Discard` discards edits and then signs out, and
`Cancel` returns to the editor and keeps the participant signed in.

#### Notifications

In-App Notifications remain a persistent signed-in top-bar utility beside the account
affordance. Notifications should not live under `Play`, `Multiplayer`, `Favourites`, or
the account menu because they cut across game modes and account surfaces while often
linking into Multiplayer.

The notification affordance uses the Font Awesome Classic `bell` icon: Classic Solid
when the Account has new or unread notifications, and Classic Regular when there are no
new or unread notifications. The bell replaces the earlier exclamation-mark placeholder
and keeps accessible status labelling for unread state. When the unread count is
greater than zero, the bell also shows a numeric unread badge; the visible badge caps at
`9+`, while the accessible label includes the actual unread count.

The notification panel lists unread items first, then read items, newest first within
each group. The bell is only a panel toggle: opening or closing it must not mark any
notification read. A notification may become read when the participant selects that
notification and is routed to its relevant destination, such as `#/play/multiplayer` for
invite, turn, or nudge notifications; when the participant reaches the relevant
destination through another route without opening the notification panel first; when the
participant uses a row-level `Mark as read` action; or when the participant uses a bulk
`Mark all as read` action. Notifications without a concrete target should remain
readable through the explicit row-level or bulk read actions. Notifications without a
concrete target are not clickable navigation rows. They render as static notification
content with a row-level `Mark as read` action when unread; once read, they are static
read-only content.

The notification panel behaves as a dropdown-style surface owned by the bell. Keyboard
activation of the bell opens the panel and moves focus into the panel heading, list, or
first actionable notification control. `Escape`, activating the bell again, or
clicking/tapping outside the panel closes it without mutating notification read state.
Close actions that do not navigate return focus to the bell. When a target notification
row closes the panel to navigate, focus follows the rendered destination instead of
returning to the bell.

Implicit target-navigation read requires the notification target to be present in the
rendered destination context. Matching the broad route alone is not enough; for example,
`#/play/multiplayer` may mark a notification read only when the matching Pending Game,
Started Game, current section, nudge target, or completed batch is loaded into the
visible Multiplayer dashboard or history context.

For a clicked target notification, route and render the target first, then mark that
notification read only after the target context is successfully present. If the target
cannot be loaded, keep the notification unread and show recovery or status feedback.
Activating a target notification row closes the panel immediately; read-state mutation
still waits until the target context is present. If the route changes successfully but
the target data is stale, missing, or mismatched, treat the target as not present and do
not issue the read mutation. If the route and target render succeed but the later
read-state update fails, leave the participant on the rendered destination, keep the
notification unread, keep or restore the unread badge/count, and surface accessible
failure feedback when the notification UI is visible. Do not bounce the participant
back to the notification panel solely because a read-state update failed.

Implicit read updates caused by reaching a target through another route should not
interrupt the target workflow. Quietly update the unread badge/count and row state when
available. If that implicit read update fails, keep the notification unread; show
notification-specific error feedback only when the notification panel is already open.
When multiple unread notifications refer to the exact loaded target context, they may be
marked read together; for example, reaching a current section can mark unread
`entries_needed` and `nudge` notifications for that same section or assignment read.
Do not mark unrelated notifications read merely because they share the same broad route.
Explicit read actions are acknowledgements rather than navigation proof: a row-level
`Mark as read` action or the bulk `Mark all as read` action may mark notifications read
without loading their targets. If an explicit read update fails, the affected
notification or notifications stay unread and the panel shows accessible failure
feedback. Bulk `Mark all as read` applies to the currently loaded notification list
rendered in the panel, not to unloaded account-wide notification history. Show the bulk
`Mark all as read` action only when that loaded list contains at least one unread
notification; hide it when every loaded notification is already read. Bulk `Mark all as
read` does not require a confirmation step.

Unread notification rows use a Font Awesome `circle-check` icon for the row-level `Mark
as read` action. Already-read rows do not show a redundant row-level read action, but
remain selectable when they have a target. The notification panel uses a Font Awesome
`list-check` icon for the bulk `Mark all as read` action when unread notifications
exist.

When an unread notification row has both a target and a row-level `Mark as read` action,
the row body remains the target-navigation action and the `circle-check` is a distinct
icon button with its own accessible name, such as `Mark notification as read`. Activating
the checkmark marks that notification read without routing; activating the row body
routes to the target and then marks the notification read only after the target context
is present. Activating row-level `Mark as read` for a non-target notification also stays
on the current route.

Successful row-level and bulk manual read actions keep the notification panel open,
update affected rows in place, and update the unread badge/count. Row-level focus
returns to the updated row or the next sensible control. Bulk-action focus remains on
the bulk control until it disappears, then moves to the panel heading or list container
so the participant can continue reviewing notifications. Notifications newly marked read
while the panel is open stay in their current visual position for that open panel
session; the unread-first then read ordering rule is reapplied when the panel is
reopened or refreshed. The row's visual read state updates immediately: unread
notification text is bold, read notification text is unbolded, accessible labelling
communicates read state for assistive technology, and the row-level `Mark as read`
checkmark is removed once that notification becomes read. Do not show visible `Unread`
or `Read` status text in each row. Target-row accessible names should include message,
read state, and action, such as `Unread: You can submit entries... Open Multiplayer`.
Read target rows can use `Read: ... Open Multiplayer`. Row-level checkmark accessible
names should identify the exact notification being changed, such as `Mark notification
as read: You can submit entries...`.

Bulk `Mark all as read` may partially succeed. Successfully updated notifications become
read, failed notifications stay unread, the unread badge/count reflects the remaining
unread notifications, and the panel shows accessible status feedback such as `Some
notifications could not be marked read. Try again.`

When the notification list is empty, opening the notification panel shows the copy `You
have no notifications yet.` inside the panel instead of rendering an empty region.

### Visual metaphor

MVP may hint at the folded-paper origin of the game, but uses a clean web-form
interaction model. Avoid literal skeuomorphic folded-paper UI that harms mobile
usability or entry speed.

Folded-paper visual hints must not intersect setup controls. In the anonymous solo MVP
setup state before "Start batch", the phrase-count and start controls should appear
cleanly without column guide lines running underneath or through them.

### Onboarding

Anonymous solo MVP starts directly in the playable game flow with minimal inline
context. A small help icon may reveal a compact explainer section for users who want
instructions, but there is no separate tutorial or landing screen before play.

The help explainer includes one short origin sentence: Crazy Phrases was invented by two
friends seeking ways to create their own absurd amusement and pass the time in lessons.
The rest of the explainer should focus on compact functional instructions.

### Analytics

The first anonymous solo slice does not include third-party analytics, tracking scripts,
cookies for analytics, or equivalent telemetry.

### Test coverage

The anonymous solo MVP includes focused tests from the first implementation slice: unit
tests for game state, phrase rendering, word selection, concealment, local-storage
recovery, reveal, and copy formatting, plus browser smoke coverage for the full
anonymous solo flow.

The signed-in foundation adds browser smoke coverage for local/test sign-in, Account
shell display, signed-in Solo Game start/resume, in-progress entry persistence, reveal,
copy actions, sign-out/sign-back-in restore, anonymous solo regression, persistence
failure warnings, stale-write conflict warnings, and mobile overflow checks.

Notification-panel regression coverage should include mixed notification lists, not
just one actionable row. Cover unread-first/read-second and newest-first ordering, bell
open/close without read mutation, keyboard focus entry, `Escape`, outside-click close,
focus return to the bell on non-navigating close, row-level mark-read without routing,
target navigation read after rendered target presence, route-success/read-failure
recovery, stale or mismatched target data staying unread, non-target notification read
actions staying on the current route, multiple notifications for the same exact target
context, loaded-list bulk `Mark all as read`, bulk partial failure, accessible status
feedback, and mobile layout with several rows without horizontal overflow.

### Frontend implementation

The anonymous solo MVP uses plain static HTML, CSS, and JavaScript. A frontend framework
is deferred until signed-in state, routing, backend integration, or component complexity
justifies it. The first signed-in navigation routing pass still uses plain JavaScript
with lightweight hash-route view switching, because the accepted destinations fit the
existing static deployment model.

Anonymous solo game logic lives in separate JavaScript modules from DOM/UI code. Pure
modules handle game state, slot sequencing, phrase rendering, word selection,
local-storage serialization, and copy formatting; DOM code stays as a thin adapter.

### Asynchronous play

Games are asynchronous by default. Participants do not need to be present at the same
time to complete their slot assignments.

### Game start

A multiplayer game starts only after all invited human participants accept. Before that
it remains pending. CPU participants are treated as accepted immediately.

Random Slot Allocation and participant-local section order are resolved when
the Game starts, not when the Pending Game is created.

After every invited human participant has accepted, the Game Creator may start
the Pending Game. Starting creates a durable Game instance, marks the Pending
Game as started for provenance, copies browser-safe participant snapshots,
stores the configured row count and template id, and stores the resolved random
default-template Slot Allocation plus participant-local section order. A
Started Game shell without assigned-section storage is intentionally incomplete
and must not imply that entries, completion, or Reveal are available.

If an invited human participant declines, the pending game is cancelled in the MVP.

Pending Game invites expire seven days after Pending Game creation unless they
are started, cancelled, or declined first. Expired Pending Games are preserved
for creator and invitee visibility, appear with an expired state, and cannot be
accepted, declined, started, or creator-cancelled in the MVP. Expiry does not
hard-delete collaborative records and does not send expiry notifications in the
first product shape.

### Slot allocation and section order

For games with two or more participants, including games with CPU participants, slot
allocation defaults to random. Templates may allow the game creator to manually allocate
slots during game setup.

Each participant's assigned sections have a participant-local order. For the
default 2-player template, random Slot Allocation is resolved when the Game
starts, and each participant's assigned sections are ordered randomly for that
participant. There is no single global Slot Order that blocks other
participants from entering their own assigned sections.

If the game creator manually configures slot allocation or section ordering in
a future template mode, they can see those choices before the game starts. If
random slot allocation or participant-local section order is selected, the
resolved allocation or order is stored by the Game but not shown to the creator
before Reveal except for the current participant's own active section.

Participants may see only their own next incomplete assigned section before
Reveal. They should not see other participants' section assignments, entry
kinds, or entries before Reveal. The MVP concurrent model does not show coarse
other-participant section progress beyond placing the Game in `Awaiting other
player entries` when the current participant has no remaining section available
and the batch is not complete.

When a participant has multiple section assignments, they complete each
assigned section separately in their participant-local order. Multiple
assignments do not merge into one contribution.

An assigned section submission consists of completing one active section across
every row in the batch. Games do not advance row by row in the first product
shape.

For Started Games, each participant may see and submit only their own next
incomplete assigned section, including its entry kind and one input per row.
Different participants may submit their own current sections concurrently.

Submitting a multiplayer assigned section stores one non-empty Entry for every
row in that section and locks those Entries. A batch becomes complete only when
all assigned sections in the Game have been submitted. Completion does not
automatically reveal the batch for every participant.

For anonymous solo MVP, the active slot is entered through a single vertical form
showing all rows for that slot. The participant may fill rows in any order within the
active slot, rather than being forced top to bottom. Each row may support manual entry
and dice assistance.

The participant cannot submit an active slot until every row in that slot has a
non-empty entry.

Anonymous solo MVP relies on standard form navigation. Tab, Shift+Tab, and Enter
behaviour should be sensible, but custom keyboard shortcuts are deferred.

### Template mode support

MVP play uses the default template only. Custom template creation, publishing, remixing,
and discovery are deferred.

Templates declare the participant counts and game modes they support. Game setup only
offers modes supported by the selected template.

The MVP default template is designed for 2-player games.

The MVP default template has three slots: adjective, noun, and noun. It produces one
phrase per row. In its default 2-player mode, random slot allocation assigns one
participant two slots and the other participant one slot.

### MVP game modes

MVP supports anonymous solo games, signed-in solo games, and signed-in 2-player games.
CPU-participant games and 3-player games are deferred.

Anonymous solo games randomize the default template's slot order per game and show only
one active slot at a time. The resolved order may remain local to the client for
anonymous solo.

Anonymous solo shows the actual active slot kind, such as adjectives or nouns, so the
participant knows what to enter. It does not show the remaining slot kinds in their
resolved order before they become active.

Anonymous solo includes a "Start again" action. It discards the current local game and
returns to phrase-count selection for a new local game with a fresh randomized slot
order and empty entries. If the current game has entered values, the action asks for
confirmation through in-app UI rather than a browser-native `window.confirm` dialog.
During entry, the confirmation uses abandonment language: "Keep playing" or "Discard
entries". After reveal, the confirmation uses new-batch language: "View phrases" or
"Start new batch".

The MVP default template renders each phrase by concatenating the three entries with
spaces, trimming whitespace, collapsing extra spaces, and capitalizing the first
character for display. It does not auto-insert articles or punctuation.

For casing, entries that match words in the global word bank use normalized word-bank
casing for display. Entries that do not match the global word bank preserve their typed
casing, including user-specified non-words or pseudo-words, whether or not they are
stored in a personal word list.

Casing normalization affects rendered phrases only. Entries are stored as typed, with
word-bank match metadata if needed for display.

For MVP setup, the default template supports configurable row count and nudge
timeout. Slot allocation and participant-local section ordering use the simple
default random behaviour; manual allocation and ordering controls are deferred.

### Solo concealment

In a solo game, the participant fills one slot at a time and is not shown populated
entries from other slots before reveal. Solo play preserves the core fun of unexpected
combinations by reducing the participant's ability to make later entries congruent with
earlier ones.

### Random entry assistance

Random word generation is an explicit per-entry assist: a participant requests a
candidate for one slot and row, then may accept, regenerate, or edit it. Random
generation does not automatically populate a full slot or batch in the first product
shape.

### Entry kind vocabulary

Templates use a controlled built-in vocabulary of entry kinds. Custom templates may
compose supported entry kinds but do not introduce arbitrary new grammar categories in
the first product shape.

### Row count

Row count is configured per game. A template may provide a default row count, but the
game setup determines the actual number of phrases in the batch.

For the anonymous solo/default-template MVP, row count defaults to 20 phrases, with
additional selectable options of 10, 15, 25, and 30.

For the anonymous solo/default-template MVP, row count is selected before entries are
made and is locked by starting the batch. Entry controls are hidden until the
participant starts the batch. After start, row-count controls are disabled for the
current batch; "Start again" is the only action that returns the participant to
phrase-count selection.

### Template publishing

Saving and publishing a template are separate actions. A saved template remains private
to its creator until they deliberately publish it for wider use.

### Template attribution

Published templates are attributed to the creator's current Gamer Tag by default.
Showing email-backed account lookup values in public template attribution is not
allowed. Phrases generated from a template may show template attribution in detail views
rather than every compact discovery surface.

### Template remixing

Participants may remix published template versions into their own saved templates. A
template remix records lineage to the source template version and original creator; if
the remix is later published, that lineage is shown publicly.

### Template versioning

Published templates are versioned. A game uses the template version selected at setup,
and existing games or saved batches do not silently adopt later edits to that template.

Each published template change creates a new template version. Older published versions
remain available for existing games, saved batches, and template lineage, while
discovery shows the latest approved version by default.

Unpublishing a template version removes it from public discovery but does not break
existing games, saved batches, favourites, or template lineage. Moderation removals may
hide public visibility more aggressively while preserving historical references needed
for game integrity.

### Phrase reactions

Phrase reactions apply to individual phrases in the first product shape. The MVP
supports laugh and like reactions only; star ratings, downvotes, and batch ratings are
not part of the initial reaction model.

Phrase reactions are deferred from MVP while public feed and leaderboards are deferred.
Private favourites and plaintext external sharing are the MVP feedback/sharing
mechanisms.

### Leaderboard ranking

Leaderboard ranking uses laugh reactions as the primary signal. Like reactions may be
shown and used as a secondary tie-break or supporting signal, but the MVP does not use
an opaque weighted score.

### Leaderboard scope

MVP leaderboards are global public discovery surfaces. Friend-only leaderboards are not
part of the first product shape.

### Leaderboard windows

MVP leaderboards support today, this week, this month, and all-time windows.
Implementation must define a canonical timezone rule before these windows are used in
production.

### Public sharing

Completed phrases do not enter public discovery surfaces automatically. A phrase may
remain private to its participants, be saved as a private phrase favourite, or be
deliberately shared.

External sharing is distinct from public discovery. Phrase and batch surfaces may offer
device or browser share options such as clipboard, email, WhatsApp, or other available
share targets without automatically publishing the content to the in-app feed or
leaderboards. MVP external sharing sends plaintext individual phrases or plaintext
batches of phrases only.

MVP includes plaintext external sharing and private phrase or batch favourites for
signed-in users. Template favourites are deferred until custom templates exist. Public
feed and leaderboards are deferred.

Private favourites are the signed-in saved-output counterpart to plaintext sharing.
Their UI, saved-state, row, expansion, removal, date, participant, snapshot, and
auth-mounting rules live in [Signed-in Favourites](#signed-in-favourites).

This section owns only the boundary between private favourites, plaintext external
sharing, and public discovery. Saving a private favourite does not publish content,
grant Share Consent, create public share links, or replace copy/external sharing
actions. Private favourites remain Account-scoped; public discovery still requires
deliberate sharing and the public safety rules below.

External sharing and plaintext copying are available only after reveal, for completed
phrases or completed batches.

Anonymous solo MVP provides per-phrase copy and copy-all actions after reveal. Both copy
plaintext only.

Per-phrase copy copies only that phrase text. Copy-all includes a short title followed
by non-numbered phrase lines separated by line breaks.

MVP uses clipboard copy for plaintext phrase and batch sharing. Web Share API
integration is deferred as a later progressive enhancement.

Clipboard copy should use the browser Clipboard API when available, and fall back to a
temporary plaintext selection/copy path when that API is unavailable or blocked. If the
browser exposes no usable copy mechanism, the UI should report that copy is unavailable
rather than silently claiming success.

### Public safety

Shared phrases and published templates become eligible for public discovery only after
automated safety screening. Published public content can be reported by participants and
handled through later human or admin review for edge cases. Private saved templates
remain outside public discovery.

### Feed

The main public feed is a random discovery surface for shared phrases. Ranked discovery
belongs to leaderboards, and chronological timeline behavior is not part of the MVP
feed.

### Phrase provenance

Public feeds and leaderboards may include shared phrases involving human participants,
CPU participants, and accepted entry candidates. Public discovery must show clear
provenance labels for those sources. Leaderboard viewers may optionally filter out
phrases involving CPU participants, but that filter is not enabled by default.

### Share consent

Any human participant may propose sharing a completed phrase, but public sharing
requires consent from every human participant in that game. CPU participants do not
grant or withhold share consent.

External sharing of phrase or batch content from a multiplayer game also requires
consent from every human participant in that game. Solo games do not require additional
share consent.

Anonymous solo games may use plaintext external sharing because there are no other human
participants to consent. Anonymous solo games still do not support persistence, public
feed publishing, leaderboards, or account-linked favourites unless the participant signs
in.

### Participant attribution

Public discovery may show the Gamer Tags of human participants after share consent, but
must not expose real names, raw authentication identities, provider identity ids, or
email addresses, email-backed lookup values, or other private Account data. CPU
participants are shown using their configured display names. Participant attribution
should use intuitively understood icons to distinguish CPU participants from human
participants.

### Account requirement

Anonymous play is allowed only for local solo games. User accounts are required for
multiplayer, persistence, friends, favourites, ratings, template publishing, public
sharing, consent, moderation, and notifications.

MVP authentication may use simple provider-backed sign-in, including social login. MFA
and passkeys are deferred unless the chosen auth provider offers them as hosted or
low-code features that do not complicate the core game flow.

### Game persistence

Signed-in solo games can be saved and resumed. Anonymous solo games are local and
ephemeral. Multiplayer in-progress state is persisted because multiplayer requires
accounts, invites, and turns.

Signed-in solo persistence stores the current signed-in Solo Game as backend-backed
state by Account. Browser local storage is not the authority for signed-in game state.

Anonymous solo local recovery and signed-in account persistence are separate lifecycle
paths. Signing in must not silently upload or import a current anonymous local game.
Explicit import from anonymous solo to signed-in state is a later product decision.

The first signed-in solo persistence slice stores the current signed-in Solo Game rather
than a full signed-in game-history browser. A revealed signed-in solo batch remains
resumable as the current game until the participant starts again. Private Phrase
Favourites and Batch Favourites are separate saved-output features.

Only started signed-in Solo Games are persisted as account-backed current-game state. In
signed-in solo, confirmed "Start again" clears the account-backed current-game record
and returns the participant to phrase-count selection for a fresh local setup. The next
account-backed current-game record is created when the participant starts the next
batch. Reloading after confirmed "Start again" but before starting the next batch must
not restore the old revealed signed-in batch.

Signed-in solo save/resume should prevent stale clients from silently overwriting newer
account-backed progress, using a revision, version, or equivalent concurrency rule.

If signed-in solo current-game loading fails, the participant remains signed in,
the app shows a retry path, and any start-new path must not silently delete or
overwrite remote account-backed state. If account-backed saving fails, the app
must visibly warn that progress may not be saved. If a stale browser or session
attempts to save over newer account-backed progress, the app must report the
conflict rather than silently overwriting the newer state.

MVP anonymous solo is a client-only experience using manual entry and the tiny bundled
seed word bank. It does not require account state, backend persistence, invite state, or
server-side word-bank access.

The first implementation is static-first for anonymous solo, with a clear backend
boundary for signed-in features. Accounts, signed-in persistence, multiplayer, invites,
consent, and private favourites require backend-backed state rather than static hosting
alone.

Anonymous solo progress may be preserved in browser local storage for refresh recovery
and convenience. This is not durable account persistence, does not sync across devices,
and may be cleared by the browser or by "Start again".

Local-storage recovery restores the same anonymous solo game state, including randomized
slot order and entered values. Refreshing the page does not generate a new slot order.

Anonymous local storage keeps only the current or latest anonymous game, including its
revealed state if completed. It does not maintain anonymous game history; "Start again"
replaces the old local game.

The anonymous solo recovery record uses the browser local-storage key
`crazyphrases.anonymousSolo.currentGame.v1`. Version `v1` stores only the current or
latest anonymous solo game payload and may be ignored by the client if the payload is
malformed, incompatible, or not an anonymous solo game.

Anonymous solo MVP should replace the homepage in dev and test environments during
review, while production keeps the holding page until the slice is accepted for
production promotion.

### Account deletion

Account deletion deactivates or anonymizes the account identity while preserving
completed game history, shared phrases, consent records, leaderboard integrity, and
template lineage where needed. Personal/private data such as personal word lists should
be deleted.

Signed-in solo current-game state is personal/private working state rather than
completed collaborative history. It should be deleted when the Account is deleted, and
it may also be cleared by the participant's signed-in solo "Start again" flow. Future
collaborative game history remains governed by the preservation and anonymization rules
in this section.

Private Phrase Favourites and Batch Favourites are personal/private saved-output
collections. They should be deleted when the Account is deleted. This does not change
future collaborative game-history preservation, participant snapshot, or consent-record
rules.

Public attribution for a deleted account shows "Deleted user" and removes the old Gamer
Tag from public surfaces. Collaborative records may still indicate that a deleted
participant or creator existed.

Prior share consent from a deleted account remains valid for content that was already
shared before deletion, unless the account explicitly unshared or reported the content
before deletion. Deleted accounts cannot grant new share consent.

Any human participant in the original game can unshare a shared phrase, removing it from
public discovery going forward. Unsharing does not delete the phrase from participants'
private game history or favourites.

### Player identity

Accounts have a private email-backed lookup key for exact known-email lookup and a
Gamer Tag for game-facing display. For hosted Auth Accounts, the private lookup key is
derived from the Supabase Auth email address used for magic-link sign-in or returned by
a third-party Auth provider. It is not a public profile field, participant display
value, profile URL value, mention value, or normal editable profile field. Gamer Tags
are changeable display names used in games and social surfaces, and they are also valid
lookup keys.

MVP profiles use Gamer Tag and a built-in Avatar selected from a generated/default or
modest project-provided visual set. The first shipped profile surface may store only a
built-in Avatar key until avatar images are rendered, but the accepted Avatar model
distinguishes Built-in Avatars from Uploaded Avatars. Uploaded Avatars are a follow-up
profile-personalisation slice, not part of the first profile-management implementation.

Uploaded Avatars accept only raster JPEG, PNG, and WebP image files. SVG, GIF,
HEIC/HEIF, video, animated formats, and non-image uploads are out of scope for the first
Uploaded Avatar slice. The first slice caps uploads at 1 MiB, requires decoded image
dimensions no larger than 1024 x 1024 pixels, and rejects images smaller than 128 x 128
pixels.

Uploaded Avatar validation and save states use these user-facing messages: invalid file
type says "Choose a JPEG, PNG, or WebP image."; oversized file says "Choose an image
smaller than 1 MB."; undersized image says "Choose an image at least 128 by 128
pixels."; oversized dimensions say "Choose an image no larger than 1024 by 1024
pixels."; unreadable or corrupt image says "This image could not be read. Choose another
file."; upload failure says "Avatar could not be uploaded. Try again."; profile-save
failure after upload says "Profile could not be saved. Your previous avatar is still
active."; successful save says "Profile saved."

The first Uploaded Avatar slice does not include image-content moderation, automated
safety scanning, human review queues, report queues, or public-discovery safety
workflows. Uploaded Avatars remain account-bound game-facing identity assets in existing
signed-in profile and participant contexts.

The first Uploaded Avatar slice stores the original validated image file under the
accepted opaque Storage object path. It does not resize, crop, strip metadata, or
transcode uploaded files. Later image-processing, derivative generation, and
metadata-stripping work is separate from #63.

Selecting an Uploaded Avatar file validates it and shows a local preview only. The app
must not upload the file to hosted Storage until the participant activates the explicit
Save profile action. If upload or profile save fails, the previously saved Avatar
remains active and the UI shows a clear failure state.

If the file upload succeeds but saving the Account Profile Avatar descriptor fails, the
app should attempt best-effort cleanup of the newly uploaded object and any matching
ownership metadata. Cleanup failure must not switch the active Avatar or falsely show
success; it leaves an abandoned-object cleanup concern for later lifecycle work.

The first Uploaded Avatar slice requires hosted Supabase validation before merge or
promotion, because it creates or depends on real Storage bucket, Storage policy,
ownership metadata, and direct browser upload behaviour. Hosted validation remains
approval-gated and should run in dev or test first; production uploaded-avatar write
smoke requires separate explicit approval.

The #63 Uploaded Avatar slice did not include crop positioning, crop metadata, or
derived cropped-image generation. That deferred scope is now implemented under #64 using
a browser-generated derived cropped image. The richer visual avatar cropper is
implemented under #79 without changing the derived-image storage authority.

Circular mask cropping under #64 saves a derived cropped image as the active Uploaded
Avatar object. The selected source file is local draft input for validation, crop
preview, and browser-side crop generation only; #64 does not upload or retain the
uncropped original as the live Avatar object.

The #64 derived cropped image is a fixed square PNG with a 256 x 256 target. It uses the
existing `avatars` bucket, opaque `uploaded/{uuid}.png` object path convention,
owner-scoped metadata, and Uploaded Avatar descriptor. Circular display remains a
rendering rule around the saved square crop.

Crop position and scale are draft Profile-editor state only. Save/reload correctness
comes from the derived image bytes, not from persisted crop metadata. The #79 visual
cropper replaces the #64 numerical controls with an inline editor inside the existing
Profile panel after a valid Uploaded Avatar file is selected; it keeps the small
circular Avatar preview as the result preview and does not introduce a modal or
full-screen crop lifecycle. The crop box remains a fixed 1:1 target for the 256 x 256
derived PNG; users move the image under the target and adjust scale through explicit
zoom controls rather than resizing the crop box. New valid images default to
centre-cover at the minimum zoom, without face detection or focal-point guessing. The
fixed crop boundary and crop-box markers remain visible while editing, while the
rule-of-thirds grid and centre guides appear during and briefly after drag, keyboard
nudge, or zoom changes rather than being permanently dominant. The editor must prevent
blank or transparent space inside the crop box by keeping zoom at or above the cover
minimum and clamping panning at the image edges. Crop edits update the draft circular
preview immediately, but the existing Save profile action remains the only action that
uploads the derived image and saves the Account Profile; there is no separate Apply crop
action. A Reset crop control returns the current valid image to centre-cover at minimum
zoom, affects only local draft crop state, and updates the draft circular preview
immediately. Crop generation failure uses the message "Avatar could not be cropped. Try
again."

The #79 visual cropper supports keyboard operation directly on the crop editor rather
than keeping the #64 numeric controls as the primary accessibility fallback. The crop
editor is focusable, arrow keys nudge the image, Shift plus arrow keys nudge further,
and plus/minus keys adjust zoom. Explicit zoom controls are keyboard-accessible buttons.
Touch users can drag the image to reposition it and use visible zoom controls to scale
it. Pinch-to-zoom is optional enhancement only, not a required path for mobile
usability.

The #79 visual cropper is implemented directly in the existing static app code rather
than using a generic third-party cropper dependency. This keeps the cropper constrained
to the accepted fixed-square target, draft pan and zoom state, guide overlay, reset
control, keyboard operation, and save-time derived PNG generation model.

Future cropper changes that preserve the existing Storage upload behaviour, Account
Profile persistence, Supabase schema and policies, and derived-image save contract
should use local automated tests plus a visible local browser smoke of the signed-in
Profile editor rather than requiring hosted Supabase write validation. Hosted dev or
test validation becomes required if implementation changes Storage upload behaviour,
Account Profile persistence, Supabase schema or policies, or the derived-image save
contract. Production Uploaded Avatar write smoke remains separately approval-gated.

The first Uploaded Avatar slice must render a basic Avatar preview in the existing
Profile editor for both Built-in Avatars and Uploaded Avatars, and existing participant
or profile identity surfaces should consume the Avatar descriptor where they already
show avatar identity. It must not add new public profile pages, friend cards,
leaderboard identity, or broader social surfaces.

Anonymous users must not receive Uploaded Avatar controls, hidden file inputs, upload
preview DOM, upload event wiring, or browser storage-upload paths. Uploaded Avatar
controls belong only inside the signed-in Profile editor surface.

The first Uploaded Avatar slice should introduce visible Built-in Avatar images using
the owner-managed Font Awesome Kit `613901cfcc`. The accepted Built-in Avatar product
keys are `dice`, `hat-wizard`, `gamepad`, `ghost`, `puzzle-piece`, `biohazard`,
`dragon`, `hurricane`, `jedi`, `pizza-slice`, `spaghetti-monster-flying`,
`user-astronaut`, and `yin-yang`; each maps to the Classic Font Awesome icon with the
same name, using Classic Solid when available and Classic Regular only as a per-icon
fallback when Solid is unavailable. Crazy Phrases Avatar keys remain stable
product/storage keys, while Font Awesome family/style/icon classes are rendering
metadata. The slice should subset the Kit where practical and verify that Built-in
Avatar previews render in local, dev, and test environments.

The first Uploaded Avatar slice treats the old transitional built-in keys `spark`,
`paper`, `moon`, `star`, `comet`, and `kite` as legacy-only. Migrating to the accepted
Built-in Avatar set maps `spark` to `dice`, `paper` to `puzzle-piece`, `moon` to
`yin-yang`, `star` to `user-astronaut`, `comet` to `hurricane`, and `kite` to `dragon`;
unknown or invalid built-in keys fall back to `dice`.

MVP accounts have one active gamer profile. Multiple personas or profiles per account
are deferred.

The Account Profile / lookup directory is a signed-in lookup surface. Lookup must not
be available to anonymous visitors, and it must not expose raw authentication user ids,
provider identity ids, email addresses, email-backed lookup values, or non-opaque
uploaded-avatar storage identifiers. Browser-facing lookup uses one lookup-key input
that accepts either a full email address already known to the participant or a Gamer
Tag, without requiring the participant to choose a lookup mode. Successful lookup
returns invite-safe profile data such as directory profile id, Gamer Tag, and Avatar
descriptor. An email miss displays `No gamer found under that email address`. A Gamer
Tag miss displays `No gamer found under that gamer tag.`.

Completed games snapshot the participant Gamer Tag and Avatar descriptor used at the
time of play. Current profiles and new games use the latest Gamer Tag and Avatar.
Private email-backed lookup values are not participant display values and must not be
snapshotted for display. Any future Auth-email change feature must define how
known-email lookup, invite resolution, and privacy expectations behave before it ships.

Replacing the current Uploaded Avatar must not break completed-game history that already
snapshots an older Uploaded Avatar descriptor, or batch favourites and other durable
history/favourite snapshots that still render an older Avatar. The first Uploaded Avatar
slice should clean up clearly abandoned objects from failed or retried uploads where
practical. The avatar image gallery slice should add cleanup for superseded uploaded
objects once the app can prove no current profile, completed-game history, batch
favourite, or other durable snapshot still references them. Account-deletion media
retention remains a separate lifecycle decision.

Participants may remove the live Uploaded Avatar from their Account Profile by choosing
and saving a Built-in Avatar. This switches the live Account Profile descriptor back to
the selected Built-in Avatar without deleting older uploaded objects that may still be
referenced by completed-game snapshots.

### Friends

Friends are mutual relationships between account holders. One-way following is not part
of the first product shape.

### Game invites

Multiplayer games can invite friends or accounts found through signed-in lookup. Friend
invites should be the low-friction path. Non-friend lookup-key invites are allowed but
need anti-spam limits and recipient controls.

MVP multiplayer invites use one lookup-key input that accepts either a known email
address or a Gamer Tag. Friend relationships and friend-based invite shortcuts are
deferred.

The invite UI is signed-in only. It lets the Game Creator select the batch row count,
enter another account's email address or Gamer Tag, create a Game Invite, and see the
invited participant's response state. Signed-in invitees can see incoming
Pending Game invites for their Account Profile, accept an invite, or decline an
invite. Once every invited human participant accepts, the Game Creator can start
the Pending Game and see that the Game shell has started. Decline cancels the
Pending Game in the MVP. The source-controlled participant-section foundation
for ADR 0015 lets signed-in participants submit their own assigned sections,
wait for other participant entries, receive in-app notifications, and reveal a
completed multiplayer batch for themselves after all sections are submitted.
The current MVP invite UI includes creator cancellation for Pending Games
before start and unrevealed Started Games, seven-day Pending Game invite
expiry, and configurable in-app nudge timeouts. It still does not add Share
Consent, friends, manual pokes, or public discovery. The historical first
Started Game turn-submission slice added global
active Turn storage and submission only; current multiplayer execution is
governed by the participant-section model in ADR 0015.

### Nudges

A nudge is an automatic reminder based on a game's configured inactivity
timeout. The MVP creates nudges only for the assigned participant whose current
incomplete section is overdue. Manual participant-triggered pokes are not part
of the first notification model.

### Nudge timeout

Nudge timeout is configured per game during setup from 1 day, 2 days, 3 days,
or 7 days. The configured timeout is copied from Pending Game setup into the
Started Game. Each account may later mute its own notifications without
changing the game's shared inactivity timeout.

### Notification delivery

MVP notifications are in-app only. Game status, invites, consent requests, and nudges do
not require email or push notification delivery in the first product shape.

Multiplayer Game-start, batch-complete, and creator-cancellation notifications
are durable in-app notification rows stored per participant. When a Game starts
after all invited participants have accepted, every participant receives an
unread actionable notification that they can submit entries. When the final
assigned section is submitted and the batch becomes complete, every participant
receives a batch-complete notification. The final submitter's batch-complete
notification is created as read because the submit flow takes them directly to
the completed batch and Reveal action; other participants receive it unread.
When the Game Creator cancels a Pending Game or unrevealed Started Game,
accepted participants other than the creator receive an unread cancellation
notification. If the cancelled Game had earlier entry-needed notifications,
or nudge notifications, those notifications are marked read so stale prompts do
not remain unread.

Nudge notifications are durable in-app notification rows. The MVP generates
overdue nudges opportunistically during authenticated Multiplayer dashboard
refresh, using database-owned logic for participant scoping, timeout checks,
and de-duplication by Started Game, Account, and assigned section. Browser
clients do not receive direct insert authority for nudge notifications.

Top-bar notification read-state changes follow the notification panel rules
above: opening or viewing the dropdown does not mark notifications read. Read
notifications remain listed. No notification is created for a participant's own
next assigned section after submitting a previous assigned section, because the
participant can continue immediately in the same flow.

### Reveal

A game reveals its batch only when every required entry is complete. Partial reveal and
timeout reveal are not part of the first product shape.

For multiplayer Games, Reveal is a per-participant viewing action after batch
completion, not a global Game transition. Every assigned section in the Game
must be submitted before any participant can reveal the batch. Each participant
clicks `Reveal phrases` for themselves; revealing the batch for one participant
does not reveal it for another participant.

For anonymous solo MVP, reveal is final for the completed local game. After reveal, the
participant can view the completed batch, copy/share it, or start again; the completed
batch does not need a re-hide action.

Revealed batches show phrases in original row order. Reveal does not shuffle completed
phrases.

Reveal presents final rendered phrases first. An optional details view may show the
contributing entries grouped by slot.

The signed-in multiplayer surface groups Started Games and completed batches
into `Awaiting your entries`, `Awaiting other player entries`, and `Batches
completed`. `Batches completed` lists only the five most recently completed
multiplayer batches for the signed-in Account in the MVP.

Signed-in participants can open a dedicated completed multiplayer history view
from the `Batches completed` dashboard bucket. The dashboard keeps its five-item
cap. The history view lists completed multiplayer batches for the current
Account in pages of up to 20, newest first, with deterministic cursor
pagination and invite-safe participant Gamer Tags and row count context. `Load
more` appears only when older completed batches are available and appends older
batches without replacing already loaded results. Cancelled Games are excluded.
Unrevealed completed batches show that they have not been revealed yet, offer
`Reveal phrases` for the current participant, and must not render phrase text in
visible or hidden DOM before that participant's successful Reveal. Successful
Reveal from history uses the existing participant-scoped Multiplayer Reveal
authority, updates only the current participant's reveal state, and renders
phrases in original row order.

MVP reveal effects should be simple and polished. Subtle transitions are acceptable, but
heavy animation or confetti is deferred.

### Cancellation

The Game Creator may cancel a Pending Game before start or a Started Game
before any participant has revealed the batch. Invited participants may decline
before accepting or starting. Once any participant has revealed the batch, the
Game becomes completed history rather than cancellable.

Cancellation preserves the Pending Game, Started Game, participant snapshots,
assigned sections, submitted entries, and notification rows for history and
audit; it does not hard-delete collaborative game records. Cancelled Games are
removed from active `Awaiting your entries`, `Awaiting other player entries`,
and `Batches completed` dashboard buckets, and further section submission or
Reveal is blocked.

Cancellation notifies accepted participants other than the creator. Pre-start
Pending Game cancellation notifications target the Pending Game; Started Game
cancellation notifications target the Started Game and supersede earlier
entry-needed and nudge notifications by marking those older prompts read.

### Entry validation

Manually typed entries use light validation only: required values, length limits, and
broad content safety checks for public sharing. Private play does not strictly enforce
grammar or word form because unexpected forms are part of the comedy.

Entries may be edited during the contributor's active turn before the turn is submitted.
Once a turn is submitted, that turn's entries are locked. After reveal, entries in
completed collaborative history cannot be deleted or edited by individual contributors;
privacy and safety concerns are handled through unsharing, reporting, or account
deletion anonymization.

### Entry candidates

Random generation produces entry-kind-specific candidates with low latency. Accepted
entries remain editable and are not grammar-enforced beyond light entry validation.

In MVP, clicking dice fills the target input immediately with a candidate. The
participant can edit the value or click dice again to replace it.

Dice assistance avoids repeating the same word within one game when possible, per entry
kind. If the available candidate list is exhausted, repeats are allowed rather than
failing.

### Word bank

Dice-click entry assistance uses a local or cached word bank so candidate generation
feels instant during play. External APIs or LLMs may refresh or enrich the word bank
asynchronously later, but are not called synchronously for each dice click.

MVP includes dice-click entry assistance backed by a small local or cached word bank for
the default template's adjective and noun slots.

MVP implementation may start with a tiny hand-curated seed list for adjective and noun
candidates while larger word-bank source selection remains a research task.

The MVP seed word bank should be large enough to populate three 30-phrase batches of the
default template without repetitions: at least 90 adjective candidates and 180 noun
candidates.

The MVP seed word bank is family-friendly by default and should not include profanity,
adult terms, or offensive words.

The MVP seed word bank lives as a JSON data asset, not inline game code. It contains
separate adjective and noun candidate arrays plus metadata such as version and
family-friendly status.

The anonymous solo MVP seed word bank asset lives at `assets/word-bank-seed.json`. The
static app fetches it with the deployed asset version query string so dice assistance
can be cache-busted alongside `assets/app.js`.

Anonymous solo play must not require downloading the full production word bank. MVP
anonymous solo may use the tiny bundled seed list, but production anonymous solo should
use the same low-latency word-bank candidate service as signed-in play, with optional
small client-side fallback shards.

Anonymous solo games remain playable if the word-bank candidate service is unavailable.
Manual entry still works, and dice assistance may fall back to a tiny bundled list for
the default template's adjective and noun slots.

### Personal word lists

The global word bank and personal word lists are distinct entry-assistance sources.
Personal words do not silently become public or global candidates, and participants must
explicitly choose when to use a personal word list for an entry.

Personal word lists are deferred from MVP. MVP entry assistance uses manual entry and
dice-click candidates from the global word bank only.

### Personal word tags

Personal words may be tagged with one or more entry kinds. Untagged personal words are
allowed, but entry assistance should prefer personal words tagged for the current slot's
entry kind.

### Personal word privacy

Personal word lists are private to their owning participant in the first product shape.
Sharing or publishing reusable word collections is a separate future feature, not an
extension of personal word lists.
