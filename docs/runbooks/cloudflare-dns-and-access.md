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
- A DNS-only hostname such as `ftp.crazyphrases.com` when it resolves directly to the cPanel server IP.
- The cPanel server IP address if the host permits it.

Do not use a proxied Cloudflare hostname for FTP/FTPS. Cloudflare's orange-cloud proxy is for HTTP(S) traffic and will not proxy normal FTP/FTPS control connections.

Before rerunning a failed deployment, verify:

```powershell
Resolve-DnsName ftp.crazyphrases.com
Test-NetConnection ftp.crazyphrases.com -Port 21
```

Expected:

- `Resolve-DnsName` returns the cPanel origin IP, not Cloudflare edge IPs.
- `Test-NetConnection` reports `TcpTestSucceeded: True`.
- The `ftp` DNS record in Cloudflare is DNS only.

## GitHub Actions Deployment

Deployment is managed by these workflows:

- `.github/workflows/ci.yml` - verifies feature branches, `main`, and pull requests.
- `.github/workflows/deploy-dev.yml` - deploys approved feature-branch commits to `dev`.
- `.github/workflows/promote.yml` - promotes `main` commits through `test` and gated `production`.

### Promotion Model

Feature slices move through environments in order:

1. Push a feature branch such as `codex/issue-2-manual-anonymous-solo`.
2. CI runs against the branch.
3. `deploy-dev.yml` creates a deployment request for the shared `dev` environment when the branch changes current static runtime or test paths.
4. Approve the `dev` GitHub Environment deployment when that branch is ready for engineering inspection.
5. Inspect `https://dev.crazyphrases.com/` after Cloudflare Access authentication. For user-observed Codex smoke tests, use the visible in-app browser path in `docs/runbooks/in-app-browser-verification.md`.
6. Open or update the pull request into `main`.
7. Merge the pull request after review and dev inspection.
8. `promote.yml` deploys the merged `main` commit to `test`.
9. Complete formal/human testing at `https://test.crazyphrases.com/`.
10. Approve the queued `production` GitHub Environment deployment only after test acceptance passes.
11. After production deployment and post-promotion verification succeed, delete the merged feature branch from GitHub and prune stale local tracking refs.

The anonymous solo MVP may replace the homepage in `dev` and `test` during review. Production should keep the holding page until the slice is accepted for production promotion.

`dev` is shared. Each approved feature-branch deployment overwrites the previous `dev` deployment. Use the GitHub run history to confirm which branch and commit are currently deployed.

Automatic `dev` deployment requests currently watch `index.html`, `assets/**`, `package.json`, `package-lock.json`, and `tests/**`. If the app later moves to a build output directory or framework-specific source tree, update `.github/workflows/deploy-dev.yml` in the same change as that app-structure migration. Use manual `workflow_dispatch` for exceptional branch deployments outside the watched paths.

### Branch Lifecycle

Feature branches are short-lived scaffolding for one implementation slice, documentation slice, or operational change. The durable history is the issue, pull request, merge commit, deployment run, and environment deployment record, not the branch name itself.

Use this branch lifecycle:

1. Start each issue or documentation slice from fresh `main`.
2. Create a focused branch such as `codex/issue-4-local-recovery` or `codex/document-branch-lifecycle`.
3. Push the branch and open a pull request.
4. Use the branch deployment to `dev` when runtime files change and the implementation needs engineering inspection.
5. Merge the pull request to `main` only after review and required verification.
6. Let the `main` merge commit promote through `test` and then `production` using the gated workflow.
7. Delete the feature branch after production verification succeeds, unless there is an explicit rollback, audit, or follow-up reason to keep it temporarily.

Do not keep old issue branches until the whole MVP is complete. Keeping merged or superseded branches makes the repository harder to read and increases the chance that future work starts from a stale ref.

Superseded branches may be deleted once their intended changes are present on `main` through another merged pull request. Before deleting a branch whose pull request was closed rather than merged, check that `git log --cherry-pick main...origin/<branch>` shows no unique commits that still need preservation.

### Operator Commands

Inspect workflow runs:

```powershell
gh run list --workflow ci.yml --limit 5
gh run list --workflow deploy-dev.yml --limit 5
gh run list --workflow promote.yml --limit 5
gh run view <run-id>
gh run watch <run-id> --exit-status
```

Manually request or re-request a feature-branch `dev` deployment:

```powershell
gh workflow run deploy-dev.yml --ref <feature-branch-name>
```

Manually re-run the `main` promotion workflow:

```powershell
gh workflow run promote.yml --ref main -f promote_production=false
```

Manually request production promotion from `main` after test acceptance:

```powershell
gh workflow run promote.yml --ref main -f promote_production=true
```

The normal path is the automatic `promote.yml` run created by a push to `main`. The manual commands are for re-running or recovering a known commit path, not for bypassing review.

### Approval Boundaries

If the selected GitHub Environment has a reviewer gate, the deployment job waits until the environment is approved in GitHub. Approval authorizes the FTPS upload only; browser access to `dev` and `test` is still controlled separately by Cloudflare Access.

Required reviewer intent:

- `dev` approval means the branch commit may overwrite the shared engineering inspection environment.
- `test` approval means the merged `main` commit may overwrite the formal testing environment.
- `production` approval means human testing has passed in `test` and the same `main` commit may mutate the live site.

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
