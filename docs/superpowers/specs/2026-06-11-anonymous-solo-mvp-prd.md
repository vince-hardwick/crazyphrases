# PRD: Anonymous Solo Game MVP

> **Status:** Published historical PRD. Accepted durable behaviour lives in `docs/product-rules.md`; architecture boundaries live in ADRs 0004 and 0008; published PRD state lives in GitHub issue #1.

Published as GitHub Issue: https://github.com/vince-hardwick/crazyphrases/issues/1

## Problem Statement

People arriving at `crazyphrases.com` currently cannot play Crazy Phrases. The project has a static holding page and a well-defined product direction, but no playable game loop. The first playable slice needs to prove the core hidden-column mechanic without requiring accounts, backend persistence, multiplayer invitations, public discovery, or production Word Bank infrastructure.

The user should be able to open the site, start playing immediately, fill concealed sections of the default template, reveal a complete batch of absurd phrases, and copy individual phrases or the full batch as plaintext.

## Solution

Build the anonymous solo MVP as a static-first, client-only game experience. It uses the default template with adjective, noun, and noun sections. The game randomizes section order per local game, shows only the active section, lets the participant fill all rows in that section in any order, and reveals the completed batch only after every required entry is complete.

The MVP uses plain static HTML, CSS, and JavaScript. Pure game logic lives in modules separate from DOM code. A tiny family-friendly JSON seed Word Bank provides dice-click adjective and noun candidates, while manual entry remains the default. Anonymous progress is preserved in browser local storage for refresh recovery, but it is not durable account persistence.

The feature replaces the homepage in dev and test environments during review. Production keeps the holding page until automated tests pass and human acceptance is completed in test.

## User Stories

1. As a first-time visitor, I want the page to open directly into the playable Crazy Phrases flow, so that I can try the game without reading a landing page.
2. As a first-time visitor, I want a compact help control, so that I can understand the rules only when I need guidance.
3. As a curious visitor, I want the help text to mention the game's school-lesson origin, so that the experience has personality without becoming a long story.
4. As an anonymous participant, I want to play without creating an account, so that I can experience the game immediately.
5. As an anonymous participant, I want the default row count to be 20 phrases, so that the batch feels substantial.
6. As an anonymous participant, I want to choose 10, 15, 25, or 30 phrases instead, so that I can control the session length.
7. As an anonymous participant, I want the game to use the default adjective/noun/noun template, so that the first version preserves the original game shape.
8. As an anonymous participant, I want the section order to be randomized for each new game, so that I am less influenced by a predictable order.
9. As an anonymous participant, I want to see only the active section, so that earlier or later entries do not influence what I type.
10. As an anonymous participant, I want the active section to tell me what kind of entries to provide, so that I know whether to type adjectives or nouns.
11. As an anonymous participant, I do not want the remaining resolved section order shown, so that the game keeps the concealed-column feel.
12. As an anonymous participant, I want the UI to say things like "Fill these adjectives" rather than expose domain terms like "slot", so that the game feels approachable.
13. As an anonymous participant, I want the two noun sections labelled neutrally when needed, so that the UI does not over-explain internal structure.
14. As an anonymous participant, I want to fill all rows for the active section in one vertical form, so that the web version feels like filling a folded-paper column.
15. As an anonymous participant, I want to fill rows in any order within the active section, so that I am not forced top to bottom.
16. As an anonymous participant, I want every row to support manual entry, so that I can type my own funny words.
17. As an anonymous participant, I want a dice action on each row, so that I can quickly generate a candidate word.
18. As an anonymous participant, I want dice to fill the input immediately, so that random entry assistance is fast.
19. As an anonymous participant, I want dice-filled entries to remain editable, so that I can adjust or replace a candidate.
20. As an anonymous participant, I want to click dice again to replace a candidate, so that a bad candidate does not block me.
21. As an anonymous participant, I want dice candidates to match the current entry kind, so that adjective sections receive adjectives and noun sections receive nouns.
22. As an anonymous participant, I want dice candidates to avoid repeats within the same game where possible, so that the batch has variety.
23. As an anonymous participant, I want dice to keep working from a small family-friendly seed Word Bank, so that generated words do not surprise me with offensive content.
24. As an anonymous participant, I want manual entry to keep working even if random assistance cannot produce a word, so that I can complete the game.
25. As an anonymous participant, I want the app to prevent section submission while any row is blank, so that reveal always produces complete phrases.
26. As an anonymous participant, I want submitted sections to be locked, so that the game preserves the hidden-entry mechanic.
27. As an anonymous participant, I want browser refresh to restore the same in-progress game, so that I do not lose a partially completed 20-row batch accidentally.
28. As an anonymous participant, I want refresh recovery to keep the same randomized section order, so that refreshing does not change the game underneath me.
29. As an anonymous participant, I want local storage to keep only the current or latest anonymous game, so that anonymous play does not become hidden durable history.
30. As an anonymous participant, I want a "Start again" action, so that I can discard the current local game and begin with a fresh order.
31. As an anonymous participant, I want "Start again" to ask for confirmation when I have entered values, so that I do not accidentally lose work.
32. As an anonymous participant, I want the batch to reveal only when every entry is complete, so that every row becomes a complete Phrase.
33. As an anonymous participant, I want reveal to be final for the local game, so that the completed batch remains available for viewing and copying.
34. As an anonymous participant, I want revealed phrases shown in original row order, so that the row alignment remains understandable.
35. As an anonymous participant, I want the reveal screen to show rendered phrases first, so that the payoff is immediate.
36. As an anonymous participant, I want optional details showing contributing entries by section, so that I can understand or debug a strange Phrase if I choose.
37. As an anonymous participant, I want phrases rendered by simple space-separated concatenation, so that the original adjective/noun/noun absurdity remains intact.
38. As an anonymous participant, I want rendered phrases to trim and collapse whitespace, so that accidental spacing does not make the output ugly.
39. As an anonymous participant, I want the first character capitalized for display, so that copied phrases look presentable.
40. As an anonymous participant, I do not want the app to auto-insert articles or punctuation, so that it does not over-correct the game.
41. As an anonymous participant, I want Word Bank matches to display with normalized Word Bank casing, so that standard words look tidy.
42. As an anonymous participant, I want non-Word-Bank words and pseudo-words to preserve typed casing, so that intentional weirdness survives.
43. As an anonymous participant, I want casing normalization to affect display only, so that my raw entries remain as typed.
44. As an anonymous participant, I want per-phrase copy after reveal, so that I can share one funny result.
45. As an anonymous participant, I want copy-all after reveal, so that I can share the whole Batch.
46. As an anonymous participant, I want copied content to be plaintext, so that it works in chat, email, and documents.
47. As an anonymous participant, I want per-phrase copy to copy only the phrase text, so that single-phrase sharing is clean.
48. As an anonymous participant, I want copy-all to include a short title and unnumbered phrase lines, so that the batch is readable without clutter.
49. As a mobile visitor, I want the interface to work well on a phone, so that I can play where shared links are likely to be opened.
50. As a desktop visitor, I want the same flow to remain efficient for many rows, so that a 20-row batch is not tedious.
51. As a keyboard user, I want standard form navigation to behave sensibly, so that I can use Tab, Shift+Tab, and Enter without custom shortcuts.
52. As a visitor, I want the UI to hint at folded paper without literal folded-paper controls, so that the game has charm without hurting usability.
53. As a visitor, I want the reveal effect to be simple and readable, so that the Phrase list remains the focus.
54. As a project owner, I want no third-party analytics in the first anonymous solo slice, so that the static MVP avoids tracking, cookie, and consent work.
55. As a project owner, I want the feature to deploy to dev first, so that the implementing engineer can verify it before formal testing.
56. As a project owner, I want the feature to deploy to test after dev verification, so that human acceptance can happen before production.
57. As a project owner, I want production to keep the holding page until acceptance, so that the public site is not changed prematurely.
58. As a future implementer, I want game logic separated from DOM code, so that behaviour is unit-testable and portable to a future framework.
59. As a future implementer, I want the seed Word Bank stored as JSON data, so that word data is not mixed into game logic.
60. As a future implementer, I want the anonymous solo module boundaries to avoid backend assumptions, so that signed-in and multiplayer features can be added later behind a clear backend boundary.

## Implementation Decisions

- Build anonymous solo before account/auth scaffolding.
- Use the default template only: adjective, noun, noun.
- Use a static-first client-only implementation for anonymous solo.
- Use plain HTML, CSS, and JavaScript for the first slice.
- Keep pure game logic separate from DOM/UI code.
- The pure game logic should cover game state, randomized section order, active section progression, entry validation, reveal state, phrase rendering, word selection, local-storage serialization, and copy formatting.
- The DOM/UI layer should be a thin adapter over the pure modules.
- Row count defaults to 20, with selectable alternatives of 10, 15, 25, and 30.
- Anonymous solo randomizes section order for each new local game.
- The active section shows its entry kind, but the remaining resolved order is concealed.
- The participant fills all rows for one active section before advancing.
- The participant may fill rows in any order within the active section.
- All rows in the active section must be non-empty before submission.
- Submitted sections are locked.
- Reveal happens only after every required entry is complete.
- Reveal is final for the completed local game.
- Revealed phrases show in original row order.
- Reveal presents rendered phrases first, with optional contributing-entry details.
- Phrase rendering concatenates the three entries with spaces, trims whitespace, collapses extra spaces, and capitalizes the first character for display.
- Phrase rendering does not auto-insert articles or punctuation.
- Entries are stored as typed.
- Word Bank casing normalization is display-only.
- Words not found in the Word Bank preserve typed casing, including pseudo-words and user-specified non-words.
- The MVP seed Word Bank is a JSON data asset with metadata and separate adjective and noun arrays.
- The seed Word Bank is family-friendly and excludes profanity, adult terms, and offensive words.
- The seed Word Bank should contain at least 90 adjective candidates and 180 noun candidates.
- Dice-click entry assistance fills the target input immediately.
- Dice-filled values remain editable and can be replaced by clicking dice again.
- Dice avoids repeating the same word within one game where possible, per entry kind.
- If the candidate list is exhausted, dice may repeat rather than fail.
- Anonymous solo uses the tiny bundled seed Word Bank and does not require server-side word-bank access.
- Manual entry works regardless of dice candidate availability.
- Local storage may preserve the current or latest anonymous solo game for refresh recovery.
- Local-storage recovery restores the same randomized section order and entered values.
- Local storage does not maintain anonymous game history.
- "Start again" replaces the current local game with a new empty one and fresh randomized order.
- "Start again" asks for confirmation if the current game has entered values.
- Copy actions are available only after reveal.
- Per-phrase copy copies only the phrase text.
- Copy-all copies a short title followed by unnumbered phrase lines separated by line breaks.
- MVP sharing uses clipboard copy only; Web Share API integration is deferred.
- User-facing copy uses UK English, including "favourite" where relevant.
- The UI should not expose the domain term Slot.
- The MVP starts directly in the playable flow.
- A small help icon reveals compact instructions.
- The help explainer includes one short origin sentence and then functional instructions.
- The interface is responsive from the start, with mobile as the primary constraint.
- The visual design may hint at folded paper but should use a clean web-form interaction model.
- Use standard form navigation only; custom keyboard shortcuts are deferred.
- Use no third-party analytics, tracking scripts, or analytics cookies in this slice.
- Deploy the anonymous solo homepage replacement to dev and test during review.
- Keep production on the holding page until automated tests pass and human acceptance is completed in test.

## Testing Decisions

- Test external behaviour and domain outcomes rather than DOM internals or private implementation details.
- Unit-test the pure game module for default template setup, randomized section order, active section progression, required-entry validation, section locking, reveal eligibility, final reveal state, and start-again behaviour.
- Unit-test concealment by verifying that only the active section information is exposed before reveal and that remaining resolved order is not exposed through the public game state used by the UI.
- Unit-test phrase rendering for whitespace cleanup, display capitalization, lack of article/punctuation insertion, display-only Word Bank casing, preservation of pseudo-word casing, and original row order.
- Unit-test Word Bank selection for entry-kind-specific candidates, no repeats per game where possible, exhaustion fallback, and family-friendly seed metadata.
- Unit-test local-storage serialization and recovery for same game state, same randomized section order, entered values, revealed state, and single-current-game replacement.
- Unit-test copy formatting for per-phrase plaintext and copy-all plaintext with title plus unnumbered phrase lines.
- Include one browser smoke test for the full anonymous solo flow: open the static page, use the help disclosure, choose row count, fill sections with manual and dice entries, reveal, copy one phrase, copy all, refresh recovery, and start again.
- Browser smoke testing should include a mobile-constrained viewport because mobile is the primary responsive constraint.
- The first implementation does not need a broad visual-regression suite, but the smoke test should verify that the main flow is usable and non-overlapping at mobile and desktop sizes.

## Out of Scope

- Account sign-up, login, MFA, passkeys, and social login.
- Signed-in solo persistence.
- Signed-in 2-player games.
- Friends, handle invites, nudges, and notifications.
- Private phrase and batch favourites.
- Public feed, leaderboards, reactions, public sharing, public safety screening, reports, and admin review.
- Custom templates, template publishing, template remixing, template favourites, and template discovery.
- CPU-participant games.
- 3-player games.
- Manual section allocation and manual section ordering controls.
- Personal Word Lists and shareable word packs.
- Expanded production Word Bank source selection and delivery architecture.
- Web Share API integration.
- Public share links or permalinks.
- Phrase image generation.
- Uploaded profile pictures, gamer profiles, and social profile URLs.
- Third-party analytics or telemetry.
- Frontend framework introduction.
- Backend services, database schema, or API contracts.
- Production homepage replacement before test acceptance.

## Further Notes

This PRD is scoped to the first playable anonymous solo slice. It deliberately proves the core Crazy Phrases loop before backend, auth, social, multiplayer, public discovery, and production-scale Word Bank work.

The implementation should respect the static-first anonymous solo ADR and the cached Word Bank ADR. Future signed-in and multiplayer features require a separate backend design and should not be constrained by the static-only shape of this slice.

The dev/test/production promotion path is part of the delivery expectation: dev for implementer verification, test for formal testing and human acceptance, then production only after acceptance.
