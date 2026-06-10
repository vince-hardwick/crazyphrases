# 0006: Cloudflare DNS and Access for Environments

## Status

Accepted

## Context

The project needs separate production, test, and development web environments:

- `www.crazyphrases.com` for production.
- `test.crazyphrases.com` for release testing.
- `dev.crazyphrases.com` for active development review.

Production should remain public. Development and test environments should require GitHub authentication before a browser can use them. GitHub repository environments can gate deployments, but they do not protect runtime browser access to deployed websites.

The domain is currently hosted on cPanel and deployed by GitHub Actions over FTPS. The site also uses email for `crazyphrases.com`, so DNS migration must preserve mail records.

## Decision

Move authoritative DNS for `crazyphrases.com` to Cloudflare and use Cloudflare as the edge access-control layer for non-production web hostnames.

Cloudflare responsibilities:

- Authoritative DNS for `crazyphrases.com`.
- Proxied HTTP(S) edge for public web hostnames.
- Cloudflare Access protection for `dev.crazyphrases.com` and `test.crazyphrases.com`.
- GitHub identity provider for Cloudflare Access.
- TLS mode set to Full (strict) where the cPanel origin presents a valid certificate.

GitHub responsibilities remain separate:

- GitHub is the source of truth for code, documentation, plans, and workflow definitions.
- GitHub Actions deploys environment-specific artifacts over FTPS.
- GitHub Environments gate deployment authority for `dev`, `test`, and `production`.
- GitHub Environment reviewers/collaborators do not grant runtime browser access by themselves.

cPanel responsibilities:

- Host the deployed files for each environment document root.
- Keep origin TLS certificates valid for `www`, `dev`, and `test` hostnames.
- Keep mail, FTP, cPanel, and webmail service records available as DNS-only records in Cloudflare.

## Target Environment Model

| Environment | Hostname | Runtime access | Deploy authority |
| --- | --- | --- | --- |
| `dev` | `dev.crazyphrases.com` | Cloudflare Access with GitHub login | GitHub Environment `dev` |
| `test` | `test.crazyphrases.com` | Cloudflare Access with GitHub login | GitHub Environment `test` |
| `production` | `www.crazyphrases.com` | Public | GitHub Environment `production` |

The allowed GitHub users or teams for Cloudflare Access must be documented in the environment runbook when configured. Deployment approvers in GitHub and runtime viewers in Cloudflare are separate lists and must be reviewed separately.

## DNS Migration Rules

- Export or record the current DNS zone before changing nameservers.
- Recreate all required records in Cloudflare before switching registrar nameservers.
- Proxy web records that Cloudflare should protect or accelerate.
- Keep non-HTTP records DNS-only, including MX, SPF, DKIM, DMARC, FTP, cPanel, and webmail records.
- Prefer using the hosting provider's raw FTP hostname for GitHub Actions secrets rather than a proxied `crazyphrases.com` hostname.

## TLS Rules

- Use Cloudflare SSL/TLS mode Full (strict) once the origin certificates cover the requested hostnames.
- Do not use Flexible SSL because it can hide origin HTTP, cause redirect loops, and weaken the intended security boundary.
- Keep Let's Encrypt or equivalent origin certificates active on cPanel for `www`, `dev`, and `test`.

## Authority Boundary

Detecting a hostname, branch, GitHub environment, DNS provider, Cloudflare zone, or runtime context must not itself authorize mutation of live systems.

Live mutation authority is granted only by the relevant approved deployment workflow or explicit owner action:

- GitHub Environment approval authorizes deployment.
- Cloudflare Access policy authorizes browser access.
- Cloudflare DNS/API access authorizes DNS and edge-policy mutation.
- cPanel access authorizes origin hosting changes.

These authorities are separate and must not be inferred from each other.

## Consequences

- Cloudflare becomes part of the production request path for proxied hostnames.
- A Cloudflare outage, account lockout, or DNS misconfiguration can affect site availability.
- DNS migration mistakes can break web or email service, so DNS records must be copied and verified carefully.
- Dev/test runtime protection is enforced at Cloudflare, not in app code.
- If the cPanel origin remains directly reachable, Cloudflare Access protects only Cloudflare-routed traffic. Origin firewall restrictions to Cloudflare IPs are desirable if the hosting provider supports them.
- Caching and proxy behavior must be environment-aware. Dev/test should avoid aggressive caching; production can add caching later after deployment invalidation is documented.
- The public repository may document architecture and policies, but must not contain Cloudflare, cPanel, FTP, or GitHub secrets.

