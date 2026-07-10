# Cloudflare DNS and Access Runbook

## Purpose

This runbook describes how to put `crazyphrases.com` behind Cloudflare DNS and use Cloudflare Access to protect `dev.crazyphrases.com` and `test.crazyphrases.com` with GitHub authentication.

## Pre-Migration Checklist

Before changing nameservers:

- Confirm registrar access for `crazyphrases.com`.
- Confirm cPanel access and current DNS zone visibility.
- Record current DNS records, especially web, mail, SPF, DKIM, DMARC, FTP, cPanel, and webmail records.
- Confirm current GitHub Actions deployment still works for production.
- Confirm cPanel has or can issue TLS certificates for:
  - `crazyphrases.com`
  - `www.crazyphrases.com`
  - `dev.crazyphrases.com`
  - `test.crazyphrases.com`

## Cloudflare Zone Setup

1. Add `crazyphrases.com` to Cloudflare.
2. Let Cloudflare scan existing DNS records.
3. Compare Cloudflare's imported records against the cPanel/registrar DNS zone.
4. Add any missing records manually.
5. Set proxy status deliberately:

| Record type/name | Cloudflare proxy status |
| --- | --- |
| `crazyphrases.com` web record | Proxied if serving the website |
| `www` | Proxied |
| `dev` | Proxied |
| `test` | Proxied |
| `MX` records | DNS only |
| SPF/DKIM/DMARC TXT records | DNS only |
| `mail` | DNS only |
| `ftp` | DNS only |
| `cpanel` | DNS only |
| `webmail` | DNS only |

ADR `0022` defers branded hosted Auth domain work with explicit accepted risk.
Do not create or update DNS for `auth.crazyphrases.com`, a Supabase custom
domain, or a Supabase vanity subdomain unless ADR `0022` is amended or
superseded. Do not infer proxy status from the web hostnames above, and do not
treat a Cloudflare DNS change as approval to activate Supabase Auth or mutate
Google OAuth settings.

6. Change the domain's authoritative nameservers at the registrar to the Cloudflare-provided nameservers.
7. Wait for propagation and Cloudflare zone activation.

## SSL/TLS Settings

In Cloudflare:

1. Open the `crazyphrases.com` zone.
2. Go to SSL/TLS.
3. Set encryption mode to Full (strict) once cPanel origin certificates cover the requested hostnames.
4. Keep Always Use HTTPS enabled for web hostnames if it does not conflict with cPanel redirects.

Do not use Flexible SSL.

## Cloudflare Access With GitHub

Set up GitHub as an identity provider in Cloudflare Zero Trust:

1. Open Cloudflare Zero Trust.
2. Configure GitHub as an identity provider.
3. Create an Access application for `dev.crazyphrases.com`.
4. Create an Access application for `test.crazyphrases.com`.
5. Add allow policies for the GitHub users, email addresses, organization, or team that should access each environment.
6. Deny access by default for everyone else.

Record the allowed GitHub users or teams below once configured:

| Environment | Allowed GitHub users/teams |
| --- | --- |
| `dev` | Configured and tested; exact allow policy to be confirmed before public documentation is treated as complete |
| `test` | Configured and tested; exact allow policy to be confirmed before public documentation is treated as complete |

## GitHub Environment Setup

Create or update GitHub Environments:

- `dev`
- `test`
- `production`

Each environment should have its own deployment secrets:

- `FTP_SERVER`
- `FTP_USERNAME`
- `FTP_PASSWORD`
- `FTP_SERVER_DIR`

Use separate `FTP_SERVER_DIR` values for each environment document root. Example shapes:

- `public_html/dev/`
- `public_html/test/`
- `public_html/`

The actual values must match cPanel's document roots for `dev.crazyphrases.com`, `test.crazyphrases.com`, and production.

`FTP_SERVER_DIR` must end with `/`. The FTP deployment action rejects paths without a trailing slash.

### FTP Connectivity Rule

GitHub Actions must connect to the cPanel FTP/FTPS endpoint directly. Do not point `FTP_SERVER` at a Cloudflare-proxied hostname.

Preferred `FTP_SERVER` values:

- The hosting provider's raw FTP hostname.
- A DNS-only hostname such as `ftp.crazyphrases.com` only when the FTP
  service certificate covers that hostname.
- The cPanel server IP address if the host permits it.

Do not use a proxied Cloudflare hostname for FTP/FTPS. Cloudflare's orange-cloud proxy is for HTTP(S) traffic and will not proxy normal FTP/FTPS control connections.

For this host, `FTP_SERVER` is expected to use the cPanel server hostname
`cloud528.thundercloud.uk` in the `dev`, `test`, and `production` GitHub
Environments. The `ftp.crazyphrases.com` DNS record resolves to the same cPanel
origin, but the FTPS service presents a certificate for
`cloud528.thundercloud.uk`. cPanel's FTP client guidance notes that FTP does not
support Server Name Indication, so SSL FTP clients must use the server hostname
rather than the account domain when verifying certificates.

Before rerunning a failed deployment, verify:

```powershell
Resolve-DnsName ftp.crazyphrases.com
Test-NetConnection ftp.crazyphrases.com -Port 21
```

Expected:

- `Resolve-DnsName` returns the cPanel origin IP, not Cloudflare edge IPs.
- `Test-NetConnection` reports `TcpTestSucceeded: True`.
- The `ftp` DNS record in Cloudflare is DNS only.

Current FTPS deployments use `SamKirkland/FTP-Deploy-Action@v4.4.0` without a
`security` override. Each deployment job first runs
`.github/actions/verify-ftps-deploy-target`, which uses strict
`curl --ssl-reqd` verification against the selected GitHub Environment's
`FTP_SERVER` and `FTP_SERVER_DIR` before any upload. This catches hostname,
certificate, credential, and target-directory problems before mutation.

If a maintenance step uses `curl` against the same FTPS endpoint, use the same
certificate-matching `FTP_SERVER` hostname and strict TLS settings. Use
`--insecure` only as an explicitly approved one-off recovery path behind the
GitHub Environment approval gate.

## GitHub Actions Deployment

Deployment is managed by these workflows:

- `.github/workflows/ci.yml` - verifies feature branches, `main`, and pull requests.
- `.github/workflows/deploy-dev.yml` - deploys approved feature-branch commits to `dev`.
- `.github/workflows/promote.yml` - promotes `main` commits through `test` and gated `production`.
- `.github/workflows/ftps-preflight.yml` - manually verifies `test` and `production` FTPS targets without deploying.

### Promotion Model

Feature slices move through environments in order:

1. Push a feature branch such as `codex/issue-2-manual-anonymous-solo`.
2. CI runs against the branch.
3. `deploy-dev.yml` creates a deployment request for the shared `dev` environment when the branch changes hosted static runtime paths.
4. Approve the `dev` GitHub Environment deployment when that branch is ready for engineering inspection.
5. Inspect `https://dev.crazyphrases.com/` after Cloudflare Access authentication. For user-observed Codex smoke tests, use the visible in-app browser path in `docs/runbooks/in-app-browser-verification.md`.
6. Before merge, confirm that the inspected `dev` deployment is the final feature-branch head. If a waiting or completed `dev` deployment targets an older commit, cancel or ignore the stale run, request a fresh `dev` deployment for the final branch head, and repeat the visible in-app browser smoke. Do not merge a hosted runtime change using only local smoke, CI, or an earlier `dev` run.
7. Open or update the pull request into `main`.
8. Merge the pull request only after `CI / Verify static site` passes, review threads are resolved, and the required fresh `dev` inspection is complete. The active `Protect main` repository ruleset blocks direct `main` pushes, force-pushes, deletion, and PR merges that do not satisfy that required check.
9. `promote.yml` deploys the merged `main` commit to `test` when the merge includes hosted runtime changes.
10. Complete formal/human functional testing at `https://test.crazyphrases.com/` after the `test` deployment succeeds. Use the visible in-app browser path and exercise the promoted behaviour; commit-hash asset stamping alone is not enough. If the same promote run is already waiting at the `production` gate, leave that gate waiting and continue with `test` validation.
11. Approve the queued `production` GitHub Environment deployment only after test acceptance passes.
12. After the required closeout for the merged PR is complete, delete the merged feature branch from GitHub and prune stale local tracking refs. For runtime changes, closeout includes production deployment and post-promotion verification. For source-only or docs-only changes that do not request promotion, closeout is the successful `main` CI run plus any required issue/documentation updates.

### Docs-Only Pull-Request Self-Review

Under ADR 0028, Codex may self-review, mark ready, and merge a docs-only pull
request autonomously. The complete diff must contain only prose documentation;
it must not include executable source, runtime assets, tests, workflows,
dependencies, configuration, Supabase migrations, or deployment-payload files.
Codex must still complete a standards-and-spec self-review, ensure the latest
`CI / Verify static site` check passes, and resolve all review threads. This
exception preserves the protected pull-request path and does not authorise a
direct push, ruleset bypass, or any environment deployment.

The anonymous solo MVP may replace the homepage in `dev` and `test` during review. Production should keep the holding page until the slice is accepted for production promotion.

`dev` is shared. Each approved feature-branch deployment overwrites the previous `dev` deployment. Use the GitHub run history to confirm which branch and commit are currently deployed.

Automatic `dev` deployment requests currently watch `.htaccess`, `index.html`, and `assets/**`. The workflow also includes a changed-file guard before any environment-backed job, so source-only pushes such as documentation, workflow-file, package metadata, Supabase migration, or test-only changes do not request `dev` deployment unless a hosted static runtime path changed in the same push. CI remains responsible for source-only verification.

Automatic `main` promotion requests also ignore source-only paths: `.gitattributes`, `.gitignore`, `.github/**`, `AGENTS.md`, `CONTEXT.md`, `README.md`, `docs/**`, `output/**`, `package.json`, `package-lock.json`, `supabase/**`, and `tests/**`. A docs-only or source-only merge to `main` must not request `test` or `production` deployment because those paths are excluded from the hosted FTPS payload and do not change the static runtime. If a future source-only `main` push creates a `promote.yml` run, treat that as a workflow regression and cancel it before approving any GitHub Environment deployment.

FTPS deployments must exclude source-only repository paths, including `.gitattributes`, `.gitignore`, `.github/`, `docs/`, `tests/`, `output/`, `supabase/`, `package.json`, and `package-lock.json`, from the static hosting payload. If the app later moves to a build output directory or framework-specific source tree, update `.github/workflows/deploy-dev.yml`, `.github/workflows/promote.yml`, and the deployment-surface regression test in the same change as that app-structure migration. Use manual `workflow_dispatch` for exceptional branch deployments outside the watched paths.

### Branch Lifecycle

Feature branches are short-lived scaffolding for one implementation slice, documentation slice, or operational change. The durable history is the issue, pull request, merge commit, deployment run, ruleset/audit record where applicable, and environment deployment record, not the branch name itself.

The `Protect main` repository ruleset makes the pull request path mandatory for
`main`. Do not plan pending work around direct pushes to `main`, force-push
repair, deleting and recreating `main`, or routine bypass. If a future emergency
requires bypassing this source-review boundary, document the authority and
reason as a separate operational decision before mutating repository settings.

Use this branch lifecycle:

1. Start each issue or documentation slice from fresh `main`.
2. Create a focused branch such as `codex/issue-4-local-recovery` or `codex/document-branch-lifecycle`.
3. Push the branch and open a pull request.
4. Use the branch deployment to `dev` when runtime files change and the implementation needs engineering inspection.
5. Merge the pull request to `main` only after review, required verification, resolved review threads, and the required `CI / Verify static site` check.
6. Let the `main` merge commit promote through `test` and then `production` using the gated workflow when hosted runtime paths changed.
7. Delete the feature branch after the applicable closeout succeeds, unless there is an explicit rollback, audit, or follow-up reason to keep it temporarily. Runtime changes wait for production verification; source-only and docs-only changes can be cleaned up after the merge, successful `main` CI, and issue/documentation closeout.

Do not keep old issue branches until the whole MVP is complete. Keeping merged or superseded branches makes the repository harder to read and increases the chance that future work starts from a stale ref.

Superseded branches may be deleted once their intended changes are present on `main` through another merged pull request. Before deleting a branch whose pull request was closed rather than merged, check that `git log --cherry-pick main...origin/<branch>` shows no unique commits that still need preservation.

### Operator Commands

The commands in this section use the GitHub CLI. When Codex runs any
authenticated `gh` command, follow
`docs/runbooks/github-cli-auth-for-codex.md` first: sandboxed `gh` can report
`401`, `invalid token`, unauthenticated `403`, or API rate limiting because it
cannot read the Windows keyring token. Rerun the same `gh` command with sandbox
escalation before asking the owner to re-authenticate or switching to manual UI
instructions.

Inspect workflow runs:

```powershell
gh run list --workflow ci.yml --limit 5
gh run list --workflow deploy-dev.yml --limit 5
gh run list --workflow promote.yml --limit 5
gh run list --workflow ftps-preflight.yml --limit 5
gh run view <run-id>
gh run watch <run-id> --exit-status
```

Cancel an unexpected source-only `main` promotion run before any deployment
approval:

```powershell
gh run list --workflow promote.yml --branch main --limit 5
gh run cancel <run-id>
gh run view <run-id>
```

Manually request or re-request a feature-branch `dev` deployment:

```powershell
gh workflow run deploy-dev.yml --ref <feature-branch-name>
```

Run a read-only strict FTPS preflight against the `dev` GitHub Environment
secrets without deploying:

```powershell
gh workflow run deploy-dev.yml --ref <feature-branch-name> -f ftps_preflight_only=true
```

Manually re-run the `main` promotion workflow:

```powershell
gh workflow run promote.yml --ref main -f promote_production=false
```

Run read-only strict FTPS preflights against the `test` and `production` GitHub
Environment secrets without deploying. These checks live in
`ftps-preflight.yml` so normal `promote.yml` runs do not show skipped manual
preflight jobs:

```powershell
gh workflow run ftps-preflight.yml --ref main -f target=test
gh workflow run ftps-preflight.yml --ref main -f target=production
gh workflow run ftps-preflight.yml --ref main -f target=all
```

Manually request production promotion from `main` after test acceptance:

```powershell
gh workflow run promote.yml --ref main -f promote_production=true
```

The normal path is the automatic `promote.yml` run created by the pull-request merge commit on `main`. Direct pushes to `main` are blocked by the `Protect main` ruleset. The manual commands are for re-running or recovering a known reviewed commit path, not for bypassing review.

### Approval Boundaries

If the selected GitHub Environment has a reviewer gate, the deployment job waits until the environment is approved in GitHub. Approval authorizes the FTPS upload only; browser access to `dev` and `test` is still controlled separately by Cloudflare Access.

Required reviewer intent:

- `dev` approval means the branch commit may overwrite the shared engineering inspection environment.
- `test` approval means the merged `main` commit may overwrite the formal testing environment.
- `production` approval means human testing has passed in `test` and the same `main` commit may mutate the live site.

For hosted runtime changes, approval of a stale `dev` run is not reusable for a
newer branch head. The final branch commit needs its own approved `dev`
deployment and visible in-app browser smoke before merge. After merge, `test`
approval and deployment authorize formal testing only; they do not imply
production acceptance.

Codex/operator pause rule:

- If a Codex-triggered commit, push, merge, or manual workflow request creates a deployment run that waits for GitHub Environment approval, Codex reports the run and then pauses.
- The user approves or rejects the deployment in GitHub.
- Codex resumes deployment-dependent checks only after the user confirms that approval has been granted.

If the `production` GitHub Environment does not have a required reviewer gate, cancel the production job and restore the gate before deploying.

The same secret names are used in each GitHub Environment. GitHub resolves the secret values from the selected environment, so `FTP_SERVER_DIR` must be different for `dev`, `test`, and `production` when their cPanel document roots differ.

## Verification

After DNS and Access setup:

```powershell
curl.exe -I https://www.crazyphrases.com/
curl.exe -I https://dev.crazyphrases.com/
curl.exe -I https://test.crazyphrases.com/
```

Expected:

- Production returns the public site.
- Dev/test unauthenticated browser access shows Cloudflare Access login.
- Authenticated GitHub users listed in Access policies can reach dev/test.
- Users not listed in Access policies cannot reach dev/test.
- Mail still works for `hello@crazyphrases.com`.

### Codex Sandbox TLS Client Failures

When a Codex sandboxed shell checks a public HTTPS page or asset, the local
Windows TLS provider can fail before any HTTP response is received. Known
symptoms include:

```text
Invoke-WebRequest: Authentication failed, see inner exception.
curl: (35) schannel: AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS (0x8009030e) - No credentials are available in the security package
```

For public production URLs, including stamped assets such as
`https://www.crazyphrases.com/assets/app.js?v=<commit-sha>`, these messages are
not evidence that the site, Cloudflare, Supabase Auth, or Crazy Phrases account
login is requesting credentials. They usually mean the sandboxed Windows
Schannel security context cannot acquire local TLS credentials.

Do not change DNS, Cloudflare SSL/TLS mode, cPanel certificates, Access
policies, asset paths, or cache-busting rules based only on this sandboxed
client failure.

Use the accepted workaround:

1. Confirm the command is read-only and targets the intended public URL.
2. Rerun the same `curl.exe` or `Invoke-WebRequest` command with sandbox
   escalation.
3. If the escalated command returns the expected HTTP status, use that result as
   the shell verification evidence and record the original failure as a Codex
   sandbox TLS-client issue.
4. If the escalated command still fails before an HTTP response, then continue
   normal public edge TLS triage and compare with the visible in-app browser or
   an external TLS checker before proposing hosting changes.

### Mobile SSL Protocol Error Triage

If a mobile browser reports `ERR_SSL_PROTOCOL_ERROR` while desktop browsers can
load production, treat it as a client or network-path symptom until public edge
TLS is checked. Do not use the failing client as authority to change DNS,
Cloudflare SSL mode, or cPanel certificates without a separate approval.

Run read-only checks first:

```powershell
Resolve-DnsName crazyphrases.com -Type A
Resolve-DnsName crazyphrases.com -Type AAAA
Resolve-DnsName www.crazyphrases.com -Type A
Resolve-DnsName www.crazyphrases.com -Type AAAA
curl.exe -4 -I --max-time 15 https://crazyphrases.com/
curl.exe -4 -I --max-time 15 https://www.crazyphrases.com/
```

Expected:

- Apex and `www` resolve to Cloudflare proxied A records.
- If IPv6 is enabled, apex and `www` also resolve to Cloudflare proxied AAAA
  records.
- Both HTTPS requests return `200` from Cloudflare.
- The response may advertise `alt-svc: h3=":443"` when HTTP/3 is enabled.

Then use an external TLS scanner, such as SSL Labs, to confirm that every
Cloudflare edge endpoint has a trusted certificate chain for Android and that
modern Android, Chrome, and Edge simulated handshakes succeed. A non-A grade
caused only by Cloudflare permitting TLS 1.0 or TLS 1.1 is not the same as an
Android certificate failure.

If public edge TLS passes, isolate the Android path before changing the site:

- Test the same URL in Chrome for Android and Edge InPrivate.
- Test the phone on mobile data and on Wi-Fi.
- Temporarily disable Android or Edge VPN, filtering, ad-blocking, antivirus,
  and custom Secure DNS settings.
- Clear Edge site data for `crazyphrases.com`, then retry
  `https://www.crazyphrases.com/`.
- If only Android Edge fails and the response advertises HTTP/3, temporarily
  disable Cloudflare HTTP/3 as a reversible diagnostic. Re-enable it unless the
  failure is confirmed to be tied to HTTP/3 or QUIC on the affected network.

If switching Android Private DNS from a filtered provider to `Automatic` fixes
the failure, treat the filtered resolver as the cause. For AdGuardDNS or similar
providers:

- Inspect the provider query log for the affected Android device immediately
  after reproducing the failure.
- Look for blocked, rewritten, empty, or refused answers for
  `crazyphrases.com`, `www.crazyphrases.com`, or related Cloudflare service
  names returned during navigation.
- If AdGuardDNS classifies the query as `NRD` (newly-registered domain), use
  the query log's `Unblock domain` action for `crazyphrases.com`.
- If the provider does not offer a one-click unblock, add an exception rule for
  the site, such as `@@||crazyphrases.com^`, so the apex and subdomains resolve
  normally.
- Keep the device on the same private DNS hostname and retry
  `https://www.crazyphrases.com/`.
- If the exception is not enough, disable only the specific AdGuardDNS filter or
  security category shown in the query log. Do not disable filtering globally
  unless the provider cannot identify the blocking rule.

DNS filtering failures may surface in the browser as an SSL protocol error when
the browser connects to a block or rewrite target instead of the Cloudflare edge
that owns the production certificate. Confirm the DNS answer before changing
Cloudflare or cPanel.

If public edge TLS fails, check Cloudflare before changing the origin:

- SSL/TLS mode is `Full (strict)`, not `Flexible`.
- The Cloudflare edge certificate covers `crazyphrases.com` and
  `*.crazyphrases.com`.
- The cPanel origin certificate covers the same web hostnames used by
  Cloudflare.
- Cloudflare records for apex and `www` are deliberately proxied or DNS-only
  according to the current hosting plan.

## Operational Notes

- GitHub Environment reviewers approve deployment.
- Cloudflare Access policies approve runtime browser access.
- cPanel controls origin file hosting.
- Cloudflare controls DNS and edge access policy.
- These authority boundaries are separate and must not be treated as interchangeable.
