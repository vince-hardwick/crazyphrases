# PRD: Private Phrase and Batch Favourites

> **Status:** Published PRD provenance. Accepted durable behaviour lives in `docs/product-rules.md`; hosted schema and deployment evidence live in `docs/runbooks/supabase-auth-and-postgres.md`; current child-ticket status belongs to GitHub issue #33 and its child issues.

Published as GitHub Issue: https://github.com/vince-hardwick/crazyphrases/issues/33

## Child Issues

1. #34 `Save and revisit a private Phrase Favourite from signed-in Reveal` - AFK, can start immediately.
2. #35 `Save and revisit a private Batch Favourite from signed-in Reveal` - AFK, blocked by #34.
3. #36 `Add removal and duplicate-state polish for private favourites` - AFK, blocked by #34 and #35.
4. #37 `Verify private favourites in deployed environments` - AFK, blocked by #34, #35, and #36.

## Problem Statement

Signed-in solo save/resume is live, but a completed Batch is still only the current signed-in Solo Game until the participant starts again. Once they clear the current game, there is no account-backed way to keep a funny Phrase or the whole Batch for later.

Participants need a private saved-output collection that is separate from current-game persistence and separate from public discovery. Saving a favourite should be deliberate, account-backed, and available only after Reveal. It must not publish content, create public share links, import anonymous play, or blur the existing Account authority boundary.

## Solution

Add private Phrase Favourites and Batch Favourites for signed-in participants.

After Reveal in a signed-in Solo Game, the participant can explicitly save an individual Phrase or the full Batch. Saved favourites are private to the Account and can be revisited from a minimal account-backed favourites surface. Anonymous solo remains local and does not gain account-linked favourites unless the participant signs in and later saves from a signed-in revealed Batch.

For the MVP favourites contract, saved favourites are immutable saved-output snapshots rather than live pointers to the current signed-in game record. A Phrase Favourite stores the rendered phrase text plus enough default-template row context to remain understandable after the current game is cleared. A Batch Favourite stores the rendered phrase list plus the same batch-level snapshot context. Favourites do not update if the source current game is later replaced.

This PRD does not add public feed publishing, reactions, leaderboards, public share links, Share Consent flows, or multiplayer favourites.

## User Stories

1. As a signed-in participant, I want to save one revealed Phrase as a private favourite, so that I can revisit a funny result after I start another batch.
2. As a signed-in participant, I want to save a revealed Batch as a private favourite, so that I can keep the whole set of completed phrases.
3. As a signed-in participant, I want favourite actions to appear only after Reveal, so that in-progress concealed entries are not treated as saved output.
4. As a signed-in participant, I want favourite actions to be explicit buttons, so that completed content is not saved automatically.
5. As a signed-in participant, I want private favourites to survive signed-out and signed-back-in sessions, so that they are Account-backed rather than browser-local.
6. As a signed-in participant, I want a minimal favourites view, so that I can revisit saved Phrase Favourites and Batch Favourites.
7. As a signed-in participant, I want saved favourites to remain available after I confirm Start again, so that clearing the current game does not delete saved output.
8. As a signed-in participant, I want a saved Phrase Favourite to show the rendered phrase text I saw at Reveal, so that the saved item preserves the joke as displayed.
9. As a signed-in participant, I want a saved Batch Favourite to show the rendered phrases in original row order, so that the saved Batch matches the revealed Batch.
10. As a signed-in participant, I want favourites to preserve enough row context for the default template, so that a saved item remains understandable even after the source game is gone.
11. As a signed-in participant, I want duplicate save attempts for the same revealed Phrase or Batch to be handled clearly, so that repeated clicks do not create confusing duplicates.
12. As a signed-in participant, I want save failures to be visible, so that I know when a favourite may not have been kept.
13. As a signed-in participant, I want load failures in the favourites surface to be visible, so that I know whether to retry.
14. As a signed-in participant, I want saved favourites to stay private, so that saving does not publish my content to other participants or public discovery.
15. As a signed-in participant, I want saving a favourite to be distinct from copying a phrase or batch, so that sharing out of the app remains a separate action.
16. As a signed-in participant, I want private favourites to use UK English in visible copy, so that the product remains consistent.
17. As a signed-in participant, I do not want domain terms such as Slot exposed in the favourites UI, so that the saved-output surface stays approachable.
18. As an anonymous participant, I do not want anonymous local play uploaded just because favourites exist, so that local anonymous play remains under my control.
19. As an anonymous participant, I want anonymous solo to keep working without sign-in, so that favourites do not make accounts required for first play.
20. As a project owner, I want favourite storage keyed to Account id, so that Handle, Gamer Name, and email are not persistence authority.
21. As a project owner, I want favourites protected by Row Level Security, so that browser clients can access only their own saved output.
22. As a project owner, I want private favourites separated from current-game persistence, so that saved output and resumable in-progress state have different lifecycles.
23. As a project owner, I want Account Deletion to delete private favourites, so that personal saved-output collections do not outlive the Account.
24. As a project owner, I want collaborative game history rules left untouched, so that deleting private favourites does not imply hard deletion of future multiplayer history.
25. As a project owner, I want the first favourites slice to avoid public discovery, so that safety screening, reports, moderation, and consent are not half-built.
26. As a project owner, I want no service-role key or database password in browser code, so that favourites follow the existing Supabase security boundary.
27. As a future implementer, I want the favourite snapshot contract to leave room for future multiplayer provenance, so that this MVP does not block later participant attribution or Share Consent.
28. As a future implementer, I want tests at public seams, so that future refactors can change storage internals without changing favourite behaviour.
29. As a future implementer, I want local test storage for browser smoke, so that favourites can be tested without mutating hosted Supabase.
30. As a future implementer, I want deployed smoke to distinguish deployment approval from live data mutation approval, so that hosted favourite writes happen only after explicit approval.

## Implementation Decisions

- Treat this as the private saved-output follow-up to the signed-in foundation, not as a public sharing PRD.
- Private favourites are available only to signed-in Accounts.
- Anonymous solo remains local and unauthenticated. The existence of favourites does not upload, import, or merge anonymous local games.
- Favourite actions appear only after Reveal.
- Favourites are created only by explicit participant actions. The app does not automatically favourite phrases or batches.
- A Phrase Favourite stores an immutable snapshot of one revealed phrase, including rendered phrase text, source row index, source mode, default-template identifier, and row entry context sufficient for a private detail view.
- A Batch Favourite stores an immutable snapshot of the revealed batch, including rendered phrase texts in original row order, source mode, default-template identifier, row count, and batch entry context sufficient for a private detail view.
- Favourite snapshots do not point at the signed-in current-game row as their authority. Clearing or replacing the current signed-in Solo Game does not mutate saved favourites.
- Favourite storage is keyed by immutable Account id, not Handle, Gamer Name, email, or display-name values.
- Browser-exposed favourite tables must enable Row Level Security before browser reads or writes are allowed.
- Browser clients may use only browser-safe Supabase keys documented as browser-safe. Service-role keys, database passwords, OAuth client secrets, and admin credentials remain server-side and out of the repository.
- Account Deletion treats private favourites as personal/private saved-output data and deletes them with the Account.
- Future collaborative game history, participant snapshots, public sharing, and consent records remain governed by their own lifecycle rules and are not changed by this PRD.
- The minimal favourites surface can be narrow: it only needs to prove that signed-in participants can revisit saved Phrase Favourites and Batch Favourites.
- The first UI does not need search, folders, tags, bulk edit, public links, reactions, or leaderboard placement.
- Duplicate save attempts for the same favourite target should not create confusing repeated entries. The first implementation may either disable saved controls for the revealed target or use an account-scoped source fingerprint to make duplicate saves idempotent.
- Save and load errors must be visible in the UI. The app must not claim a favourite was saved when the backend write failed.
- Supabase hosted schema mutation requires explicit owner approval. Source-controlled migrations can be written and tested locally before any hosted apply.
- A hosted browser smoke that writes favourite rows is live Supabase data mutation and requires explicit approval beyond deployment approval.

## Testing Decisions

- Tests should verify public behaviour and domain outcomes, not private implementation details.
- Use the existing revealed-game seam for snapshot creation: a revealed signed-in Solo Game plus the public phrase-rendering behaviour should produce the favourite snapshot.
- Add repository contract tests for account-scoped save/list behaviour, malformed payload rejection, duplicate handling, and Supabase error reporting.
- Add migration-surface tests proving favourite tables are account-owned, RLS-enabled, and not granted to `anon`.
- Add browser smoke coverage for local test sign-in, Reveal, saving a Phrase Favourite, revisiting it from the favourites surface, clearing the current game, and confirming the saved favourite remains.
- Add browser smoke coverage for saving and revisiting a Batch Favourite once that slice is implemented.
- Preserve existing anonymous solo and signed-in current-game smoke coverage as regression coverage.
- Automated local tests must use fake, memory, or local test storage. They must not mutate hosted Supabase.
- Deployed smoke must use the visible in-app Browser route and the documented deployment gates. Hosted favourite writes require explicit owner approval.

## Out of Scope

- Public feed publishing.
- Public share links or permalink pages.
- Phrase reactions, leaderboard ranking, or batch ratings.
- Safety screening, content reports, admin review, and moderation workflows.
- Share Consent for multiplayer or public discovery.
- Signed-in 2-player asynchronous Games, Game Invites, Pending Games, Nudges, and In-App Notifications.
- Friend relationships and friend invite shortcuts.
- Template favourites.
- Custom template creation, publishing, remixing, discovery, or version editing.
- Personal Word Lists and shareable word packs.
- Anonymous solo import into signed-in state.
- Full signed-in game-history browsing beyond the narrow favourites surface.
- Web Share API integration.
- Phrase image generation.
- Uploaded profile pictures, multiple gamer profiles, and social profile URLs.
- Third-party analytics or telemetry.

## Further Notes

This PRD deliberately starts with private saved output. It should not expand into social discovery or multiplayer consent without a separate PRD or accepted follow-up decision.
