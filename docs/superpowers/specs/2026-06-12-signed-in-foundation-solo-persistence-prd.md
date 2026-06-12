# PRD: Signed-In Foundation and Solo Save/Resume

Published as GitHub Issue: https://github.com/vince-hardwick/crazyphrases/issues/22

## Problem Statement

Anonymous solo play is live and proves the core Crazy Phrases loop, but it is intentionally local and ephemeral. A participant cannot sign in, see a stable game-facing identity, or resume a solo game from another browser or device. The product also needs a durable backend and authentication boundary before multiplayer, favourites, invites, consent, notifications, or public sharing can be implemented responsibly.

The next slice should establish the signed-in foundation without taking on the whole social product. The participant should be able to sign in, recognise their Crazy Phrases identity, start or continue a signed-in Solo Game, and rely on account-backed persistence rather than browser local storage. Anonymous solo must continue to work without accounts, backend availability, or account-linked storage.

## Solution

Build a boundary-first signed-in foundation centred on signed-in solo save/resume.

The first implementation work under this PRD must record the backend/auth/source-of-truth decision before code depends on a provider. The signed-in experience then introduces a minimal Account shell with one active game-facing profile: Handle, Gamer Name, and generated or default Avatar. A signed-in participant can start a default-template Solo Game, make entries using the same rules as anonymous solo, leave or refresh, and resume the current signed-in game from backend-backed state.

Anonymous solo remains local and ephemeral. Anonymous browser storage is not account persistence, is not a source of authority for signed-in state, and is not silently uploaded when a visitor signs in. Automatic or manual import from anonymous play is a later product decision.

This PRD is not a multiplayer PRD. It prepares the Account, identity, persistence, and deletion boundaries that later 2-player asynchronous games, private favourites, consent, and notifications will need.

## User Stories

1. As a returning participant, I want to sign in to Crazy Phrases, so that my game state can survive beyond one browser.
2. As a signed-in participant, I want to see that I am signed in, so that I know whether I am playing in account-backed mode.
3. As a signed-in participant, I want a Gamer Name, so that game-facing surfaces do not expose my account identity.
4. As a signed-in participant, I want a globally unique Handle, so that future invites, mentions, and profile URLs can disambiguate me.
5. As a signed-in participant, I want an Avatar marker, so that account-facing surfaces have a recognisable visual identity without requiring an uploaded photo.
6. As a signed-in participant, I want the product to keep Gamer Name separate from Handle, so that I can change display name later without losing my stable identifier.
7. As a signed-in participant, I want account setup to be lightweight, so that I can reach play quickly.
8. As a signed-in participant, I want uploaded profile pictures to be absent from this first slice, so that sign-in does not add image moderation and storage work.
9. As a signed-in participant, I want to start a Solo Game with the default template, so that I can keep using the proven anonymous solo play loop.
10. As a signed-in participant, I want the signed-in Solo Game to use the same row-count options as anonymous solo, so that the two solo modes feel consistent.
11. As a signed-in participant, I want the signed-in Solo Game to randomise section order per game, so that the concealed-column feel remains intact.
12. As a signed-in participant, I want to see only the active section before reveal, so that my later entries are not influenced by earlier entries.
13. As a signed-in participant, I want dice assistance to keep working in signed-in solo, so that account-backed play does not feel worse than anonymous play.
14. As a signed-in participant, I want manual entry to keep working even if dice assistance is unavailable, so that backend or word-bank interruptions do not block private play.
15. As a signed-in participant, I want the app to save my setup once I start a signed-in game, so that the selected row count and resolved section order are durable.
16. As a signed-in participant, I want entries to save as I play, so that refreshes or navigation do not discard a partly completed batch.
17. As a signed-in participant, I want submitted sections to stay locked after resume, so that persistence does not weaken concealment.
18. As a signed-in participant, I want reveal state to persist, so that a completed batch remains visible after refresh.
19. As a signed-in participant, I want "Start again" to replace the current signed-in solo game only after confirmation when needed, so that I do not accidentally lose account-backed progress.
20. As a signed-in participant, I want the current signed-in Solo Game to resume when I return, so that I can continue a 20-row batch over multiple sessions.
21. As a signed-in participant, I want to resume from another browser or device after signing in, so that persistence is attached to my Account rather than local storage.
22. As a signed-in participant, I want the app to avoid silently overwriting newer saved progress from another session, so that cross-device play does not lose entries without warning.
23. As a signed-in participant, I want clear state if my saved game cannot be loaded, so that I know whether to retry or start a new game.
24. As a signed-in participant, I want clear state if my latest entry cannot be saved, so that I do not believe account-backed progress is safe when it is not.
25. As a signed-in participant, I want to sign out without deleting my saved signed-in game, so that I can return later.
26. As a signed-out visitor, I want anonymous solo to keep working, so that accounts are not required for first play.
27. As an anonymous participant, I do not want my local entries uploaded just because I sign in, so that private local play remains under my control.
28. As an anonymous participant, I want the app to distinguish local recovery from account persistence, so that I understand what will and will not follow me to another device.
29. As a participant with an anonymous local game and a signed-in saved game, I want the product not to merge them automatically, so that hidden entries and reveal state are not combined unpredictably.
30. As a participant, I want copied phrases and copied batches to keep working after signed-in reveal, so that the current sharing behaviour remains available.
31. As a participant, I want signed-in solo not to publish my phrases publicly, so that account persistence does not imply public discovery.
32. As a participant, I want signed-in solo not to create private favourites automatically, so that saving a current game and favouriting a Phrase or Batch remain distinct actions.
33. As a participant, I want signed-in solo to use UK English in user-facing copy, so that the product remains consistent.
34. As a participant, I want the UI to avoid exposing domain terms such as Slot, so that the signed-in flow stays approachable.
35. As a mobile participant, I want sign-in and resume controls to work cleanly on a phone, so that account-backed play does not make the mobile flow cramped.
36. As a desktop participant, I want signed-in resume to stay efficient for larger batches, so that a saved 30-phrase game is still practical.
37. As a project owner, I want backend-backed state for signed-in features, so that signed-in persistence is not constrained by static anonymous solo hosting.
38. As a project owner, I want backend/auth choice recorded before implementation, so that future agents understand the source-of-truth boundary.
39. As a project owner, I want environment detection separated from mutation authority, so that branch, host, or deployment target detection never grants permission to mutate live systems.
40. As a project owner, I want no tokens or secrets committed, so that backend/auth setup does not weaken repository safety.
41. As a project owner, I want development, test, and production environment assumptions recorded, so that signed-in persistence can be promoted through the existing gates.
42. As a project owner, I want signed-in state to be testable without hitting production systems, so that agents can verify behaviour safely.
43. As a project owner, I want anonymous solo regression coverage preserved, so that adding accounts does not break the public first-play loop.
44. As a project owner, I want the first signed-in slice to avoid multiplayer, so that the Account and persistence boundary is proven before invites and turns.
45. As a project owner, I want the first signed-in slice to avoid public discovery, so that consent, moderation, and reporting are not half-built.
46. As a project owner, I want the first signed-in slice to avoid private favourites, so that current-game persistence and saved-output collections are designed separately.
47. As a future implementer, I want signed-in solo persistence to reuse the existing game lifecycle rules where appropriate, so that signed-in solo does not fork the product model unnecessarily.
48. As a future implementer, I want the persistence contract to store enough state to resume the same game, so that random order, active section, entries, locks, used dice candidates, and reveal status survive reload.
49. As a future implementer, I want signed-in persistence to use an Account identifier rather than Handle as storage authority, so that handle changes or deletion rules do not corrupt game state.
50. As a future implementer, I want account deletion rules considered in the first signed-in slice, so that personal solo state can be removed without compromising future collaborative history rules.
51. As a future implementer, I want private signed-in solo data to be distinguishable from collaborative game history, so that future deletion and export paths can treat them differently.
52. As a future implementer, I want clear out-of-scope boundaries for 2-player asynchronous play, so that this PRD does not accidentally require Game Invites, Pending Games, Turns, Share Consent, or In-App Notifications.
53. As a future implementer, I want a browser smoke seam for sign-in and resume, so that the first account-backed flow is tested as a user would experience it.
54. As a future implementer, I want a persistence contract seam, so that save/load behaviour can be tested without relying on a live production backend.
55. As a future implementer, I want provider-specific details isolated behind documented contracts, so that later provider changes do not rewrite the domain game logic.

## Implementation Decisions

- Treat this as a signed-in foundation PRD, not as a multiplayer PRD.
- The first child implementation task must create or update an ADR that chooses the backend/auth provider and records the source-of-truth boundary before provider-dependent code is written.
- The backend/auth ADR must preserve the existing rule that detecting an environment, host, branch, deployment target, or runtime context does not itself authorise mutation.
- Provider evaluation must cover hosted authentication, account identifiers, local development, dev/test/production separation, secret handling, deployment compatibility, data export/deletion feasibility, and a low-friction path for browser smoke tests.
- Signed-in persistence uses backend-backed state. It must not rely on browser local storage as the authority for signed-in game state.
- Anonymous solo remains available without sign-in and without backend availability.
- Anonymous local recovery and signed-in persistence are separate lifecycle paths.
- Signing in must not silently upload or import the current anonymous local game.
- Automatic or manual import from anonymous solo to signed-in state is deferred.
- The minimum signed-in identity model contains Account, Handle, Gamer Name, and Avatar.
- Account is the durable signed-in identity and storage authority.
- Handle is globally unique and used for future discovery, mentions, profile URLs, and disambiguation.
- Gamer Name is the game-facing display name and remains separate from account identity.
- Avatar is generated, defaulted, or selected from a modest preset set. Uploaded profile pictures are out of scope.
- The MVP has one active gamer profile per Account.
- Signed-in solo uses the default template and preserves the existing solo concealment, entry, row-count, dice assistance, section submission, reveal, copy, details, and Start again behaviours unless this PRD explicitly changes them.
- Signed-in solo persists the current account-backed Solo Game, including row count, resolved section order, active section, entries as typed, locked sections, used candidate tracking, started state, revealed state, and any versioning or revision data needed for safe writes.
- The first signed-in solo persistence scope is the current signed-in Solo Game, not a full game-history browser.
- A revealed signed-in solo batch remains resumable as the current game until the participant starts again.
- Starting again in signed-in solo replaces the current signed-in Solo Game after the same phase-appropriate confirmation behaviour used by anonymous solo.
- Private Phrase Favourites and Batch Favourites are separate saved-output features and are deferred from this PRD.
- Signed-in persistence should use a revision, version, or equivalent concurrency mechanism so stale clients do not silently overwrite newer saved state.
- If saving fails, the UI must make the risk visible instead of claiming that progress is saved.
- If loading fails, the UI must offer a safe retry or start-new path without deleting remote state silently.
- Account deletion for this slice treats signed-in solo current-game state as personal/private data that can be deleted with the Account.
- Future collaborative game history remains governed by the accepted account-deletion decision and must not be designed as hard-deleted personal data.
- No third-party analytics or telemetry is introduced by this PRD.
- Public feed, leaderboards, public share links, reactions, safety screening, reports, and admin review remain out of scope.
- 2-player asynchronous games, Game Invites, Pending Games, Turns, Nudges, and In-App Notifications remain out of scope.
- Friend relationships and friend invite shortcuts remain out of scope.
- Personal Word Lists remain out of scope.
- The frontend framework decision remains deferred unless the backend/auth design shows that routing, signed-in state, or component complexity makes plain JavaScript costly enough to justify a framework ADR.

## Testing Decisions

- Test external behaviour and domain outcomes rather than implementation details.
- Prefer the highest seam available for each behaviour: browser flow for user-facing sign-in and resume, domain/state tests for game lifecycle rules, and persistence contract tests for save/load semantics.
- Preserve the existing anonymous solo test coverage as regression prior art: game state, local recovery, clipboard behaviour, and browser smoke.
- Add signed-in solo domain/state tests for lifecycle compatibility with anonymous solo rules where pure logic can remain provider-independent.
- Add persistence contract tests for loading no current game, saving a new current game, resuming an in-progress game, resuming a revealed game, replacing the current game through Start again, rejecting malformed payloads, and handling stale-write conflicts.
- Add account identity tests for Handle uniqueness, Gamer Name separation, Avatar defaulting, and Account identifier use as persistence authority, at the highest provider-independent seam available.
- Add deletion/privacy tests showing that signed-in solo current-game state is personal/private data while future collaborative-history preservation remains a separate rule.
- Add browser smoke coverage for the signed-in path: sign in through the supported local/test mechanism, complete account setup if needed, start a signed-in Solo Game, enter values, refresh, resume, reveal, copy, sign out, sign back in, and see the current signed-in game restored.
- Add browser regression coverage or assertions showing that anonymous solo remains playable when signed out and does not require the signed-in persistence path.
- Use fake, local, or test-environment auth/persistence fixtures for automated tests. Automated tests must not mutate production systems.
- Use the visible in-app Browser route for local or deployed smoke testing when browser verification is required.
- Documentation-only PRD changes are verified by diff inspection and path/link checks; implementation slices must run the relevant automated tests and browser smoke before being reported complete.

## Out of Scope

- Choosing multiplayer rules or implementing 2-player asynchronous games.
- Pending Game creation, Game Invites, handle invites, invite expiry, Slot Allocation for multiple participants, Slot Order visibility for multiple participants, Turn completion by different participants, and multiplayer Reveal.
- Friends, friend invite shortcuts, one-way following, social discovery, and social profile URLs.
- Nudges, Nudge Timeout delivery, email notifications, push notifications, and In-App Notifications.
- Private Phrase Favourites and Batch Favourites.
- Template favourites.
- Public feed, leaderboards, public sharing, public share links, phrase reactions, safety screening, content reports, and admin review.
- Share Consent for multiplayer or public discovery.
- Custom templates, template publishing, template remixing, template discovery, and template version editing.
- Personal Word Lists and shareable word packs.
- Automatic or manual migration of anonymous local games into signed-in account state.
- Full signed-in game history browsing beyond the current signed-in Solo Game.
- Uploaded profile pictures.
- Multiple gamer profiles per Account.
- MFA, passkeys, or advanced auth controls unless the chosen provider offers them as hosted or low-code features that do not complicate the core flow.
- Third-party analytics or telemetry.
- Production word-bank delivery redesign unless the backend/auth ADR explicitly finds that signed-in persistence cannot be separated from word-bank service boundaries.
- Production deployment outside the documented GitHub Actions and environment-gated promotion path.

## Further Notes

Expected child issue sequence:

1. Record the backend/auth/source-of-truth ADR for signed-in state.
2. Add the minimal Account shell with Handle, Gamer Name, and Avatar.
3. Add signed-in solo current-game save/resume.
4. Add signed-in browser smoke coverage and deployment verification.

This PRD deliberately keeps the first signed-in phase small. It establishes identity and persistence boundaries that later slices can reuse for private favourites, 2-player asynchronous games, consent, notifications, and public discovery.
