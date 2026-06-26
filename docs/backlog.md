# Backlog

## Index

Use this index to route to the relevant backlog cluster before loading the whole
file. The full entries below remain the authoritative deferral records and
preserve their original history.

- **Template and template tooling**: deferred. Start with:
  [Custom templates](#custom-templates);
  [Template favourites](#template-favourites);
  [Manual slot allocation and ordering controls](#manual-slot-allocation-and-ordering-controls);
  [Template visibility rules](#template-visibility-rules).
- **Game modes and lifecycle**: deferred. Start with:
  [CPU-participant games](#cpu-participant-games);
  [3-player games](#3-player-games);
  [Live synchronous play](#live-synchronous-play);
  [Partial or timeout reveal](#partial-or-timeout-reveal);
  [Participant replacement](#participant-replacement);
  [Post-submission correction requests](#post-submission-correction-requests).
- **Multiplayer and social graph**: nudge timeout foundation promoted through
  production; multiplayer destination and notification utility placement accepted; most
  social scope deferred. Start with:
  [Signed-in 2-player asynchronous game](#signed-in-2-player-asynchronous-game);
  [Multiplayer destination placement](#multiplayer-destination-placement);
  [Notification top-bar affordance](#notification-top-bar-affordance);
  [Notification bulk read management](#notification-bulk-read-management);
  [Pending invite expiry duration](#pending-invite-expiry-duration);
  [One-way following](#one-way-following);
  [Friend relationships](#friend-relationships);
  [Manual pokes](#manual-pokes);
  [Android app and push notifications](#android-app-and-push-notifications).
- **Account, profile, and auth**: profile-management MVP completed; signed-in route
  gate, avatar-first account affordance, and account-menu placement accepted. Start
  with:
  [Signed-in route gate for anonymous visitors](#signed-in-route-gate-for-anonymous-visitors);
  [Signed-in Account Profile management surface](#signed-in-account-profile-management-surface);
  [Auth-gated favourites DOM loading](#auth-gated-favourites-dom-loading);
  [Anonymous solo import to signed-in state](#anonymous-solo-import-to-signed-in-state);
  [Email OTP code entry](#email-otp-code-entry);
  [Additional hosted Auth providers](#additional-hosted-auth-providers);
  [Branded Supabase Auth domain](#branded-supabase-auth-domain);
  [Uploaded Avatars](#uploaded-avatars);
  [Multiple gamer profiles](#multiple-gamer-profiles);
  [Social profile URLs](#social-profile-urls).
- **Favourites and saved-output UI**: mixed completed, accepted, and deferred. Canonical
  accepted rules live in
  [Signed-in Favourites product rules](product-rules.md#signed-in-favourites). Start
  with:
  [Private phrase and batch favourites follow-up slice](#private-phrase-and-batch-favourites-follow-up-slice);
  [Icon-first favourite and copy actions](#icon-first-favourite-and-copy-actions);
  [Dedicated favourites destination](#dedicated-favourites-destination);
  [Signed-in navigation Favourites heart](#signed-in-navigation-favourites-heart);
  [Compact Batch Favourite participant avatars](#compact-batch-favourite-participant-avatars);
  [Favourites pagination and search](#favourites-pagination-and-search);
  [Favourites duplicate grouping](#favourites-duplicate-grouping);
  [Favourites source-game links](#favourites-source-game-links);
  [Favourites date localisation](#favourites-date-localisation);
  [Favourites saved-count badge](#favourites-saved-count-badge).
- **Sharing, discovery, reactions, and ranking**: deferred. Start with:
  [Batch ratings](#batch-ratings);
  [Friend-only leaderboards](#friend-only-leaderboards);
  [Public feed and leaderboards](#public-feed-and-leaderboards);
  [Phrase reactions](#phrase-reactions);
  [Leaderboard timezone rule](#leaderboard-timezone-rule);
  [Phrase image generation](#phrase-image-generation);
  [Public share links](#public-share-links);
  [Web Share API](#web-share-api).
- **Word bank and entry assistance**: deferred. Start with:
  [Full automatic batch population](#full-automatic-batch-population);
  [User-defined entry kinds](#user-defined-entry-kinds);
  [Shareable word packs](#shareable-word-packs);
  [Personal word lists](#personal-word-lists);
  [Expanded word-bank source selection](#expanded-word-bank-source-selection);
  [Word-bank family-friendly setting](#word-bank-family-friendly-setting);
  [Production word-bank delivery](#production-word-bank-delivery).
- **UI polish**: deferred. Start with:
  [Celebratory reveal effects](#celebratory-reveal-effects);
  [Custom keyboard shortcuts](#custom-keyboard-shortcuts).
- **Operations and platform**: mixed completed and deferred; first signed-in hash
  routing accepted without framework. Start with:
  [Main branch protection ruleset](#main-branch-protection-ruleset);
  [Cloudflare Access allow-list documentation](#cloudflare-access-allow-list-documentation);
  [Privacy-preserving telemetry](#privacy-preserving-telemetry);
  [Frontend framework](#frontend-framework);
  [Cloudflare deployment cache purge](#cloudflare-deployment-cache-purge).

## Deferred Product Decisions

### Custom templates

- **Deferred**: Creating, publishing, remixing, and discovering custom templates.
- **Why deferred**: A safe template ecosystem requires editor UX, versioning,
  publishing, moderation, remix lineage, and discovery; the MVP should prove the
  default-template game loop first.
- **Revisit when**: Default-template play, accounts, sharing, and core social loops are
  working.
- **Remaining risk**: Game and template data models should preserve the template/version
  boundaries already documented so custom templates can be added without rewriting game
  history.

### Template favourites

- **Deferred**: Marking templates as favourites for easier reuse.
- **Why deferred**: MVP uses only the default template, so template favourites do not
  add value until custom or published templates exist.
- **Revisit when**: Custom template creation, publishing, or discovery is implemented.
- **Remaining risk**: Favourite models should distinguish template favourites from
  phrase and batch favourites.

### Manual slot allocation and ordering controls

- **Deferred**: Letting the game creator manually allocate sections or manually choose
  participant-local section order during setup.
- **Why deferred**: MVP default-template setup should stay simple with random Slot
  Allocation and participant-local section order, while manual controls fit better with
  later custom template tooling.
- **Revisit when**: Custom templates or repeated player feedback need creator control
  over who fills which slot and when.
- **Remaining risk**: Game setup should still model resolved allocation and
  participant-local order separately so manual controls can be added later.

### CPU-participant games

- **Deferred**: Games where one or more slots are filled by CPU participants.
- **Why deferred**: MVP can prove anonymous solo, signed-in solo, and signed-in 2-player
  play without implementing automated participant behavior.
- **Revisit when**: Players need a low-friction opponent beyond solo play or when
  entry-candidate generation can support credible CPU turns.
- **Remaining risk**: Participant and provenance models should preserve CPU participant
  concepts already documented.

### 3-player games

- **Deferred**: Games with three human participants.
- **Why deferred**: MVP focuses on the default 2-player version of the original game
  while keeping allocation and invitation flows simpler.
- **Revisit when**: 2-player multiplayer is working and players want each
  default-template slot assigned to a different person.
- **Remaining risk**: Game setup and slot allocation should avoid assuming exactly two
  human participants forever.

### Live synchronous play

- **Deferred**: Realtime games where all participants are present together and see live
  turn progress.
- **Why deferred**: The core folded-paper game is turn-based, and asynchronous play
  avoids presence, realtime update, and connection-state complexity in the first product
  shape.
- **Revisit when**: Players need a party-room or live-session experience beyond
  asynchronous invitations and nudges.
- **Remaining risk**: Game state should avoid assuming that asynchronous turn-taking is
  the only possible execution profile forever.

### Template visibility rules

- **Deferred**: Allowing templates to declare custom visibility rules, such as exposing
  selected earlier entries to later players.
- **Why deferred**: Classic play can use a simpler concealment rule for the first
  implementation: players see guidance for their assigned slot and their own entries,
  but not other players' entries until reveal.
- **Revisit when**: Custom templates need richer play styles that deliberately trade
  surprise for coherence.
- **Remaining risk**: Early data models and UI flows should avoid assuming that all
  non-owner entries are always invisible in every future mode.

### Full automatic batch population

- **Deferred**: Automatically filling a whole slot or batch with generated entries.
- **Why deferred**: Per-entry assistance preserves the hidden-contribution game loop,
  while full auto-fill risks making the product feel like a generic phrase generator.
- **Revisit when**: Solo, CPU, accessibility, or onboarding flows need a faster way to
  create complete batches.
- **Remaining risk**: Entry-assist interfaces and services should avoid assuming
  generation can only ever be requested for one entry.

### User-defined entry kinds

- **Deferred**: Letting users create arbitrary entry kinds beyond the built-in
  vocabulary.
- **Why deferred**: Generation, validation, guidance, and template editing all need
  predictable categories for the first product shape.
- **Revisit when**: Template creators repeatedly need categories that cannot be
  represented with the built-in entry kinds.
- **Remaining risk**: Template storage should avoid hard-coding the initial vocabulary
  so tightly that adding new kinds later requires migrating every template.

### Batch ratings

- **Deferred**: Letting participants rate or react to whole batches.
- **Why deferred**: Phrase reactions are easier to understand, rank, and use in feeds,
  while batch favourites already cover saving a whole revealed set.
- **Revisit when**: Leaderboard or sharing designs need batch-level scoring rather than
  phrase-level scoring.
- **Remaining risk**: Reaction and leaderboard code should not assume that phrases are
  the only possible reaction target forever.

### Friend-only leaderboards

- **Deferred**: Leaderboards scoped to a user's friends.
- **Why deferred**: Friend-only ranking depends on mature social graph behavior and
  creates edge cases around whose friend network defines the leaderboard.
- **Revisit when**: The friend graph is actively used beyond game invitations and
  players need smaller social ranking surfaces.
- **Remaining risk**: Leaderboard services should avoid assuming global scope is the
  only possible scope forever.

### Public feed and leaderboards

- **Deferred**: Public feed, global leaderboards, phrase reactions in public discovery,
  and related moderation operations.
- **Why deferred**: Public discovery requires consent, safety screening, reporting,
  moderation, ranking, and abuse handling; MVP should prove the core game loop first.
- **Revisit when**: Default-template games, accounts, handle invites, external sharing,
  and private favourites are working.
- **Remaining risk**: Sharing, consent, provenance, and reaction concepts should remain
  available for future public discovery.

### Private phrase and batch favourites follow-up slice

- **No longer deferred**: Private Phrase Favourites and Batch Favourites from the
  signed-in foundation and solo save/resume PRD.
- **Why deferred**: The first signed-in slice should prove Account identity and
  current-game persistence before adding saved-output collections.
- **Revisit when**: Signed-in solo current-game save/resume is working in dev/test and
  the persistence model can distinguish current game state from saved favourites.
- **Status**: Revisit trigger satisfied on 2026-06-15 after the signed-in foundation
  shipped through production. PRD #33 is published, with implementation tracked by
  issues #34, #35, #36, and #37. Issues #34, #35, and #36 now have source-controlled
  local implementation and tests for Phrase and Batch Favourites, including saved-state
  polish and Account-scoped removal. The private Batch Favourite migration and signed-in
  `dev` write smoke were completed against hosted Supabase on 2026-06-15 after explicit
  approval. A follow-up `dev` deployment of the removal-polish branch fixed Supabase
  `jsonb` snapshot key-order saved-state matching and passed the authorised signed-in
  hosted smoke for Phrase Favourite and Batch Favourite save, remove, re-save, reload,
  current-game clear, and cleanup.
- **Remaining risk**: The accepted MVP contract stores immutable saved-output snapshots
  rather than live current-game references. No accepted private-favourites
  implementation scope remains open; future work should focus on UI consolidation,
  dedicated navigation, or broader sharing only through separate accepted slices.

### Auth-gated favourites DOM loading

- **No longer deferred**: Avoid rendering or wiring private favourites UI, favourite
  action controls, and related client capability until a participant has successfully
  signed in; remove those DOM nodes and event paths again on sign-out.
- **Why deferred**: The current MVP hides favourites UI when the session is anonymous,
  but hidden DOM can still be revealed with browser developer tools. The security
  boundary should remain Supabase Auth and Row Level Security, but the client should not
  expose account-only affordances in anonymous mode or create any ambiguity about
  whether favourites work without sign-in.
- **Revisit when**: Private favourites receive another UI/security hardening pass, a
  dedicated favourites page is introduced, or before broader public onboarding where
  anonymous users may inspect or manipulate hidden controls.
- **Status**: Completed on 2026-06-16. PR #42 merged to `main` as
  `055eeee9bbedeff3fce169a2f2406754a8deff6b` after local automated tests, visible local
  smoke, and approved `dev` deployment verification. The merged commit was promoted
  through `test` and `production` by the documented GitHub Environment gates. Visible
  browser smokes on `dev`, `test`, and production confirmed stamped static assets,
  anonymous reveal with no favourites panel, no Phrase Favourite save controls, no Batch
  Favourite save controls, no horizontal overflow, and empty browser warnings/errors.
  Local browser smoke also asserted signed-in Account-backed mode mounted the
  then-current minimal favourites surface and sign-out removed account-only nodes.
- **Remaining risk**: Future account-only event paths should keep using Supabase Auth
  and Row Level Security as the authority and keep anonymous DOM absence covered by
  browser tests.

### Signed-in route gate for anonymous visitors

- **Accepted for signed-in navigation design**: Anonymous visitors may use
  `#/play/solo`, but anonymous visits to signed-in-only hash routes such as
  `#/play/multiplayer` and `#/favourites` should show a sign-in-required gate for the
  requested destination.
- **Why**: Hash-route selection is client view state, not Account authority. The product
  should make the requested destination clear without mounting account-only DOM, wiring
  account-only event paths, or fetching private data before Supabase Auth and Row Level
  Security can authorise the Account.
- **Status**: Accepted on 2026-06-25 as part of signed-in navigation design. The
  requested signed-in destination should be preserved through sign-in and opened after a
  valid Account session exists. Explicit sign-out from a signed-in-only route should
  clear account-only UI, close account and notification menus, discard preserved
  requested destination state, and reset the route to `#/play/solo`; fresh anonymous
  visits to bookmarked signed-in-only routes may still show the gate. Implementation
  still needs an owning PRD and agent-sized issues before code changes.
- **Remaining risk**: Hosted OAuth and magic-link redirects may not preserve URL
  fragments directly, so implementation may need a short-lived client-side
  requested-destination handoff before leaving for hosted auth. Browser tests must cover
  anonymous `#/play/multiplayer` and `#/favourites` gate rendering, absence of
  account-only DOM/data fetches, signed-in restoration to the requested route, sign-out
  reset to `#/play/solo`, and sign-out cleanup.

### Icon-first favourite and copy actions

- **No longer deferred for design**: Replacing text-heavy contextual favourite, copy,
  share, and remove controls with accessible icon-first controls for familiar utility
  actions.
- **Why previously deferred**: The MVP controls were explicit and testable, but became
  visually heavy as revealed-batch and saved-output actions grew. Icon controls need
  accessibility labels, equivalent names, saved/pending/failure states, and mobile
  hit-area review before replacing clear text buttons.
- **Revisit trigger satisfied**: Signed-in navigation and Favourites placement were
  designed on 2026-06-25 and 2026-06-26, including a dedicated `#/favourites`
  destination and account-scoped saved-output management.
- **Status**: Accepted. Canonical icon, action-availability, status-copy, confirmation,
  focus, visible-tooltip, touch-activation, and pending-settlement rules live in
  [Signed-in Favourites product rules](product-rules.md#signed-in-favourites) and
  [Icon-first actions product rules](product-rules.md#icon-first-actions).
- **Implementation risk**: The implementation plan still needs to translate those rules
  into accessible names, hover/focus tooltips for icon-only row actions, direct touch
  activation without tap-to-preview tooltips, mobile-safe hit areas, narrow-row action
  wrapping without overflow menus, row-local live regions, pending-disabled state,
  failure state, share-action visibility, and regression coverage for anonymous DOM
  absence and signed-in saved-state behaviour.

### Dedicated favourites destination

- **No longer deferred for design**: Moving saved-output browsing and management from
  the inline game surface to a primary signed-in `#/favourites` destination.
- **Why previously deferred**: The MVP was still a static-first single-flow app, and the
  inline favourites surface was enough to validate saved-output persistence. A separate
  destination introduces navigation hierarchy, tabs, loading and error states, empty
  states, row actions, focus recovery, and account-menu decisions.
- **Revisit trigger satisfied**: Signed-in navigation and profile/account surfaces were
  designed on 2026-06-25 and 2026-06-26 after private Phrase Favourites, Batch
  Favourites, and uploaded Avatar profile editing shipped.
- **Status**: Accepted. Canonical destination, tab, row, expansion, copy/share,
  remove-confirmation, pending-settlement, saved-date, participant-indicator, and
  snapshot rules live in [Signed-in Favourites product
  rules](product-rules.md#signed-in-favourites). The backlog now records implementation
  readiness and deferred follow-up ideas rather than restating the full UI contract.
- **Implementation risk**: The implementation plan still needs to define the code-level
  removal of current inline saved-collection browsing from Play/Reveal, `#/favourites`
  route mounting, parallel list loading, list-specific retries, newest-first full-list
  query/render contracts, row-local live status, Share Consent checks,
  participant-indicator truncation, accessible labels, programmatic focus targets,
  expanded Batch Favourite state, pending removal unmount/inactive-tab settlement, and
  regression coverage for anonymous DOM absence and stable hash routing.
- **True follow-ups**: Pagination/search, duplicate grouping, source-game/reveal links,
  original reveal date reconsideration, date localisation, participant avatars, and a
  saved-count badge remain deferred in the dedicated backlog entries below.

### Favourites pagination and search

- **Deferred for first dedicated Favourites slice**: Pagination, `Load more`, search,
  filtering, and visible item limits for `#/favourites`.
- **Why deferred**: There is no established favourite-volume problem yet, and adding
  list navigation now would complicate removal, single-row expansion, independent tab
  retries, and first-slice regression coverage.
- **Revisit when**: Real saved-output volume, local performance testing, or user
  feedback shows that full returned favourite lists are too slow or hard to scan.
- **Remaining risk**: Very large favourite collections could make the first dedicated
  destination slower or harder to browse until a later pagination/search slice is
  designed and implemented.

### Favourites duplicate grouping

- **Deferred for first dedicated Favourites slice**: Merging, grouping, collapsing, or
  otherwise visually combining saved favourites that have identical phrase text or
  identical batch phrase lists but come from different revealed output snapshots.
- **Why deferred**: Exact revealed snapshot matching treats those rows as distinct saved
  outputs, and first-slice `#/favourites` already has saved date and participant
  indicators for row context. Duplicate grouping would add grouping rules,
  expanded-state interactions, removal semantics, copy/share payload questions, and
  extra regression cases before there is evidence that duplicate-looking rows are a real
  usability problem.
- **Revisit when**: User feedback, QA, or real saved-output volume shows that
  duplicate-looking saved favourite rows are confusing or hard to scan, especially after
  search, filtering, or pagination is introduced.
- **Remaining risk**: Participants may see visually similar favourite rows and wonder
  why they repeat until a later grouping affordance can explain shared text alongside
  distinct saved dates, participants, and revealed snapshots.

### Favourites source-game links

- **Deferred for first dedicated Favourites slice**: Linking a Phrase Favourite or Batch
  Favourite row back to the original Game, Reveal, completed-history entry, or source
  context that produced the saved snapshot.
- **Why deferred**: The first dedicated Favourites destination treats favourites as
  snapshot-only saved-output rows. Source-game links would require a clearer shared
  model between completed-game history and favourites, including route targets, access
  control, deleted/anonymised participant handling, multiplayer visibility, behaviour
  when the source game is no longer available, and whether original reveal date should
  appear alongside or instead of favourite saved date.
- **Revisit when**: Completed-game history and favourites have a shared navigation
  model, or user feedback shows participants expect saved favourites to act as entry
  points back into the original game or reveal. Revisit original reveal date display as
  part of that source-game/reveal link design.
- **Remaining risk**: Participants cannot jump from a favourite row back to the source
  game/reveal in the first slice, and they see favourite saved date rather than original
  reveal date, so saved date and participant indicator must carry enough context for
  browsing until source links and reveal-date display are designed.

### Favourites date localisation

- **Deferred for first dedicated Favourites slice**: Localising Favourite row date text,
  month names, or date order to browser locale or user-selected UI language.
- **Why deferred**: The first slice uses fixed UK English `D Mon YYYY` text for
  predictable layout and tests while the participant's browser timezone still controls
  which calendar date is displayed. The app does not yet have a broader multi-language
  UI model.
- **Revisit when**: The app introduces multi-language UI/localisation support,
  user-selected UI language settings, or user feedback shows that fixed UK English
  Favourite row dates are confusing.
- **Remaining risk**: Participants using non-English browser locales will still see UK
  English month abbreviations in Favourite rows until localisation is designed.

### Compact Batch Favourite participant avatars

- **Deferred for first dedicated Favourites slice**: Requiring Avatar images in the
  compact Batch Favourite participant indicator.
- **Why deferred**: Text-first labels from the saved batch snapshot communicate
  participant context without adding data-loading, snapshot-shape, or row-density scope
  to the first Favourites destination implementation.
- **Revisit when**: Saved batch snapshots consistently expose Avatar descriptors for the
  relevant participants, or QA shows the text-first participant indicator is not clear
  enough in compact rows.
- **Remaining risk**: Text-only participant indicators may feel less visually rich and
  need careful truncation, disambiguation, and accessible labelling.

### Signed-in navigation Favourites heart

- **Accepted for signed-in navigation design**: `Play` and `Favourites` stay visible as
  primary signed-in navigation controls rather than moving behind a hamburger or generic
  menu button. `Favourites` may be denoted by a Font Awesome Classic Solid `heart` icon
  instead of visible `Favourites` text on any device.
- **Why**: `Play` is the Game Mode selector and `Favourites` is a primary saved-output
  destination, so hiding either behind a generic menu would make the first signed-in
  navigation shape feel less direct. A heart icon is widely understood as a
  saved/favourite affordance and lets the destination stay prominent without
  overcrowding the header.
- **Status**: Accepted on 2026-06-26 as part of signed-in navigation design. The
  `Favourites` nav heart keeps accessible name `Favourites`; when icon-only, it shows a
  lightweight hover/focus tooltip with the text `Favourites`. The nav heart uses stable
  icon style; active route state is shown through nav-control styling and
  `aria-current`, not by switching the nav icon between regular and solid styles.
  Regular-vs-solid heart changes remain reserved for item-level favourite actions: Font
  Awesome Classic Regular `heart` means the item is not currently a favourite, and Font
  Awesome Classic Solid `heart` means it is already a favourite. Do not show a
  saved-count badge on the `Favourites` nav heart in the first slice; saved counts are
  not urgent notifications, and the dedicated destination tabs own saved-output loading,
  empty, and error state after the participant chooses Favourites. The Notifications
  bell remains a utility control and the account affordance remains the identity
  control; `Play` and account menus may open as full-width mobile popovers or sheets on
  narrow screens. Implementation still needs an owning PRD and agent-sized issues before
  code changes.
- **Remaining risk**: The implementation plan still needs mobile-safe hit areas,
  active-route styling, full-width mobile menu behaviour, and browser coverage for
  narrow viewport layout without overlap or horizontal overflow.

### Favourites saved-count badge

- **Deferred for first signed-in navigation slice**: Showing a saved-count badge on the
  `Favourites` nav heart.
- **Why deferred**: Saved counts are not urgent notifications, and a badge would force
  account-scoped favourite-count loading into the global header before the participant
  opens `#/favourites`.
- **Revisit when**: Participants accumulate enough saved output that a count materially
  improves navigation or orientation, and the app has an accepted lightweight
  count-loading contract.
- **Remaining risk**: Participants cannot see their saved-output volume from the global
  header in the first slice; the dedicated destination tabs remain the place where
  loading, empty, and error states explain the collection.

### Signed-in Account Profile management surface

- **No longer deferred**: A signed-in profile/account UI for viewing and editing the
  current Gamer Name, Handle, and preset Avatar.
- **Why previously deferred**: The shipped Account shell created and loaded a durable
  Account Profile and showed the game-facing Handle, while the broader profile/account
  surface design depended on signed-in navigation choices that were not needed to prove
  the Account Profile, Handle Directory, signed-in solo, private-favourites, or first
  multiplayer foundations.
- **Revisit trigger**: Satisfied on 2026-06-22 when the owner explicitly brought the
  slice forward for comprehensive PRD specification before TDD implementation.
- **Status**: Completed on 2026-06-22. PR #62 merged #47 to `main` as
  `586bcb2eb093dc95c49f5a59ccf1e92329df4876`, then promoted through `dev`, `test`, and
  production after owner approvals. Visible browser smoke on `dev` and `test` confirmed
  the signed-in Profile editor, stamped assets, no mobile overflow, clean console logs,
  and no hosted profile-save mutation. Production smoke confirmed stamped assets,
  anonymous-mode absence of profile editor DOM, hosted sign-in controls, no mobile
  overflow, and clean console logs. GitHub issues #47 and parent #43 are closed as
  completed.
- **Account-menu placement**: Accepted as part of signed-in navigation design on
  2026-06-25. Profile editing, Avatar editing, and sign-out belong under an account
  affordance built from the signed-in Account's game-facing identity; `Profile` and
  `Sign out` should not be primary signed-in navigation items. The first account menu
  contains only `Profile`, `Avatar`, and `Sign out`; do not add `Favourites`, completed
  history, notifications, settings, or social/profile-public links to the account menu
  in this slice.
- **Account-affordance display**: Accepted as part of signed-in navigation design on
  2026-06-26. The account affordance is avatar-first: the signed-in Avatar is the stable
  visual target, the Handle may be shown beside it when space allows, and narrow layouts
  may use an avatar-only button with an accessible name such as `Account menu for
  @handle`.
- **Account-menu icons**: Accepted as part of signed-in navigation design on 2026-06-26.
  Use the Font Awesome `circle-user` icon for `Profile`, the Font Awesome `image` icon
  for `Avatar`, and the Font Awesome `arrow-right-from-bracket` icon for `Sign out`.
- **Focused editor entry points**: Accepted as part of signed-in navigation design on
  2026-06-26. `Profile` and `Avatar` open separate focused editor views or panels:
  `Profile` focuses Gamer Name and Handle editing, while `Avatar` focuses Avatar
  selection, upload, and cropping. They may share implementation behind the scenes, but
  the account menu labels should take participants directly to the relevant task.
  Opening either panel should not change the current hash route; the panel should close
  back to the same route.
- **Unsaved editor confirmation**: Accepted as part of signed-in navigation design on
  2026-06-26. Closing a `Profile` or `Avatar` panel with unsaved edits should require
  confirmation. The confirmation actions are `Save` with the Font Awesome `floppy-disk`
  icon, `Discard` with the Font Awesome `trash-can` icon, and `Cancel` with the Font
  Awesome `circle-left` icon when returning to the edit panel. If the participant tries
  to sign out while the editor has unsaved changes, use the same confirmation before
  sign-out proceeds: `Save` saves first and then signs out, `Discard` discards edits and
  then signs out, and `Cancel` returns to the editor and keeps the participant signed
  in.
- **Remaining risk**: Uploaded avatar images are now implemented through #63 / PR #74,
  browser-generated circular crop derivatives through #64 / PR #78, and the visual
  cropper through #79 / PR #92. The accepted account-menu placement still needs an
  owning PRD and agent-sized implementation issues, including avatar-first responsive
  display, menu states, mobile behaviour, keyboard/focus behaviour, focused Profile and
  Avatar panel behaviour without hash-route changes, unsaved-edit confirmation
  behaviour, sign-out-with-unsaved-edits sequencing, menu item and confirmation icon
  styling, sign-out cleanup coverage, accessible avatar-only labelling, and regression
  coverage for anonymous DOM absence.

### Phrase reactions

- **Deferred**: Laugh and like reactions for shared phrases.
- **Why deferred**: Reactions are most useful once phrases appear in public discovery
  surfaces; MVP uses private favourites and plaintext external sharing instead.
- **Revisit when**: Public feed or leaderboards are being implemented.
- **Remaining risk**: Phrase storage should leave room for reaction counts without
  making reactions part of MVP completion.

### Leaderboard timezone rule

- **Deferred**: Choosing the canonical timezone for today, this week, and this month
  leaderboard windows.
- **Why deferred**: The product shape can be agreed before implementation chooses
  whether windows use UTC, viewer-local time, or a project-defined timezone.
- **Revisit when**: Leaderboard persistence, querying, or caching is designed.
- **Remaining risk**: Date-window code must not ship without a clear timezone rule.

### Pending invite expiry duration

- **Previously deferred**: Choosing the fixed duration after which Pending Game invites
  expire.
- **Why it was deferred**: The lifecycle rule was clear, but the exact duration was a
  product tuning value.
- **Status**: Accepted on 2026-06-23 as seven days after Pending Game creation. ADR
  `0017` records the durable lifecycle boundary: `public.pending_games.expires_at` is
  the source timestamp, browser DTOs derive an effective `expired` display state,
  expired invites remain visible to relevant creators and invitees, expired invites are
  no longer accept/decline/start/cancel actionable, and the MVP does not add an expiry
  cron job or expiry notifications.
- **Remaining risk**: Future notification cadence or scheduled persistence of `status =
  'expired'` is separate scope.

### Multiplayer destination placement

- **Accepted for signed-in navigation design**: Selecting `Multiplayer` from `Play`
  opens a single signed-in Multiplayer destination that owns invite creation, active
  multiplayer dashboard buckets, and the completed-history entry point.
- **Why**: Invite creation, active turns, dashboard buckets, and completed multiplayer
  history are one game lifecycle. A separate primary `History` nav item or account-menu
  history item would split that lifecycle and make completed multiplayer records feel
  like a settings/account surface rather than game state.
- **Status**: Accepted on 2026-06-25 as part of the signed-in navigation design. The
  first implementation should expose this destination at `#/play/multiplayer` inside the
  static single-page app. Implementation still needs an owning PRD and agent-sized
  issues before code changes.
- **Remaining risk**: Until implemented, the current single-flow app may keep exposing
  multiplayer through inline panels and completed-history links without a coherent
  signed-in navigation destination. The implementation plan still needs lightweight
  hash-route view-switching mechanics, mobile `Play` menu behaviour, preservation of
  existing completed-history contracts, and regression coverage for anonymous/signed-in
  separation.

### Notification top-bar affordance

- **Accepted for signed-in navigation design**: In-App Notifications remain a persistent
  signed-in top-bar utility beside the account affordance rather than living under
  `Play`, `Multiplayer`, `Favourites`, or the account menu.
- **Why**: Notifications cut across game modes and account surfaces, while many
  actionable notifications deep-link into Multiplayer. A persistent utility keeps the
  unread state visible without promoting notifications into primary navigation.
- **Icon and badge rule**: Replace the exclamation-mark placeholder with the Font
  Awesome Classic `bell` icon. Use Classic Solid when the Account has new or unread
  notifications, and Classic Regular when there are no new or unread notifications. When
  the unread count is greater than zero, show a numeric badge capped visually at `9+`;
  the accessible label should include the actual unread count.
- **Panel ordering**: Accepted on 2026-06-26 as part of the signed-in navigation design.
  The notification panel lists unread items first, then read items, newest first within
  each group.
- **Item selection behaviour**: Accepted on 2026-06-26 as part of the signed-in
  navigation design. Selecting a notification item should close the notification panel,
  mark that item read, and navigate to its relevant destination when one exists, such as
  `#/play/multiplayer` for invite, turn, or nudge notifications. Notifications without a
  concrete target should mark read and leave the current route unchanged.
- **Status**: Accepted on 2026-06-25 as part of the signed-in navigation design. The
  first signed-in navigation slice is item-level only and does not include a `Mark all
  read` notification action. Implementation still needs an owning PRD and agent-sized
  issues before code changes.
- **Remaining risk**: Until implemented, notification affordance semantics and icon
  state may remain inconsistent with the accepted signed-in navigation model. The
  implementation plan still needs unread-state derivation, badge cap rendering,
  accessible label/status copy with actual unread count, unread-first/newest-first panel
  ordering, focus/dropdown behaviour, notification selection sequencing, read-state
  failure handling, mobile layout, and regression coverage for signed-in-only
  notification UI.

### Notification bulk read management

- **Deferred**: A `Mark all read` or equivalent bulk notification management action.
- **Why deferred**: The first signed-in navigation slice should prove notification
  placement, bell unread state, item selection, mark-read sequencing, and target
  navigation before adding another mutation path.
- **Revisit when**: Notification volume creates repeated user friction, manual QA shows
  item-by-item read handling is too slow, or additional notification categories make
  bulk management necessary.
- **Remaining risk**: If notification volume grows quickly, users may need to clear
  multiple stale notifications one at a time until this is implemented. Future
  implementation should preserve signed-in-only DOM absence, read-state failure
  handling, and accessible status feedback.

### Phrase image generation

- **Deferred**: Generating an image from a completed phrase.
- **Why deferred**: Image generation is likely to incur LLM or image-model API costs and
  should be designed as a premium or paid feature rather than part of the free core
  loop.
- **Revisit when**: The product has account, billing, moderation, and sharing
  foundations strong enough to support paid generated media.
- **Remaining risk**: Phrase sharing and favourites should avoid assuming that phrases
  are text-only forever.

### Public share links

- **Deferred**: Public or permalink URLs for externally shared phrases or batches.
- **Why deferred**: Public URLs add access control, revocation, indexing, moderation,
  and consent-state complexity, while plaintext sharing is enough for the MVP external
  sharing flow.
- **Revisit when**: Players need durable web links for shared phrases or batches outside
  the in-app feed and leaderboards.
- **Remaining risk**: External sharing code should avoid assuming plaintext is the only
  possible share artifact forever.

### Web Share API

- **Deferred**: Native device/browser share-sheet integration using the Web Share API.
- **Why deferred**: Clipboard copy is simpler, more predictable, and easier to test for
  MVP; Web Share support varies by browser and device.
- **Revisit when**: Plaintext copy formatting is stable and mobile sharing needs a
  native share-sheet flow.
- **Remaining risk**: Sharing code should keep plaintext formatting separate from the
  delivery mechanism so Web Share can be added later.

### Celebratory reveal effects

- **Deferred**: Heavy reveal animation, confetti, or other celebratory effects.
- **Why deferred**: MVP should keep reveal readable and focused on the phrase content,
  with only subtle transitions if needed.
- **Revisit when**: The core reveal flow is tested and needs more delight without
  harming readability.
- **Remaining risk**: Reveal UI should leave room for optional animation without
  depending on it.

### Custom keyboard shortcuts

- **Deferred**: App-specific keyboard shortcuts for faster entry, dice use, navigation,
  or reveal.
- **Why deferred**: Standard form navigation is enough for MVP and keeps mobile and
  accessibility behaviour simpler.
- **Revisit when**: Repeated desktop play shows clear speed or ergonomics needs.
- **Remaining risk**: Form and button structure should not block future shortcut
  handling.

### Cloudflare Access allow-list documentation

- **Deferred**: Recording the exact allowed GitHub users or teams for `dev` and `test`
  Cloudflare Access policies.
- **Why deferred**: Dev/test environments have been created, configured, and tested, but
  the exact allow-list was not provided in this thread.
- **Revisit when**: The configured Cloudflare Access allow policies are available for
  documentation.
- **Remaining risk**: Runtime access reviewers and GitHub Environment deployment
  approvers may be confused if the Access allow-list remains undocumented.

### Main branch protection ruleset

- **No longer deferred**: Creating an active GitHub repository ruleset that targets
  `main` and blocks direct, unchecked mutation of the default branch.
- **Why it was deferred**: The repository warning was investigated on 2026-06-25 and
  GitHub reported no repository rulesets plus `Branch not protected` for `main`.
  Enabling protection changes the source-review boundary and needed an explicit owner
  approval plus an unambiguous required status-check name.
- **Status**: Implemented on 2026-06-25. ADR `0009` records the durable boundary: `main`
  is protected by the `Protect main` repository ruleset, deletion and non-fast-forward
  pushes are blocked, updates must arrive through pull requests, review threads must be
  resolved, and `CI / Verify static site` must pass with latest-code policy before
  `main` can be updated.
- **Remaining risk**: The first ruleset intentionally requires zero approving reviews
  because this is currently a user-owned solo repository. Before adding maintainers or
  relying on human code review as a control, revisit the ruleset to require at least one
  approval and add CODEOWNERS where useful.

### Privacy-preserving telemetry

- **Deferred**: Minimal internal event logging or analytics for product learning.
- **Why deferred**: The first anonymous solo slice can be validated manually, and
  telemetry should wait until privacy, consent, and dev/test/production environment
  boundaries are clear.
- **Revisit when**: Product decisions require usage data that cannot be gathered through
  manual testing or direct feedback.
- **Remaining risk**: App structure should not make it hard to add explicit,
  privacy-preserving telemetry later.

### Frontend framework

- **Deferred**: Introducing a frontend framework for app structure, routing, or
  components.
- **Why deferred**: The anonymous solo MVP is small enough for plain static HTML, CSS,
  and JavaScript, and the repository already has a static deployment path.
- **Revisit trigger reviewed**: Signed-in navigation routing was reviewed on 2026-06-25.
  The accepted first pass uses lightweight hash routes inside the existing static
  single-page app: `#/play/solo`, `#/play/multiplayer`, and `#/favourites`. Signed-in
  root or unrecognised hash state defaults to `#/play/solo`.
- **Status**: Still deferred. The accepted signed-in destinations do not yet justify
  framework, server-side routing, or hosting rewrite work. A small plain-JavaScript view
  controller is the preferred first implementation route.
- **Revisit when**: Signed-in routing gains nested route guards, complex shared layout
  state, route-level data loading, reusable component pressure, or backend integration
  complexity that makes plain JavaScript costly.
- **Remaining risk**: Plain JavaScript modules should be structured so a later framework
  migration is possible without rewriting domain logic. Hash-route view selection must
  remain separate from authentication, Account authority, Supabase Row Level Security,
  and any live mutation permission. Browser tests must cover that ordinary route changes
  and `Play -> Solo play` selection preserve an in-progress or revealed Solo Game and do
  not trigger destructive-action confirmations. Navigation tests should also cover that
  the top-level label remains `Play` on both play routes, with the active Game Mode
  marked inside the dropdown.

### One-way following

- **Deferred**: Letting users follow other users without a mutual friend relationship.
- **Why deferred**: Multiplayer invitations, consent, and nudges are clearer when
  friends are mutual accepted relationships.
- **Revisit when**: Public feed, creator discovery, or template publishing needs a
  lightweight subscription model.
- **Remaining risk**: Social graph data should avoid assuming all future relationships
  are mutual.

### Friend relationships

- **Deferred**: Mutual friend relationships and friend-based invite shortcuts.
- **Why deferred**: MVP can support 2-player games through handle invites without
  building the full social graph first.
- **Revisit when**: Players repeatedly invite the same accounts or need a faster
  trusted-player workflow.
- **Remaining risk**: Invite and notification code should avoid assuming all invited
  accounts are friends.

### Signed-in 2-player asynchronous game

- **Deferred**: The first signed-in 2-player asynchronous Game slice, including handle
  invites, Pending Game lifecycle, multi-participant Slot Allocation, Slot Order, Turn
  completion, Reveal, Share Consent, Nudges, and In-App Notifications.
- **Why deferred**: The product needs a working Account, identity, and backend-backed
  persistence boundary before collaborative game state is designed.
- **Revisit when**: Signed-in solo current-game save/resume has passed automated and
  browser smoke verification.
- **Status**: Revisit trigger satisfied on 2026-06-15 after automated tests, hosted
  Supabase lifecycle smoke, `test` smoke, and production smoke passed for the signed-in
  foundation. On 2026-06-16, the durable Account Profile / Handle Directory prerequisite
  and the invite-safe directory authority-boundary correction also reached production
  through PR #45 and PR #48. The remaining profile-management UI work was intentionally
  deferred under GitHub issue #47 and the `Signed-in Account Profile management surface`
  backlog item while the first handle-invite/Pending Game foundation proceeded; on
  2026-06-22, the owner brought that profile-management slice forward, issue #47 became
  the ready-for-agent PRD, and PR #62 later completed and promoted it through
  production. The source-controlled handle-invite Pending Game foundation reached `main`
  through PR #49 as merge commit `497c84f39e6c19ba1c7f2c58a88b76a3967c8f6e`, was
  promoted through `test` and production after owner approval, and
  `supabase/migrations/20260616131908_create_pending_games.sql` was applied to hosted
  Supabase after explicit owner approval as hosted migration
  `20260616141452_create_pending_games`. The signed-in Pending Game creation UI and
  Account-shell repository wiring reached `main` through PR #53 as merge commit
  `d6b40550809f87b35bb2b84686ffd3fae6d62495` and was promoted through `dev`, `test`, and
  production after owner approvals. It uses `createSupabasePendingGameRepository` for
  hosted Supabase and a localhost-only local test fixture for automated browser
  coverage. On 2026-06-17, an explicitly approved production write/cleanup smoke created
  and verified a hosted Pending Game invite, then deleted the Pending Game and temporary
  smoke Auth/Profile fixture. The invite response visibility slice added incoming invite
  visibility, accept/decline response mutation, creator response visibility, and ADR
  `0012` for invite-response authority. Hosted migration `20260617135237
  support_pending_game_invite_responses` was applied after owner approval,
  schema-verified, and smoke-tested in `dev` with accept and decline through the
  invitee-authenticated RLS path. PR #54 merged to `main` as
  `97c64ac455d53a512d870d6fb46b4838b0e7cc6e` and promoted through `test` and production
  by promotion run `27694666076` after owner approvals. Visible `test` and production
  browser smokes passed for stamped assets, hidden localhost-only test controls,
  anonymous reveal, `Copy all`, clean console logs, and no horizontal overflow.
  Production smoke was anonymous-only and did not mutate hosted Supabase data. On
  2026-06-17, branch `codex/started-game-foundation` added the source-controlled Started
  Game foundation locally: accepted Pending Games can be started by the Game Creator,
  `public.games` and `public.game_participants` store the Started Game shell and
  participant snapshots, random default-template Slot Allocation and Slot Order are
  resolved at start time, and ADR `0013` records the conversion authority. On
  2026-06-18, hosted migration `20260618081517 start_pending_game_foundation` was
  applied after explicit owner approval, schema-verified, advisor-checked, and
  smoke-tested in `dev`; cleanup removed the temporary invitee fixture and all smoke
  Pending Game / Started Game rows. PR #55 merged to `main` as
  `22abb6bfd5652adb7b262636e3303fd64141cff3` and was promoted through `test` and
  production by promotion run `27747189569` after owner approvals. Test and production
  smoke confirmed stamped assets, hidden localhost-only test controls, signed-in Account
  shell rendering, Multiplayer invite panel rendering, clean browser logs, no horizontal
  overflow, and production anonymous copy behaviour through a temporary non-mutating
  Playwright context. On 2026-06-18, branch `codex/started-game-turn-submission` added
  source-controlled first Turn storage and submission: `public.game_turns`,
  `public.game_entries`, a narrow `public.submit_started_game_turn(uuid, jsonb)` RPC,
  ADR `0014`, repository tests, migration-surface tests, and local browser smoke
  coverage for submitting the first active Started Game Turn without Reveal. PR #56
  branch commit `aadc524fe88b66d2c9c2ac34eb4b26254df1bc61` was deployed to `dev` after
  owner approval; hosted migration `20260618102626 started_game_turn_submission` was
  applied after explicit owner approval, schema-verified, advisor-checked, and
  smoke-tested in `dev`; cleanup removed the temporary Auth/Profile, Pending Game,
  Started Game, Turn, and Entry rows.
- **Promotion closeout**: PR #56 merged to `main` as
  `46033c134b2e3f10bd7f6d5a57865eebad39cfcd` and promoted through `test` and production
  by promotion run `27754207753` after owner approvals. Visible `test` and production
  smokes confirmed stamped assets, hidden localhost-only test controls, signed-in
  Account shell rendering, reveal, favourites, Multiplayer invite panel rendering, clean
  browser logs, and no horizontal overflow. The promotion smokes were read-only and did
  not mutate hosted Supabase data.
- **Design reset**: On 2026-06-18, the owner approved participant-section multiplayer
  execution as the future model. Participants can work concurrently on their own next
  assigned section, while participant-local section order preserves
  one-section-at-a-time concealment for players assigned multiple sections. ADR `0015`
  supersedes ADR `0014`'s global active-Turn sequencing for future multiplayer work.
- **Participant-section foundation status**: On 2026-06-18, branch
  `codex/multiplayer-execution-redesign` added the source-controlled ADR `0015`
  participant-section foundation locally: participant-local section dashboard buckets,
  section submission, completion-gated participant-scoped Reveal, durable in-app
  notification rows, Supabase adapter methods, migration-surface coverage, and local
  browser smoke coverage. PR #57 commit `f8ef3e1bae66324904f1377f9a86cf3a4b6376f7` was
  deployed to `dev` on 2026-06-19 after owner approval. After explicit owner approval,
  hosted migration `20260619131018 participant_section_multiplayer_execution` and
  corrective migration `20260619132023 fix_multiplayer_reveal_conflict_target` were
  applied to the live Supabase project, schema-verified, advisor-checked, and
  smoke-tested in `dev`. The signed-in smoke created a temporary invitee, verified
  concurrent participant-section submission, final-submitter read completion
  notification, top-bar notification read behaviour, participant-scoped Reveal for both
  participants, and cleanup to zero smoke rows. PR #57 merged to `main` as
  `60b0fe7d169c1b829f50ff97ab62cf1e712d0e97` and promotion run `27833585561` deployed it
  through `test` and production after owner approvals; visible `test` and production
  smokes passed for stamped assets, signed-in Account-backed mode, Notifications, the
  three multiplayer dashboard buckets, hidden localhost-only test controls, clean
  browser logs, and no horizontal overflow.
- **Creator-cancellation source status**: Branch `codex/creator-cancel-multiplayer`
  added source-controlled creator cancellation for Pending Games before start and
  Started Games before Reveal. ADR `0016` records the authority boundary. On 2026-06-19,
  PR #58 was deployed to `dev` after owner approval as runtime commit
  `751f0ad82d26bc56ef282e7bfe76b01c23c77f85`; visible read-only dev inspection confirmed
  stamped runtime assets. After separate explicit owner approval, hosted migration
  `20260619221615 creator_multiplayer_cancellation` applied source migration
  `20260619151000_creator_multiplayer_cancellation.sql`; read-only schema/RPC
  verification passed and a visible dev reload confirmed the signed-in Multiplayer
  loading error cleared. A separately approved signed-in `dev` write/cleanup smoke then
  created a temporary invitee, accepted through authenticated RLS, started and cancelled
  a Started Game through the visible creator UI, verified the `game_cancelled`
  notification and stale `entries_needed` cleanup in hosted SQL, and cleaned all smoke
  rows back to zero. PR #58 merged to `main` as
  `91e855bee56286fb3a7cafdfc5447d2391cce7e7` and promotion run `27851753455` deployed it
  through `test` and production after owner approvals; visible `test` and production
  smokes passed for stamped assets, signed-in Account-backed mode, Notifications, the
  Multiplayer invite panel and three dashboard buckets, hidden localhost-only test
  controls, clean browser logs, and no horizontal overflow. The promotion smokes were
  read-only and did not mutate hosted game data.
- **Pending invite expiry source status**: On 2026-06-23, the Pending invite expiry
  duration slice was selected as the next signed-in multiplayer follow-up. ADR `0017`
  records the seven-day expiry lifecycle, source migration
  `supabase/migrations/20260623151948_pending_game_invite_expiry.sql` adds
  `public.pending_games.expires_at`, and the browser derives an effective `expired`
  state while hiding stale invite actions. PR #72 merged to `main` as
  `791165b97896ebdfb8ee22623ca224272fbb8c64`; hosted migration `20260623161126
  pending_game_invite_expiry` then applied after explicit owner approval, schema
  verification passed, read-only visible `dev` smoke confirmed signed-in `@vhcoder`
  loads the Pending Game panel without the previous invite-load error, and promotion run
  `28039043049` deployed the merge commit through `test` and production with passing
  read-only visible smokes.
- **Nudge timeout foundation source status**: On 2026-06-24, branch
  `codex/nudge-timeout-foundation` added the source-controlled MVP in-app nudge timeout
  foundation. ADR `0018` records the database-owned dashboard-triggered generation
  boundary. Source migration
  `supabase/migrations/20260624103000_nudge_timeout_foundation.sql` adds per-game nudge
  timeout storage, assigned-section availability timestamps, `nudge` in-app notification
  rows keyed by assigned section, private overdue-nudge generation, and a mutating
  dashboard refresh path without granting browser notification insert authority. The
  browser invite form now selects a nudge timeout of 1, 2, 3, or 7 days and carries it
  into Pending and Started Game DTOs. After explicit owner approval, hosted migration
  `20260624094619 nudge_timeout_foundation` applied that source migration. Supabase
  performance advisors then identified that the new
  `in_app_notifications_target_assignment_fk` needed a covering index in FK column
  order; corrective source migration
  `supabase/migrations/20260624104500_fix_nudge_notification_assignment_fk_index.sql`
  and hosted migration `20260624094839 fix_nudge_notification_assignment_fk_index`
  replace the initial single-column assignment index with `(target_assignment_id,
  target_game_id)`.
- **Nudge timeout promotion closeout**: PR #73 merged to `main` as
  `afb06888a9eabe1ae0cd662e63b7fc8bb6e83c40` and promotion run `28091498010` deployed it
  through `test` and production after owner approvals. Visible `test` and production
  smokes confirmed signed-in Account-backed mode for `@vhcoder`, hidden localhost-only
  test controls, the nudge timeout selector with `1 day`, `2 days`, `3 days`, and `7
  days` options and `2 days` selected, the Multiplayer invite panel, three dashboard
  buckets, completed-history link, no horizontal overflow, empty browser warning/error
  logs, stamped top-level and transitive first-party assets at the merge commit, and no
  `__ASSET_VERSION__` placeholder. The promotion smokes were read-only apart from normal
  signed-in session refresh/read checks and did not create, update, nudge, or clean up
  hosted game data.
- **Nudge timeout hosted write/cleanup smoke**: After explicit owner approval on
  2026-06-24, a hosted `test` smoke created a temporary invitee
  `@codex-smoke-nudge-080d57`, Started Game, and backdated current creator assignment
  for `@vhcoder`. The first visible dashboard refresh created exactly one unread `nudge`
  notification for the overdue assignment, and a second refresh did not duplicate it.
  Cleanup removed all smoke Auth/Profile/Directory/Pending Game/Started
  Game/assignment/notification rows, and the final visible `test` reload showed empty
  dashboard buckets, zero unread notifications, no smoke Handle, no horizontal overflow,
  and no browser warning/error logs.
- **Next action**: Promotion-workflow follow-up PR #59 merged to `main` as
  `fde1b5815c718f3904522bcad1dc604e75ae5ccf`; docs-only/source-only `main` pushes now do
  not request `promote.yml`, and manual `test`/production FTPS target checks live in
  `.github/workflows/ftps-preflight.yml`. Completed multiplayer batch history was
  selected after creator cancellation and published as parent PRD issue #65 with
  `ready-for-agent`. First-page child ticket #66 is complete and promoted through
  production via PR #69. Reveal from history child ticket #67 is complete and promoted
  through production via PR #70. Cursor pagination child ticket #68 merged to `main`
  through PR #71, reached `test`, passed a data-backed `test` pagination
  write/verify/cleanup smoke after owner approval, and was promoted through production
  by promotion run `28026481310`. Pending invite expiry PR #72 is merged, the hosted
  expiry migration is applied, and the slice has been promoted through production with
  documented read-only smokes. Nudge timeout foundation PR #73 is merged, its hosted
  migrations are applied, the slice has been promoted through production with documented
  read-only smokes, and the approved hosted `test` overdue-nudge write/cleanup smoke has
  passed. Uploaded Avatar issue #63 has merged to `main` through PR #74 and has been
  promoted through production with a documented functional non-write production smoke.
  Circular mask cropping issue #64 merged through PR #78 and was promoted through
  production with documented dev/test/production smokes and owner-performed upload/crop
  testing. Any future uploaded-avatar write smoke remains separately approval-gated.
- **Legacy Turn cleanup context**: The legacy `public.game_turns` and
  `public.game_entries` precondition checks documented in
  `docs/runbooks/supabase-auth-and-postgres.md` were run read-only on 2026-06-19 and
  both tables had zero rows before hosted participant-section migration application. The
  owner confirmed on 2026-06-19 that the live site has no users yet, so any future
  legacy Turn rows should be treated as smoke-test artefacts unless the owner later
  identifies real user-owned legacy submissions; clean them up only through an
  explicitly approved hosted cleanup route where needed.
- **Scope guardrails**: Keep Share Consent, friends, manual pokes, public discovery,
  broader profile/account UI, and broader social work out of the completed multiplayer
  batch history page unless the owner explicitly expands scope.
- **Remaining risk**: Account and solo persistence models must leave room for
  collaborative history, participant snapshots, consent records, cancellation, and
  account deletion anonymisation.

### Completed multiplayer batch history page

- **Previously deferred**: A full paginated page for a signed-in participant's completed
  multiplayer batch history.
- **Why it was deferred**: The MVP `Batches completed` panel could expose the five most
  recently completed multiplayer batches without introducing routing, pagination, or a
  larger history browsing surface.
- **Status**: Completed on 2026-06-23. Parent PRD issue #65 was implemented through
  child tickets #66, #67, and #68. The first-page history surface was promoted through
  production via PR #69, Reveal from history via PR #70, and cursor pagination via PR
  #71. The hosted pagination migration was applied after owner approval. Promotion run
  `28026481310` deployed PR #71 merge commit `4aa196f4019fce4094acd81ad9fee8660a5e60af`
  through `test` and production after separate GitHub Environment approvals. The first
  observed `dev` and `test` smokes were empty-state only because the signed-in Account
  had zero completed batches; after separate owner approval for hosted `test` data
  mutation, a write/verify/cleanup smoke created 21 temporary completed batches,
  verified cursor pagination and later-page Reveal through the visible `test` browser,
  and cleaned all smoke rows back to zero. The production smoke was read-only and
  confirmed the deployed completed-history empty state, stamped first-party assets, no
  smoke markers, no horizontal overflow, and empty browser warning/error logs.
- **Scope**: Add a signed-in, Account-scoped completed multiplayer history surface
  reachable from the dashboard `Batches completed` panel. The dashboard keeps its
  five-item cap; the history surface lists completed multiplayer batches newest first
  with a clear pagination contract.
- **Boundary**: Preserve participant-scoped Reveal, current Account scoping,
  cancellation exclusion, and anonymous/signed-in separation. Viewing history must not
  reveal phrase text for the current participant before that participant's own Reveal
  action, and must not mutate another participant's Reveal state.
- **Remaining risk**: No accepted scope remains open for this backlog entry. Future
  hosted data mutation still remains separate from deployment approval and requires
  explicit owner approval.

### Manual pokes

- **Deferred**: Letting participants manually poke another participant to take their
  turn.
- **Why deferred**: Automatic nudges are more predictable and reduce the risk of
  participant-triggered notification spam.
- **Revisit when**: Multiplayer engagement needs a participant-initiated reminder
  separate from inactivity timeouts.
- **Remaining risk**: Notification settings should avoid assuming every future game
  reminder is system-scheduled.

### Android app and push notifications

- **Deferred**: A companion Android app and push notification delivery.
- **Why deferred**: MVP notification delivery is in-app only, avoiding mobile app, push
  token, delivery preference, and abuse-control complexity before the core web game is
  proven.
- **Revisit when**: The web app has active multiplayer usage and players need out-of-app
  reminders for invites, consent requests, turns, and nudges.
- **Remaining risk**: Notification models should avoid assuming every notification is
  web-only or in-app-only forever.

### Uploaded Avatars

- **Status**: Source implementation for user-uploaded Account Profile Avatar images
  merged to `main` under #63 through PR #74 and has been promoted through production. On
  2026-06-24, the hosted Supabase `avatars` bucket, uploaded-avatar ownership metadata,
  descriptor columns, and owner-scoped Storage policies were applied after explicit
  owner approval through hosted migration `20260624212005 uploaded_avatar_profile`; the
  branch deployment to `dev` then passed a hosted browser upload/write/reload/restore
  smoke for `@vhcoder`. On 2026-06-25, the approved `test` promotion passed a functional
  browser upload/write/reload/restore smoke for `@vhcoder`, and production promotion
  passed a functional non-write browser smoke for the signed-in Profile Avatar UI.
  Circular mask cropping and derived cropped-image generation merged to `main` under #64
  through PR #78 as `9dc424c965984be016a935391f08500a0f331503` and was promoted through
  production on 2026-06-25 after owner approvals. The post-MVP visual cropper merged
  under #79 through PR #92 as `3529bafcbbfedd9bac9d77266317865c7bb1ad21` and was
  promoted through production on 2026-06-25 after owner approvals and owner acceptance
  in `test`.
- **No longer deferred in #63/#64/#79**: The signed-in Profile editor can select
  Built-in Avatars, validate JPEG/PNG/WebP Uploaded Avatar files, preview them locally,
  operate a visual inline crop editor with a fixed square crop box, drag-to-reposition
  image movement, explicit zoom controls, crop-box markers, transient guide overlay,
  keyboard nudge/zoom support, and Reset crop, upload only a browser-generated derived
  256 x 256 PNG crop on explicit Save profile, persist the Uploaded Avatar descriptor,
  and keep the previous Avatar active on upload or post-upload save failure. The live
  Avatar object remains the derived crop; the uncropped original is not uploaded as the
  live Avatar object, crop coordinates are draft state only, and crop coordinates are
  not persisted as rendering authority.
- **Remaining risk**: Any production uploaded-avatar write smoke remains separately
  approval-gated. The #63/#64 Uploaded Avatar slices intentionally exclude image-content
  moderation, automated safety scanning, human review queues, report queues,
  public-discovery safety workflows, image transcoding, metadata stripping, server-side
  derivative generation, historical-avatar garbage collection, and account-deletion
  media-retention rules. The dev and test smokes left unreferenced generated test
  objects as historical Uploaded Avatars; this is covered by the deliberately deferred
  historical-avatar garbage-collection lifecycle rather than bypassing Supabase Storage
  deletion protections. Revisit Uploaded Avatar retention when completed-game history
  renders uploaded avatars in production or when Account Deletion implementation reaches
  uploaded media; revisit formal metadata stripping and server-side derivative
  generation if uploaded images create privacy, performance, or presentation problems
  beyond the browser-generated #64 crop; revisit moderation and abuse handling before
  Uploaded Avatars appear in public discovery surfaces or if abuse appears in signed-in
  game/profile contexts.

### Multiple gamer profiles

- **Deferred**: Multiple personas or gamer profiles under one account.
- **Why deferred**: MVP attribution, consent, moderation, and notifications are simpler
  with one active gamer profile per account.
- **Revisit when**: Roleplay or persona-specific play becomes a clear user need.
- **Remaining risk**: Account models should avoid merging account identity and gamer
  profile so tightly that personas are impossible later.

### Social profile URLs

- **Deferred**: Adding external social profile URLs to player profiles.
- **Why deferred**: Social links are not needed for play, invites, consent, sharing, or
  leaderboards, and they add moderation, impersonation, privacy, and link-safety work.
- **Revisit when**: Player profiles need richer public identity beyond gamer name,
  handle, and avatar.
- **Remaining risk**: Profile models should leave room for verified or moderated
  external links later.

### Partial or timeout reveal

- **Deferred**: Revealing incomplete batches, partially completed rows, or batches after
  an inactivity timeout.
- **Why deferred**: Completion-gated reveal preserves the payoff of unexpected complete
  phrases.
- **Revisit when**: Abandoned games become common enough that participants need recovery
  options.
- **Remaining risk**: Game state should leave room for abandoned, cancelled, or
  replaced-participant outcomes without treating every non-revealed game as active
  forever.

### Participant replacement

- **Deferred**: Replacing an invited participant who declines or an active participant
  who abandons a game.
- **Why deferred**: Replacement creates edge cases around existing acceptances, setup
  changes, random assignment fairness, and in-progress concealment.
- **Revisit when**: Declined or abandoned games are common enough that recreating or
  cancelling games becomes a poor user experience.
- **Remaining risk**: Game lifecycle state should leave room for participant replacement
  without assuming cancellation is the only possible outcome forever.

### Post-submission correction requests

- **Deferred**: Letting a participant request correction to submitted entries before
  reveal.
- **Why deferred**: Locking entries at turn submission keeps concealment and turn state
  simple, especially once later slots have started.
- **Revisit when**: Real users frequently submit obvious mistakes and need a controlled
  correction flow.
- **Remaining risk**: Entry state should distinguish active-turn drafts from submitted
  locked entries.

### Shareable word packs

- **Deferred**: Sharing or publishing reusable word collections.
- **Why deferred**: Personal word lists may contain private jokes, names, and
  context-sensitive words, while shareable packs need separate privacy, moderation, and
  discovery rules.
- **Revisit when**: Players want reusable themed word collections beyond their own
  private lists.
- **Remaining risk**: Personal word-list code should avoid becoming the only possible
  model for reusable word collections.

### Personal word lists

- **Deferred**: Account-owned reusable word lists with optional entry-kind tags.
- **Why deferred**: MVP already supports manual entry and global word-bank dice
  candidates; personal lists add account-specific storage, tagging UI, privacy, and
  source-selection controls.
- **Revisit when**: Players want to reuse favourite private words across games.
- **Remaining risk**: Entry-assistance code should preserve the distinction between
  global and personal candidate sources.

### Anonymous solo import to signed-in state

- **Deferred**: Automatically or manually importing a current anonymous solo local game
  into signed-in account persistence.
- **Why deferred**: Silent upload would blur the boundary between local anonymous
  recovery and Account-backed persistence; manual import needs explicit user consent and
  conflict handling.
- **Revisit when**: Signed-in save/resume is working and the product introduces sign-in
  prompts around active anonymous games or revealed anonymous batches.
- **Status**: Signed-in save/resume is working as of 2026-06-15. The remaining trigger
  is a product decision to introduce sign-in prompts or explicit import surfaces around
  active anonymous games.
- **Remaining risk**: Visitors may expect a current local game to follow them after
  sign-in, so UI copy must avoid implying migration until an import flow exists.

### Email OTP code entry

- **Deferred**: Six-digit email OTP entry for hosted Supabase Auth.
- **Why deferred**: The first hosted email sign-in path uses Supabase magic links, which
  are enabled by default and avoid extra verification UI. OTP code entry requires
  email-template handling and an additional in-app verification form; Supabase free-tier
  email template customisation changed on 2026-06-03.
- **Revisit when**: Magic-link usability is poor, template customisation is available
  and approved, or production sign-in needs an in-app code-entry fallback.
- **Remaining risk**: Some users prefer typing a code instead of clicking a link, so the
  Auth adapter should keep email sign-in isolated from game persistence to allow an OTP
  path later.

### Additional hosted Auth providers

- **Deferred**: Adding X/Twitter, Facebook, Azure/Microsoft, and Apple as hosted
  Supabase Auth sign-in providers alongside the current Google and email magic-link
  paths.
- **Why deferred**: More providers increase sign-in choice, but each one adds
  provider-console setup, callback/redirect configuration, consent-screen review, secret
  handling, sign-in button design, browser verification, and provider-specific
  maintenance. The MVP should finish deployment and gather sign-in friction evidence
  before expanding the Auth surface.
- **Revisit when**: MVP has deployed and broader onboarding is being prepared, testers
  or users ask for one of these providers, account onboarding friction becomes a
  blocker, or a target audience clearly benefits from a specific provider such as Apple
  for iOS users or Microsoft/Azure for work accounts.
- **Status**: Enhancement issue #89 tracks the post-MVP request. Current Supabase
  documentation lists native social providers for Twitter, Facebook, Azure, and Apple.
  Future implementation must verify current provider docs before planning because
  provider setup, scopes, and dashboard requirements change.
- **Remaining risk**: Until this ships, users who prefer X/Twitter, Facebook,
  Azure/Microsoft, or Apple must use Google or email magic link instead, which may
  reduce account conversion for users who avoid Google or prefer platform-specific
  account identity.

### Branded Supabase Auth domain

- **Deferred with accepted risk**: Replacing the generic `<project-ref>.supabase.co`
  Google OAuth consent/sign-in destination with a branded Crazy Phrases domain or
  equivalent trusted presentation.
- **Why deferred**: The first hosted sign-in slice validated Supabase Auth and signed-in
  persistence using the default Supabase callback domain. A first-party Supabase custom
  domain such as `auth.crazyphrases.com` would provide the strongest trust signal, but
  the owner reviewed the Supabase custom-domain cost implications in more detail on
  2026-06-25 and decided the cost is not suitable for the current project stage.
- **Revisit when**: The project approaches broader public user onboarding, sign-in
  hesitation caused by the Supabase project domain becomes a repeated tester or user
  blocker, Supabase custom-domain pricing or project budget constraints change, a
  lower-cost provider or branding option becomes available, or
  commercial/public-discovery features raise the trust bar.
- **Status**: Hosted Google sign-in has worked end-to-end in `dev`, and the signed-in
  foundation has been promoted through `test` and `production` as of 2026-06-15.
  Production verification on 2026-06-25 reproduced the trust issue: Google displayed
  `egnudphshvqdhrotxrfs.supabase.co` after `Sign in with Google` from Crazy Phrases. ADR
  `0022` records documented deferral with explicit accepted risk. Parent PRD #83 and
  route-selection issue #84 were closed as completed by PR #87; custom-domain
  preparation issue #85 and activation/verification issue #86 were superseded and closed
  as not planned.
- **Remaining risk**: Users may be confused or mistrust the Google prompt saying
  "continue to `<project-ref>.supabase.co`" even though the request was initiated from
  `crazyphrases.com`. This risk is accepted for the current pre-public-onboarding scope
  and must be revisited before broader public onboarding or if it becomes a repeated
  blocker.

### Expanded word-bank source selection

- **Deferred**: Selecting and integrating a comprehensive open-source lexical dataset
  for the default word bank.
- **Why deferred**: A tiny hand-curated seed list can unblock MVP dice-click
  implementation while licensing, parsing, part-of-speech quality, and packaging are
  researched.
- **Revisit when**: The MVP dice feature works with the seed list and needs broader
  candidate variety.
- **Remaining risk**: Word-bank storage should be able to grow beyond a small seed list
  without changing the entry-assistance interface.

### Word-bank family-friendly setting

- **Deferred**: Account setting to toggle family-friendly filtering for generated
  word-bank candidates.
- **Why deferred**: MVP candidate generation is family-friendly by default, and
  account-level content preferences require signed-in settings and broader moderation
  design.
- **Revisit when**: Signed-in settings and expanded word-bank candidate categories are
  implemented.
- **Remaining risk**: Word-bank entries should be taggable for content suitability
  rather than assuming every candidate is family-friendly forever.

### Production word-bank delivery

- **Deferred**: Designing the production delivery path for a large tagged word bank,
  such as a cached candidate endpoint, CDN-hosted entry-kind shards, or edge-backed read
  model.
- **Why deferred**: MVP can use a tiny bundled seed list, while a full lexicon may be
  large enough that bundling or forcing client-side storage would harm load time and
  waste disk space.
- **Revisit when**: The expanded word-bank source is selected and its compressed size,
  parse cost, and runtime access patterns are known.
- **Remaining risk**: Runtime dice-click code should avoid assuming the full word bank
  is available inside the main client bundle.

### Cloudflare deployment cache purge

- **Deferred**: Automating Cloudflare cache purges after successful GitHub Actions
  deployments.
- **Why deferred**: The repository does not currently document or require Cloudflare API
  deployment secrets, and adding cache purge automation needs explicit Cloudflare
  zone/token setup without exposing secrets in the public repository.
- **Revisit when**: Deployed `index.html` remains stale after `.htaccess` cache headers
  are in place, or when Cloudflare API credentials are added to the relevant GitHub
  Environments.
- **Remaining risk**: A browser or Cloudflare edge cache may temporarily serve an older
  HTML shell after a successful FTPS upload until the cache revalidates or is manually
  purged.
