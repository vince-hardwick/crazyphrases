# Supabase security upgrade evidence

Status: upgrade completed and verified on 22 October 2026. Supabase reports ACTIVE_HEALTHY on PostgreSQL 17.11, package 17.11.0.003. Vince explicitly authorised the upgrade, accepted up to one hour of interruption and directed proceeding without an independent backup or Pro subscription. That one-off instruction superseded the preparation-stage recovery prerequisite; it is not a general waiver for future maintenance.

## Target and reason

Connected project metadata and SQL identify `crazyphrases`, ref `egnudphshvqdhrotxrfs`, in `eu-west-2`, on `vhCoder's org` Free plan. Before the upgrade, the healthy project reported PostgreSQL **17.6**, package **17.6.1.166**. Supabase's [25 September announcement](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) says the 17.11 release closes 44 CVEs and made existing-project upgrades available on 28 September. The authenticated project upgrade dialog offered **17.11.0.003**, within the same major version.

The [Supabase runbook](../runbooks/supabase-auth-and-postgres.md) records that dev, test and production share this backend. An upgrade affects all three together. It does not require changing or redeploying the static website merely to change the database version. The [traffic investigation](cloudflare-traffic-investigation-20261022.md#supabase-read-only-investigation) owns the earlier activity/access-control findings; this note does not duplicate that investigation or imply exploitation.

## Supported route, interruption and recovery

Current [Supabase upgrade documentation](https://supabase.com/docs/guides/platform/upgrading) explicitly covers major and minor versions through **General Settings > Upgrade project**. The dialog displays an estimate and blockers. The project goes offline while Supabase copies/upgrades it; associated services are unavailable. The documented failure handling brings the original database back online. That is not a promise of self-service downgrade after a successful upgrade. A Free project's pause/restore also moves it to the latest minor version, but it is an interrupting alternative, not a step taken here.

The connector's documentation search returned older instructions pointing to Infrastructure; the current live official page is the route above. The authenticated project dialog was inspected and cancelled without confirming an upgrade. It offers **17.11.0.003**, warns that all services may be offline for **up to one hour**, and says a successful upgrade cannot be downgraded to **17.6.1.166**. The current 2 GB disk will be right-sized. General Settings reports Auth 2.197.0 and PostgREST 14.17; the dialog did not establish target versions for those services. Database size alone cannot predict the full outage because provisioning and validation also take time.

## Read-only compatibility results

SQL catalogue checks completed at **19:32 UTC / 20:32 BST**, with no application function invocation or table mutation.

| Check | Project-specific result |
| --- | --- |
| Current database size | 15,150,227 bytes, approximately 14.45 MiB. This is database size, not disk capacity or free disk space. |
| Encoding/collation | UTF8, four-byte maximum character length, ICU provider. |
| `ltree` compatibility | No installed extension and no `ltree`/array operator-class indexes. Thus neither announced index case has an identified target. |
| `btree_gist` floating-point indexes | Extension absent; official index-catalogue query returned no GiST float indexes. |
| Custom selectivity operators | Official non-extension operator query returned no affected operators. |
| `pgcrypto` legacy PGP use | `pgcrypto` 1.3 is installed. No non-extension function source in non-system schemas referenced `pgp_sym_*`/`pgp_pub_*` encryption/decryption. No public/private `bytea` columns. Source search in migrations, assets, tests and package metadata found no PGP functions or `cipher-algo` option. This does not prove that arbitrary historical/ad-hoc client SQL never used them. |
| Replication | Zero replication slots and zero connected replicas. A stopped/configured cloud read replica is not disproved by connection count; confirm project preflight. |
| System-OID column types | No public/private `reg*` columns. The only non-system matches were Supabase-managed `realtime.subscription.entity` (`regclass`) and `claims_role` (`regrole`); the table contained zero rows. Do not modify managed schema to address a generic warning. |
| MD5 role passwords | Metadata-only check returned no login roles using MD5; no password values were output. |
| Installed extensions | `plpgsql` 1.0, `pg_stat_statements` 1.11, `uuid-ossp` 1.1, `pgcrypto` 1.3, `supabase_vault` 0.3.1, `hypopg` 1.4.1, `index_advisor` 0.2.0. No deprecated PG17 extensions, `pg_cron` or `pg_graphql`. Exact target compatibility still needs dialog validation. |

The [release notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) owns the ltree, pgcrypto, btree_gist and custom-operator conditions. Its temporary-function and wrong-key data scan was not run: that would create a function and inspect encrypted values. Current source/catalogue checks identify no application use requiring it. Do not invent a reindex or data-rewrite step when no affected object was found.

## Backup evidence and gaps

[Official backup guidance](https://supabase.com/docs/guides/platform/backups) recommends independent exports for Free projects. Database backups exclude Storage object bytes and do not preserve custom-role passwords. A general statement that a provider creates physical backups does not establish that this account has a recent accessible restore point.

The available connector exposes no backup-list or upgrade-eligibility method. `get_project` metadata did not establish an accessible backup or a recovery test. SQL showed archive mode enabled, five successfully archived WAL files, no archive failures since the statistics reset, and a latest archive timestamp of 19:07 UTC. **WAL archive statistics are not evidence of a complete, accessible or restorable backup.**

The authenticated Database Backups page explicitly states that the Free plan does not include project backups; it offers a Pro upgrade for seven days of scheduled backups. No available restore point was shown. No paid-plan change was made. No independent database backup, Storage-byte copy or restore rehearsal was created or validated in this preparation. The earlier investigation found three avatar objects; their bytes require separate backup coverage. Actual disk free space remains unverified. Screenshots and text receipts for the upgrade dialog and backup availability are retained beside the existing incident assessment.

## Completed maintenance and verification

### Dashboard error and warning review

The owner's subsequent dashboard report of 18 Postgres errors and eight Auth
warnings was reconciled against logs from 19:56 to 20:58:22 UTC on 22 October.
All 18 database entries occurred from 20:44:47 to 20:49:03 UTC, during the
upgrade: 12 administrator-command connection terminations, four attempts by the
provider's `supabase_admin` role to connect to a database of that name, one
database-shutdown refusal and one missing `realtime.subscription` relation.
The Realtime relation now exists. There is still no database named
`supabase_admin`; this name is not the application database, and no creation or
repair of a provider-managed database is warranted by these isolated attempts.
No ERROR/FATAL/PANIC entries occurred after 20:49:03 in the inspected window,
and current project status remains healthy. The timing and successful recovery
support transient maintenance activity, rather than an ongoing application fault.

The eight Auth warnings are four pairs emitted alongside Auth v2.197.0 startup
at 20:43:28, 20:44:41, 20:48:34 and 20:48:58 UTC. They name only
`GOTRUE_JWT_ADMIN_GROUP_NAME` and `GOTRUE_JWT_DEFAULT_GROUP_NAME`.
The [matching Auth source](https://github.com/supabase/auth/blob/v2.197.0/internal/api/api.go#L85-L97)
emits these configuration deprecation notices when the old group settings are
non-empty. The [official Auth documentation](https://github.com/supabase/auth#inherited-features)
identifies group information as an unsupported inherited feature. This does not
deprecate JWT authentication or establish a signing-key rotation requirement.
No use of the named group settings was found in application assets, Supabase
files, workflows or project documentation. No keys or hosted settings were changed.

The existing incident owner retains the grouped log receipt
`crazyphrases-supabase-upgrade-warning-review.json`. Escalation to Supabase is
appropriate if database errors recur outside maintenance, authentication fails,
or the provider announces a migration affecting a feature the app actually uses.
No reproducible application defect was established, so this remained read-only
log classification and upstream-source verification; no regression-fix workflow
or production reproduction was attempted.

The upgrade was confirmed once through the owner's Personal Edge Supabase tab. Provider progress recorded a start at 20:41:51 UTC; completion was visible by 20:50 UTC and the API/SQL checks confirmed health at 20:51 UTC. This is an observed maintenance window of about nine minutes, not a measured request-by-request outage. The project remains on the Free plan. No independent database export, Storage backup or paid subscription was created.

Before/after metadata checks confirmed unchanged row counts for all 17 application tables, three Auth users, three Storage objects, all 28 migrations, installed extension versions, RLS on every application table, and identical policy, table-grant and application-function definition digests. Database size changed from 15,150,227 to 14,907,059 bytes. These checks do not constitute a byte-for-byte backup or exhaustive data-content comparison.

Security advisors show the same Auth leaked-password-protection WARN and private word-bank registry no-policy INFO. The existing Free-plan Auth deferral remains. Performance has no WARN/ERROR; unused-index INFO count changed from 28 to 29 after migration. No indexes were removed on that basis.

Visible Personal Edge checks passed in dev, test and production: signed-in account shell, both favourites tabs, multiplayer lists and profile reads. The test-player session restored its completed ten-phrase solo batch. Google sign-in succeeded for vhCoder on dev and production, and the uploaded avatar rendered. No games, favourites or profiles were deliberately changed. New write/cleanup fixtures and a two-player game were not exercised.

Test browser logs were empty. Dev and production each recorded a one-second OAuth token-issued-in-the-future clock-skew warning during login; authentication and subsequent reads succeeded, with no console errors. The 20:50–20:54 UTC returned Auth/API logs contained only INFO and HTTP 200/302 responses. No PostgreSQL entries were returned for that window; this is bounded observed evidence, not an assertion of complete provider log coverage.

Evidence is retained beside the existing incident owner in files prefixed `crazyphrases-supabase-upgrade-`: before/after metadata, row counts, completion screenshot and browser checks. The repository's Supabase state ledger owns the sanitised operational receipt. All four GitHub workflows were read back as disabled; this upgrade changes neither the GitHub runner containment nor the separate UWH trust-store follow-up.

The route was the existing ask-matt/grill-with-docs operational plan plus the Supabase skill and runbook. The owner settled the remaining backup and downtime decisions explicitly. No application code or schema migration was implemented, so verification used provider preflight and bounded live comparisons rather than new implementation tests. Automatic context compaction occurred during provider progress; saved receipts and live readback supported continuation. Documentation impact is D1: update existing status/provenance owners, with no new ADR or governance rule.
