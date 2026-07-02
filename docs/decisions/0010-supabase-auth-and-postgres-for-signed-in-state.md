# 0010: Supabase Auth and Postgres for Signed-In State

## Status

Accepted

## Context

ADR 0008 keeps anonymous Solo Game play static-first, but signed-in features now
need a durable backend boundary for accounts, save/resume, account deletion, and
future collaborative game history.

The project constraints for this slice are:

- fixed monthly cost should remain absent or minimal while the project is a
  personal passion project;
- sign-in should be convenient, with social sign-in and passwordless email
  preferred over forcing a new password;
- browser-accessible data must be protected by server-enforced authorisation;
- service/admin credentials must stay server-side and out of the repository;
- current signed-in Solo Game state needs stale-write protection;
- the longer-term model is likely relational: Account, private email lookup key,
  Gamer Tag, Avatar, current signed-in Solo Game, later invites, turns, consent
  records, favourites, account deletion, and collaborative history.

Research in `docs/research/auth-backend-stack-2026-06-12.md` compared Supabase,
Firebase, Cloudflare D1 with auth libraries, Appwrite, Clerk, WorkOS, Convex,
Neon, SuperTokens, and PocketBase. The user approved the Supabase Auth +
Postgres recommendation on 2026-06-12.

## Decision

Use **Supabase Auth + Supabase Postgres** as the signed-in foundation backend for
the first account-backed Solo Game save/resume slice.

Initial implementation rules:

1. Supabase Auth owns public Account authentication.
2. Supabase Postgres owns signed-in game persistence.
3. App tables key user-owned rows to the immutable Supabase Auth user id, not to
   mutable Gamer Tag, private email lookup key, raw email, or display-name
   values.
4. Launch auth methods are Google sign-in plus passwordless email magic
   link/OTP, unless provider setup proves impractical during implementation.
5. SMS/phone sign-in is out of MVP scope because it adds cost and recovery
   complexity.
6. All browser-exposed tables must enable Row Level Security before browser
   reads or writes are allowed.
7. Browser clients may use only keys that Supabase documents as browser-safe.
   Service-role keys, database passwords, OAuth client secrets, SMTP secrets,
   and repair/admin credentials must remain server-side and out of the repo.
8. Privileged operations that need service-role authority must run through
   Supabase Edge Functions or another server-side route, not browser code.
9. Signed-in Solo Game state must include a revision/version field checked on
   every update so stale clients cannot silently overwrite newer progress.
10. Local, dev, test, and production Supabase configuration must be separated by
    environment variables, provider project configuration, or another documented
    environment boundary. Detecting the current environment does not authorise
    mutation of live data.
11. Moving from free/hobby limits to any paid Supabase plan requires explicit
    owner approval.

## Consequences

- Supabase becomes the source of truth for public signed-in identity and
  account-backed game state.
- The current static deployment path remains valid for anonymous Solo Game play.
- The project can test most application behaviour before a live Supabase account
  exists by driving public interfaces against fakes, local adapters, SQL
  migrations, or Supabase local development if available.
- A real Supabase account/project is required before validating hosted auth
  redirects, provider allowlists, email delivery, hosted RLS behaviour from the
  browser SDK, environment secrets, and deployed dev/test/prod smoke flows.
- Firebase, Appwrite, Neon, Clerk, WorkOS, Convex, SuperTokens, and PocketBase
  remain researched alternatives, but are not the default implementation path
  for issue #23 or the signed-in Solo Game foundation.
- The implementation should start with a narrow test-driven boundary: public
  account/session state, signed-in current Solo Game repository behaviour, and
  stale-write conflict handling before broader account features.
