# Private Lookup Hosted Reset and Migration Implementation Plan

> **Status:** Draft/active planning as of 2026-07-02. Do not execute hosted
> reads, writes, resets, migrations, deployments, or PR readiness changes from
> this plan until the owner approves the plan and then approves each named gate.
> PR #152 must remain draft while this planning status is active.

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely take the private known-email lookup and Gamer Tag identity
slice from draft PR #152 through hosted Supabase reset, migration, dev
inspection, main/test promotion, and production approval without preserving or
publicly exposing legacy Handle/Gamer Name account data.

**Architecture:** Treat the source change, hosted Supabase mutation, and static
environment deployment as separate authority boundaries. The source migration
`supabase/migrations/20260702120000_private_email_lookup_and_gamer_tag.sql`
fails fast unless `public.account_profiles` and
`public.account_profile_directory` are empty. Hosted reset and migration happen
only after read-only inventory, explicit owner approval, and post-reset
zero-row verification. Current runbooks document one hosted Supabase project,
so a Supabase reset or migration can affect all hosted static environments even
when a GitHub Environment approval targets only `dev`, `test`, or
`production`.

**Tech Stack:** GitHub PR #152 and issue #151, GitHub Actions and Environment
gates, Supabase MCP/SQL, Supabase Auth/Storage/Postgres, static JavaScript app,
Codex visible in-app browser verification, bundled Node `node --test`, and the
Supabase state ledger.

---

## Non-Negotiables

- PR #152 stays draft until the owner explicitly approves moving it out of
  planning and into merge readiness.
- Detecting the branch, hostname, Supabase project ref, or GitHub Environment
  does not authorise mutation.
- Do not commit, paste into chat, or store the owner's email address, service
  role keys, database credentials, OAuth secrets, or Storage object secrets.
- Do not apply the hosted migration while either Account Profile table contains
  rows.
- Prefer an app-profile/data reset that keeps the Supabase Auth user unless the
  owner separately approves full Auth-user deletion.
- Full Auth-user deletion is a separate destructive gate. Supabase documents
  that deleting an Auth user does not immediately invalidate existing JWTs and
  can be blocked by owned Storage objects.
- If read-only inventory finds more hosted users or meaningful user-owned rows
  than expected, pause and replan before deletion.

## Task 1: Local Source Preflight

**Files:**
- Read: `supabase/migrations/20260702120000_private_email_lookup_and_gamer_tag.sql`
- Read: `docs/decisions/0023-private-email-lookup-and-gamer-tag.md`
- Read: `docs/runbooks/supabase-auth-and-postgres.md`
- Read: `docs/runbooks/cloudflare-dns-and-access.md`
- Read: `docs/planning/supabase-state-ledger.md`

- [x] **Step 1: Confirm branch and draft intent**

Run:

```powershell
git status --short --branch
git log --oneline -2
```

Expected:

- branch is `codex/account-identity-docs`;
- no unrelated working-tree edits block the hosted plan;
- latest commits include the private lookup implementation and reset-required
  migration update.

- [x] **Step 2: Verify the source migration still has the empty-table guard**

Inspect
`supabase/migrations/20260702120000_private_email_lookup_and_gamer_tag.sql`.
Expected:

- the migration raises before schema mutation if `public.account_profiles` or
  `public.account_profile_directory` contains rows;
- the migration does not backfill old Handle/Gamer Name rows;
- direct browser table grants do not expose `email_lookup_key`;
- signed-in lookup goes through `public.lookup_account_profile(text, text)`.

- [x] **Step 3: Run local verification**

Run:

```powershell
C:\Users\VinceHardwick\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --test
git diff --check
```

Expected: all tests pass with zero failures, and `git diff --check` reports no
whitespace errors.

## Task 2: PR and Issue Preflight

**Files:**
- Read: `docs/runbooks/github-cli-auth-for-codex.md` before interpreting any
  sandboxed `gh` authentication failure.

- [x] **Step 1: Confirm PR #152 is still draft**

Run with GitHub CLI:

```powershell
gh pr view 152 --repo vince-hardwick/crazyphrases --json number,title,isDraft,state,headRefName,baseRefName,headRefOid,statusCheckRollup,url
```

Expected:

- `isDraft` is `true`;
- `headRefName` is `codex/account-identity-docs`;
- `baseRefName` is `main`;
- required CI is passing for the current head.

- [x] **Step 2: Confirm issue #151 remains the owning issue**

Run:

```powershell
gh issue view 151 --repo vince-hardwick/crazyphrases --json number,title,state,labels,url
```

Expected: issue #151 remains open until hosted reset, migration, runtime smoke,
and documentation closeout have completed or the owner explicitly rescope it.

Execution note, 2026-07-02: stale `deploy-dev.yml` run #88
(`28587504060`) targeted obsolete branch commit `5a6a947` and was cancelled
after PR #152 advanced to `f877af5`. A fresh final-head `dev` deployment is
still required later by Task 7.

## Task 3: Hosted Supabase Read-Only Inventory

**Files:**
- Read: `docs/runbooks/supabase-auth-and-postgres.md`
- Read: `docs/planning/supabase-state-ledger.md`

- [x] **Step 1: Get owner approval for read-only hosted inventory**

Ask for explicit approval before running hosted SQL through Supabase MCP,
Dashboard SQL Editor, or another authenticated route. This approval authorises
read-only inspection only; it does not authorise data deletion, schema
mutation, Storage mutation, Auth-user deletion, deployment, or PR readiness.

- [x] **Step 2: Confirm the hosted project and migration history**

Use Supabase MCP `list_migrations` for project `egnudphshvqdhrotxrfs`.
Expected:

- the known hosted migrations in `docs/planning/supabase-state-ledger.md` are
  present;
- `private_email_lookup_and_gamer_tag` is not already applied.

- [x] **Step 3: Run a no-PII row-count inventory**

Execute read-only SQL and record only counts, not email addresses or raw user
details:

```sql
select 'auth.users' as surface, count(*)::bigint as row_count from auth.users
union all select 'public.account_profiles', count(*)::bigint from public.account_profiles
union all select 'public.account_profile_directory', count(*)::bigint from public.account_profile_directory
union all select 'public.uploaded_avatar_objects', count(*)::bigint from public.uploaded_avatar_objects
union all select 'storage.objects:avatars', count(*)::bigint from storage.objects where bucket_id = 'avatars'
union all select 'public.signed_in_solo_current_games', count(*)::bigint from public.signed_in_solo_current_games
union all select 'public.private_phrase_favourites', count(*)::bigint from public.private_phrase_favourites
union all select 'public.private_batch_favourites', count(*)::bigint from public.private_batch_favourites
union all select 'public.pending_games', count(*)::bigint from public.pending_games
union all select 'public.pending_game_participants', count(*)::bigint from public.pending_game_participants
union all select 'public.games', count(*)::bigint from public.games
union all select 'public.game_participants', count(*)::bigint from public.game_participants
union all select 'public.game_section_assignments', count(*)::bigint from public.game_section_assignments
union all select 'public.game_section_entries', count(*)::bigint from public.game_section_entries
union all select 'public.multiplayer_batch_reveals', count(*)::bigint from public.multiplayer_batch_reveals
union all select 'public.in_app_notifications', count(*)::bigint from public.in_app_notifications;
```

Expected:

- one Auth user is plausible based on the owner's 2026-07-02 statement;
- Account Profile and Account Profile Directory counts explain why the source
  migration would currently fail;
- active game, favourite, notification, avatar, and Storage counts are small
  enough to review manually.

- [x] **Step 4: Pause on unexpected hosted state**

Pause and replan before any reset if:

- `auth.users` count is greater than one;
- game, favourite, notification, avatar, or Storage counts indicate meaningful
  data the owner did not expect to delete;
- read-only SQL fails because a table is missing or the hosted schema differs
  from the source-controlled migration history.

Execution note, 2026-07-02: hosted migration history matched the state ledger
and `private_email_lookup_and_gamer_tag` was not applied. Read-only inventory
returned one Auth user, one Account Profile row, one Account Profile Directory
row, seven uploaded-avatar metadata rows, seven `avatars` Storage objects, and
zero rows across signed-in Solo current games, private favourites, Pending
Games, Started Games, section rows, Reveals, and in-app notifications.
Avatar aggregate counts were one live Uploaded Avatar and six historical
Uploaded Avatars. No email addresses, raw Auth ids, or Storage object paths
were recorded in this plan.

## Task 4: Reset Mode Decision Gate

**Files:**
- Read: `docs/decisions/0023-private-email-lookup-and-gamer-tag.md`
- Read: `docs/runbooks/supabase-auth-and-postgres.md`

- [x] **Step 1: Present the reset choice to the owner**

Present these options with the read-only counts:

- **Preferred app-profile reset:** delete hosted app data that blocks the
  migration, including games, Pending Games, favourites, current signed-in Solo
  state, Account Profile rows, Account Profile Directory rows, and related
  uploaded-avatar metadata. Keep the Supabase Auth user. The owner signs in
  again after migration and the app recreates the Account Profile under the new
  Gamer Tag/email-lookup rules.
- **Full Auth reset:** delete the same app data, delete approved owned avatar
  Storage objects, then delete the Supabase Auth user through an approved Auth
  admin route. This requires a separate sign-out/re-register step and must
  account for JWT expiry and Storage ownership.

Do not proceed until the owner chooses one mode and explicitly approves the
hosted reset.

- [x] **Step 2: Confirm Storage treatment if avatar objects exist**

If `public.uploaded_avatar_objects` or `storage.objects:avatars` has rows,
present the object count and ask whether to delete those avatar Storage objects
as part of the reset. Storage deletion is a live hosted mutation and needs
separate approval from SQL row deletion.

Execution note, 2026-07-02: the owner approved the preferred app-profile reset
plus deletion of the seven avatar Storage objects, while keeping the Supabase
Auth user.

## Task 5: Hosted Reset Execution

**Files:**
- Read: `docs/runbooks/supabase-auth-and-postgres.md`
- Update later: `docs/planning/supabase-state-ledger.md`

- [ ] **Step 1: Reconfirm the mutation scope immediately before reset**

State the exact approved mode, the Supabase project ref
`egnudphshvqdhrotxrfs`, and the current counts. Confirm that this is a hosted
backend mutation that may affect all static hostnames using the shared
Supabase project.

- [ ] **Step 2: Delete approved avatar Storage objects if required**

Only if approved in Task 4, delete avatar Storage objects whose paths are
listed by `public.uploaded_avatar_objects`. Record counts before and after.
If Storage deletion fails, stop before deleting profile metadata.

Execution note, 2026-07-02: stopped before hosted deletion. Current Supabase
Storage docs say deleting objects should use the Storage API and not SQL,
because SQL deletion from `storage.objects` can orphan bucket files. The
available Supabase connector exposes SQL and migration tools but no Storage API
object-removal tool. No Storage objects, Account Profile rows, Account Profile
Directory rows, app data, or Auth users were deleted.

- [ ] **Step 3: Run the approved app-profile reset transaction**

For the preferred app-profile reset, execute this as an approved hosted SQL
mutation:

```sql
begin;

delete from public.games;
delete from public.pending_games;
delete from public.signed_in_solo_current_games;
delete from public.private_phrase_favourites;
delete from public.private_batch_favourites;
delete from public.account_profiles;

commit;
```

Expected:

- `public.games` deletion cascades section assignments, section entries,
  participant snapshots, Reveal rows, and game-targeted notifications;
- `public.pending_games` deletion cascades Pending Game participants and
  pending-game-targeted notifications;
- `public.account_profiles` deletion cascades `public.account_profile_directory`
  and `public.uploaded_avatar_objects`;
- `auth.users` remains intact in the preferred reset mode.

- [ ] **Step 4: Run full Auth deletion only if separately approved**

If the owner chose full Auth reset, delete the Auth user only after app data and
approved Storage objects have been cleared. Use Supabase Dashboard/Auth Admin or
another approved admin route. Record that existing JWTs may remain usable until
expiry and require the browser session to sign out or be cleared before
validation.

- [ ] **Step 5: Verify the migration precondition**

Run read-only SQL:

```sql
select 'public.account_profiles' as surface, count(*)::bigint as row_count
from public.account_profiles
union all
select 'public.account_profile_directory', count(*)::bigint
from public.account_profile_directory;
```

Expected: both counts are `0`. If either count is non-zero, do not apply the
migration.

## Task 6: Hosted Migration Application

**Files:**
- Read: `supabase/migrations/20260702120000_private_email_lookup_and_gamer_tag.sql`
- Update later: `docs/planning/supabase-state-ledger.md`

- [ ] **Step 1: Get explicit owner approval to apply the hosted migration**

This approval is separate from reset approval. It authorises DDL/schema change
only for source migration
`supabase/migrations/20260702120000_private_email_lookup_and_gamer_tag.sql`.

- [ ] **Step 2: Apply the migration**

Use Supabase MCP `apply_migration` against project `egnudphshvqdhrotxrfs` with
name `private_email_lookup_and_gamer_tag` and the exact SQL from the
source-controlled migration file. Then run Supabase MCP `list_migrations`.

Expected: migration history includes the new hosted migration and no later
unexpected migration appears.

- [ ] **Step 3: Verify schema, grants, and lookup privacy**

Run read-only SQL:

```sql
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('account_profiles', 'account_profile_directory')
  and column_name in ('email_lookup_key', 'gamer_tag')
order by table_name, column_name;

select has_function_privilege(
  'authenticated',
  'public.lookup_account_profile(text,text)',
  'execute'
) as authenticated_can_execute_lookup;

select table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and table_name in ('account_profiles', 'account_profile_directory')
  and grantee = 'authenticated'
  and column_name = 'email_lookup_key'
order by table_name, privilege_type;
```

Expected:

- both tables have `email_lookup_key` and `gamer_tag`;
- `authenticated_can_execute_lookup` is `true`;
- no authenticated direct `SELECT` privilege exists for `email_lookup_key`.

- [ ] **Step 4: Run Supabase advisors where available**

Use Supabase Dashboard, Supabase MCP, or CLI-supported advisors if available.
Record new security/performance findings separately from existing accepted
project posture. Supabase recommends using the security advisor before
production-facing changes.

## Task 7: Feature-Branch Dev Deployment and Smoke

**Files:**
- Read: `docs/runbooks/cloudflare-dns-and-access.md`
- Read: `docs/runbooks/in-app-browser-verification.md`
- Update later: `docs/planning/supabase-state-ledger.md`

- [ ] **Step 1: Request final-branch-head dev deployment**

After source verification and hosted migration pass, request a fresh `dev`
deployment for the final PR #152 branch head:

```powershell
gh workflow run deploy-dev.yml --ref codex/account-identity-docs
```

If the run waits for the `dev` GitHub Environment gate, pause until the owner
confirms approval has been granted.

- [ ] **Step 2: Run visible in-app browser smoke on dev**

Use the in-app browser runbook. Verify:

- `https://dev.crazyphrases.com/` loads the branch commit;
- signed-in Google flow reaches Account-backed mode;
- the recreated profile uses Gamer Tag terminology and does not show email as
  public identity;
- the invite lookup input is one field labelled for email or Gamer Tag;
- an unknown email shows `No gamer found under that email address`;
- an unknown Gamer Tag shows `No gamer found under that gamer tag.`;
- successful lookup results, if tested with a second approved account, show
  Gamer Tag and Avatar but not email;
- no browser warning/error logs or mobile overflow appear.

If only the owner account exists, do not create a second hosted Auth/Profile
fixture just to test successful invitation unless the owner separately approves
that write/cleanup smoke.

## Task 8: PR Readiness and Merge

**Files:**
- Update later: PR #152 and issue #151

- [ ] **Step 1: Ask whether to mark PR #152 ready**

Only after Tasks 1-7 pass, ask the owner to approve marking PR #152 ready for
review/merge. Do not mark the PR ready while this draft plan is still awaiting
approval.

- [ ] **Step 2: Merge only through the protected PR path**

Merge only when:

- PR #152 is no longer draft by owner approval;
- `CI / Verify static site` passes for the latest head;
- review threads are resolved;
- the final branch head received fresh approved `dev` deployment and visible
  smoke.

## Task 9: Main to Test and Production Promotion

**Files:**
- Read: `docs/runbooks/cloudflare-dns-and-access.md`
- Read: `docs/runbooks/in-app-browser-verification.md`
- Update later: `docs/planning/supabase-state-ledger.md`

- [ ] **Step 1: Validate the merged main commit in test**

After merge, let the promotion workflow deploy the exact `main` merge commit to
`test`. If it waits for the `test` GitHub Environment gate, pause until the
owner confirms approval. Then run visible in-app browser smoke against
`https://test.crazyphrases.com/` with the same behavioural checks from Task 7.

- [ ] **Step 2: Keep production waiting until test acceptance passes**

Do not approve production while `test` validation is incomplete or failing. A
waiting production gate does not block test validation.

- [ ] **Step 3: Promote to production only after explicit approval**

After test acceptance, ask for explicit production approval. Then validate
`https://www.crazyphrases.com/` with a read-only smoke unless the owner
separately approves production data mutation. Confirm the promoted static
assets are stamped with the merge commit and that the browser does not expose
email in identity or lookup results.

## Task 10: Documentation and Issue Closeout

**Files:**
- Update: `docs/planning/supabase-state-ledger.md`
- Update if procedure changed: `docs/runbooks/supabase-auth-and-postgres.md`
- Update: issue #151
- Update: PR #152

- [ ] **Step 1: Record hosted evidence**

Add dated state-ledger entries for:

- read-only inventory counts;
- approved reset mode and reset outcome;
- hosted migration application and verification;
- Supabase advisor result summary;
- dev, test, and production smoke evidence;
- any intentionally deferred successful hosted lookup with a second account.

- [ ] **Step 2: Reconcile docs and issues**

If execution changes the accepted operational procedure, update the Supabase
runbook. Comment on issue #151 with hosted migration/deployment evidence. Close
issue #151 only after accepted scope is complete or explicitly rescoped.

- [ ] **Step 3: Commit, push, and branch cleanup**

Stage, commit, and push documentation evidence with related source changes. If
PR #152 is merged and production closeout is complete, delete the merged feature
branch locally and remotely unless the owner asks to preserve it.

## References Checked

- Supabase Auth user deletion caveats:
  `https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/managing-user-data.mdx`
- Supabase session/JWT verification context:
  `https://github.com/supabase/supabase/blob/master/supabase/apps/docs/content/guides/auth/sessions.mdx`
- Supabase production security-advisor recommendation:
  `https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/integrations/supabase-for-platforms.mdx`
