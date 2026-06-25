# 0022: Branded Supabase Auth Custom Domain

## Status

Accepted. The owner selected the Supabase custom-domain route on 2026-06-25
for GitHub issue #84, under parent PRD #83. Preparation is tracked by #85 and
activation/verification by #86.

## Context

Crazy Phrases uses Supabase Auth for hosted Account sign-in. Google sign-in and
email magic links are launched from the Crazy Phrases static app, and the
participant returns to the app root after hosted Auth completes.

Live production verification on 2026-06-25 reproduced the trust problem that
was previously deferred in the backlog. A signed-out participant clicked
`Sign in with Google` from `https://www.crazyphrases.com/`, but Google displayed
the external sign-in destination as
`egnudphshvqdhrotxrfs.supabase.co`. That domain is technically correct for the
current Supabase project, but it does not look like Crazy Phrases to a
participant at the Account boundary.

The plausible routes were:

- improve Google OAuth consent/app branding while keeping the raw Supabase
  project callback domain;
- use a Supabase custom domain such as `auth.crazyphrases.com`;
- use a Supabase vanity subdomain that reads more clearly than the raw project
  ref;
- document a deferral if cost, provider, DNS, or operational constraints make
  branded Auth unsuitable now.

Current Supabase documentation recommends Google consent branding and a custom
domain for user trust. It also says Supabase custom domains and vanity
subdomains are mutually exclusive, and that Auth uses the custom domain for
OAuth flows after activation. The Supabase CLI documentation for custom-domain
activation also warns that third-party Auth providers no longer function on the
Supabase-provisioned subdomain after activation. OAuth provider callback
configuration must therefore be prepared before activation.

## Decision

Crazy Phrases will use a first-party Supabase custom domain for hosted Auth.
The accepted target hostname is:

```text
auth.crazyphrases.com
```

The custom domain is selected over Google-only branding because the observed
trust issue is the destination domain shown at the hosted Auth boundary, not
only the app logo or display name. It is selected over a Supabase vanity
subdomain because a first-party `crazyphrases.com` hostname gives the clearest
relationship between the game and the Auth hand-off.

This decision selects the route only. It does not activate the custom domain,
change Google OAuth configuration, change Cloudflare DNS, change GitHub
Environment variables, mutate production, or authorise hosted data writes.

Preparation must happen before activation:

- confirm Supabase plan, add-on, and cost implications for the custom domain;
- prepare the Google OAuth callback URL for
  `https://auth.crazyphrases.com/auth/v1/callback` alongside the current
  Supabase project callback until the migration is complete;
- create and verify the Supabase custom-domain configuration;
- apply only the DNS records Supabase requires for this custom domain;
- verify certificate readiness before any activation step;
- decide explicitly whether deployment `SUPABASE_URL` values should remain on
  the project URL or move to the custom domain after activation.

Activation must be handled as a separate, approval-gated operation because
Supabase Auth provider flows may switch to the custom domain immediately once
the custom hostname is activated.

## Consequences

- The player-visible sign-in seam is:
  `crazyphrases.com` signed-out UI -> `Sign in with Google` -> Google/Supabase
  auth screen -> return to Crazy Phrases signed in.
- The branded Auth work is complete only when that seam no longer presents the
  raw Supabase project ref as the confusing primary destination.
- Google OAuth settings, Supabase Auth settings, Cloudflare DNS, certificate
  validation, GitHub Environment variable changes, deployment approval, and
  hosted data mutation remain separate authorities.
- If Supabase custom-domain plan, cost, verification, or provider constraints
  make this route unsuitable, the route must be revisited with a new ADR or an
  explicit amendment to this one. Do not silently substitute a vanity subdomain
  or Google-only branding as equivalent.
- No game mechanics, Account Profile fields, Handle rules, Avatar storage,
  Multiplayer lifecycle, Favourites storage, or public discovery behaviour
  changes as part of this decision.
- The Supabase Auth runbook owns preparation and activation procedure. The
  Cloudflare runbook owns DNS authority boundaries for the
  `auth.crazyphrases.com` hostname.

## References

- Supabase Login with Google:
  `https://supabase.com/docs/guides/auth/social-login/auth-google`
- Supabase Custom Domains:
  `https://supabase.com/docs/guides/platform/custom-domains`
- Supabase CLI custom-domain activation:
  `https://supabase.com/docs/reference/cli/introduction`
