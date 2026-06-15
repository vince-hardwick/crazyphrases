# Product Rules

## Game Play

### Product language

The product primarily uses UK English in user-facing copy.

Use UK spelling such as "favourite" in user-facing copy and domain documentation. Code identifiers may follow ecosystem conventions when a framework or library strongly favours US spelling, but UI copy should remain UK English.

Do not expose the domain term "slot" in user-facing copy for MVP. Use natural task wording such as "Fill these adjectives" or "Next section" while keeping Slot as the internal/domain term.

For the default template's two noun slots, use neutral user-facing labels only when needed. During play, the active section can say "Fill these nouns"; progress context can use phrasing like "Section 2 of 3" without revealing the remaining resolved order.

### Responsive design

MVP UI is responsive from the start, with mobile as the primary constraint. The same flow should work well on phones and desktop rather than splitting into separate experiences.

### Visual metaphor

MVP may hint at the folded-paper origin of the game, but uses a clean web-form interaction model. Avoid literal skeuomorphic folded-paper UI that harms mobile usability or entry speed.

Folded-paper visual hints must not intersect setup controls. In the anonymous solo MVP setup state before "Start batch", the phrase-count and start controls should appear cleanly without column guide lines running underneath or through them.

### Onboarding

Anonymous solo MVP starts directly in the playable game flow with minimal inline context. A small help icon may reveal a compact explainer section for users who want instructions, but there is no separate tutorial or landing screen before play.

The help explainer includes one short origin sentence: Crazy Phrases was invented by two friends seeking ways to create their own absurd amusement and pass the time in lessons. The rest of the explainer should focus on compact functional instructions.

### Analytics

The first anonymous solo slice does not include third-party analytics, tracking scripts, cookies for analytics, or equivalent telemetry.

### Test coverage

The anonymous solo MVP includes focused tests from the first implementation slice: unit tests for game state, phrase rendering, word selection, concealment, local-storage recovery, reveal, and copy formatting, plus one browser smoke test for the full anonymous solo flow.

### Frontend implementation

The anonymous solo MVP uses plain static HTML, CSS, and JavaScript. A frontend framework is deferred until signed-in state, routing, backend integration, or component complexity justifies it.

Anonymous solo game logic lives in separate JavaScript modules from DOM/UI code. Pure modules handle game state, slot sequencing, phrase rendering, word selection, local-storage serialization, and copy formatting; DOM code stays as a thin adapter.

### Asynchronous play

Games are asynchronous by default. Participants do not need to be present at the same time to complete their slot assignments.

### Game start

A multiplayer game starts only after all invited human participants accept. Before that it remains pending. CPU participants are treated as accepted immediately.

Random slot allocation and random slot order are resolved when the game starts, not when the pending game is created.

If an invited human participant declines, the pending game is cancelled in the MVP.

Pending game invites expire automatically after a fixed period. The exact expiry duration is a product tuning value to be chosen later.

### Slot allocation and order

For games with two or more participants, including games with CPU participants, slot allocation defaults to random. Templates may allow the game creator to manually allocate slots during game setup.

Slot order may also be random or manually configured during game setup when the template allows it. The resolved slot allocation and slot order belong to the game instance so participants have a stable sequence of slot assignments to complete.

If the game creator manually configures slot allocation or slot order, they can see those choices before the game starts. If random slot allocation or random slot order is selected, the resolved allocation or order is stored by the game but not shown to the creator before reveal.

Participants may see their own slot assignments before reveal, but should not see other participants' slot assignments before reveal unless required for invitations or coarse turn status. Turn status may say that the game is waiting for another participant without revealing the entry kind or slot that participant is filling.

When a participant has multiple slot assignments, they complete each assignment only when that slot becomes active in the resolved slot order. Multiple assignments do not merge into one turn.

A turn consists of completing one active slot across every row in the batch. Games do not advance row by row in the first product shape.

For anonymous solo MVP, the active slot is entered through a single vertical form showing all rows for that slot. The participant may fill rows in any order within the active slot, rather than being forced top to bottom. Each row may support manual entry and dice assistance.

The participant cannot submit an active slot until every row in that slot has a non-empty entry.

Anonymous solo MVP relies on standard form navigation. Tab, Shift+Tab, and Enter behaviour should be sensible, but custom keyboard shortcuts are deferred.

### Template mode support

MVP play uses the default template only. Custom template creation, publishing, remixing, and discovery are deferred.

Templates declare the participant counts and game modes they support. Game setup only offers modes supported by the selected template.

The MVP default template is designed for 2-player games.

The MVP default template has three slots: adjective, noun, and noun. It produces one phrase per row. In its default 2-player mode, random slot allocation assigns one participant two slots and the other participant one slot.

### MVP game modes

MVP supports anonymous solo games, signed-in solo games, and signed-in 2-player games. CPU-participant games and 3-player games are deferred.

Anonymous solo games randomize the default template's slot order per game and show only one active slot at a time. The resolved order may remain local to the client for anonymous solo.

Anonymous solo shows the actual active slot kind, such as adjectives or nouns, so the participant knows what to enter. It does not show the remaining slot kinds in their resolved order before they become active.

Anonymous solo includes a "Start again" action. It discards the current local game and returns to phrase-count selection for a new local game with a fresh randomized slot order and empty entries. If the current game has entered values, the action asks for confirmation through in-app UI rather than a browser-native `window.confirm` dialog. During entry, the confirmation uses abandonment language: "Keep playing" or "Discard entries". After reveal, the confirmation uses new-batch language: "View phrases" or "Start new batch".

The MVP default template renders each phrase by concatenating the three entries with spaces, trimming whitespace, collapsing extra spaces, and capitalizing the first character for display. It does not auto-insert articles or punctuation.

For casing, entries that match words in the global word bank use normalized word-bank casing for display. Entries that do not match the global word bank preserve their typed casing, including user-specified non-words or pseudo-words, whether or not they are stored in a personal word list.

Casing normalization affects rendered phrases only. Entries are stored as typed, with word-bank match metadata if needed for display.

For MVP setup, the default template supports configurable row count and nudge timeout. Slot allocation and slot order use the simple default random behavior; manual allocation and ordering controls are deferred.

### Solo concealment

In a solo game, the participant fills one slot at a time and is not shown populated entries from other slots before reveal. Solo play preserves the core fun of unexpected combinations by reducing the participant's ability to make later entries congruent with earlier ones.

### Random entry assistance

Random word generation is an explicit per-entry assist: a participant requests a candidate for one slot and row, then may accept, regenerate, or edit it. Random generation does not automatically populate a full slot or batch in the first product shape.

### Entry kind vocabulary

Templates use a controlled built-in vocabulary of entry kinds. Custom templates may compose supported entry kinds but do not introduce arbitrary new grammar categories in the first product shape.

### Row count

Row count is configured per game. A template may provide a default row count, but the game setup determines the actual number of phrases in the batch.

For the anonymous solo/default-template MVP, row count defaults to 20 phrases, with additional selectable options of 10, 15, 25, and 30.

For the anonymous solo/default-template MVP, row count is selected before entries are made and is locked by starting the batch. Entry controls are hidden until the participant starts the batch. After start, row-count controls are disabled for the current batch; "Start again" is the only action that returns the participant to phrase-count selection.

### Template publishing

Saving and publishing a template are separate actions. A saved template remains private to its creator until they deliberately publish it for wider use.

### Template attribution

Published templates are attributed to the creator's current gamer name and handle, without exposing email addresses or real names. Phrases generated from a template may show template attribution in detail views rather than every compact discovery surface.

### Template remixing

Participants may remix published template versions into their own saved templates. A template remix records lineage to the source template version and original creator; if the remix is later published, that lineage is shown publicly.

### Template versioning

Published templates are versioned. A game uses the template version selected at setup, and existing games or saved batches do not silently adopt later edits to that template.

Each published template change creates a new template version. Older published versions remain available for existing games, saved batches, and template lineage, while discovery shows the latest approved version by default.

Unpublishing a template version removes it from public discovery but does not break existing games, saved batches, favourites, or template lineage. Moderation removals may hide public visibility more aggressively while preserving historical references needed for game integrity.

### Phrase reactions

Phrase reactions apply to individual phrases in the first product shape. The MVP supports laugh and like reactions only; star ratings, downvotes, and batch ratings are not part of the initial reaction model.

Phrase reactions are deferred from MVP while public feed and leaderboards are deferred. Private favourites and plaintext external sharing are the MVP feedback/sharing mechanisms.

### Leaderboard ranking

Leaderboard ranking uses laugh reactions as the primary signal. Like reactions may be shown and used as a secondary tie-break or supporting signal, but the MVP does not use an opaque weighted score.

### Leaderboard scope

MVP leaderboards are global public discovery surfaces. Friend-only leaderboards are not part of the first product shape.

### Leaderboard windows

MVP leaderboards support today, this week, this month, and all-time windows. Implementation must define a canonical timezone rule before these windows are used in production.

### Public sharing

Completed phrases do not enter public discovery surfaces automatically. A phrase may remain private to its participants, be saved as a private phrase favourite, or be deliberately shared.

External sharing is distinct from public discovery. Phrase and batch surfaces may offer device or browser share options such as clipboard, email, WhatsApp, or other available share targets without automatically publishing the content to the in-app feed or leaderboards. MVP external sharing sends plaintext individual phrases or plaintext batches of phrases only.

MVP includes plaintext external sharing and private phrase or batch favourites for signed-in users. Template favourites are deferred until custom templates exist. Public feed and leaderboards are deferred.

External sharing and plaintext copying are available only after reveal, for completed phrases or completed batches.

Anonymous solo MVP provides per-phrase copy and copy-all actions after reveal. Both copy plaintext only.

Per-phrase copy copies only that phrase text. Copy-all includes a short title followed by non-numbered phrase lines separated by line breaks.

MVP uses clipboard copy for plaintext phrase and batch sharing. Web Share API integration is deferred as a later progressive enhancement.

Clipboard copy should use the browser Clipboard API when available, and fall back to a temporary plaintext selection/copy path when that API is unavailable or blocked. If the browser exposes no usable copy mechanism, the UI should report that copy is unavailable rather than silently claiming success.

### Public safety

Shared phrases and published templates become eligible for public discovery only after automated safety screening. Published public content can be reported by participants and handled through later human or admin review for edge cases. Private saved templates remain outside public discovery.

### Feed

The main public feed is a random discovery surface for shared phrases. Ranked discovery belongs to leaderboards, and chronological timeline behavior is not part of the MVP feed.

### Phrase provenance

Public feeds and leaderboards may include shared phrases involving human participants, CPU participants, and accepted entry candidates. Public discovery must show clear provenance labels for those sources. Leaderboard viewers may optionally filter out phrases involving CPU participants, but that filter is not enabled by default.

### Share consent

Any human participant may propose sharing a completed phrase, but public sharing requires consent from every human participant in that game. CPU participants do not grant or withhold share consent.

External sharing of phrase or batch content from a multiplayer game also requires consent from every human participant in that game. Solo games do not require additional share consent.

Anonymous solo games may use plaintext external sharing because there are no other human participants to consent. Anonymous solo games still do not support persistence, public feed publishing, leaderboards, or account-linked favourites unless the participant signs in.

### Participant attribution

Public discovery may show the gamer names of human participants after share consent, but must not expose email addresses, real names, or authentication identities. CPU participants are shown using their configured display names. Participant attribution should use intuitively understood icons to distinguish CPU participants from human participants.

### Account requirement

Anonymous play is allowed only for local solo games. User accounts are required for multiplayer, persistence, friends, favourites, ratings, template publishing, public sharing, consent, moderation, and notifications.

MVP authentication may use simple provider-backed sign-in, including social login. MFA and passkeys are deferred unless the chosen auth provider offers them as hosted or low-code features that do not complicate the core game flow.

### Game persistence

Signed-in solo games can be saved and resumed. Anonymous solo games are local and ephemeral. Multiplayer in-progress state is persisted because multiplayer requires accounts, invites, and turns.

Signed-in solo persistence stores the current signed-in Solo Game as backend-backed state by Account. Browser local storage is not the authority for signed-in game state.

Anonymous solo local recovery and signed-in account persistence are separate lifecycle paths. Signing in must not silently upload or import a current anonymous local game. Explicit import from anonymous solo to signed-in state is a later product decision.

The first signed-in solo persistence slice stores the current signed-in Solo Game rather than a full signed-in game-history browser. A revealed signed-in solo batch remains resumable as the current game until the participant starts again. Private Phrase Favourites and Batch Favourites are separate saved-output features.

Only started signed-in Solo Games are persisted as account-backed current-game state. In signed-in solo, confirmed "Start again" clears the account-backed current-game record and returns the participant to phrase-count selection for a fresh local setup. The next account-backed current-game record is created when the participant starts the next batch. Reloading after confirmed "Start again" but before starting the next batch must not restore the old revealed signed-in batch.

Signed-in solo save/resume should prevent stale clients from silently overwriting newer account-backed progress, using a revision, version, or equivalent concurrency rule.

If signed-in solo current-game loading fails, the participant remains signed in,
the app shows a retry path, and any start-new path must not silently delete or
overwrite remote account-backed state. If account-backed saving fails, the app
must visibly warn that progress may not be saved. If a stale browser or session
attempts to save over newer account-backed progress, the app must report the
conflict rather than silently overwriting the newer state.

MVP anonymous solo is a client-only experience using manual entry and the tiny bundled seed word bank. It does not require account state, backend persistence, invite state, or server-side word-bank access.

The first implementation is static-first for anonymous solo, with a clear backend boundary for signed-in features. Accounts, signed-in persistence, multiplayer, invites, consent, and private favourites require backend-backed state rather than static hosting alone.

Anonymous solo progress may be preserved in browser local storage for refresh recovery and convenience. This is not durable account persistence, does not sync across devices, and may be cleared by the browser or by "Start again".

Local-storage recovery restores the same anonymous solo game state, including randomized slot order and entered values. Refreshing the page does not generate a new slot order.

Anonymous local storage keeps only the current or latest anonymous game, including its revealed state if completed. It does not maintain anonymous game history; "Start again" replaces the old local game.

The anonymous solo recovery record uses the browser local-storage key `crazyphrases.anonymousSolo.currentGame.v1`. Version `v1` stores only the current or latest anonymous solo game payload and may be ignored by the client if the payload is malformed, incompatible, or not an anonymous solo game.

Anonymous solo MVP should replace the homepage in dev and test environments during review, while production keeps the holding page until the slice is accepted for production promotion.

### Account deletion

Account deletion deactivates or anonymizes the account identity while preserving completed game history, shared phrases, consent records, leaderboard integrity, and template lineage where needed. Personal/private data such as personal word lists should be deleted.

Signed-in solo current-game state is personal/private working state rather than completed collaborative history. It should be deleted when the Account is deleted, and it may also be cleared by the participant's signed-in solo "Start again" flow. Future collaborative game history remains governed by the preservation and anonymization rules in this section.

Public attribution for a deleted account shows "Deleted user" and removes the old gamer name and handle from public surfaces. Collaborative records may still indicate that a deleted participant or creator existed.

Prior share consent from a deleted account remains valid for content that was already shared before deletion, unless the account explicitly unshared or reported the content before deletion. Deleted accounts cannot grant new share consent.

Any human participant in the original game can unshare a shared phrase, removing it from public discovery going forward. Unsharing does not delete the phrase from participants' private game history or favourites.

### Player identity

Accounts have a globally unique handle for discovery, mentions, profile URLs, and disambiguation. Gamer names are changeable display names used in games and social surfaces.

MVP profiles use gamer name, handle, and a generated/default avatar or a modest gallery of preset avatar assets. Uploaded profile pictures are not part of the first product shape.

MVP accounts have one active gamer profile. Multiple personas or profiles per account are deferred.

Completed games snapshot the participant gamer name and avatar display used at the time of play. Current profiles and new games use the latest gamer name and avatar. Handles remain the stable disambiguator while the account exists.

### Friends

Friends are mutual relationships between account holders. One-way following is not part of the first product shape.

### Game invites

Multiplayer games can invite friends or accounts found by handle. Friend invites should be the low-friction path. Non-friend handle invites are allowed but need anti-spam limits and recipient controls.

MVP multiplayer invites use handles. Friend relationships and friend-based invite shortcuts are deferred.

### Nudges

A nudge is an automatic reminder based on a game's configured inactivity timeout. Manual participant-triggered pokes are not part of the first notification model.

### Nudge timeout

Nudge timeout is configured per game during setup from a small set of allowed values. Each account may mute its own notifications without changing the game's shared inactivity timeout.

### Notification delivery

MVP notifications are in-app only. Game status, invites, consent requests, and nudges do not require email or push notification delivery in the first product shape.

### Reveal

A game reveals its batch only when every required entry is complete. Partial reveal and timeout reveal are not part of the first product shape.

For anonymous solo MVP, reveal is final for the completed local game. After reveal, the participant can view the completed batch, copy/share it, or start again; the completed batch does not need a re-hide action.

Revealed batches show phrases in original row order. Reveal does not shuffle completed phrases.

Reveal presents final rendered phrases first. An optional details view may show the contributing entries grouped by slot.

MVP reveal effects should be simple and polished. Subtle transitions are acceptable, but heavy animation or confetti is deferred.

### Cancellation

The game creator may cancel an in-progress game before reveal. Invited participants may decline before accepting or starting. Once revealed, a game becomes completed history rather than cancellable. Cancellation notifies accepted participants and prevents further turns.

### Entry validation

Manually typed entries use light validation only: required values, length limits, and broad content safety checks for public sharing. Private play does not strictly enforce grammar or word form because unexpected forms are part of the comedy.

Entries may be edited during the contributor's active turn before the turn is submitted. Once a turn is submitted, that turn's entries are locked. After reveal, entries in completed collaborative history cannot be deleted or edited by individual contributors; privacy and safety concerns are handled through unsharing, reporting, or account deletion anonymization.

### Entry candidates

Random generation produces entry-kind-specific candidates with low latency. Accepted entries remain editable and are not grammar-enforced beyond light entry validation.

In MVP, clicking dice fills the target input immediately with a candidate. The participant can edit the value or click dice again to replace it.

Dice assistance avoids repeating the same word within one game when possible, per entry kind. If the available candidate list is exhausted, repeats are allowed rather than failing.

### Word bank

Dice-click entry assistance uses a local or cached word bank so candidate generation feels instant during play. External APIs or LLMs may refresh or enrich the word bank asynchronously later, but are not called synchronously for each dice click.

MVP includes dice-click entry assistance backed by a small local or cached word bank for the default template's adjective and noun slots.

MVP implementation may start with a tiny hand-curated seed list for adjective and noun candidates while larger word-bank source selection remains a research task.

The MVP seed word bank should be large enough to populate three 30-phrase batches of the default template without repetitions: at least 90 adjective candidates and 180 noun candidates.

The MVP seed word bank is family-friendly by default and should not include profanity, adult terms, or offensive words.

The MVP seed word bank lives as a JSON data asset, not inline game code. It contains separate adjective and noun candidate arrays plus metadata such as version and family-friendly status.

The anonymous solo MVP seed word bank asset lives at `assets/word-bank-seed.json`. The static app fetches it with the deployed asset version query string so dice assistance can be cache-busted alongside `assets/app.js`.

Anonymous solo play must not require downloading the full production word bank. MVP anonymous solo may use the tiny bundled seed list, but production anonymous solo should use the same low-latency word-bank candidate service as signed-in play, with optional small client-side fallback shards.

Anonymous solo games remain playable if the word-bank candidate service is unavailable. Manual entry still works, and dice assistance may fall back to a tiny bundled list for the default template's adjective and noun slots.

### Personal word lists

The global word bank and personal word lists are distinct entry-assistance sources. Personal words do not silently become public or global candidates, and participants must explicitly choose when to use a personal word list for an entry.

Personal word lists are deferred from MVP. MVP entry assistance uses manual entry and dice-click candidates from the global word bank only.

### Personal word tags

Personal words may be tagged with one or more entry kinds. Untagged personal words are allowed, but entry assistance should prefer personal words tagged for the current slot's entry kind.

### Personal word privacy

Personal word lists are private to their owning participant in the first product shape. Sharing or publishing reusable word collections is a separate future feature, not an extension of personal word lists.
