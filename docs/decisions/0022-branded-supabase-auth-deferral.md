# 0022: Branded Supabase Auth Deferral

## Status

Accepted. The owner selected documented deferral with explicit accepted risk on
2026-06-25 for GitHub issue #84, under parent PRD #83. PR #87 merged the
deferral record and closed #83 and #84 as completed. The earlier
`auth.crazyphrases.com` custom-domain route was reversed after reviewing
Supabase custom-domain cost implications in more detail.

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

After reviewing cost implications in more detail, the owner decided that the
custom-domain route is not suitable for the current project stage.

## Decision

Crazy Phrases will defer branded hosted Auth domain work and explicitly accept
the current trust risk for the current launch-readiness scope.

The hosted Google sign-in flow may continue to show the raw Supabase project
domain, `egnudphshvqdhrotxrfs.supabase.co`, while the project remains in the
current pre-public-onboarding stage.

The project will not create or activate `auth.crazyphrases.com`, a Supabase
custom domain, or a Supabase vanity subdomain as part of #84. The follow-up
custom-domain preparation and activation issues #85 and #86 are superseded by
this decision and were closed as not planned.

This decision does not authorise any Supabase Auth, Google OAuth, Cloudflare
DNS, GitHub Environment, production deployment, or hosted data mutation.

The deferral should be revisited when one of these triggers occurs:

- the project is ready for broader public user onboarding;
- sign-in hesitation caused by the Supabase project domain becomes a repeated
  tester or user blocker;
- Supabase custom-domain pricing, plan, or project budget constraints change;
- a lower-cost provider or branding option becomes available;
- the project introduces paid, commercial, or public-discovery features that
  make the current trust risk unacceptable.

## Consequences

- The player-visible sign-in seam is:
  `crazyphrases.com` signed-out UI -> `Sign in with Google` -> Google/Supabase
  auth screen -> return to Crazy Phrases signed in.
- The seam remains known to show the raw Supabase project ref as the external
  destination, and that is an accepted risk for the current scope.
- Google OAuth settings, Supabase Auth settings, Cloudflare DNS, certificate
  validation, GitHub Environment variable changes, deployment approval, and
  hosted data mutation remain separate authorities.
- Future work must not silently create `auth.crazyphrases.com`, enable a
  Supabase custom domain, or switch to a vanity subdomain without first
  amending or superseding this ADR.
- No game mechanics, Account Profile fields, Handle rules, Avatar storage,
  Multiplayer lifecycle, Favourites storage, or public discovery behaviour
  changes as part of this decision.
- The Supabase Auth and Cloudflare runbooks should continue to make clear that
  branded Auth domain mutation is not authorised by environment detection or
  by the presence of the backlog item.

## References

- Supabase Login with Google:
  `https://supabase.com/docs/guides/auth/social-login/auth-google`
- Supabase Custom Domains:
  `https://supabase.com/docs/guides/platform/custom-domains`
- Supabase CLI custom-domain activation:
  `https://supabase.com/docs/reference/cli/introduction`
