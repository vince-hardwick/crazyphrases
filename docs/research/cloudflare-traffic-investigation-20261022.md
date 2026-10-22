# Cloudflare traffic interpretation and integrity checks

Research date: 22 October 2026. This note records a read-only investigation, its interpretation and limitations. It is not authority to change live services. Current incident follow-up remains owned by `project-certificate-assessment.md` in the existing certificate investigation directory; this note is supporting evidence.

## What the dashboard can establish

| Display | Interpretation |
| --- | --- |
| Requests | HTTP requests, including asset fetches. One page view can require many requests. Zone traffic includes legitimate clients, crawlers and threats. |
| Unique visitors | Cloudflare's analytics FAQ describes identification by unique IP address. Bots and services fetching only part of a page can count. This is not a count of named people who know the site. |
| Performance | Includes HTTP versions, bandwidth savings, content types and, where available, origin response times. These describe delivery rather than whether an account was breached. |
| Security | Describes threats or security decisions. Counts must be read alongside their action, source, time range and hostname. |

Sources: [Zone Analytics](https://developers.cloudflare.com/analytics/account-and-zone-analytics/zone-analytics/) and [Cloudflare Analytics FAQ](https://developers.cloudflare.com/analytics/faq/about-analytics/). The FAQ also explains that HTTP analytics cover proxied traffic: direct traffic to an origin or an unproxied hostname is outside that view. Compare like time windows and filters before comparing dashboard totals.

Cloudflare documents public certificate-transparency datasets and searchable interfaces that reveal domain names. Consequently, an obscure hostname can be discovered without its owner telling another person about it. This is a possible discovery route, not evidence that any particular visitor used it. [Cloudflare's certificate-transparency explanation](https://blog.cloudflare.com/new-regional-internet-traffic-and-certificate-transparency-insights-on-radar/)

## Requests, security events and evidence of compromise

Security Events shows requests flagged or acted on by security products. One request can produce several events. Its sampled list can omit events, and narrowing the time window can improve visibility. A missing event therefore does not prove that a request never occurred. Use the all-traffic view to inspect requests that were not mitigated, alongside edge and origin response codes where available. [Security Events](https://developers.cloudflare.com/waf/analytics/security-events/) and [Security Analytics](https://developers.cloudflare.com/security/analytics/)

Investigation reasoning, rather than a Cloudflare product guarantee:

- Repeated requests for unrelated software paths, credentials or configuration files support a conclusion of probing. Status codes and response bodies distinguish a rejected or missing target from data actually returned.
- A `200` alone is not proof of exploitation: it might be an ordinary page, error document or application fallback. A `403` or `404` is evidence about that request, not proof that every other attempt failed.
- Stronger compromise indicators include unexpected executable files or altered deployed code, unauthorised hosting/Cloudflare/GitHub changes, unfamiliar privileged logins, and corroborated unauthorised backend access or data changes.
- Even matching public assets cannot rule out an unused server-side implant, stolen credentials, historical access or a backend-only compromise. A defensible negative result must name the inspected scope and unavailable evidence.

Record the dashboard's exact period, hostname filters, time zone and sampling notice. Inspect suspicious path/method/status combinations, then correlate timestamps and available request identifiers with origin logs. Separate normal asset requests and verification traffic from scanner paths. A country or a claimed user-agent name alone does not establish identity or intent.

## Minimal static-file integrity comparison

The completed origin comparison and observed hosting gaps are recorded below; the numbered method is retained to explain the checks, not as unfinished implementation work.

The repository's [hosting runbook](../runbooks/live-static-hosting.md) defines the runtime payload as `.htaccess`, `index.html` and `assets/`. [Production promotion](../../.github/workflows/promote.yml) stamps the workflow SHA into `index.html` and top-level `assets/*.js`. The [config-rendering action](../../.github/actions/render-supabase-runtime-config/action.yml) additionally renders the public Supabase URL and publishable key into `assets/supabase-config.js`.

Use these read-only checks, without deploying or editing the working tree:

1. Confirm the last approved production run and exact commit. The supplied baseline is `b7ca901c957ca8bdad82e16acb0073e594ffd3eb`; do not silently assume local `HEAD` or a branch tip is deployed.
2. Read that commit's blobs using Git, preserving bytes. Build expected copies outside the working tree. Replace `__ASSET_VERSION__` with the full SHA in the same paths as the workflow. Compare downloaded response bodies with those expected bytes or SHA-256 hashes. Save response status, retrieval time, final URL and cache headers with the results.
3. For `supabase-config.js`, verify the expected production project URL and publishable-key value through the authorised source, reproduce the documented rendering, then compare. A generated-config difference from the unrendered Git blob is expected; do not call it tampering or mask the entire file from comparison.
4. Start with `index.html`, every referenced script, stylesheet and runtime config; expand across the 26 tracked assets in that baseline. Version-query strings alone are not an integrity check. Account for documented edge transformations when investigating a byte mismatch.
5. Inspect the origin file inventory and hashes, including dotfiles, through authenticated read-only hosting access. Compare `.htaccess` with the approved blob; its baseline contains cache headers, with no SPA rewrite. Review unexpected executable files and source-only paths. Separate known `dev/`, `test/` and hosting-managed content from production payload.

The public edge comparison verifies what was served at that moment. It does not prove the origin disk is identical: cached copies can conceal later origin changes. Origin access/error logs, hosting login/change records and Cloudflare audit records therefore remain distinct evidence. The static hosting description does not eliminate the app's separate authenticated backend: the config renderer and project routing explicitly identify Supabase. Backend findings require their own authorised review.

The initial Cloudflare research used official documentation and local sources. The subsequent investigation used the owner's Personal Edge session, ordinary public HTTP reads, read-only cPanel shell commands and connected Supabase reads. No hosting configuration, application data, packages or workflows were changed. This note adds no new policy or operational authority.

## Observed Cloudflare and hosting evidence

The personal Cloudflare account was **vhCoders Account**, zone `crazyphrases.com`. The 30-day dashboard reported approximately **50.9k requests, 2.39k visits, 2.9k pageviews and 104 MB transferred**. Counts changed slightly on refresh. Detailed tables were sampled (roughly 5.88–9.09% in the inspected views), so these are not exact forensic counts. The zone includes production, dev/test Access login pages and cPanel traffic on port 2083. Requests and visits must not be equated with distinct people.

Repeated `/.env`, environment-backup and `/.git/config` requests establish automated probing. About **28k responses were 4xx** and **18.1k were redirects**; about **4.75k were 2xx**. Security showed approximately **910 blocks**, mostly managed rules. A fully expanded 22 October 06:38:48 BST event showed a managed-rule block of `POST /`; the request body was unavailable, so no exact exploit was inferred. Origin response times were 43 ms at the median and 419 ms at the 95th percentile, with 5xx at 0.12%. These metrics do not indicate a demonstrated compromise or major availability incident.

The 30-day HTTP-200 path view contained normal static assets, Access/cPanel routes, and `/webmail/phpinfo.php`. A fresh GET of that suspicious route returned a **cPanel Redirect** document, not PHP configuration. Current HEAD checks rejected the selected `.env`, `.git` and WordPress-backup paths with 403; `service-account.json` returned 404. These observations apply to those requests only. Investigation-generated traffic around 20:01 BST was recognised in the event list and excluded from attacker interpretation.

The account audit view, filtered to exclude view actions for 22 September–22 October, contained **24 successful events, zero failures and two actor categories: the owner's personal account and System**. Owner events were login and the 2 October Access/rules setup; System events were certificate-pack operations and associated DNS operations. No unfamiliar actor or later unexplained configuration change appeared. The member list contained the owner alone. This is evidence from the available audit view, not proof against credential theft.

### Origin integrity and logs

Read-only cPanel inspection verified account `crazyphr` on `cloud528`. All **28 intended production files** matched the approved `b7ca901c957ca8bdad82e16acb0073e594ffd3eb` payload by SHA-256 on the origin: `.htaccess`, `index.html` and 26 assets. The expected bytes accounted for deployment stamping. The generated Supabase module was rendered from the production GitHub Environment variables, matched the public response, and independently passed the origin hash check; it points to the expected project and uses the required publishable-key form. The earlier public comparison independently matched HTML, 16 application modules and CSS as text. No secret key was printed or saved.

There were **38 production files**, excluding the separate dev/test roots. The ten additional files were three repository documents (`AGENTS.md`, `CONTEXT.md`, `.font-awesome.md`), five word-bank build/source files, `.ftp-deploy-sync-state.json` and `.ftpquota`. The three documents and two build scripts checked against Git history matched known historical versions. Their observed modification dates were June/July. This supports deployment leftovers rather than attacker-created files, without making a lifetime integrity claim.

Across the website directory, including dev/test, the bounded filename inspection found no PHP/PHTML, CGI, Python or shell files, no symlinks and no files modified after the 22 October production deployment threshold of 14:35 BST. The account had zero cron lines; the process snapshot showed only the inspection shell and `ps`. No authorised-keys file or user-systemd directory appeared in the bounded metadata check. These checks do not inspect privileged provider processes or the full account filesystem.

The retained production NGINX archive contained **25,405 records**, from **30 September 13:22:07 to 22 October 12:49:06 BST**. Counts included 10,823 HTTP403, 12,045 HTTP404 and 2,117 HTTP200. The current SSL log contained **855 records**, from **22 October 13:06:45 to 20:09:32 BST** at inspection. There is a gap between those inspected files; the HTTP/non-SSL and all historical dev/test logs were not exhaustively analysed.

A bounded search for successful responses to credential, Git, WordPress, PHP and CGI probe paths found 22 archived and four current `/webmail/phpinfo.php` responses. The other archive matches were eight static-root requests with `phpinfo` or cloud-metadata-like query strings, each returning 200 with 2,538 logged response bytes. The present payload has no server-side application endpoint that interprets those query strings. Historical response bodies are unavailable, so their contents cannot be established from status/size alone. cPanel's error page showed no recent web-server errors; its suEXEC entries were hosting redirect/autodiscovery programs, including `wredirect.cgi` at the probe times. ImunifyAV's malicious-files and history views both had no results; with no dated completed scan visible, this was not treated as a clean scan certificate.

### Confirmed exposure and remaining limits

Two hosting problems require remediation separately from the breach assessment:

1. `/assets/` and `/assets/word-bank/` return directory indexes, contrary to the hosting runbook. This exposes names and timestamps of public assets.
2. Public GET/HEAD requests retrieve the historical repository documents, word-bank build scripts and deployment state file. The workflow explicitly excludes `AGENTS.md` and `CONTEXT.md` but their older copies remain. Its current exclusions also omit `tools/` and `.font-awesome.md`. The correction needs both removal or access denial for the identified live leftovers and a deployment-payload correction that prevents recurrence; exclusions alone do not demonstrate removal of already deployed files.

No successful compromise was established in the inspected scope. Historical origin authentication/FTP change records, privileged provider logs, complete old request bodies and a complete Supabase organisation audit were unavailable. The hosting dashboard's single previous-login IP is not a full login history and was not attributed to an attacker. The review does not rule out every historical data access, credential theft or provider-level compromise. Third-party CDN JavaScript referenced by the app was identified but not independently supply-chain audited.

Evidence is retained alongside the existing incident owner at `C:/Users/VinceHardwick/Documents/Codex/2026-10-21/conduct-a-live-web-search-to/`: `crazyphrases-cloudflare-*-20261022.txt` contains dashboard/audit observations; `crazyphrases-expected-origin-sha256-20261022.txt`, `crazyphrases-origin-integrity-20261022.png`, `crazyphrases-origin-log-check-20261022.png` and `crazyphrases-runtime-config-check-20261022.json` record integrity checks; the path/body/source-history JSON files and `crazyphrases-cpanel-errors-20261022.txt` record the remaining checks. Local evidence contains operational details and should not be published indiscriminately.

This was the ask-matt research route with a primary-source research agent, followed by read-only verification. Documentation impact is D1 evidence; no implementation review, deployment validation or remediation completion is claimed. No external issue, provider message, commit or push was made. All four GitHub workflows were independently read back as `disabled_manually` at closeout. Existing GitHub runner and UWH trust-store monitoring remains separate.

## Supabase read-only investigation

Verified on 22 October 2026 around 19:03 UTC (20:03 BST), through the connected Supabase tools. `list_projects` matched the runbook's `crazyphrases` project `egnudphshvqdhrotxrfs`, organisation `zboqogxtnrfsdzhqkvaq`, in `eu-west-2`; status was `ACTIVE_HEALTHY`. Organisation metadata confirmed the Free plan. The [Supabase runbook](../runbooks/supabase-auth-and-postgres.md) and [hosted state ledger](../planning/supabase-state-ledger.md) supplied the expected configuration and migration provenance.

### Observed activity

The final fixed log window was **21 October 19:03:36 UTC to 22 October 19:03:36 UTC**. `query_logs` queried the unified logs stream with that explicit window. Early counts were slightly lower while log ingestion continued; the final grouped result contained **118 gateway requests: 117 with status 200 and one with status 201**.

- **113 requests** came from one GB address on the `pcl-ag01` network between 13:31:07 and 13:35:34 UTC on 22 October. Paths were the expected account/profile, pending-game, notification, favourite, current-solo-game, dashboard RPC, token-refresh and avatar endpoints. A minimal Auth/Profile join correlated the two active identifiers with **test-player** (64 authenticated requests referring from `test.crazyphrases.com`, 13:31:16–13:33:07 UTC) and **vhCoder** (10 authenticated requests referring from `www.crazyphrases.com`, 13:35:33–13:35:34 UTC). The lead investigator's retained smoke JSON identifies these same test/production accounts, following deployment jobs completed at 13:30:04 and 13:34:37 UTC respectively. This is specific supporting evidence that the observed writes and reads were the authorised smoke checks, beyond network geography alone.
- The other **five requests** were AWS-addressed health, ready and network-ban retrieval calls around 19:01 UTC, contemporaneous with this investigation. Their administrative shape and timing are consistent with platform/inspection activity; this is an inference rather than attribution to an identified operator.
- External Auth audit logs contained two `token_refreshed` and two `token_revoked` events at 13:31:16 and 13:35:33 UTC. Auth endpoint logs identified `refresh_token` grants. No signup, password-change or new login event appeared in that window. Four Auth warnings were deprecation notices for GoTrue group-name settings.
- Inspection of `auth.users` found **three users, zero anonymous users and no accounts created in the last 30 days**. A subsequent minimal identity reconciliation found **vhCoder** (Google, created 15 June), **test-player** (email, created 7 July) and **Jimbo** (Google, created and last signed in 8 July). Vince directly confirmed that **Jimbo is James Edge**; no recent activity from that account appeared in the inspected gateway window. The latest stored initial sign-in across the accounts was 23 July. Existing sessions can refresh later, so this timestamp does not imply no recent activity. No emails, tokens, account UUIDs or session values are retained in this note.
- `auth.audit_log_entries` contained **zero rows**. This is a historical evidence gap, not evidence of no authentication activity. Supabase supports retaining Auth audit events externally while disabling database writes. [Auth audit documentation](https://supabase.com/docs/guides/auth/audit-logs)

### Access-control and configuration checks

Read-only catalogue queries found RLS enabled on all **16 public tables** and on the private shard-registry table. Effective `anon` privileges showed no SELECT/INSERT/UPDATE/DELETE access to public/private tables and no EXECUTE access to public/private functions. There were no public views. Public browser RPCs use invoker security and authenticated execution, consistent with the advisor-remediation migration; the legacy definer function `submit_started_game_turn` remains inaccessible to both browser roles, as its source migration requires. Private implementations retain privileged execution where documented. This was a catalogue/policy review, not an exhaustive proof of every function's authorisation logic.

All **28 hosted migration names** matched the 28 repository migration names, with no extras or missing names. Hosted timestamps can differ from source filenames; the latest `20260713092820 pin_multiplayer_entry_assist_shards` is recorded in the state ledger. Matching history does not prove that no out-of-band DDL was ever executed. No Edge Functions were deployed.

The sole Storage bucket was the documented public-read `avatars` bucket, limited to 1 MiB JPEG/PNG/WebP files. Insert/delete policies restrict changes to registered, owned pending avatar objects. There were three objects, last created/updated on 6 July and none created in the last 30 days. Public read access is intentional under the [Uploaded Avatar runbook](../runbooks/supabase-auth-and-postgres.md#uploaded-avatar-storage).

Security advisors returned no ERROR findings. The existing [leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains an accepted Free-plan deferral in the runbook. The other finding was INFO for [RLS enabled without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) on `private.word_bank_shard_registry`; the source migration deliberately enables RLS and revokes browser/service-role grants. The inspected grants remained absent. Neither finding establishes a breach.

### Separate patch follow-up

Live SQL `current_setting('server_version')` and `version()` both reported **PostgreSQL 17.6**; project metadata reported package `17.6.1.166`. Supabase's 25 September announcement says the 17.11 update closes 44 CVEs and that dashboard upgrades became available on 28 September. This is a material patch-age concern requiring an upgrade/mitigation review, **not evidence of exploitation**. [Official Supabase security-update announcement](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes)

The installed extension list did not contain `ltree` or `btree_gist`. `pgcrypto` was installed, but no public/private function source referenced `pgp_sym_*` or `pgp_pub_*` encryption/decryption. That narrow check does not rule out every use from client SQL or other schemas. No upgrade, restart, reindex, data change or exploit test was performed.

### Limits and next evidence

The observed gateway traffic matches the accounts, hostnames and timing of the known verification work; no breach indicator emerged from these queries. All three account labels are reconciled: the known owner, the smoke-test account and James Edge (`Jimbo`), with the last identity confirmed directly by Vince.

This review covers the specified 24-hour logs and current metadata, not the site's lifetime. Retention depends on plan and not all activity is recorded automatically. [Logs documentation](https://supabase.com/docs/guides/observability/logs) Organisation Platform Audit Logs require Team/Enterprise, while personal Account Audit Logs are a separate view. [Platform audit documentation](https://supabase.com/docs/guides/security/platform-audit-logs) The lead investigator separately inspected the personal audit UI: six entries, comprising today's 20:01:07 BST login and project/settings/key reads at 20:01:26–28 BST, consistent with the user opening the tab. Removing the date filter still returned six. The organisation audit view was unavailable on Free, and personal MFA showed Google Authenticator added on 12 June. These limited records do not supply a complete historical organisation audit. The empty database Auth audit table also prevents a longer historical conclusion from that source. No API key secrets, passwords, application game contents or avatar bytes were exported.
