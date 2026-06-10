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
| `dev` | Not configured yet |
| `test` | Not configured yet |

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

