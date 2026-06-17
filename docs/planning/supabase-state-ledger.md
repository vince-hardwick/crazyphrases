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
