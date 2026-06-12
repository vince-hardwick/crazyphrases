# Auth and Backend Stack Research - 2026-06-12

## Purpose

This note informs GitHub issue #23, `Record backend/auth/source-of-truth ADR`.
It is research, not an accepted ADR. The eventual ADR should re-check provider
pricing, quotas, and product names before locking a decision.

## Project Constraints

- Crazy Phrases is a personal, fun, passion project, so fixed monthly cost should
  be absent or very low until real usage justifies paying.
- Signed-in features need backend-backed state. Static hosting is only the
  anonymous solo boundary.
- User convenience matters: prefer social sign-in and passwordless email over
  forcing users to create another password.
- Security matters: use managed auth where practical, avoid storing secrets in
  the repo, enforce per-account authorization in the data store, and keep
  service/admin credentials server-side only.
- The data model is likely relational over time: Account, Handle, Gamer Name,
  Avatar, current signed-in Solo Game, later Game Invites, Turns, consent
  records, favourites, account deletion, and collaborative history.
- Existing Cloudflare Access protects `dev` and `test`, but it is environment
  access control for reviewers, not public end-user game authentication.

## Recommendation

Use **Supabase Auth + Supabase Postgres** as the default recommendation for the
first signed-in foundation ADR.

Recommended initial shape:

- Keep the current static deployment path for anonymous solo while signed-in
  pages call Supabase through the browser SDK.
- Use Supabase Auth with Google sign-in plus passwordless email magic link/OTP.
  Add Apple later if mobile/iOS usage justifies the extra provider setup. Avoid
  SMS/phone sign-in for MVP because it adds cost and account-recovery risk.
- Model user-owned data in Postgres tables keyed to Supabase `auth.users`.
- Enable Row Level Security on every exposed table and write policies such as
  "participants can select/update only rows owned by their Account".
- Store the current signed-in Solo Game with a revision/version field so stale
  clients cannot silently overwrite newer progress.
- Use Edge Functions or a small server-side route only for privileged operations
  that need service-role authority; do not expose service-role keys to the
  browser.
- Treat the Supabase free plan as acceptable for hobby evaluation, but record in
  the ADR that free-project pauses/quotas are an operational risk and that paid
  promotion requires explicit approval.

Why this is the best fit:

- It gives the project managed auth, a relational database, row-level
  authorization, generated APIs, and enough free quota for hobby validation in
  one provider.
- Postgres fits the future game-history, consent, deletion, and template lineage
  boundaries better than a document-only model.
- It keeps implementation smaller than Cloudflare D1 plus custom auth, while
  keeping the backend source-of-truth clearer than Firebase document trees.

## Shortlist Comparison

| Option | Cost posture | User convenience | Security posture | Data-model fit | Project fit |
| --- | --- | --- | --- | --- | --- |
| Supabase Auth + Postgres | Free tier includes 2 projects, 500 MB database per project, 50k MAU, 5 GB egress, and 500k Edge Function invocations. Paid usage adds fixed and variable costs. | Built-in password, magic link/OTP, social login, SSO options. | Strong when every exposed table has RLS enabled; browser access can be scoped by JWT + RLS. | Strong relational fit for accounts, games, turns, consent, favourites, deletion, and history. | Best balanced default. |
| Firebase Auth + Firestore | Spark has no payment method and generous no-cost limits; Firestore has daily read/write quotas. | Excellent drop-in auth, social login, account recovery, provider linking. | Strong if Firestore Security Rules are written narrowly; easy to make broad rules too permissive. | Good for simple current-game documents, weaker for future relational history/consent queries. | Best fallback if auth convenience beats relational modelling. |
| Cloudflare Workers + D1 + Auth.js/Better Auth | D1 and Workers have very generous free usage and no D1 egress charge. | Depends on custom auth implementation; not end-user auth out of the box. | Can be strong, but the project owns more session, OAuth, CSRF, and authorization work. | Good lightweight SQL fit; migrations and privileged routes are custom. | Cheapest runtime fit, but more work and security responsibility. |
| Appwrite Cloud | Free plan is explicitly aimed at passion projects, with 75k MAU, 1 database, 2 functions, 2 GB storage, and 5 GB bandwidth; free projects pause after inactivity. | Built-in auth, OAuth2, email OTP, magic URL, MFA options. | Good BaaS posture, but authorization model and ecosystem are less familiar than Supabase/Firebase. | Mostly document-oriented; enough for MVP, less ideal for future relational history. | Viable but not better than Supabase for this project. |
| Clerk + Supabase/Neon/D1 | Clerk Hobby is free up to 50k retained users and has polished prebuilt auth UI. Backend still needs a second provider. | Best UX for prebuilt sign-up/sign-in/profile surfaces. | Strong managed auth, bot protection, breached password checks; passkeys/MFA require paid plan. | Depends on chosen backend. | Consider only if auth UX polish is worth an extra provider and possible branding/paid limits. |
| WorkOS AuthKit + Supabase/Neon/D1 | AuthKit is currently free up to 1M MAU, but custom domains, Radar scale, SSO connections, and Directory Sync can add meaningful monthly cost. Backend still needs a second provider. | Very strong hosted auth: social, email/password, Magic Auth, MFA, passkeys, organizations, RBAC, and enterprise SSO. | Strong managed auth and enterprise controls, but the project still owns backend authorization for game state. | Depends on chosen backend. | Feature-rich and not cost-prohibitive for auth alone, but overpowered for the first consumer game slice unless enterprise auth is a near-term goal. |
| Convex | Free/Starter is aimed at personal projects and includes auth, realtime, storage, functions, and preview deployments. | Good modern app experience, often with Convex Auth or external auth. | Good if staying in Convex's model; less standard for SQL/RLS-style authorization. | Reactive document database, not a natural fit for relational consent/history modelling. | Attractive for a full app rewrite, not the least disruptive #23 choice. |
| Neon Postgres + Better Auth/Auth.js | Neon free includes Postgres, scale-to-zero, 0.5 GB storage, and Neon Auth with 60k MAU. | Good if the project adopts an app server/framework and owns more auth code. | Can be strong, but more is in project code: sessions, auth routes, CSRF, migrations. | Strong Postgres fit. | Promising but higher implementation complexity than Supabase. |
| PocketBase self-hosted | Software cost is zero, but hosting, backups, patching, uptime, and TLS are on the project owner. | Built-in auth, OAuth2, OTP, MFA. | Acceptable for small self-hosted apps if operated carefully, but more ops burden. | SQLite-backed, simple and fast for small data. | Not recommended for production-critical direction; docs say v1.0 compatibility is not guaranteed. |

## Recommended Auth UX

For the first signed-in slice:

1. Offer "Continue with Google" as the primary path.
2. Offer email magic link or email OTP as the fallback for users who do not want
   Google.
3. Do not offer phone/SMS auth in MVP.
4. Do not force password registration in MVP unless the chosen provider's hosted
   flow makes it unavoidable.
5. Add passkeys later only if the chosen provider supports them without
   distorting the core game flow or forcing a paid plan too early.

This gives players a low-friction path while avoiding password storage decisions
and SMS cost. It also keeps account identity separate from Gamer Name and Handle.

## Security Guidance For The ADR

The ADR should require:

- Auth provider redirect URL allowlists for local, dev, test, and production.
- Separate provider projects or configuration for dev/test/production where the
  provider supports it.
- No tokens, service-role keys, OAuth client secrets, database passwords, or
  SMTP secrets in the repository.
- Public/browser keys only where the provider explicitly designs them for
  browser use.
- Server-only service/admin keys for migrations, admin repair tools, account
  deletion jobs, and any future moderation tasks.
- RLS or equivalent server-enforced authorization before any browser client can
  read or write account-backed data.
- Account-owned current Solo Game rows keyed by immutable Account/user id, not
  by mutable Handle or Gamer Name.
- Unique database constraints for Handle.
- A revision/version field on the current signed-in Solo Game, checked on every
  update to prevent stale overwrite.
- Deletion handling that treats current signed-in solo state as personal/private
  data while preserving the accepted future collaborative-history rule.
- Bot/abuse controls on sign-up if public sign-up is enabled. Cloudflare
  Turnstile is a good low-friction candidate, but its server-side token
  validation and environment-separated widgets are mandatory.

## ADR Decision Template

The issue #23 ADR should answer:

1. Which provider owns Account authentication?
2. Which provider owns signed-in game persistence?
3. What is the immutable Account identifier used in app tables?
4. Which auth methods are enabled at launch?
5. How are local, dev, test, and production projects/configuration separated?
6. Where are secrets stored, and which keys are allowed in browser code?
7. What row-level or rule-based authorization model protects user-owned rows?
8. How does signed-in Solo Game save/resume prevent stale overwrites?
9. What is deleted for account deletion in this slice?
10. What explicit costs or quota risks does the owner accept?

## Provider Notes

### Supabase

Supabase Auth supports password, magic link, OTP, social login, and SSO, and it
integrates auth JWTs with Postgres Row Level Security. Supabase's billing docs
list Free, Pro, Team, and Enterprise plans; current free quotas include 2 free
projects, 500 MB database per project, 50k MAU, 50k third-party MAU, 5 GB egress,
1 GB storage, and 500k Edge Function invocations. Supabase docs state that RLS
must always be enabled on tables in exposed schemas.

Key risk: free projects and quotas are fine for a passion project but not a
production guarantee. The ADR should call out when the project would move to a
paid plan and who approves that.

Sources:

- https://supabase.com/docs/guides/auth
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/platform/billing-on-supabase

### Firebase

Firebase Auth has excellent user-facing auth workflows. FirebaseUI is positioned
as a drop-in auth solution and handles email/password, phone, and federated
providers such as Google/Facebook. Pricing currently shows a no-cost Spark plan
with no payment method, 50k Authentication MAU for non-phone providers, and
Firestore no-cost limits including 1 GiB stored data, 20k writes/day, and 50k
reads/day. Firestore Security Rules evaluate every client request, and Firebase
explicitly warns not to ship allow-all rules.

Key risk: Firestore's document model can work for current-game persistence, but
future game history, consent, participant snapshots, and deletion/anonymisation
will need careful modelling and rules. Billing can also become less predictable
when read patterns grow.

Sources:

- https://firebase.google.com/docs/auth
- https://firebase.google.com/pricing
- https://firebase.google.com/docs/firestore/security/get-started

### Cloudflare Workers and D1

Cloudflare D1 has the strongest cost story: current free limits include 5M rows
read/day, 100k rows written/day, and 5 GB total storage; paid D1 includes large
monthly allowances, and D1 has no data-transfer/egress charge. This fits the
existing Cloudflare DNS/Access setup and could keep runtime cost near zero.

Key risk: D1 does not solve public end-user auth by itself. Auth.js/Better Auth
can provide OAuth/session flows, but that moves more auth and session security
into project-owned code. It is a good advanced option if the owner wants to stay
Cloudflare-first and accepts more implementation responsibility.

Sources:

- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://authjs.dev/getting-started/authentication/oauth
- https://authjs.dev/concepts/session-strategies
- https://authjs.dev/guides/edge-compatibility
- https://better-auth.com/docs/introduction

### Appwrite

Appwrite Cloud's free plan is explicitly described as suitable for passion
projects and small apps. It includes auth, one database, functions, storage,
realtime, and high MAU allowance. Appwrite supports email/password, OTP, magic
URL, OAuth2, anonymous login, JWT login, and MFA options.

Key risk: free projects pause after inactivity, and the database shape is less
natural for relational game-history and consent boundaries than Postgres.

Sources:

- https://appwrite.io/pricing
- https://appwrite.io/docs/products/auth

### Clerk

Clerk has the strongest auth-product UX: prebuilt UI for sign-up/sign-in/profile,
free Hobby tier up to 50k retained users, social connections, email links/codes,
automatic account linking, bot protection, and data exports. It is very
attractive if the owner wants the smoothest possible sign-in flow.

Key risk: it is auth only. The project still needs Supabase, Neon, D1, Firebase,
or another backend for game state. The free plan has branding/session limits, and
MFA/passkeys are paid features.

Sources:

- https://clerk.com/pricing
- https://clerk.com/docs/guides/configure/auth-strategies/social-connections/overview

### WorkOS

WorkOS AuthKit is not overkill from a cost-only perspective: current pricing
lists AuthKit as free up to 1 million monthly active users. It is overkill from a
product-scope perspective for the first signed-in Crazy Phrases slice because it
is primarily an enterprise-grade auth and user-management platform. Its strengths
are social auth, email/password, Magic Auth, MFA, email verification,
organization policies, JIT provisioning, passkeys, RBAC, enterprise SSO,
Directory Sync, Admin Portal, and audit/security-adjacent products.

For Crazy Phrases, WorkOS would still need a separate backend for signed-in game
state. That means WorkOS plus Supabase/Neon/D1 instead of one provider that owns
both auth and persistence. The extra provider can be justified if the owner wants
the most polished hosted auth and expects organizations, enterprise SSO, RBAC, or
admin portal features soon. It is not the smallest path to account-backed Solo
Game save/resume.

Key cost caveats: AuthKit's free MAU allowance is generous, but custom domain is
listed as a paid monthly add-on, Radar has a small free allowance before paid
blocks, and SSO/Directory Sync connections are priced per connection. Those are
fine to defer, but they are exactly the features WorkOS is strongest at.

Sources:

- https://workos.com/pricing
- https://workos.com/docs/authkit
- https://workos.com/docs/authkit/hosted-ui

### Convex

Convex is strong for realtime apps and has an appealing personal-project tier.
It includes a reactive database, auth, functions, file storage, preview
deployments, and a TypeScript-first workflow.

Key risk: it would steer Crazy Phrases toward a broader app-stack migration and
a document/reactive model. That may be useful later, but it is not the smallest
move from the current static app to signed-in solo persistence.

Sources:

- https://www.convex.dev/pricing
- https://docs.convex.dev/auth/overview

### Neon + Better Auth/Auth.js

Neon is a strong low-cost Postgres option. Current free plan details include
0.5 GB storage per project, scale-to-zero compute, 100 CU-hours/month per
project, and Neon Auth with 60k MAU. Better Auth is framework-agnostic and offers
email/password, social sign-on, account/session management, rate limiting, and a
plugin ecosystem including passkeys.

Key risk: it requires more application/backend code than Supabase. That may be a
good long-term engineering choice, but it is less frictionless for the immediate
signed-in foundation.

Sources:

- https://neon.com/pricing
- https://better-auth.com/docs/introduction
- https://better-auth.com/docs/plugins/passkey

### PocketBase

PocketBase is a compelling zero-software-cost self-hosted option: SQLite,
realtime, built-in auth, dashboard, and simple APIs in one executable. Its docs
also warn that full backwards compatibility is not guaranteed before v1.0.0 and
that it is not recommended for production-critical applications unless the owner
is comfortable following changelog-driven migrations.

Key risk: operational ownership. Hosting, backups, patching, monitoring, TLS,
and incident response become the project owner's problem.

Sources:

- https://pocketbase.io/docs/
- https://pocketbase.io/docs/authentication/
- https://pocketbase.io/docs/going-to-production/
