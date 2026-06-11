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

Deployment is managed by `.github/workflows/deploy.yml`.

Manual deployment:

1. Open GitHub Actions.
2. Select **Deploy website**.
3. Select **Run workflow**.
4. Choose `dev`, `test`, or `production` as the target environment.
5. Approve the selected GitHub Environment if a reviewer gate is configured.

Codex/operator deployment:

Use GitHub CLI to trigger non-production deployments from the repository root:

```powershell
gh workflow run deploy.yml --ref main -f target_environment=dev
gh workflow run deploy.yml --ref main -f target_environment=test
```

Use `dev` for active development review and `test` for release testing. Do not deploy to `dev` or `test` by pushing to `main`; pushes to `main` are reserved for production verification and deployment.

Feature slices should move through environments in order:

1. Deploy to `dev` so the implementing engineer can verify the functionality.
2. Deploy to `test` for formal testing after development verification passes.
3. Deploy to `production` only after required automated tests pass and human acceptance is completed in `test`.

The anonymous solo MVP may replace the homepage in `dev` and `test` during review. Production should keep the holding page until the slice is accepted for production promotion.

After triggering a run, inspect it in GitHub Actions or with GitHub CLI:

```powershell
gh run list --workflow deploy.yml --limit 5
gh run view <run-id>
gh run watch <run-id> --exit-status
```

If the selected GitHub Environment has a reviewer gate, the deployment job waits until the environment is approved in GitHub. Approval authorizes the FTPS upload only; browser access to `dev` and `test` is still controlled separately by Cloudflare Access.

Automatic deployment:

- Pushes to `main` run verification and then target the `production` environment only.
- The production environment reviewer gate remains the authority boundary for live production mutation.
- Pushes to `main` do not deploy to `dev` or `test`.

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

## Operational Notes

- GitHub Environment reviewers approve deployment.
- Cloudflare Access policies approve runtime browser access.
- cPanel controls origin file hosting.
- Cloudflare controls DNS and edge access policy.
- These authority boundaries are separate and must not be treated as interchangeable.
