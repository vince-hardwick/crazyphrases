# Backlog

## Index

Use this index to route to the relevant backlog cluster before loading the whole
file. The full entries below remain the authoritative deferral records and
preserve their original history.

| Area | Status | Sections |
| --- | --- | --- |
| Template and template tooling | Deferred | Custom templates; Template favourites; Manual slot allocation and ordering controls; Template visibility rules |
| Game modes and lifecycle | Deferred | CPU-participant games; 3-player games; Live synchronous play; Partial or timeout reveal; Participant replacement; Post-submission correction requests |
| Multiplayer and social graph | Next slice partly unblocked; most social scope deferred | Signed-in 2-player asynchronous game; Pending invite expiry duration; One-way following; Friend relationships; Manual pokes; Android app and push notifications |
| Account, profile, and auth | Profile-management MVP completed; other scope mixed deferred/completed | Signed-in Account Profile management surface; Anonymous solo import to signed-in state; Email OTP code entry; Branded Supabase Auth domain; Uploaded profile pictures; Multiple gamer profiles; Social profile URLs; Auth-gated favourites DOM loading |
| Favourites and saved-output UI | Mixed completed/deferred | Private phrase and batch favourites follow-up slice; Icon-first favourite and copy actions; Dedicated favourites page |
| Sharing, discovery, reactions, and ranking | Deferred | Batch ratings; Friend-only leaderboards; Public feed and leaderboards; Phrase reactions; Leaderboard timezone rule; Phrase image generation; Public share links; Web Share API |
| Word bank and entry assistance | Deferred | Full automatic batch population; User-defined entry kinds; Shareable word packs; Personal word lists; Expanded word-bank source selection; Word-bank family-friendly setting; Production word-bank delivery |
| UI polish | Deferred | Celebratory reveal effects; Custom keyboard shortcuts |
| Operations and platform | Deferred | Cloudflare Access allow-list documentation; Privacy-preserving telemetry; Frontend framework; Cloudflare deployment cache purge |

## Deferred Product Decisions

### Custom templates

- **Deferred**: Creating, publishing, remixing, and discovering custom templates.
- **Why deferred**: A safe template ecosystem requires editor UX, versioning, publishing, moderation, remix lineage, and discovery; the MVP should prove the default-template game loop first.
- **Revisit when**: Default-template play, accounts, sharing, and core social loops are working.
- **Remaining risk**: Game and template data models should preserve the template/version boundaries already documented so custom templates can be added without rewriting game history.

### Template favourites

- **Deferred**: Marking templates as favourites for easier reuse.
- **Why deferred**: MVP uses only the default template, so template favourites do not add value until custom or published templates exist.
- **Revisit when**: Custom template creation, publishing, or discovery is implemented.
- **Remaining risk**: Favourite models should distinguish template favourites from phrase and batch favourites.

### Manual slot allocation and ordering controls

- **Deferred**: Letting the game creator manually allocate sections or manually choose participant-local section order during setup.
- **Why deferred**: MVP default-template setup should stay simple with random Slot Allocation and participant-local section order, while manual controls fit better with later custom template tooling.
- **Revisit when**: Custom templates or repeated player feedback need creator control over who fills which slot and when.
- **Remaining risk**: Game setup should still model resolved allocation and participant-local order separately so manual controls can be added later.

### CPU-participant games

- **Deferred**: Games where one or more slots are filled by CPU participants.
- **Why deferred**: MVP can prove anonymous solo, signed-in solo, and signed-in 2-player play without implementing automated participant behavior.
- **Revisit when**: Players need a low-friction opponent beyond solo play or when entry-candidate generation can support credible CPU turns.
- **Remaining risk**: Participant and provenance models should preserve CPU participant concepts already documented.

### 3-player games

- **Deferred**: Games with three human participants.
- **Why deferred**: MVP focuses on the default 2-player version of the original game while keeping allocation and invitation flows simpler.
- **Revisit when**: 2-player multiplayer is working and players want each default-template slot assigned to a different person.
- **Remaining risk**: Game setup and slot allocation should avoid assuming exactly two human participants forever.

### Live synchronous play

- **Deferred**: Realtime games where all participants are present together and see live turn progress.
- **Why deferred**: The core folded-paper game is turn-based, and asynchronous play avoids presence, realtime update, and connection-state complexity in the first product shape.
- **Revisit when**: Players need a party-room or live-session experience beyond asynchronous invitations and nudges.
- **Remaining risk**: Game state should avoid assuming that asynchronous turn-taking is the only possible execution profile forever.

### Template visibility rules

- **Deferred**: Allowing templates to declare custom visibility rules, such as exposing selected earlier entries to later players.
- **Why deferred**: Classic play can use a simpler concealment rule for the first implementation: players see guidance for their assigned slot and their own entries, but not other players' entries until reveal.
- **Revisit when**: Custom templates need richer play styles that deliberately trade surprise for coherence.
- **Remaining risk**: Early data models and UI flows should avoid assuming that all non-owner entries are always invisible in every future mode.

### Full automatic batch population

- **Deferred**: Automatically filling a whole slot or batch with generated entries.
- **Why deferred**: Per-entry assistance preserves the hidden-contribution game loop, while full auto-fill risks making the product feel like a generic phrase generator.
- **Revisit when**: Solo, CPU, accessibility, or onboarding flows need a faster way to create complete batches.
- **Remaining risk**: Entry-assist interfaces and services should avoid assuming generation can only ever be requested for one entry.

### User-defined entry kinds

- **Deferred**: Letting users create arbitrary entry kinds beyond the built-in vocabulary.
- **Why deferred**: Generation, validation, guidance, and template editing all need predictable categories for the first product shape.
- **Revisit when**: Template creators repeatedly need categories that cannot be represented with the built-in entry kinds.
- **Remaining risk**: Template storage should avoid hard-coding the initial vocabulary so tightly that adding new kinds later requires migrating every template.

### Batch ratings

- **Deferred**: Letting participants rate or react to whole batches.
- **Why deferred**: Phrase reactions are easier to understand, rank, and use in feeds, while batch favourites already cover saving a whole revealed set.
- **Revisit when**: Leaderboard or sharing designs need batch-level scoring rather than phrase-level scoring.
- **Remaining risk**: Reaction and leaderboard code should not assume that phrases are the only possible reaction target forever.

### Friend-only leaderboards

- **Deferred**: Leaderboards scoped to a user's friends.
- **Why deferred**: Friend-only ranking depends on mature social graph behavior and creates edge cases around whose friend network defines the leaderboard.
- **Revisit when**: The friend graph is actively used beyond game invitations and players need smaller social ranking surfaces.
- **Remaining risk**: Leaderboard services should avoid assuming global scope is the only possible scope forever.

### Public feed and leaderboards

- **Deferred**: Public feed, global leaderboards, phrase reactions in public discovery, and related moderation operations.
- **Why deferred**: Public discovery requires consent, safety screening, reporting, moderation, ranking, and abuse handling; MVP should prove the core game loop first.
- **Revisit when**: Default-template games, accounts, handle invites, external sharing, and private favourites are working.
- **Remaining risk**: Sharing, consent, provenance, and reaction concepts should remain available for future public discovery.

### Private phrase and batch favourites follow-up slice

- **No longer deferred**: Private Phrase Favourites and Batch Favourites from the signed-in foundation and solo save/resume PRD.
- **Why deferred**: The first signed-in slice should prove Account identity and current-game persistence before adding saved-output collections.
- **Revisit when**: Signed-in solo current-game save/resume is working in dev/test and the persistence model can distinguish current game state from saved favourites.
- **Status**: Revisit trigger satisfied on 2026-06-15 after the signed-in foundation shipped through production. PRD #33 is published, with implementation tracked by issues #34, #35, #36, and #37. Issues #34, #35, and #36 now have source-controlled local implementation and tests for Phrase and Batch Favourites, including saved-state polish and Account-scoped removal. The private Batch Favourite migration and signed-in `dev` write smoke were completed against hosted Supabase on 2026-06-15 after explicit approval. A follow-up `dev` deployment of the removal-polish branch fixed Supabase `jsonb` snapshot key-order saved-state matching and passed the authorised signed-in hosted smoke for Phrase Favourite and Batch Favourite save, remove, re-save, reload, current-game clear, and cleanup.
- **Remaining risk**: The accepted MVP contract stores immutable saved-output snapshots rather than live current-game references. The remaining private-favourites follow-up is test/production promotion for the completed favourites slices (#37) behind explicit approval gates.

### Auth-gated favourites DOM loading

- **No longer deferred**: Avoid rendering or wiring private favourites UI, favourite action controls, and related client capability until a participant has successfully signed in; remove those DOM nodes and event paths again on sign-out.
- **Why deferred**: The current MVP hides favourites UI when the session is anonymous, but hidden DOM can still be revealed with browser developer tools. The security boundary should remain Supabase Auth and Row Level Security, but the client should not expose account-only affordances in anonymous mode or create any ambiguity about whether favourites work without sign-in.
- **Revisit when**: Private favourites receive another UI/security hardening pass, a dedicated favourites page is introduced, or before broader public onboarding where anonymous users may inspect or manipulate hidden controls.
- **Status**: Completed on 2026-06-16. PR #42 merged to `main` as `055eeee9bbedeff3fce169a2f2406754a8deff6b` after local automated tests, visible local smoke, and approved `dev` deployment verification. The merged commit was promoted through `test` and `production` by the documented GitHub Environment gates. Visible browser smokes on `dev`, `test`, and production confirmed stamped static assets, anonymous reveal with no favourites panel, no Phrase Favourite save controls, no Batch Favourite save controls, no horizontal overflow, and empty browser warnings/errors. Local browser smoke also asserts signed-in Account-backed mode still mounts the minimal favourites surface and sign-out removes account-only nodes.
- **Remaining risk**: Future account-only event paths should keep using Supabase Auth and Row Level Security as the authority and keep anonymous DOM absence covered by browser tests.

### Icon-first favourite and copy actions

- **Deferred**: Replacing text-heavy favourite and copy buttons with conventional icon-first controls, such as an empty star for adding a Phrase Favourite, a filled star for removing one, a list-aware favourite icon for Batch Favourites, and a copy icon for plaintext copy actions.
- **Why deferred**: The current MVP controls are explicit and testable while the signed-in persistence and favourites lifecycle are still being validated. Icon controls need accessibility labels, tooltips, pressed/saved states, and mobile hit-area review before replacing clear text buttons.
- **Revisit when**: Private favourites have completed test/production promotion, or when repeated UI review shows the revealed-batch actions are too visually noisy.
- **Remaining risk**: The revealed phrase and batch surfaces may stay cluttered as more actions are added unless action semantics are consolidated into accessible icon controls.

### Dedicated favourites page

- **Deferred**: Moving the favourites UI from the inline game surface to a separate page or route, accessible from a profile/account dropdown or a top-level navigation item.
- **Why deferred**: The MVP is still a static-first single-flow app, and the inline favourites surface is enough to validate saved-output persistence. A separate favourites page introduces routing, navigation hierarchy, empty/loading states, and account-menu decisions.
- **Revisit when**: Signed-in navigation or profile/account surfaces are introduced, or when the inline game surface becomes crowded after private favourites are promoted.
- **Remaining risk**: Keeping saved favourites inline with the game flow may make the setup and reveal screens feel busier as account-backed features expand.

### Signed-in Account Profile management surface

- **No longer deferred**: A signed-in profile/account UI for viewing and editing the current Gamer Name, Handle, and preset Avatar.
- **Why previously deferred**: The shipped Account shell created and loaded a durable Account Profile and showed the game-facing Handle, while the broader profile/account surface design depended on signed-in navigation choices that were not needed to prove the Account Profile, Handle Directory, signed-in solo, private-favourites, or first multiplayer foundations.
- **Revisit trigger**: Satisfied on 2026-06-22 when the owner explicitly brought the slice forward for comprehensive PRD specification before TDD implementation.
- **Status**: Completed on 2026-06-22. PR #62 merged #47 to `main` as `586bcb2eb093dc95c49f5a59ccf1e92329df4876`, then promoted through `dev`, `test`, and production after owner approvals. Visible browser smoke on `dev` and `test` confirmed the signed-in Profile editor, stamped assets, no mobile overflow, clean console logs, and no hosted profile-save mutation. Production smoke confirmed stamped assets, anonymous-mode absence of profile editor DOM, hosted sign-in controls, no mobile overflow, and clean console logs. GitHub issues #47 and parent #43 are closed as completed.
- **Remaining risk**: The MVP profile-management surface still uses preset Avatar keys only. Uploaded avatar images and circular mask cropping are intentionally deferred to #63 and #64.

### Phrase reactions

- **Deferred**: Laugh and like reactions for shared phrases.
- **Why deferred**: Reactions are most useful once phrases appear in public discovery surfaces; MVP uses private favourites and plaintext external sharing instead.
- **Revisit when**: Public feed or leaderboards are being implemented.
- **Remaining risk**: Phrase storage should leave room for reaction counts without making reactions part of MVP completion.

### Leaderboard timezone rule

- **Deferred**: Choosing the canonical timezone for today, this week, and this month leaderboard windows.
- **Why deferred**: The product shape can be agreed before implementation chooses whether windows use UTC, viewer-local time, or a project-defined timezone.
- **Revisit when**: Leaderboard persistence, querying, or caching is designed.
- **Remaining risk**: Date-window code must not ship without a clear timezone rule.

### Pending invite expiry duration

- **Deferred**: Choosing the fixed duration after which pending game invites expire.
- **Why deferred**: The lifecycle rule is clear, but the exact duration is a product tuning value.
- **Revisit when**: Multiplayer invite UX and notification cadence are designed.
- **Remaining risk**: Pending game state should not assume invites can remain pending forever.

### Phrase image generation

- **Deferred**: Generating an image from a completed phrase.
- **Why deferred**: Image generation is likely to incur LLM or image-model API costs and should be designed as a premium or paid feature rather than part of the free core loop.
- **Revisit when**: The product has account, billing, moderation, and sharing foundations strong enough to support paid generated media.
- **Remaining risk**: Phrase sharing and favourites should avoid assuming that phrases are text-only forever.

### Public share links

- **Deferred**: Public or permalink URLs for externally shared phrases or batches.
- **Why deferred**: Public URLs add access control, revocation, indexing, moderation, and consent-state complexity, while plaintext sharing is enough for the MVP external sharing flow.
- **Revisit when**: Players need durable web links for shared phrases or batches outside the in-app feed and leaderboards.
- **Remaining risk**: External sharing code should avoid assuming plaintext is the only possible share artifact forever.

### Web Share API

- **Deferred**: Native device/browser share-sheet integration using the Web Share API.
- **Why deferred**: Clipboard copy is simpler, more predictable, and easier to test for MVP; Web Share support varies by browser and device.
- **Revisit when**: Plaintext copy formatting is stable and mobile sharing needs a native share-sheet flow.
- **Remaining risk**: Sharing code should keep plaintext formatting separate from the delivery mechanism so Web Share can be added later.

### Celebratory reveal effects

- **Deferred**: Heavy reveal animation, confetti, or other celebratory effects.
- **Why deferred**: MVP should keep reveal readable and focused on the phrase content, with only subtle transitions if needed.
- **Revisit when**: The core reveal flow is tested and needs more delight without harming readability.
- **Remaining risk**: Reveal UI should leave room for optional animation without depending on it.

### Custom keyboard shortcuts

- **Deferred**: App-specific keyboard shortcuts for faster entry, dice use, navigation, or reveal.
- **Why deferred**: Standard form navigation is enough for MVP and keeps mobile and accessibility behaviour simpler.
- **Revisit when**: Repeated desktop play shows clear speed or ergonomics needs.
- **Remaining risk**: Form and button structure should not block future shortcut handling.

### Cloudflare Access allow-list documentation

- **Deferred**: Recording the exact allowed GitHub users or teams for `dev` and `test` Cloudflare Access policies.
- **Why deferred**: Dev/test environments have been created, configured, and tested, but the exact allow-list was not provided in this thread.
- **Revisit when**: The configured Cloudflare Access allow policies are available for documentation.
- **Remaining risk**: Runtime access reviewers and GitHub Environment deployment approvers may be confused if the Access allow-list remains undocumented.

### Privacy-preserving telemetry

- **Deferred**: Minimal internal event logging or analytics for product learning.
- **Why deferred**: The first anonymous solo slice can be validated manually, and telemetry should wait until privacy, consent, and dev/test/production environment boundaries are clear.
- **Revisit when**: Product decisions require usage data that cannot be gathered through manual testing or direct feedback.
- **Remaining risk**: App structure should not make it hard to add explicit, privacy-preserving telemetry later.

### Frontend framework

- **Deferred**: Introducing a frontend framework for app structure, routing, or components.
- **Why deferred**: The anonymous solo MVP is small enough for plain static HTML, CSS, and JavaScript, and the repository already has a static deployment path.
- **Revisit when**: Signed-in state, routing, backend integration, or component complexity makes plain JavaScript costly.
- **Remaining risk**: Plain JavaScript modules should be structured so a later framework migration is possible without rewriting domain logic.

### One-way following

- **Deferred**: Letting users follow other users without a mutual friend relationship.
- **Why deferred**: Multiplayer invitations, consent, and nudges are clearer when friends are mutual accepted relationships.
- **Revisit when**: Public feed, creator discovery, or template publishing needs a lightweight subscription model.
- **Remaining risk**: Social graph data should avoid assuming all future relationships are mutual.

### Friend relationships

- **Deferred**: Mutual friend relationships and friend-based invite shortcuts.
- **Why deferred**: MVP can support 2-player games through handle invites without building the full social graph first.
- **Revisit when**: Players repeatedly invite the same accounts or need a faster trusted-player workflow.
- **Remaining risk**: Invite and notification code should avoid assuming all invited accounts are friends.

### Signed-in 2-player asynchronous game

- **Deferred**: The first signed-in 2-player asynchronous Game slice, including handle invites, Pending Game lifecycle, multi-participant Slot Allocation, Slot Order, Turn completion, Reveal, Share Consent, Nudges, and In-App Notifications.
- **Why deferred**: The product needs a working Account, identity, and backend-backed persistence boundary before collaborative game state is designed.
- **Revisit when**: Signed-in solo current-game save/resume has passed automated and browser smoke verification.
- **Status**: Revisit trigger satisfied on 2026-06-15 after automated tests, hosted Supabase lifecycle smoke, `test` smoke, and production smoke passed for the signed-in foundation. On 2026-06-16, the durable Account Profile / Handle Directory prerequisite and the invite-safe directory authority-boundary correction also reached production through PR #45 and PR #48. The remaining profile-management UI work was intentionally deferred under GitHub issue #47 and the `Signed-in Account Profile management surface` backlog item while the first handle-invite/Pending Game foundation proceeded; on 2026-06-22, the owner brought that profile-management slice forward, issue #47 became the ready-for-agent PRD, and PR #62 later completed and promoted it through production. The source-controlled handle-invite Pending Game foundation reached `main` through PR #49 as merge commit `497c84f39e6c19ba1c7f2c58a88b76a3967c8f6e`, was promoted through `test` and production after owner approval, and `supabase/migrations/20260616131908_create_pending_games.sql` was applied to hosted Supabase after explicit owner approval as hosted migration `20260616141452_create_pending_games`. The signed-in Pending Game creation UI and Account-shell repository wiring reached `main` through PR #53 as merge commit `d6b40550809f87b35bb2b84686ffd3fae6d62495` and was promoted through `dev`, `test`, and production after owner approvals. It uses `createSupabasePendingGameRepository` for hosted Supabase and a localhost-only local test fixture for automated browser coverage. On 2026-06-17, an explicitly approved production write/cleanup smoke created and verified a hosted Pending Game invite, then deleted the Pending Game and temporary smoke Auth/Profile fixture. The invite response visibility slice added incoming invite visibility, accept/decline response mutation, creator response visibility, and ADR `0012` for invite-response authority. Hosted migration `20260617135237 support_pending_game_invite_responses` was applied after owner approval, schema-verified, and smoke-tested in `dev` with accept and decline through the invitee-authenticated RLS path. PR #54 merged to `main` as `97c64ac455d53a512d870d6fb46b4838b0e7cc6e` and promoted through `test` and production by promotion run `27694666076` after owner approvals. Visible `test` and production browser smokes passed for stamped assets, hidden localhost-only test controls, anonymous reveal, `Copy all`, clean console logs, and no horizontal overflow. Production smoke was anonymous-only and did not mutate hosted Supabase data. On 2026-06-17, branch `codex/started-game-foundation` added the source-controlled Started Game foundation locally: accepted Pending Games can be started by the Game Creator, `public.games` and `public.game_participants` store the Started Game shell and participant snapshots, random default-template Slot Allocation and Slot Order are resolved at start time, and ADR `0013` records the conversion authority. On 2026-06-18, hosted migration `20260618081517 start_pending_game_foundation` was applied after explicit owner approval, schema-verified, advisor-checked, and smoke-tested in `dev`; cleanup removed the temporary invitee fixture and all smoke Pending Game / Started Game rows. PR #55 merged to `main` as `22abb6bfd5652adb7b262636e3303fd64141cff3` and was promoted through `test` and production by promotion run `27747189569` after owner approvals. Test and production smoke confirmed stamped assets, hidden localhost-only test controls, signed-in Account shell rendering, Multiplayer invite panel rendering, clean browser logs, no horizontal overflow, and production anonymous copy behaviour through a temporary non-mutating Playwright context. On 2026-06-18, branch `codex/started-game-turn-submission` added source-controlled first Turn storage and submission: `public.game_turns`, `public.game_entries`, a narrow `public.submit_started_game_turn(uuid, jsonb)` RPC, ADR `0014`, repository tests, migration-surface tests, and local browser smoke coverage for submitting the first active Started Game Turn without Reveal. PR #56 branch commit `aadc524fe88b66d2c9c2ac34eb4b26254df1bc61` was deployed to `dev` after owner approval; hosted migration `20260618102626 started_game_turn_submission` was applied after explicit owner approval, schema-verified, advisor-checked, and smoke-tested in `dev`; cleanup removed the temporary Auth/Profile, Pending Game, Started Game, Turn, and Entry rows.
- **Promotion closeout**: PR #56 merged to `main` as `46033c134b2e3f10bd7f6d5a57865eebad39cfcd` and promoted through `test` and production by promotion run `27754207753` after owner approvals. Visible `test` and production smokes confirmed stamped assets, hidden localhost-only test controls, signed-in Account shell rendering, reveal, favourites, Multiplayer invite panel rendering, clean browser logs, and no horizontal overflow. The promotion smokes were read-only and did not mutate hosted Supabase data.
- **Design reset**: On 2026-06-18, the owner approved participant-section multiplayer execution as the future model. Participants can work concurrently on their own next assigned section, while participant-local section order preserves one-section-at-a-time concealment for players assigned multiple sections. ADR `0015` supersedes ADR `0014`'s global active-Turn sequencing for future multiplayer work.
- **Participant-section foundation status**: On 2026-06-18, branch `codex/multiplayer-execution-redesign` added the source-controlled ADR `0015` participant-section foundation locally: participant-local section dashboard buckets, section submission, completion-gated participant-scoped Reveal, durable in-app notification rows, Supabase adapter methods, migration-surface coverage, and local browser smoke coverage. PR #57 commit `f8ef3e1bae66324904f1377f9a86cf3a4b6376f7` was deployed to `dev` on 2026-06-19 after owner approval. After explicit owner approval, hosted migration `20260619131018 participant_section_multiplayer_execution` and corrective migration `20260619132023 fix_multiplayer_reveal_conflict_target` were applied to the live Supabase project, schema-verified, advisor-checked, and smoke-tested in `dev`. The signed-in smoke created a temporary invitee, verified concurrent participant-section submission, final-submitter read completion notification, top-bar notification read behaviour, participant-scoped Reveal for both participants, and cleanup to zero smoke rows. PR #57 merged to `main` as `60b0fe7d169c1b829f50ff97ab62cf1e712d0e97` and promotion run `27833585561` deployed it through `test` and production after owner approvals; visible `test` and production smokes passed for stamped assets, signed-in Account-backed mode, Notifications, the three multiplayer dashboard buckets, hidden localhost-only test controls, clean browser logs, and no horizontal overflow.
- **Creator-cancellation source status**: Branch `codex/creator-cancel-multiplayer` added source-controlled creator cancellation for Pending Games before start and Started Games before Reveal. ADR `0016` records the authority boundary. On 2026-06-19, PR #58 was deployed to `dev` after owner approval as runtime commit `751f0ad82d26bc56ef282e7bfe76b01c23c77f85`; visible read-only dev inspection confirmed stamped runtime assets. After separate explicit owner approval, hosted migration `20260619221615 creator_multiplayer_cancellation` applied source migration `20260619151000_creator_multiplayer_cancellation.sql`; read-only schema/RPC verification passed and a visible dev reload confirmed the signed-in Multiplayer loading error cleared. A separately approved signed-in `dev` write/cleanup smoke then created a temporary invitee, accepted through authenticated RLS, started and cancelled a Started Game through the visible creator UI, verified the `game_cancelled` notification and stale `entries_needed` cleanup in hosted SQL, and cleaned all smoke rows back to zero. PR #58 merged to `main` as `91e855bee56286fb3a7cafdfc5447d2391cce7e7` and promotion run `27851753455` deployed it through `test` and production after owner approvals; visible `test` and production smokes passed for stamped assets, signed-in Account-backed mode, Notifications, the Multiplayer invite panel and three dashboard buckets, hidden localhost-only test controls, clean browser logs, and no horizontal overflow. The promotion smokes were read-only and did not mutate hosted game data.
- **Next action**: Promotion-workflow follow-up PR #59 merged to `main` as `fde1b5815c718f3904522bcad1dc604e75ae5ccf`; docs-only/source-only `main` pushes now do not request `promote.yml`, and manual `test`/production FTPS target checks live in `.github/workflows/ftps-preflight.yml`. Completed multiplayer batch history was selected as the next signed-in multiplayer slice and published as parent PRD issue #65 with `ready-for-agent`. First-page child ticket #66 is complete and promoted through production via PR #69. The remaining child tickets are Reveal from history (#67) and cursor pagination (#68); prefer #67 next unless the owner reprioritises.
- **Legacy Turn cleanup context**: The legacy `public.game_turns` and `public.game_entries` precondition checks documented in `docs/runbooks/supabase-auth-and-postgres.md` were run read-only on 2026-06-19 and both tables had zero rows before hosted participant-section migration application. The owner confirmed on 2026-06-19 that the live site has no users yet, so any future legacy Turn rows should be treated as smoke-test artefacts unless the owner later identifies real user-owned legacy submissions; clean them up only through an explicitly approved hosted cleanup route where needed.
- **Scope guardrails**: Keep invite expiry, Share Consent, friends, nudges, public discovery, broader profile/account UI, and broader social work out of the completed multiplayer batch history page unless the owner explicitly expands scope.
- **Remaining risk**: Account and solo persistence models must leave room for collaborative history, participant snapshots, consent records, cancellation, and account deletion anonymisation.

### Completed multiplayer batch history page

- **Deferred**: A full paginated page for a signed-in participant's completed multiplayer batch history.
- **Why deferred**: The MVP `Batches completed` panel can expose the five most recently completed multiplayer batches without introducing routing, pagination, or a larger history browsing surface.
- **Status**: Selected as the next signed-in multiplayer slice and published as parent PRD issue #65 on 2026-06-22 with `ready-for-agent`. Child implementation ticket #66 for the first-page history surface is complete and was promoted through production via PR #69. Parent PRD issue #65 remains open for #67 Reveal from history and #68 cursor pagination.
- **Scope**: Add a signed-in, Account-scoped completed multiplayer history surface reachable from the dashboard `Batches completed` panel. The dashboard keeps its five-item cap; the history surface lists completed multiplayer batches newest first with a clear pagination contract.
- **Boundary**: Preserve participant-scoped Reveal, current Account scoping, cancellation exclusion, and anonymous/signed-in separation. Viewing history must not reveal phrase text for the current participant before that participant's own Reveal action, and must not mutate another participant's Reveal state.
- **Remaining risk**: Completed-batch storage and list APIs should support Account-scoped pagination rather than hard-coding a five-item-only history model. Hosted schema mutations, if needed, remain live backend mutations and require explicit owner approval or the documented deployment workflow gate.

### Manual pokes

- **Deferred**: Letting participants manually poke another participant to take their turn.
- **Why deferred**: Automatic nudges are more predictable and reduce the risk of participant-triggered notification spam.
- **Revisit when**: Multiplayer engagement needs a participant-initiated reminder separate from inactivity timeouts.
- **Remaining risk**: Notification settings should avoid assuming every future game reminder is system-scheduled.

### Android app and push notifications

- **Deferred**: A companion Android app and push notification delivery.
- **Why deferred**: MVP notification delivery is in-app only, avoiding mobile app, push token, delivery preference, and abuse-control complexity before the core web game is proven.
- **Revisit when**: The web app has active multiplayer usage and players need out-of-app reminders for invites, consent requests, turns, and nudges.
- **Remaining risk**: Notification models should avoid assuming every notification is web-only or in-app-only forever.

### Uploaded profile pictures

- **Deferred**: User-uploaded Account Profile avatar images, tracked by #63, plus circular mask cropping for uploaded avatar images, tracked by #64.
- **Why deferred**: Uploaded images require storage, resizing, moderation, abuse handling, privacy controls, and accessible crop UI decisions that are not needed for the MVP preset-avatar identity surface.
- **Revisit when**: Generated/default or preset avatars are no longer enough for player recognition or social expression, or when #63 is selected as the next profile-personalisation slice.
- **Remaining risk**: Profile UI and Account Profile storage should avoid assuming avatars are always generated or preset keys forever; #64 should remain dependent on or co-designed with #63.

### Multiple gamer profiles

- **Deferred**: Multiple personas or gamer profiles under one account.
- **Why deferred**: MVP attribution, consent, moderation, and notifications are simpler with one active gamer profile per account.
- **Revisit when**: Roleplay or persona-specific play becomes a clear user need.
- **Remaining risk**: Account models should avoid merging account identity and gamer profile so tightly that personas are impossible later.

### Social profile URLs

- **Deferred**: Adding external social profile URLs to player profiles.
- **Why deferred**: Social links are not needed for play, invites, consent, sharing, or leaderboards, and they add moderation, impersonation, privacy, and link-safety work.
- **Revisit when**: Player profiles need richer public identity beyond gamer name, handle, and avatar.
- **Remaining risk**: Profile models should leave room for verified or moderated external links later.

### Partial or timeout reveal

- **Deferred**: Revealing incomplete batches, partially completed rows, or batches after an inactivity timeout.
- **Why deferred**: Completion-gated reveal preserves the payoff of unexpected complete phrases.
- **Revisit when**: Abandoned games become common enough that participants need recovery options.
- **Remaining risk**: Game state should leave room for abandoned, cancelled, or replaced-participant outcomes without treating every non-revealed game as active forever.

### Participant replacement

- **Deferred**: Replacing an invited participant who declines or an active participant who abandons a game.
- **Why deferred**: Replacement creates edge cases around existing acceptances, setup changes, random assignment fairness, and in-progress concealment.
- **Revisit when**: Declined or abandoned games are common enough that recreating or cancelling games becomes a poor user experience.
- **Remaining risk**: Game lifecycle state should leave room for participant replacement without assuming cancellation is the only possible outcome forever.

### Post-submission correction requests

- **Deferred**: Letting a participant request correction to submitted entries before reveal.
- **Why deferred**: Locking entries at turn submission keeps concealment and turn state simple, especially once later slots have started.
- **Revisit when**: Real users frequently submit obvious mistakes and need a controlled correction flow.
- **Remaining risk**: Entry state should distinguish active-turn drafts from submitted locked entries.

### Shareable word packs

- **Deferred**: Sharing or publishing reusable word collections.
- **Why deferred**: Personal word lists may contain private jokes, names, and context-sensitive words, while shareable packs need separate privacy, moderation, and discovery rules.
- **Revisit when**: Players want reusable themed word collections beyond their own private lists.
- **Remaining risk**: Personal word-list code should avoid becoming the only possible model for reusable word collections.

### Personal word lists

- **Deferred**: Account-owned reusable word lists with optional entry-kind tags.
- **Why deferred**: MVP already supports manual entry and global word-bank dice candidates; personal lists add account-specific storage, tagging UI, privacy, and source-selection controls.
- **Revisit when**: Players want to reuse favourite private words across games.
- **Remaining risk**: Entry-assistance code should preserve the distinction between global and personal candidate sources.

### Anonymous solo import to signed-in state

- **Deferred**: Automatically or manually importing a current anonymous solo local game into signed-in account persistence.
- **Why deferred**: Silent upload would blur the boundary between local anonymous recovery and Account-backed persistence; manual import needs explicit user consent and conflict handling.
- **Revisit when**: Signed-in save/resume is working and the product introduces sign-in prompts around active anonymous games or revealed anonymous batches.
- **Status**: Signed-in save/resume is working as of 2026-06-15. The remaining trigger is a product decision to introduce sign-in prompts or explicit import surfaces around active anonymous games.
- **Remaining risk**: Visitors may expect a current local game to follow them after sign-in, so UI copy must avoid implying migration until an import flow exists.

### Email OTP code entry

- **Deferred**: Six-digit email OTP entry for hosted Supabase Auth.
- **Why deferred**: The first hosted email sign-in path uses Supabase magic links, which are enabled by default and avoid extra verification UI. OTP code entry requires email-template handling and an additional in-app verification form; Supabase free-tier email template customisation changed on 2026-06-03.
- **Revisit when**: Magic-link usability is poor, template customisation is available and approved, or production sign-in needs an in-app code-entry fallback.
- **Remaining risk**: Some users prefer typing a code instead of clicking a link, so the Auth adapter should keep email sign-in isolated from game persistence to allow an OTP path later.

### Branded Supabase Auth domain

- **Deferred**: Replacing the generic `<project-ref>.supabase.co` Google OAuth consent/sign-in destination with a branded Crazy Phrases domain such as `auth.crazyphrases.com` or a Google-presented app name/domain that clearly reads as Crazy Phrases.
- **Why deferred**: The first hosted sign-in slice can validate Supabase Auth and signed-in persistence using the default Supabase callback domain, while a branded Auth domain may require Supabase custom-domain setup, DNS changes, certificate validation, and possibly plan/cost checks.
- **Revisit when**: Hosted Google sign-in works end-to-end in dev/test, before production sign-in is promoted for general users, or sooner if the generic Supabase domain materially reduces trust during testing.
- **Status**: Hosted Google sign-in has worked end-to-end in `dev`, and the signed-in foundation has been promoted through `test` and `production` as of 2026-06-15. Review this before broader public user onboarding, because the generic Supabase domain is still visible during Google sign-in.
- **Remaining risk**: Users may be confused or mistrust the Google prompt saying "continue to `<project-ref>.supabase.co`" even though the request was initiated from `crazyphrases.com`.

### Expanded word-bank source selection

- **Deferred**: Selecting and integrating a comprehensive open-source lexical dataset for the default word bank.
- **Why deferred**: A tiny hand-curated seed list can unblock MVP dice-click implementation while licensing, parsing, part-of-speech quality, and packaging are researched.
- **Revisit when**: The MVP dice feature works with the seed list and needs broader candidate variety.
- **Remaining risk**: Word-bank storage should be able to grow beyond a small seed list without changing the entry-assistance interface.

### Word-bank family-friendly setting

- **Deferred**: Account setting to toggle family-friendly filtering for generated word-bank candidates.
- **Why deferred**: MVP candidate generation is family-friendly by default, and account-level content preferences require signed-in settings and broader moderation design.
- **Revisit when**: Signed-in settings and expanded word-bank candidate categories are implemented.
- **Remaining risk**: Word-bank entries should be taggable for content suitability rather than assuming every candidate is family-friendly forever.

### Production word-bank delivery

- **Deferred**: Designing the production delivery path for a large tagged word bank, such as a cached candidate endpoint, CDN-hosted entry-kind shards, or edge-backed read model.
- **Why deferred**: MVP can use a tiny bundled seed list, while a full lexicon may be large enough that bundling or forcing client-side storage would harm load time and waste disk space.
- **Revisit when**: The expanded word-bank source is selected and its compressed size, parse cost, and runtime access patterns are known.
- **Remaining risk**: Runtime dice-click code should avoid assuming the full word bank is available inside the main client bundle.

### Cloudflare deployment cache purge

- **Deferred**: Automating Cloudflare cache purges after successful GitHub Actions deployments.
- **Why deferred**: The repository does not currently document or require Cloudflare API deployment secrets, and adding cache purge automation needs explicit Cloudflare zone/token setup without exposing secrets in the public repository.
- **Revisit when**: Deployed `index.html` remains stale after `.htaccess` cache headers are in place, or when Cloudflare API credentials are added to the relevant GitHub Environments.
- **Remaining risk**: A browser or Cloudflare edge cache may temporarily serve an older HTML shell after a successful FTPS upload until the cache revalidates or is manually purged.
