# Supabase State Ledger

## Purpose

This ledger records hosted Supabase migration application, schema verification,
deployment smoke evidence, and dated hosted-state observations.

It is provenance, not procedure. Use
`docs/runbooks/supabase-auth-and-postgres.md` for operational commands, mutation
authority, approval paths, secrets handling, and validation procedures. Use ADRs
and `docs/product-rules.md` for durable architecture and product behaviour.

## Update Rule

Add dated evidence here when a hosted Supabase migration, provider setting,
deployment smoke, cleanup check, or hosted-state observation would otherwise
make the runbook larger or harder to route. Keep raw logs out unless the exact
line is needed to resolve a future operational dispute.

## Hosted Auth Provider State

As of 2026-06-15, the project owner had configured and enabled the Google
provider in the hosted Supabase project.

A `dev` browser smoke reached Google Accounts from
`https://dev.crazyphrases.com/` with the configured Google OAuth client id, the
Supabase callback URL, and `redirect_to` set back to the dev app. After owner
sign-in and consent, the app returned to `https://dev.crazyphrases.com/#`,
hydrated Account-backed mode, hid hosted sign-in controls, exposed sign-out,
started a signed-in 10-phrase batch, saved `teapot` into the first entry,
reloaded, and resumed that entry. A read-only hosted SQL check confirmed one
`public.signed_in_solo_current_games` row at revision `2`.

## Hosted Migration Applications

| Hosted version | Name | Evidence status |
| --- | --- | --- |
| `20260614222419` | `create_signed_in_solo_current_games` | Applied after explicit owner approval; schema verified. |
| `20260614222554` | `tighten_signed_in_solo_current_games_grants` | Applied after explicit owner approval; schema verified. |
| `20260615134730` | `maintain_signed_in_solo_current_games_updated_at` | Applied after explicit owner approval; schema verified. |
| `20260615160720` | `create_private_phrase_favourites` | Applied after explicit owner approval; schema verified. |
| `20260615164651` | `create_private_batch_favourites` | Applied after explicit owner approval; schema verified. |
| `20260615235714` | `create_account_profiles` | Applied after explicit owner approval; schema verified. |
| `20260616092324` | `tighten_account_profile_directory_grants` | Applied after explicit owner approval; schema verified. |
| `20260616093056` | `replace_account_profile_directory_view` | Applied after explicit owner approval; schema verified. |
| `20260616141452` | `create_pending_games` | Applied after explicit owner approval; schema verified. |
| `20260617135237` | `support_pending_game_invite_responses` | Applied after explicit owner approval; schema verified. |
| `20260618081517` | `start_pending_game_foundation` | Applied after explicit owner approval; schema verified and dev-smoke tested. |
| `20260618102626` | `started_game_turn_submission` | Applied after explicit owner approval; schema verified and dev-smoke tested. |
| `20260619131018` | `participant_section_multiplayer_execution` | Applied after explicit owner approval; schema verified and dev-smoke tested. |
| `20260619132023` | `fix_multiplayer_reveal_conflict_target` | Applied as a corrective hosted migration during the approved participant-section smoke; schema verified and dev-smoke tested. |
| `20260619221615` | `creator_multiplayer_cancellation` | Applied after explicit owner approval; schema verified and dev-smoke tested. |
| `20260622144027` | `completed_multiplayer_history` | Applied after explicit owner approval; schema verified and read-only dev-smoke tested. |
| `20260623121445` | `completed_multiplayer_history_pagination` | Applied after explicit owner approval; schema verified. |
| `20260623161126` | `pending_game_invite_expiry` | Applied after explicit owner approval; schema verified and read-only dev-smoke tested. |
| `20260624094619` | `nudge_timeout_foundation` | Applied after explicit owner approval; schema verified. |
| `20260624094839` | `fix_nudge_notification_assignment_fk_index` | Applied after explicit owner approval as corrective index coverage; schema verified. |
| `20260624212005` | `uploaded_avatar_profile` | Applied after explicit owner approval; schema and Storage bucket/policy surface verified. |

Source-controlled migration
`supabase/migrations/20260619151000_creator_multiplayer_cancellation.sql`
was applied to hosted Supabase on 2026-06-19 after explicit owner approval as
hosted migration `20260619221615 creator_multiplayer_cancellation`.

Local source verification for the creator-cancellation branch used the bundled
Node executable documented in `docs/runbooks/node-npm-for-codex.md`.
`node.exe --test` passed 149/149 tests, including repository, migration-surface,
and browser smoke coverage for creator cancellation. `git diff --check` passed;
Git emitted only LF-to-CRLF working-copy warnings. No hosted Supabase mutation
or deployed environment smoke was performed during this local source pass.

After explicit owner approval on 2026-06-19, deploy-dev run `27849518676`
deployed branch `codex/creator-cancel-multiplayer` to `dev` at runtime-changing
commit `751f0ad82d26bc56ef282e7bfe76b01c23c77f85`. Later branch commits
`e4ed6eb`, `66b1365`, and `cade251` were documentation-only and did not request
another static runtime deployment. Visible `dev` browser inspection confirmed
`https://dev.crazyphrases.com/` loaded as Crazy Phrases, top-level
`assets/site.css` and `assets/app.js` were stamped with the deployed commit SHA,
all observed first-party JavaScript modules including `pending-game.js` were
stamped with the same SHA, the Account-backed shell rendered for the existing
dev browser session, the Notifications button and Multiplayer panel rendered,
there was no horizontal overflow, and browser warning/error logs were empty.
Because source migration
`20260619151000_creator_multiplayer_cancellation.sql` has not yet been applied
to hosted Supabase, the signed-in Multiplayer panel showed the expected
schema-mismatch loading error, `Game invites could not be loaded. Try again.`
No hosted Supabase data mutation or signed-in write/cleanup smoke was performed
during this deployment check.

After explicit owner approval later on 2026-06-19, hosted migration
`20260619221615 creator_multiplayer_cancellation` was applied through the
Supabase MCP. Hosted migration history then listed the new migration. Read-only
schema verification confirmed `public.in_app_notifications.target_game_id` and
`target_pending_game_id` are both nullable UUID targets, the notification type
check includes `game_cancelled`, the exactly-one-target check exists, the new
game and Pending Game notification indexes exist, and
`public.cancel_created_game(uuid)` exposes the expected cancellation status
check, reveal guard, stale `entries_needed` cleanup, pending-aware notification
targeting, and `game_cancelled` notification creation. Execute privileges
confirmed `public` and `anon` cannot execute the multiplayer RPCs checked, while
`authenticated` can execute `cancel_created_game`, dashboard, section-submit,
and Reveal RPCs. Read-only hosted data inspection found zero Pending Game rows.
Visible `dev` browser reload then confirmed the previous signed-in Multiplayer
loading error was gone, the three dashboard buckets rendered, Notifications
rendered, there was no horizontal overflow, and browser warning/error logs were
empty. No signed-in write/cleanup smoke was performed during this migration
verification.

After separate explicit owner approval on 2026-06-19, a signed-in
creator-cancellation write/cleanup smoke ran in `dev` using existing creator
Account Profile `@player-00c9137f-e786-4e7d` and temporary invitee Handle
`@codex-smoke-cc-0803c1`. The visible browser created a 10-phrase Pending Game
invite, the temporary invitee accepted through the authenticated RLS path, the
creator started the accepted game, and the creator cancelled the Started Game
before Reveal. The visible UI showed `Game cancelled.`, the Created invite card
showed `Cancelled`, no `Submit section` control remained, the Multiplayer
dashboard buckets were empty, and there was no horizontal overflow. Hosted SQL
confirmed Pending Game `100fac25-0994-4120-a32b-8590a510587a` was `cancelled`,
Started Game `376b6745-3af2-481b-a416-3fb12684374b` was preserved, three
section assignments existed, zero Reveal rows existed, prior `entries_needed`
notifications were marked `read`, and the invitee had one unread
`game_cancelled` notification. Cleanup deleted one Started Game, one Pending
Game, and one temporary invitee Auth user; follow-up SQL confirmed zero rows
remained for the smoke Auth user, Account Profile, Handle Directory entry,
Pending Game, Pending Game participants, Started Game, Started Game
participants, section assignments, section entries, multiplayer reveals, and
in-app notifications. A final visible `dev` reload showed Account-backed mode,
an empty Multiplayer dashboard, no smoke Handle, and no horizontal overflow.

After explicit owner approval on 2026-06-22, hosted migration
`20260622144027 completed_multiplayer_history` was applied through the
Supabase MCP from source migration
`supabase/migrations/20260622120000_completed_multiplayer_history.sql`.
Hosted migration history then listed the new migration. Read-only schema
verification confirmed `public.list_completed_multiplayer_history()` exists as
a stable `security definer` function with an empty `search_path`, returns the
expected empty unauthenticated page shape, scopes history through `auth.uid()`,
requires the source Pending Game to remain `started`, limits the first page to
20 completed batches, and includes phrase text only behind the caller's reveal
row. Execute privileges confirmed only `postgres` and `authenticated` can run
the RPC. Supabase security advisors added the expected signed-in
`security definer` warning for the new intentional authenticated RPC, alongside
existing participant-section and project-level warnings; performance advisors
reported only existing index/policy warnings.

A read-only authenticated-context SQL check using existing profile `vhcoder`
confirmed `auth.uid()` resolved to
`f222c9a8-e424-4156-a378-c34eabc71bbf` and
`public.list_completed_multiplayer_history()` returned `{"batches":[]}` for
that Account. Visible `dev` browser reload confirmed
`https://dev.crazyphrases.com/` loaded as Crazy Phrases with top-level
`assets/app.js` and `assets/site.css` stamped at branch commit
`d3409f41cc8326297a7841defe46817a6432c544`, no invite-load error, no browser
console errors, and no horizontal overflow. No signed-in write/cleanup smoke
was performed during this migration verification; creating fresh completed
history data remains a separate hosted data-mutation approval.

After separate explicit owner approval on 2026-06-22, a signed-in
completed-history write/cleanup smoke ran in `dev` using existing creator
Account Profile `@vhcoder` and temporary invitee Handle
`@codex-smoke-history-1a75a4`. The visible browser created a 10-phrase Pending
Game invite, the temporary invitee accepted through the authenticated RLS path,
the creator started the accepted game, and the creator submitted their active
`noun-2` section through the signed-in browser UI. Hosted SQL then submitted
the temporary invitee's `noun-1` and `adjective` sections through
`public.submit_multiplayer_section(uuid, jsonb)` under the invitee's
authenticated context. Hosted SQL confirmed Started Game
`d6552a0b-05d8-4d9f-9a65-0f0bbaab8e46` had all three assignments submitted,
30 section entries, zero Reveal rows, and
`public.list_completed_multiplayer_history()` returned one unrevealed batch for
creator Account `f222c9a8-e424-4156-a378-c34eabc71bbf`.

The visible `dev` browser opened `Completed multiplayer history` and confirmed
the batch appeared as `Not revealed yet.` with no phrase text and no horizontal
overflow. The browser then revealed the batch as the creator, reopened
completed history, and confirmed ten `Brisk ladder teapot` phrases rendered
with no horizontal overflow. Cleanup deleted four in-app notifications, one
Reveal row, 30 section entries, three section assignments, two Started Game
participants, one Started Game, two Pending Game participants, one Pending
Game, one Handle Directory row, one Account Profile row, and one temporary
Auth user. Follow-up hosted SQL confirmed zero rows remained for the smoke Auth
user, Account Profile, Handle Directory entry, Pending Game, Pending Game
participants, Started Game, Started Game participants, section assignments,
section entries, multiplayer reveals, and in-app notifications, and
`public.list_completed_multiplayer_history()` returned `{"batches":[]}` for the
creator Account. A final visible `dev` reload showed Account-backed mode, empty
Multiplayer dashboard buckets, no smoke Handle, no horizontal overflow, and no
browser warning/error logs.

PR #69 was merged to `main` on 2026-06-22 as merge commit
`060295a50408b0b724c8283364018c4f534e291a`. Promotion run `27962578783`
deployed that commit to `test` after explicit owner approval for the
`Deploy main to test` GitHub Environment gate. The `Deploy main to test` job
succeeded from 2026-06-22T15:08:41Z to 2026-06-22T15:08:58Z. Visible
`test` browser verification confirmed Account-backed mode for `@vhcoder`, an
empty completed Multiplayer history page, no `codex-smoke-history-1a75a4`
smoke Handle, no horizontal overflow, and no browser warning/error logs. The
top-level stylesheet plus all observed first-party JavaScript modules,
including `pending-game.js` and `supabase-config.js`, were stamped with merge
commit `060295a50408b0b724c8283364018c4f534e291a`, and no
`__ASSET_VERSION__` placeholder was visible. The same promotion run then
waited at the separate `Deploy main to production` GitHub Environment gate
pending formal `test` acceptance and explicit production approval.

After explicit owner approval for production on 2026-06-22, the same promotion
run `27962578783` deployed merge commit
`060295a50408b0b724c8283364018c4f534e291a` to production. The
`Deploy main to production` job succeeded from 2026-06-22T15:23:02Z to
2026-06-22T15:23:18Z. Visible production browser verification at
`https://crazyphrases.com/` was read-only and confirmed the signed-out
Anonymous solo surface loaded, hosted sign-in controls were available, no
`codex-smoke-history-1a75a4` smoke Handle was present, there was no horizontal
overflow, and browser warning/error logs were empty. The top-level stylesheet
plus all observed first-party JavaScript modules, including `pending-game.js`
and `supabase-config.js`, were stamped with merge commit
`060295a50408b0b724c8283364018c4f534e291a`, and no `__ASSET_VERSION__`
placeholder was visible. No hosted production Supabase data mutation was
performed during this production verification.

After explicit owner approval on 2026-06-23, the first Supabase MCP attempt to
apply source migration
`supabase/migrations/20260622213000_completed_multiplayer_history_pagination.sql`
failed before migration history advanced because the source SQL used
`pg_catalog.extract(epoch from ...)`; PostgreSQL treats `extract ... from ...`
as special syntax, not a schema-qualified function call. Hosted inspection
confirmed the existing no-argument
`public.list_completed_multiplayer_history()` RPC was still present and the
pagination migration was not recorded. The source migration and regression
test were corrected to use `pg_catalog.date_part('epoch', ...)`, and bundled
`node.exe --test tests/supabase-migration-surface.test.mjs` passed 16/16.
The corrected migration was then applied through the Supabase MCP as hosted
version `20260623121445 completed_multiplayer_history_pagination`. Read-only
schema verification confirmed the replacement
`public.list_completed_multiplayer_history(integer, bigint, uuid)` function is
stable, `security definer`, has defaulted page-size and cursor arguments, uses
the schema-qualified `date_part` cursor expression, avoids
schema-qualified `extract`, and grants execute only to `postgres` and
`authenticated`. Both `public.list_completed_multiplayer_history()` and
`public.list_completed_multiplayer_history(2, null, null)` returned the
expected unauthenticated empty paginated shape:
`{"batches":[],"hasMore":false,"nextCursor":null}`. No hosted browser
deployment smoke or hosted data mutation was performed during this migration
application; the PR #71 `dev` deployment remained behind its separate GitHub
Environment approval gate.

## Participant-Section Hosted Application

During Task 7 source closeout for the ADR 0015 participant-section
multiplayer foundation, the source migration
`supabase/migrations/20260618192252_participant_section_multiplayer_execution.sql`
had not yet been applied to hosted Supabase. PR #57 was deployed to `dev` on
2026-06-19 as branch commit
`f8ef3e1bae66324904f1377f9a86cf3a4b6376f7`; no `test` or production
deployment has been triggered for that foundation.

On 2026-06-19, read-only hosted SQL confirmed that `public.game_turns` and
`public.game_entries` both had zero rows before participant-section hosted
application. Read-only hosted SQL also confirmed that the participant-section
tables and RPCs from source migration
`20260618192252_participant_section_multiplayer_execution.sql` were not yet
present in hosted Supabase. Visible `dev` browser inspection therefore reached
the deployed runtime but showed the signed-in Multiplayer loading error path
until the hosted migration is applied.

After explicit owner approval on 2026-06-19, hosted migration
`20260619131018 participant_section_multiplayer_execution` was applied to the
live Supabase project. Schema verification confirmed the participant-section
tables, RLS, indexes, public RPCs, private helpers, trigger replacement,
legacy Turn execution revocation, notification grants, and zero new table rows
before smoke data setup. During signed-in smoke, the reveal RPC exposed an
ambiguous PL/pgSQL `ON CONFLICT` target; corrective hosted migration
`20260619132023 fix_multiplayer_reveal_conflict_target` replaced the reveal
function with a named unique-constraint conflict target and added the composite
`public.game_section_entries(assignment_id, game_id)` index required by the
Supabase performance advisor.

The signed-in `dev` smoke used existing Account Profile
`@player-00c9137f-e786-4e7d` and temporary Handle
`@codex-smoke-ps-6e2f`. The visible browser created the Pending Game invite,
the invitee accepted through the authenticated RLS path, the creator started
the game, and participant-section execution created per-participant
`entries_needed` notifications. The creator saw only their next assigned
section, submitted section 1 of 2, saw section 2 of 2, and made the final
submission after the invitee submitted their section through
`public.submit_multiplayer_section(uuid, jsonb)`. Hosted SQL confirmed the
final submitter's `batch_complete` notification was stored as `read` while the
other participant's was `unread`. The visible browser revealed the completed
batch, the top-bar notification dropdown listed both durable notification rows
and marked the remaining unread row read, and the invitee revealed the same
batch independently through `public.reveal_multiplayer_batch(uuid)`.

Cleanup deleted the Started Game, Pending Game, and temporary Auth/Profile
fixture. Follow-up hosted SQL confirmed zero rows remained for the smoke Auth
user, Account Profile, Handle Directory entry, Pending Game, Pending Game
participants, Started Game, Started Game participants, participant-section
assignments, participant-section entries, multiplayer reveals, and in-app
notifications. A final visible `dev` reload confirmed Account-backed mode,
an empty three-bucket Multiplayer dashboard, no smoke Handle, no load error,
and no browser warning/error logs.

## Schema Verification Summary

### Signed-In Current Games

Read-only hosted SQL confirmed:

- `public.signed_in_solo_current_games` exists with Row Level Security enabled.
- The table has no `anon` grants.
- `authenticated` and `service_role` have only `select`, `insert`, `update`,
  and `delete` grants.
- Account-owned `select`, `insert`, `update`, and `delete` policies exist for
  the `authenticated` role.
- Constraints enforce the Account foreign key, primary key, `revision >= 1`,
  `signed-in-solo` mode, matching `accountId`, and started-game payload.
- The `set_signed_in_solo_current_games_updated_at` trigger exists, calls the
  private-schema timestamp function, uses security invoker, and sets an empty
  function `search_path`.
- A hosted verification row was inserted, updated, and deleted on 2026-06-15;
  a follow-up check confirmed the table was empty again.

### Private Phrase Favourites

Read-only hosted SQL confirmed:

- `public.private_phrase_favourites` exists with Row Level Security enabled.
- The table has no `anon` grants.
- `authenticated` and `service_role` have only `select`, `insert`, and
  `delete` grants.
- Account-owned `select`, `insert`, and `delete` policies exist for the
  `authenticated` role.
- Constraints enforce the primary key, Account foreign key with
  `on delete cascade`, account-scoped unique `source_fingerprint`, and valid
  private Phrase Favourite snapshots.
- The table had zero rows immediately after migration application.
- Supabase advisors reported no performance warnings and no
  `private_phrase_favourites` security warning.
- A hosted rollback smoke simulated `authenticated`, inserted one favourite,
  confirmed duplicate source-fingerprint insertion affected zero rows, selected
  and deleted the row through Row Level Security, and rolled back.

### Private Batch Favourites

Read-only hosted SQL confirmed:

- `public.private_batch_favourites` exists with Row Level Security enabled.
- The table has no `anon` grants.
- `authenticated` and `service_role` have only `select`, `insert`, and
  `delete` grants.
- Account-owned `select`, `insert`, and `delete` policies exist for the
  `authenticated` role.
- Constraints enforce the primary key, Account foreign key with
  `on delete cascade`, account-scoped unique `source_fingerprint`, and valid
  private Batch Favourite snapshots.
- The table had zero rows immediately after migration application.
- Supabase advisors reported no performance warnings and no
  `private_batch_favourites` security warning.

### Account Profiles

Read-only hosted SQL confirmed:

- `public.account_profiles` exists with Row Level Security enabled.
- The table has no `anon` grants.
- `authenticated` and `service_role` have only `select`, `insert`, and
  `update` grants.
- Signed-in profile lookup, owner-only create, and owner-only update policies
  exist for the `authenticated` role.
- Constraints enforce the Account foreign key with `on delete cascade`, primary
  key, unique directory `profile_id`, unique `handle`, lower-case Handle format
  and length, Gamer Name length, and allowed Avatar keys.
- The table had zero rows immediately after migration application.
- Supabase generated TypeScript types after the schema change, but the app is
  plain JavaScript and the repository has no generated database-types owner
  file, so no generated type file was committed.
- Supabase advisors reported no performance warnings and no `account_profiles`
  security warning.
- The 2026-04-28 Supabase Data API exposure breaking-change guidance was
  reviewed before application; the migration uses explicit grants and keeps
  `anon` revoked.

### Account Profile Directory Corrections

Read-only hosted SQL confirmed:

- `public.account_profile_directory` is a base table, not a view.
- The directory exposes only `profile_id`, `handle`, `gamer_name`, and
  `avatar_key`.
- The directory has no `anon` grants; `authenticated` and `service_role` have
  only `select`.
- The directory has a signed-in `select` Row Level Security policy.
- The raw `public.account_profiles` table keeps owner-only `select`, `insert`,
  and `update` policies.
- The raw table has no table-level `authenticated` grant; browser access uses
  column-level grants for owner-profile load/create/update and does not grant
  `update` on `profile_id`, `created_at`, or `updated_at`.
- Simulating the hosted authenticated Account
  `f222c9a8-e424-4156-a378-c34eabc71bbf` showed one owner-visible raw profile
  row, one signed-in-visible directory row, matching Handle data, and no raw
  `account_id` column on the directory surface.
- Supabase performance advisors reported no lints, and security advisors no
  longer reported the Account Profile directory view issue.

### Pending Games

Read-only hosted SQL confirmed:

- `public.pending_games` and `public.pending_game_participants` exist with Row
  Level Security enabled.
- Both tables have no `anon` grants.
- `authenticated` has only `select` and `insert` on `pending_games`.
- `authenticated` has only `select` on `pending_game_participants`.
- Creator-owned Pending Game `select` and `insert` policies exist, and the
  participant-row `select` policy scopes rows to Pending Games created by the
  signed-in Account.
- `private.create_pending_game_participants()` is a private-schema security
  definer trigger function and is not executable by `public`, `anon`, or
  `authenticated`.
- The `create_pending_game_participants` trigger runs after inserts on
  `public.pending_games`.
- Planned foreign-key indexes and check constraints exist.
- Both new tables had zero rows immediately after migration application.
- Supabase generated TypeScript types after the schema change, but no generated
  type file was committed because the current app is plain JavaScript.
- Supabase security advisors reported only the existing project-level Auth
  leaked-password-protection warning.
- Supabase performance advisors reported expected `unused_index` info for the
  brand-new Pending Game indexes before live query traffic exists.
- The invite-response migration allows `accepted`, `pending`, and `declined`
  participant invite statuses while keeping creator rows accepted and invitee
  rows constrained to pending without an Account, accepted with an Account, or
  declined with an Account.
- Invitee-visible Pending Game `select`, invitee-visible participant-row
  `select`, and invitee response `update` policies exist for the
  `authenticated` role. Browser clients have update authority only on
  `public.pending_game_participants.account_id` and
  `public.pending_game_participants.invite_status`; they still do not have
  update authority on `public.pending_games`.
- `private.set_pending_game_participants_updated_at()` and
  `private.cancel_pending_game_after_invite_decline()` use an empty
  `search_path`, are not executable by `public`, `anon`, or `authenticated`,
  and are attached to the expected participant update triggers.
- The Started Game foundation migration adds `public.games` and
  `public.game_participants` with Row Level Security enabled, no `anon` grants,
  a narrow authenticated column grant only on
  `public.games(pending_game_id)`, no browser update authority on
  `public.pending_games`, private trigger-owned Pending Game conversion, a
  private RLS helper with narrow authenticated execute permission,
  participant snapshots, and resolved random Slot Allocation and Slot Order
  storage.
- Hosted verification for `20260618081517 start_pending_game_foundation`
  confirmed `public.games` and `public.game_participants` RLS, policies,
  private helper and trigger function `security definer` state, empty
  `search_path`, trigger attachment, column-level insert grant, no broad
  `pending_games` update authority, and zero rows immediately before the smoke.
- Supabase security advisors after the Started Game foundation migration
  reported only the existing project-level Auth leaked-password-protection
  warning. Performance advisors reported expected `unused_index` info for the
  brand-new Started Game indexes before live query traffic exists, plus the
  existing multiple-permissive-policy warnings on Pending Game select policies.
- The Started Game turn-submission migration adds `public.game_turns` and
  `public.game_entries` with Row Level Security enabled, no `anon` grants, no
  direct authenticated write grant on Turns or Entries, an authenticated
  `select` grant only on currently active assigned Turns, private trigger-owned
  Turn creation, and the narrow authenticated
  `public.submit_started_game_turn(uuid, jsonb)` RPC for complete Entry
  submission.
- Hosted verification for
  `20260618102626 started_game_turn_submission` confirmed the table grants,
  RLS policy, private helper and trigger functions, Started Game trigger
  attachment, and `public.submit_started_game_turn(uuid, jsonb)` RPC. Supabase
  generated TypeScript types after the schema change; the output included
  `game_turns`, `game_entries`, and `submit_started_game_turn`, but no type file
  was committed because the current app is plain JavaScript.
- Supabase advisors after the Started Game turn-submission migration reported
  intentional warnings for `game_entries` having RLS with no direct policy and
  for authenticated execution of the guarded `security definer` RPC, plus the
  existing project-level Auth leaked-password-protection warning. Performance
  advisors reported expected `unused_index` info for the new Turn/Entry indexes
  before live query traffic exists, plus existing Started Game and Pending Game
  advisories.
- The source-controlled creator-cancellation migration
  `20260619151000_creator_multiplayer_cancellation.sql` adds pending-aware
  notification targets, the `game_cancelled` notification type,
  `public.cancel_created_game(uuid)`, stale `entries_needed` read-status
  cleanup, and cancelled-game guards for dashboard, section submission, and
  Reveal. Hosted migration `20260619221615 creator_multiplayer_cancellation`
  applied it after explicit owner approval on 2026-06-19 and read-only
  verification confirmed the schema/RPC surface.

## Deployment And Smoke Evidence

| Date | Slice | Evidence |
| --- | --- | --- |
| 2026-06-15 | Private favourites dev smoke | Branch `codex/private-favourites` commit `962d17302fe2831ea14c3d23e6e6db7fb4adeee4` deployed to `dev` through the approved GitHub Environment workflow. Visible signed-in smoke saved a Batch Favourite, confirmed it persisted after `Start again`, had no overflow or browser logs, and read-only SQL confirmed one `public.private_batch_favourites` row. |
| 2026-06-15 | Private favourites removal polish | Branch `codex/private-favourites-remove-polish` commit `1c33c89ad168d9a568cc1fa57d7b9d38f2d7ed02` deployed to `dev`. Smoke marker `codexsmokebgmrnhbd` covered save, remove, re-save, reload persistence, current-game clear, and cleanup for Phrase and Batch Favourites; read-only SQL confirmed zero marker rows remained, zero Phrase Favourite rows, one retained earlier Batch Favourite row, and zero current-game rows. |
| 2026-06-16 | Account Profile initial promotion | PR #45 merge commit `2ad7993ee6b6cd5fa3d0975f15fd683606c9ca8a`, promotion run `27585762335`, deployed through `test` and production after owner approvals. Smokes showed hosted sign-in controls, stamped assets, no browser logs, no overflow, and retained one durable Account Profile with no transient game or favourite rows requiring cleanup. |
| 2026-06-16 | Account Profile dev validation | Branch `codex/durable-account-profile-handle-directory` commit `364fe3e320f469b0107ef419aad276b6a3758ac6` deployed to `dev`. Signed-out smoke passed. After owner-approved Google sign-in validation, the app hydrated Account-backed mode, retained the Account Profile after reload, and read-only SQL found exactly one profile row with directory `profile_id` separate from the raw Auth user id. No current-game or Favourite mutation smoke was performed. |
| 2026-06-16 | Account Profile correction promotion | PR #48 merge commit `46bea304b11d0e2472bff22aae2c67d73330f891`, promotion run `27612185923`, deployed through `test` and production after owner approvals. Smokes confirmed stamped local assets including `account-profile.js`, no browser logs, no overflow, and no hosted data-mutation smoke. |
| 2026-06-16 | Pending Game foundation promotion | PR #49 merge commit `497c84f39e6c19ba1c7f2c58a88b76a3967c8f6e`, promotion run `27623268625`, deployed through `test` and production after owner approvals. Smokes confirmed hosted sign-in controls or signed-in Account shell as expected, stamped assets, no browser logs, no overflow, and no hosted Supabase data mutation beyond the approved schema migration. |
| 2026-06-16 | Pending Game docs-only promotion cancellation | PR #50 merge commit `e2920bd650b46f5d807081aa9c827030a3317a75`, promote run `27625010945`, was cancelled before `test` or production deployment jobs ran because the change was docs-only. |
| 2026-06-17 | Pending Game creation UI promotion | PR #53 merge commit `d6b40550809f87b35bb2b84686ffd3fae6d62495`, promotion run `27684805862`, deployed through `test` and production after owner approvals. Dev, `test`, and production browser verification confirmed stamped runtime assets including `pending-game.js`, clean browser logs, and no horizontal overflow. Production verification was read-only because the visible browser was already signed in; the signed-in Pending Game panel mounted, but no hosted Pending Game create or cleanup smoke was performed. |
| 2026-06-17 | Pending Game creation hosted write/cleanup smoke | After explicit owner approval, production browser smoke created a hosted Pending Game invite through the signed-in UI for temporary Handle `codex-smoke-7e72926` with 15 phrases. Hosted SQL verification confirmed one pending game, creator accepted, invitee pending, and trigger-created participant rows. Cleanup deleted the Pending Game and the temporary smoke Auth/Profile fixture; follow-up SQL confirmed zero smoke Auth, Profile, directory, Pending Game, and participant rows remained, and both Pending Game tables were empty. |
| 2026-06-17 | Pending Game invite response dev deployment | Branch `codex/pending-game-invite-response` commit `4d37d1d470c3b516e09e8e70048808760fd8add9`, deploy-dev run `27692609312`, deployed to `dev` after owner approval. Visible `dev` browser smoke confirmed stamped `assets/app.js` and `assets/site.css` with the deployed commit SHA, hidden localhost-only test sign-in controls remained hidden, the anonymous 10-phrase flow reached reveal, `Copy all` copied the title plus ten phrases, and the browser had no console errors. No hosted Supabase data mutation or signed-in invite-response smoke was performed; source migration `20260617131817_support_pending_game_invite_responses.sql` remains unapplied to hosted Supabase pending separate approval. |
| 2026-06-17 | Pending Game invite response hosted smoke | After explicit owner approval, hosted migration `20260617135237 support_pending_game_invite_responses` was applied and schema-verified. Visible `dev` browser smoke signed in as the existing Account Profile `@player-00c9137f-e786-4e7d`, created invites to temporary Handle `@codex-smoke-ir-8d4`, simulated invitee accept and decline through the authenticated RLS path, verified the creator UI rendered `Accepted` and `Declined`, and saw no browser warnings or errors. Cleanup removed both smoke Pending Games and the temporary Auth/Profile fixture; follow-up SQL confirmed zero smoke Auth, Profile, directory, Pending Game, and participant rows remained, and both Pending Game tables were empty. |
| 2026-06-17 | Pending Game invite response promotion | PR #54 merge commit `97c64ac455d53a512d870d6fb46b4838b0e7cc6e`, promotion run `27694666076`, deployed through `test` and production after owner approvals. Visible `test` and production browser smokes confirmed stamped runtime assets at the merge commit, hidden localhost-only test sign-in controls, anonymous 10-phrase reveal, `Copy all`, clean browser logs, and no horizontal overflow. Production smoke was anonymous-only and did not mutate hosted Supabase data. |
| 2026-06-18 | Started Game foundation hosted smoke | PR #55 branch `codex/started-game-foundation` commit `fbe086926aa7c88b58f9d764e40e6a7154521b38` was deployed to `dev` after owner approval. Hosted migration `20260618081517 start_pending_game_foundation` was applied after explicit owner approval and schema-verified. Visible `dev` browser smoke confirmed stamped `assets/app.js` and `assets/site.css`, hidden localhost-only test controls, Account-backed mode for existing profile `@player-00c9137f-e786-4e7d`, clean browser warnings/errors, and no horizontal overflow. The smoke created a temporary invitee Auth/Profile fixture with Handle `@codex-smoke-sg-c5fff9`, created a 15-phrase Pending Game through the signed-in creator UI, simulated invitee acceptance through the authenticated RLS path, started the accepted Pending Game through the creator UI, verified the UI showed `Game started. Turns are not available yet.` and `Started`, and verified the persisted Started Game row, participant snapshots, three Slot Allocation entries, and three Slot Order entries. Cleanup removed the Started Game, Pending Game, and temporary Auth/Profile fixture; follow-up SQL confirmed zero smoke Auth, Profile, directory, Pending Game, participant, Started Game, and Started Game participant rows remained, and both Pending Game and Started Game tables were empty. |
| 2026-06-18 | Started Game foundation promotion | PR #55 merged to `main` as merge commit `22abb6bfd5652adb7b262636e3303fd64141cff3` and promoted through `test` and production by promotion run `27747189569` after owner approvals. Visible `test` and production browser smokes confirmed stamped runtime assets at the merge commit, hidden localhost-only test controls, signed-in Account shell for existing profile `@player-00c9137f-e786-4e7d`, Started Game-safe Multiplayer invite panel rendering, clean browser logs, and no horizontal overflow. Production verification kept hosted Supabase data read-only because the visible browser was signed in with an existing account-backed reveal; a separate temporary anonymous Playwright context verified a 10-phrase production reveal plus per-phrase copy and `Copy all` clipboard output without hosted Supabase mutation. |
| 2026-06-18 | Started Game turn-submission dev smoke | PR #56 branch `codex/started-game-turn-submission` commit `aadc524fe88b66d2c9c2ac34eb4b26254df1bc61` was deployed to `dev` after owner approval. Hosted migration `20260618102626 started_game_turn_submission` was applied after explicit owner approval and schema-verified. Visible `dev` browser smoke confirmed stamped runtime assets, hidden localhost-only test sign-in controls, clean browser warnings/errors, and no horizontal overflow. Hosted SQL smoke marker `codex-smoke-ts-bee3e1` created temporary Auth/Profile fixtures, inserted a Pending Game as the simulated authenticated creator, accepted it as the simulated authenticated invitee, started the Started Game through the authenticated `public.games(pending_game_id)` grant, confirmed three trigger-created Turns, submitted the first active Turn through `public.submit_started_game_turn(uuid, jsonb)`, confirmed 10 Entries and exactly one next active Turn visible to its assignee, and confirmed the submitted Turn was no longer visible to the submitter. Cleanup deleted the Started Game, Pending Game, and temporary Auth/Profile fixture; follow-up SQL confirmed zero smoke Auth, Profile, directory, Pending Game, participant, Started Game, Turn, and Entry rows remained. |
| 2026-06-18 | Started Game turn-submission promotion | PR #56 merged to `main` as merge commit `46033c134b2e3f10bd7f6d5a57865eebad39cfcd` and promoted through `test` and production by promotion run `27754207753` after owner approvals. Visible `test` smoke confirmed stamped runtime assets at the merge commit, hidden localhost-only test controls, signed-in Account shell rendering, reveal, favourites, Multiplayer invite panel rendering, clean browser logs, and no horizontal overflow. Visible production smoke confirmed stamped runtime assets at the merge commit, hidden localhost-only test controls, signed-in Account shell rendering, reveal, favourites, Multiplayer invite panel rendering, clean browser logs, and no horizontal overflow. Both `test` and production promotion smokes were read-only and did not mutate hosted Supabase data. |
| 2026-06-19 | Participant-section pre-migration dev observation | PR #57 branch `codex/multiplayer-execution-redesign` commit `f8ef3e1bae66324904f1377f9a86cf3a4b6376f7` was deployed to `dev` by deploy-dev run `27826214483` after owner approval. Visible `dev` browser inspection confirmed first-party runtime assets, transitive modules, and the Word Bank JSON were stamped with the deployed commit SHA, and browser warnings/errors were clean. The existing signed-in session rendered Account-backed mode and the Notifications button, but the Multiplayer dashboard showed `Game invites could not be loaded. Try again.` Read-only hosted SQL confirmed migrations only through `20260618102626 started_game_turn_submission`, zero rows in `public.game_turns` and `public.game_entries`, and absence of participant-section tables/RPCs. No hosted data mutation smoke was performed. |
| 2026-06-19 | Participant-section hosted migration and dev smoke | After explicit owner approval, hosted migration `20260619131018 participant_section_multiplayer_execution` was applied, then corrective migration `20260619132023 fix_multiplayer_reveal_conflict_target` fixed the reveal RPC conflict target and added the section-entry composite FK index. Schema verification confirmed participant-section tables/RLS/indexes/RPCs, legacy Turn trigger/RPC revocation, notification grants, and cleanup-empty new tables. Visible `dev` smoke with existing Account Profile `@player-00c9137f-e786-4e7d` and temporary Handle `@codex-smoke-ps-6e2f` created an invite, accepted it through invitee-authenticated RLS, started a game, submitted only the visible creator sections while the invitee submitted through authenticated RPC, verified final-submitter `batch_complete` notification status `read`, revealed phrases in the browser, verified dropdown rows marked read when viewed, independently revealed as invitee through RPC, and cleaned up all smoke Auth/Profile/Pending Game/Started Game/section/entry/reveal/notification rows. Final visible reload showed an empty Multiplayer dashboard, no smoke handle, no load error, and no browser warning/error logs. |
| 2026-06-19 | Participant-section test promotion | PR #57 merged to `main` as merge commit `60b0fe7d169c1b829f50ff97ab62cf1e712d0e97` and promotion run `27833585561` deployed it to `test` after owner approval. Visible `test` browser smoke confirmed stamped top-level assets and transitive first-party JavaScript modules at the merge commit SHA, signed-in Account-backed mode, the top-bar Notifications button, the Multiplayer dashboard buckets `Awaiting your entries`, `Awaiting other player entries`, and `Batches completed`, hidden localhost-only test sign-in controls, no invite-load error, no browser warning/error logs, and no horizontal overflow. No production approval/deployment or hosted Supabase data mutation was performed during this test smoke. |
| 2026-06-19 | Participant-section production promotion | Promotion run `27833585561` deployed PR #57 merge commit `60b0fe7d169c1b829f50ff97ab62cf1e712d0e97` to production after owner approval. Visible production browser smoke confirmed stamped top-level assets, transitive first-party JavaScript modules, and the Word Bank JSON at the merge commit SHA, signed-in Account-backed mode, the top-bar Notifications button, the Multiplayer dashboard buckets `Awaiting your entries`, `Awaiting other player entries`, and `Batches completed`, hidden localhost-only test sign-in controls, no invite-load error, no browser warning/error logs, and no horizontal overflow. The smoke was read-only apart from normal signed-in session refresh/read queries and did not create, update, or clean up hosted game data. |
| 2026-06-19 | Creator-cancellation dev write/cleanup smoke | After explicit owner approval, visible `dev` browser smoke used existing creator `@player-00c9137f-e786-4e7d` and temporary invitee `@codex-smoke-cc-0803c1`. The browser created a 10-phrase invite, the invitee accepted through authenticated RLS, the creator started and then cancelled the Started Game before Reveal, and the UI showed `Game cancelled.`, `Cancelled`, no `Submit section`, empty dashboard buckets, and no horizontal overflow. Hosted SQL verified cancelled Pending Game `100fac25-0994-4120-a32b-8590a510587a`, Started Game `376b6745-3af2-481b-a416-3fb12684374b`, no Reveal, read stale `entries_needed` notifications, and one unread invitee `game_cancelled` notification. Cleanup deleted the smoke Started Game, Pending Game, and temporary Auth/Profile fixture; follow-up SQL confirmed zero smoke rows across Auth, Profile, Directory, Pending Game, Started Game, section, reveal, and notification tables. |
| 2026-06-19 | Creator-cancellation promotion | PR #58 merged to `main` as merge commit `91e855bee56286fb3a7cafdfc5447d2391cce7e7` and promoted through `test` and production by promotion run `27851753455` after owner approvals. `Deploy main to test` succeeded from 2026-06-19T22:55:27Z to 2026-06-19T22:55:45Z, and `Deploy main to production` succeeded from 2026-06-19T23:10:50Z to 2026-06-19T23:11:08Z. Visible `test` and production smokes confirmed Crazy Phrases loaded in signed-in Account-backed mode for `@player-00c9137f-e786-4e7d`, Notifications rendered, the Multiplayer invite panel and the three dashboard buckets rendered, localhost-only test sign-in controls stayed hidden, no invite-load error appeared, there was no horizontal overflow, and browser warning/error logs were empty. Top-level and transitive first-party assets, including `pending-game.js` and `word-bank-seed.json`, were stamped with the merge commit SHA and no `__ASSET_VERSION__` placeholder remained. The promotion smokes were read-only normal signed-in session refresh/read checks and did not mutate hosted game data. |
| 2026-06-22 | Completed history Reveal from history dev deployment | PR #70 branch `codex/reveal-completed-history` commit `36c227be98297eae3bd235bca42ee291d8b92057` deployed to `dev` by deploy-dev run `27971960568` after owner approval. PR #70 was promoted from draft to ready for review. Visible `dev` browser smoke confirmed Crazy Phrases loaded in signed-in Account-backed mode for `@vhcoder`, top-level assets and transitive first-party JavaScript modules were stamped with the branch commit SHA, no `__ASSET_VERSION__` placeholder remained, the completed multiplayer history surface opened from `Batches completed`, the current Account had no completed multiplayer batches, no `Reveal phrases` action was rendered, there was no horizontal overflow, and browser warning/error logs were empty. The smoke was read-only normal signed-in session refresh/read verification and did not create, reveal, update, or clean up hosted Supabase game data. |
| 2026-06-22 | Completed history Reveal from history dev write/cleanup smoke | After explicit owner approval for hosted game-data mutation and cleanup, PR #70 branch commit `36c227be98297eae3bd235bca42ee291d8b92057` was smoke-tested in `dev` using existing creator Account Profile `@vhcoder` and temporary invitee Handle `@codex-smoke-history-1d1c62`. The visible browser created a 10-phrase Pending Game invite, the temporary invitee accepted through the authenticated RLS path, the creator started the accepted game through the visible UI, the temporary invitee submitted `noun-2` through `public.submit_multiplayer_section(uuid, jsonb)`, and the creator submitted `noun-1` plus `adjective` through the visible UI. Hosted SQL confirmed `public.list_completed_multiplayer_history()` returned Started Game `d8f91630-9690-4221-a690-95564adda64e` from Pending Game `342e117f-3788-4b45-857f-88525a6af04b` as `revealed: false` with `phrases: null` before Reveal. The visible `Completed multiplayer history` page showed the batch as `Not revealed yet.` with no phrase text, then the history-page `Reveal phrases` action rendered ten phrases in original row order from `Briska laddera teapota` through `Briskj ladderj teapotj`; the top-level app assets remained stamped with the deployed branch commit SHA, no `__ASSET_VERSION__` placeholder was visible, and there was no horizontal overflow. Browser console capture was unavailable in this Browser evaluate scope, so this run did not record browser warning/error logs. Cleanup deleted four in-app notifications, one Reveal row, 30 section entries, three section assignments, two Started Game participants, one Started Game, two Pending Game participants, one Pending Game, one Handle Directory row, one Account Profile row, and one temporary Auth user. Follow-up hosted SQL confirmed zero rows remained for the smoke Auth user, Account Profile, Handle Directory entry, Pending Game, Pending Game participants, Started Game, Started Game participants, section assignments, section entries, multiplayer reveals, and in-app notifications. A final visible `dev` reload showed Account-backed mode for `@vhcoder`, empty Multiplayer dashboard buckets, empty completed Multiplayer history, no smoke Handle, and no horizontal overflow. |
| 2026-06-22 | Completed history Reveal from history test promotion | PR #70 was merged to `main` as merge commit `8524ec3c46af68b97ee39ec0f3716ec5a5a70277`. Promotion run `27976166867` deployed that commit to `test` after explicit owner approval for the `Deploy main to test` GitHub Environment gate. The `Deploy main to test` job succeeded from 2026-06-22T18:55:04Z to 2026-06-22T18:55:21Z. Visible `test` browser verification confirmed Crazy Phrases loaded in signed-in Account-backed mode for `@vhcoder`, completed Multiplayer history opened from the `Batches completed` dashboard bucket, the history page showed `No completed multiplayer batches yet.`, no `Reveal phrases` action or phrase list was rendered, no `codex-smoke-history-1d1c62` or `codex-smoke-history-1a75a4` smoke Handle was present, there was no horizontal overflow, and browser warning/error logs were empty. The top-level stylesheet plus all observed first-party JavaScript modules, including `pending-game.js`, `supabase-config.js`, and `word-bank-seed.json`, were stamped with merge commit `8524ec3c46af68b97ee39ec0f3716ec5a5a70277`, and no `__ASSET_VERSION__` placeholder was visible. The smoke was read-only apart from normal signed-in session refresh/read checks and did not create, reveal, update, or clean up hosted Supabase game data. The promotion workflow then waited at the separate `Deploy main to production` GitHub Environment gate pending explicit production approval. |
| 2026-06-22 | Completed history Reveal from history production promotion | After explicit owner approval for production, promotion run `27976166867` deployed PR #70 merge commit `8524ec3c46af68b97ee39ec0f3716ec5a5a70277` to production. The `Deploy main to production` job succeeded from 2026-06-22T21:01:45Z to 2026-06-22T21:02:01Z. Visible production browser verification at `https://www.crazyphrases.com/` confirmed Crazy Phrases loaded in signed-in Account-backed mode for `@vhcoder`, completed Multiplayer history opened from the `Batches completed` dashboard bucket, the history page showed `No completed multiplayer batches yet.`, no `Reveal phrases` action or phrase list was rendered, no `codex-smoke-history-1d1c62` or `codex-smoke-history-1a75a4` smoke Handle was present, there was no horizontal overflow, and browser warning/error logs were empty. The top-level stylesheet plus all observed first-party JavaScript modules, including `pending-game.js`, `supabase-config.js`, and `word-bank-seed.json`, were stamped with merge commit `8524ec3c46af68b97ee39ec0f3716ec5a5a70277`, and no `__ASSET_VERSION__` placeholder was visible. The production smoke was read-only apart from normal signed-in session refresh/read checks and did not create, reveal, update, or clean up hosted Supabase game data. |
| 2026-06-23 | Completed history pagination hosted migration | After explicit owner approval, the first Supabase MCP application of source migration `20260622213000_completed_multiplayer_history_pagination.sql` failed before migration history advanced because `pg_catalog.extract(epoch from ...)` is invalid PostgreSQL syntax. Hosted inspection confirmed the previous no-argument RPC remained in place. The source migration and regression test were corrected to `pg_catalog.date_part('epoch', ...)`; focused migration-surface tests passed 16/16. Corrected hosted migration `20260623121445 completed_multiplayer_history_pagination` then applied successfully. Read-only schema verification confirmed the defaulted `(integer, bigint, uuid)` RPC signature, authenticated-only execute grant, valid default and parameter call shapes, and no hosted browser smoke or hosted data mutation was performed. This proved RPC shape and permissions, not row-backed pagination behaviour. |
| 2026-06-23 | Completed history pagination dev deployment | PR #71 branch `codex/completed-history-pagination` runtime-changing commit `0d0b6e168cbd33edee0eac2de65b4f4401a33e53` deployed to `dev` by deploy-dev run `27987518058` after explicit owner approval for the `Deploy branch to dev` GitHub Environment gate. The deploy job succeeded from 2026-06-23T12:26:41Z to 2026-06-23T12:26:59Z. A later branch commit `e0eb5ade44dd71d8068bfe865cdc5720bd4d4834` corrected source migration/test/ledger files only and did not trigger another static deployment under the source-only path rules. Visible `dev` browser verification confirmed Crazy Phrases loaded in signed-in Account-backed mode for `@vhcoder`, first-party scripts, stylesheet, and `word-bank-seed.json` were stamped with deployed commit `0d0b6e168cbd33edee0eac2de65b4f4401a33e53`, no `__ASSET_VERSION__` placeholder was observed, the completed Multiplayer history page opened from `View all completed batches`, the hosted `list_completed_multiplayer_history` RPC was observed, the history page showed `No completed multiplayer batches yet.`, no `Load more` or `Reveal phrases` action was rendered, no `codex-smoke-history-1d1c62` or `codex-smoke-history-1a75a4` smoke Handle was present, there was no horizontal overflow, and browser warning/error logs were empty. The smoke was read-only apart from normal signed-in session refresh/read checks and did not create, reveal, update, or clean up hosted Supabase game data. Because the Account had zero completed batches, this was an empty-state deployment smoke only; it did not exercise pagination, cursor ordering, `Load more`, or non-empty completed-history rendering. |
| 2026-06-23 | Completed history pagination test promotion | PR #71 merged to `main` as merge commit `4aa196f4019fce4094acd81ad9fee8660a5e60af`. Promotion run `28026481310` deployed that commit to `test` after explicit owner approval for the `Deploy main to test` GitHub Environment gate. The `Deploy main to test` job succeeded from 2026-06-23T12:37:53Z to 2026-06-23T12:38:10Z. Visible `test` browser verification confirmed Crazy Phrases loaded in signed-in Account-backed mode for `@vhcoder`, first-party scripts, stylesheet, and `word-bank-seed.json` were stamped with merge commit `4aa196f4019fce4094acd81ad9fee8660a5e60af`, no `__ASSET_VERSION__` placeholder was observed, the completed Multiplayer history page opened from `View all completed batches`, the hosted `list_completed_multiplayer_history` RPC was observed, the history page settled from `Loading completed batches...` to `No completed multiplayer batches yet.`, no `Load more` or `Reveal phrases` action was rendered, no `codex-smoke-history-1d1c62` or `codex-smoke-history-1a75a4` smoke Handle was present, there was no horizontal overflow, and browser warning/error logs were empty. The smoke was read-only apart from normal signed-in session refresh/read checks and did not create, reveal, update, or clean up hosted Supabase game data. Because the Account had zero completed batches, this was an empty-state deployment smoke only; it did not exercise pagination, cursor ordering, `Load more`, or non-empty completed-history rendering. The promotion workflow then waited at the separate `Deploy main to production` GitHub Environment gate pending explicit production approval. |
| 2026-06-23 | Completed history pagination test write/cleanup smoke | After explicit owner approval for hosted `test` Supabase data mutation, a marked fixture `@codex-smoke-pagination-9f8e` created 21 temporary completed multiplayer batches for existing creator `@vhcoder` and one temporary invitee Auth/Profile row. Direct hosted RPC verification under `@vhcoder` returned 20 batches on page one with `hasMore: true` and a cursor, then one batch on the cursor page with `hasMore: false`. Visible `test` browser verification against stamped app script `4aa196f4019fce4094acd81ad9fee8660a5e60af` opened completed history, confirmed 20 rendered cards plus `Load more`, loaded the 21st card without replacing the first page, confirmed no phrase text before Reveal, revealed the later-page batch, and rendered ten phrases including `Brisk01-0 ladder01-0 teapot01-0`. The browser reported no warning/error logs and no horizontal overflow. Cleanup removed the temporary reveal, 630 section entries, 63 section assignments, 42 game participants, 42 Pending Game participants, 21 Started Games, 21 Pending Games, related notifications, one Account Profile/Directory row, and one temporary Auth user. Follow-up hosted SQL confirmed zero smoke rows across Auth, Profile, Directory, Pending Game, Started Game, section, reveal, and notification tables. A final visible `test` reload showed Account-backed mode for `@vhcoder`, the completed-history empty state, no `codex-smoke-pagination-9f8e` Handle, no `Load more`, no horizontal overflow, and no browser warning/error logs. |
| 2026-06-23 | Completed history pagination production promotion | After explicit owner approval for production, promotion run `28026481310` deployed PR #71 merge commit `4aa196f4019fce4094acd81ad9fee8660a5e60af` to production. The `Deploy main to production` job succeeded from 2026-06-23T13:30:37Z to 2026-06-23T13:30:54Z. Visible production browser verification at `https://www.crazyphrases.com/` confirmed Crazy Phrases loaded in signed-in Account-backed mode for `@vhcoder`, the completed Multiplayer history page opened from `View all completed batches`, the history page showed `No completed multiplayer batches yet.`, no `Load more` or `Reveal phrases` action was rendered, no `codex-smoke-pagination-9f8e`, `codex-smoke-history-1d1c62`, or `codex-smoke-history-1a75a4` smoke Handle was present, there was no horizontal overflow, and browser warning/error logs were empty. The top-level stylesheet plus all observed first-party JavaScript modules, including `pending-game.js`, `supabase-config.js`, and `word-bank-seed.json`, were stamped with merge commit `4aa196f4019fce4094acd81ad9fee8660a5e60af`, and no `__ASSET_VERSION__` placeholder was visible. The production smoke was read-only apart from normal signed-in session refresh/read checks and did not create, reveal, update, or clean up hosted Supabase game data. Data-backed pagination, cursor ordering, `Load more`, and later-page Reveal behaviour remain covered by the approved hosted `test` write/cleanup smoke above rather than by production data mutation. |
| 2026-06-23 | Pending invite expiry hosted migration and dev smoke | After explicit owner approval, hosted migration `20260623161126 pending_game_invite_expiry` applied source migration `supabase/migrations/20260623151948_pending_game_invite_expiry.sql`. Schema verification confirmed `public.pending_games.expires_at` as non-null `timestamptz` with the seven-day default, the status constraint includes `expired`, the partial pending `expires_at` index exists, invite-response and Game-start policies include unexpired Pending Game guards, and start/cancel RPCs include expiry guards. Supabase advisors reported expected existing security advisories plus a new expected `unused_index` info item for `pending_games_pending_expires_at_idx` immediately after creation. Visible `dev` browser smoke at `https://dev.crazyphrases.com/` confirmed first-party assets stamped with branch commit `15bb0c3e7e46ec0b5e42f6deffebabf4005ffa70`, signed-in Account-backed mode for `@vhcoder`, the Pending Game panel/form visible, the previous `Game invites could not be loaded. Try again.` error gone, localhost-only test controls hidden, no horizontal overflow, and clean browser warning/error logs. The smoke was read-only normal signed-in session refresh/read verification and did not create, update, or clean up hosted game data. |
| 2026-06-23 | Pending invite expiry test promotion | PR #72 merged to `main` as merge commit `791165b97896ebdfb8ee22623ca224272fbb8c64`. Promotion run `28039043049` deployed that commit to `test` after explicit owner approval for the `Deploy main to test` GitHub Environment gate. The `Deploy main to test` job succeeded from 2026-06-23T16:28:13Z to 2026-06-23T16:28:29Z. Visible `test` browser verification at `https://test.crazyphrases.com/` confirmed Crazy Phrases loaded in signed-in Account-backed mode for `@vhcoder`, the Profile surface rendered, the Pending Game panel/form rendered, the three Multiplayer dashboard buckets and completed-history link rendered, no invite-load or profile-load error appeared, localhost-only test controls stayed hidden, there was no horizontal overflow, and browser warning/error logs were empty. The top-level stylesheet plus all observed first-party JavaScript modules, including `pending-game.js`, `supabase-config.js`, and `word-bank-seed.json`, were stamped with merge commit `791165b97896ebdfb8ee22623ca224272fbb8c64`, and no `__ASSET_VERSION__` placeholder was visible. The smoke was read-only apart from normal signed-in session refresh/read checks and did not create, update, or clean up hosted game data. The promotion workflow then waited at the separate `Deploy main to production` GitHub Environment gate pending explicit production approval. |
| 2026-06-23 | Pending invite expiry production promotion | After explicit owner approval for production, promotion run `28039043049` deployed PR #72 merge commit `791165b97896ebdfb8ee22623ca224272fbb8c64` to production. The `Deploy main to production` job succeeded from 2026-06-23T16:40:03Z to 2026-06-23T16:40:18Z. Visible production browser verification at `https://www.crazyphrases.com/` confirmed Crazy Phrases loaded in signed-in Account-backed mode for `@vhcoder`, the Profile surface rendered, the Pending Game panel/form rendered, the three Multiplayer dashboard buckets and completed-history link rendered, no invite-load or profile-load error appeared, localhost-only test controls stayed hidden, there was no horizontal overflow, and browser warning/error logs were empty. The top-level stylesheet plus all observed first-party JavaScript modules, including `pending-game.js`, `supabase-config.js`, and `word-bank-seed.json`, were stamped with merge commit `791165b97896ebdfb8ee22623ca224272fbb8c64`, and no `__ASSET_VERSION__` placeholder was visible. The production smoke was read-only apart from normal signed-in session refresh/read checks and did not create, update, or clean up hosted game data. |
| 2026-06-24 | Nudge timeout foundation hosted migrations | After explicit owner approval, hosted migration `20260624094619 nudge_timeout_foundation` applied source migration `supabase/migrations/20260624103000_nudge_timeout_foundation.sql`. Read-only schema verification confirmed `nudge_timeout_hours` on `public.pending_games` and `public.games`, `available_at` on `public.game_section_assignments`, nudge-target columns and constraints on `public.in_app_notifications`, authenticated-only public RPC grants, and private overdue-nudge generation without browser notification insert authority. Supabase performance advisors then flagged missing FK-order index coverage for `public.in_app_notifications` constraint `in_app_notifications_target_assignment_fk`; corrective source migration `supabase/migrations/20260624104500_fix_nudge_notification_assignment_fk_index.sql` and hosted migration `20260624094839 fix_nudge_notification_assignment_fk_index` replaced the initial single-column assignment index with `in_app_notifications_target_assignment_game_idx` on `(target_assignment_id, target_game_id)`. Follow-up hosted catalogue verification confirmed the composite index exists and the old single-column index is absent. Performance advisors no longer report the unindexed FK; remaining items are expected existing multiple-policy warnings and unused-index info for new or previously unused indexes. Security advisors remained at the existing project posture: RLS/no-policy info for RPC-owned tables, intentional authenticated `SECURITY DEFINER` RPC warnings, and Auth leaked-password protection disabled. No hosted browser smoke or hosted game-data mutation was performed. |
| 2026-06-24 | Nudge timeout foundation dev deployment | PR #73 was promoted from draft to ready for review, then branch `codex/nudge-timeout-foundation` commit `b9ee5c0155f34525052e384a07f246df8ec1d63b` deployed to `dev` by deploy-dev run `28090665813` after explicit owner approval for the `Deploy branch to dev` GitHub Environment gate. The run completed successfully at 2026-06-24T10:09:13Z after static-site verification, strict FTPS target verification, Supabase runtime config rendering, asset stamping, and FTPS upload. Visible `dev` browser verification at `https://dev.crazyphrases.com/` confirmed Crazy Phrases loaded in signed-in Account-backed mode for `@vhcoder`, localhost-only test controls were hidden, the nudge timeout selector rendered with `1 day`, `2 days`, `3 days`, and `7 days` options and `2 days` selected, the Pending Game invite panel and three Multiplayer dashboard buckets rendered, there was no horizontal overflow, and browser warning/error logs were empty. The top-level stylesheet plus all observed first-party JavaScript modules, including `pending-game.js`, `supabase-config.js`, and `word-bank-seed.json`, were stamped with commit `b9ee5c0155f34525052e384a07f246df8ec1d63b`, and no `__ASSET_VERSION__` placeholder was visible. The smoke was read-only apart from normal signed-in session refresh/read checks and did not create, update, nudge, or clean up hosted game data. |
| 2026-06-24 | Nudge timeout foundation test promotion | PR #73 merged to `main` as merge commit `afb06888a9eabe1ae0cd662e63b7fc8bb6e83c40`. Promotion run `28091498010` deployed that commit to `test` after explicit owner approval for the `Deploy main to test` GitHub Environment gate. The `Deploy main to test` job succeeded from 2026-06-24T10:22:50Z to 2026-06-24T10:23:07Z after static-site verification, strict FTPS target verification, Supabase runtime config rendering, asset stamping, and FTPS upload. Visible `test` browser verification at `https://test.crazyphrases.com/` confirmed Crazy Phrases loaded in signed-in Account-backed mode for `@vhcoder`, localhost-only test controls were hidden, the nudge timeout selector rendered with `1 day`, `2 days`, `3 days`, and `7 days` options and `2 days` selected, the Pending Game invite panel, three Multiplayer dashboard buckets, and completed-history link rendered, there was no horizontal overflow, and browser warning/error logs were empty. The top-level stylesheet plus all observed first-party JavaScript modules, including `pending-game.js`, `supabase-config.js`, and `word-bank-seed.json`, were stamped with merge commit `afb06888a9eabe1ae0cd662e63b7fc8bb6e83c40`, and no `__ASSET_VERSION__` placeholder was visible. The smoke was read-only apart from normal signed-in session refresh/read checks and did not create, update, nudge, or clean up hosted game data. The promotion workflow then waited at the separate `Deploy main to production` GitHub Environment gate pending explicit production approval. |
| 2026-06-24 | Nudge timeout foundation production promotion | After explicit owner approval for production, promotion run `28091498010` deployed PR #73 merge commit `afb06888a9eabe1ae0cd662e63b7fc8bb6e83c40` to production. The `Deploy main to production` job succeeded from 2026-06-24T10:30:38Z to 2026-06-24T10:30:56Z after strict FTPS target verification, Supabase runtime config rendering, asset stamping, and FTPS upload. Visible production browser verification at `https://www.crazyphrases.com/` confirmed Crazy Phrases loaded in signed-in Account-backed mode for `@vhcoder`, the Profile surface rendered, localhost-only `Test sign in` and `Test invitee sign in` controls were hidden, the nudge timeout selector rendered with `1 day`, `2 days`, `3 days`, and `7 days` options and `2 days` selected, the Multiplayer invite panel, three dashboard buckets, and completed-history link rendered, there was no horizontal overflow, and browser warning/error logs were empty. The top-level stylesheet plus all observed first-party JavaScript modules, including `pending-game.js`, `supabase-config.js`, and `word-bank-seed.json`, were stamped with merge commit `afb06888a9eabe1ae0cd662e63b7fc8bb6e83c40`, and no `__ASSET_VERSION__` placeholder was visible. The production smoke was read-only apart from normal signed-in session refresh/read checks and did not create, update, nudge, or clean up hosted game data. |
| 2026-06-24 | Nudge timeout foundation test write/cleanup smoke | After explicit owner approval for hosted `test` Supabase data mutation and cleanup, a marked fixture used existing creator Account Profile `@vhcoder` and temporary invitee Handle `@codex-smoke-nudge-080d57`. Setup created temporary Auth user `ff7ffd2f-2752-40a8-94ab-d401e02a54cd`, Account Profile `e3aed5b1-5a6b-452a-9246-1f5b1a9ca6e8`, Pending Game `e25b88b4-9768-41f9-a24f-e230805f3161`, Started Game `ab1fe6e9-d069-40cd-8d36-5fc43a275141`, and backdated creator assignment `f40fb61e-7d68-4f07-851d-2e4a3aab81b4` to `2026-06-23T10:54:17Z` with a 24-hour nudge timeout. Initial SQL confirmed zero `nudge` notifications and two `entries_needed` notifications. Visible `test` browser refresh as `@vhcoder` showed the smoke game in `Awaiting your entries`, `Nudge after 1 day`, Section 1 of 2, `Fill these adjectives`, no horizontal overflow, and no browser warning/error logs. Hosted SQL after the first refresh confirmed exactly one unread `nudge` notification `a55efe5c-0626-4239-bf00-7b08c77c62c6` for the backdated assignment. A second visible dashboard refresh kept the same awaiting-entry card, updated the visible notification count to two unread prompts, and hosted SQL confirmed the nudge count remained one for the same assignment and notification id. Cleanup deleted three in-app notifications, three section assignments, two Started Game participants, one Started Game, two Pending Game participants, one Pending Game, one Account Profile/Directory row, and one temporary Auth user. Follow-up hosted SQL confirmed zero smoke rows across Auth, Account Profile, Handle Directory, Pending Game, Started Game, section entries, section assignments, reveals, and notifications. A final visible `test` reload showed Account-backed mode for `@vhcoder`, all three dashboard buckets empty, no `codex-smoke-nudge-080d57` Handle, zero unread notifications, no horizontal overflow, and no browser warning/error logs. During setup, one failed Auth insert rolled back because `auth.users.confirmed_at` is generated, and the fixture was completed with sequential SQL statements after data-modifying CTE visibility proved unsuitable for depending on trigger-created participant and assignment rows. |
| 2026-06-24 | Uploaded Avatar hosted migration | After explicit owner approval for Supabase Storage mutation, hosted migration `20260624212005 uploaded_avatar_profile` applied source migration `supabase/migrations/20260624150000_uploaded_avatar_profile.sql`. Read-only hosted verification confirmed public Storage bucket `avatars` exists with 1 MiB file-size limit and allowed MIME types `image/jpeg`, `image/png`, and `image/webp`; Avatar descriptor columns exist on `public.account_profiles`, `public.account_profile_directory`, `public.pending_game_participants`, and `public.game_participants`; `public.uploaded_avatar_objects` exists with `object_path` and `lifecycle_status`; authenticated owner-scoped metadata policies exist on `public.uploaded_avatar_objects`; and owner-scoped pending-object upload/delete policies exist on `storage.objects`. Supabase security advisors reported no new uploaded-avatar-specific warning beyond the existing project posture for RPC-owned tables, intentional authenticated `SECURITY DEFINER` RPCs, and Auth leaked-password protection. Performance advisors reported expected existing multiple-policy and unused-index info plus immediate unused-index info for the new uploaded-avatar metadata indexes. No hosted browser upload/write/cleanup smoke had been performed at this migration-verification point; the later dev browser write/restore row records that validation. Production uploaded-avatar write smoke remains separately approval-gated. |
| 2026-06-24 | Uploaded Avatar dev browser write/restore smoke | After explicit owner approval for the branch deployment, deploy-dev run `28130977697` deployed branch `codex/uploaded-avatar-profile` commit `0bc8ce0f24041ed1e1c0a5ef7d3832566d27ea93` to `dev`. Visible in-app browser verification at `https://dev.crazyphrases.com/` confirmed first-party `site.css` and `app.js` were stamped with the deployed commit, the Font Awesome Kit script loaded, the signed-in Account Profile for `@vhcoder` rendered with the uploaded-image control, and the mobile viewport had no horizontal overflow. A generated 128 x 128 PNG smoke file was selected manually in the visible browser; the preview used a local `blob:` URL before Save profile. Saving the Profile uploaded `uploaded/bce88cbd-3047-44bc-92b8-095f8d298fb0.png` to the public `avatars` bucket, changed the live Account Profile descriptor to `avatar_type = uploaded`, created matching `uploaded_avatar_objects` metadata with `content_type = image/png`, `byte_size = 489`, `width = 128`, `height = 128`, `lifecycle_status = live`, and produced a Storage object row. Reloading the deployed page restored the uploaded avatar from its Supabase public Storage URL with natural width `128`. Saving back to the Built-in Avatar `dice` restored `@vhcoder` to `avatar_type = built-in`, `avatar_key = dice`, and no `avatar_object_path`; the generated object moved to `lifecycle_status = historical`, and read-only reference checks showed zero live Account Profile, Handle Directory, Pending Game participant, or Started Game participant references. The final hydrated visible browser state showed Account-backed mode for `@vhcoder`, Built-in Avatar `dice`, no uploaded image preview, Font Awesome `fa-solid fa-dice` rendering through the Font Awesome 7 webfont with non-zero dimensions, no horizontal overflow, and clean browser warning/error logs. Direct SQL deletion of the Storage object was intentionally blocked by Supabase Storage's `protect_delete()` guard, and the Supabase CLI/Storage API deletion path was unavailable in this session; the generated smoke object remains as an unreferenced historical Uploaded Avatar object rather than bypassing Storage deletion protections. |
| 2026-06-25 | Uploaded Avatar test promotion and browser write/restore smoke | PR #74 merged to `main` as merge commit `f7d2d55cf26ed01381e2800fc2589a13ea6799be`. Promotion run `28166782275` deployed that commit to `test` after explicit owner approval for the `Deploy main to test` GitHub Environment gate; the `Deploy main to test` job succeeded from 2026-06-25T11:37:24Z to 2026-06-25T11:37:43Z after static-site verification, strict FTPS target verification, Supabase runtime config rendering, asset stamping, and FTPS upload. Visible in-app browser verification at `https://test.crazyphrases.com/` confirmed first-party `site.css` and `app.js` were stamped with merge commit `f7d2d55cf26ed01381e2800fc2589a13ea6799be`, the Font Awesome Kit script loaded, and the signed-in Account Profile for `@vhcoder` rendered with the uploaded-image control. Built-in Avatar functionality was exercised by saving `gamepad`, reloading, and confirming `fa-solid fa-gamepad` rendered from persisted profile state. A generated 128 x 128 PNG smoke file was selected manually in the visible browser; the preview used a local `blob:` URL before Save profile. Saving the Profile uploaded `uploaded/5c6d1383-a62a-4fce-b3d9-390320299247.png` to the public `avatars` bucket and changed the live Account Profile descriptor to an Uploaded Avatar; reloading restored the uploaded avatar from its Supabase public Storage URL. Saving back to the Built-in Avatar `dice` restored `@vhcoder` to `avatar_type = built-in`, `avatar_key = dice`, and no `avatar_object_path`; read-only SQL confirmed the Account Profile and Handle Directory rows both matched that restored Built-in Avatar state, the generated object exists in `storage.objects`, `public.uploaded_avatar_objects` records it as `content_type = image/png`, `byte_size = 1103`, `width = 128`, `height = 128`, `lifecycle_status = historical`, and live reference counts were zero across `public.account_profiles`, `public.account_profile_directory`, `public.pending_game_participants`, and `public.game_participants`. The final visible browser state showed Account-backed mode for `@vhcoder`, Built-in Avatar `dice`, no uploaded image preview, Font Awesome `fa-solid fa-dice` rendering with non-zero dimensions, no horizontal overflow, a captured screenshot, and clean browser warning/error logs. The promotion workflow then waited at the separate `Deploy main to production` GitHub Environment gate pending explicit production approval. Production uploaded-avatar write smoke remains separately approval-gated. |
| 2026-06-25 | Uploaded Avatar production promotion | After explicit owner approval for production, promotion run `28166782275` deployed PR #74 merge commit `f7d2d55cf26ed01381e2800fc2589a13ea6799be` to production. The `Deploy main to production` job succeeded from 2026-06-25T11:57:51Z to 2026-06-25T11:58:10Z after strict FTPS target verification, Supabase runtime config rendering, asset stamping, and FTPS upload. Visible production browser verification at `https://www.crazyphrases.com/` confirmed first-party `site.css` and `app.js` were stamped with merge commit `f7d2d55cf26ed01381e2800fc2589a13ea6799be`, the Font Awesome Kit script loaded, and the signed-in Account Profile for `@vhcoder` rendered with the uploaded-image control. A non-write functional smoke exercised the Profile Avatar selector by switching the draft preview from Built-in Avatar `dice` to `gamepad`, confirming `fa-solid fa-gamepad` rendered, switching back to `dice`, then reloading and confirming the persisted profile still hydrated as `dice` with no uploaded-image preview. The smoke also opened and closed `How to play`, confirmed the upload input accepts only `image/jpeg,image/png,image/webp`, captured a screenshot, found no horizontal overflow, and observed clean browser warning/error logs. The production smoke did not select an image file, upload an Uploaded Avatar, click `Save profile`, create game data, or mutate hosted Supabase data. Production Uploaded Avatar write smoke remains separately approval-gated. |
| 2026-06-25 | Uploaded Avatar crop dev deployment | PR #78 branch `codex/uploaded-avatar-crop` commit `000acfbf19d1466b0ddeb91d143e9d88cbac16d5` deployed to `dev` by deploy-dev run `28174244862` after explicit owner approval for the `Deploy branch to dev` GitHub Environment gate. The branch deployment completed successfully at 2026-06-25T14:02:17Z. Visible in-app browser verification at `https://dev.crazyphrases.com/` confirmed top-level and transitive first-party app assets were stamped with `000acfbf19d1466b0ddeb91d143e9d88cbac16d5`, the signed-in Profile rendered for `@vhcoder`, the Uploaded Avatar accept contract remained `image/jpeg,image/png,image/webp`, crop controls and inputs were mounted and hidden before file selection, there was no horizontal overflow, and browser warning/error logs were empty. The smoke was read-only apart from normal signed-in session refresh/read checks and did not create, upload, update, or clean up hosted Avatar data. |
| 2026-06-25 | Uploaded Avatar crop test promotion | PR #78 merged to `main` as merge commit `9dc424c965984be016a935391f08500a0f331503`. Promotion run `28175938536` deployed that commit to `test` after explicit owner approval for the `Deploy main to test` GitHub Environment gate. The `Deploy main to test` job succeeded from 2026-06-25T14:25:26Z to 2026-06-25T14:25:43Z after strict FTPS target verification, Supabase runtime config rendering, asset stamping, and FTPS upload. Visible in-app browser verification at `https://test.crazyphrases.com/` confirmed signed-in Account-backed mode for `@vhcoder`, Profile mounted, Uploaded Avatar accept contract intact, crop controls mounted and hidden before file selection, no horizontal overflow, clean browser warning/error logs, and top-level plus transitive first-party assets stamped with merge commit `9dc424c965984be016a935391f08500a0f331503`. The owner then manually performed file upload and crop-control testing, accepted the numerical-control MVP implementation, and deferred a visual crop tool with guidelines/direct manipulation to issue #79. Any production uploaded-avatar write smoke remains separately approval-gated. |
| 2026-06-25 | Uploaded Avatar crop production promotion | After explicit owner approval for production, promotion run `28175938536` deployed PR #78 merge commit `9dc424c965984be016a935391f08500a0f331503` to production. The `Deploy main to production` job succeeded from 2026-06-25T14:30:29Z to 2026-06-25T14:30:45Z after strict FTPS target verification, Supabase runtime config rendering, asset stamping, and FTPS upload. Visible production browser verification at `https://www.crazyphrases.com/` confirmed first-party scripts and styles, including `avatar-crop.js` and `avatar-storage.js`, were stamped with merge commit `9dc424c965984be016a935391f08500a0f331503`; signed-in Account-backed mode for `@vhcoder` rendered; Profile mounted; Uploaded Avatar accept contract remained `image/jpeg,image/png,image/webp`; crop controls were mounted and hidden before file selection; no horizontal overflow was present; and browser warning/error logs were empty. The production smoke did not perform a new file upload/save/delete or other hosted data mutation. |

## Signed-In Persistence Evidence

Hosted Supabase signed-in persistence was validated in `dev` through Google
Auth, Account shell hydration, a Supabase-backed current-game save, browser
reload, and a read-only hosted SQL check. On 2026-06-15, the full signed-in
current-game lifecycle was also validated against hosted Supabase in `dev`:
start, save, reload, reveal, copy, sign out, sign back in, restore the revealed
current game, and clear through `Start again`.

The signed-in foundation was then promoted through `test` and production by the
documented GitHub Environment gates.

## Current Known Hosted-State Notes

- The existing project-level Auth leaked-password-protection advisor warning
  remains the only repeatedly observed security advisor warning.
- Static JavaScript slices do not consume generated TypeScript database types;
  no generated database-types owner file is committed.
- First Integration Checklist item 6, TypeScript type generation consumption,
  remains deferred until the app has an owning generated-types path.
