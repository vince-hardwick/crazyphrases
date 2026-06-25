# PRD: Durable Account Profile and Handle Directory

> **Status:** Published PRD provenance. Accepted durable authority lives in ADR 0011, `docs/product-rules.md`, and `docs/runbooks/supabase-auth-and-postgres.md`. MVP profile-management UI shipped through #47 / PR #62; avatar-upload personalisation shipped through #63 / PR #74; circular avatar masking remains tracked in `docs/backlog.md` and GitHub issue #64.

Published as GitHub Issue: https://github.com/vince-hardwick/crazyphrases/issues/43

## Child Issues

1. #44 `Add durable Account Profile and Handle Directory` - AFK, can start immediately.

## Problem Statement

Signed-in play currently has a client-side Account shell with generated/default
Handles, Gamer Names, and Avatars. That is enough for local display, but it is
not a durable profile boundary and it cannot support handle-based multiplayer
invites. A future Game Invite needs to find another signed-in participant by
Handle without exposing emails or raw Supabase Auth identities to public app
surfaces.

The next slice should create the durable Account Profile / Handle Directory
prerequisite only. It should not start the Pending Game, invite acceptance,
Slot Allocation, Turn, or Reveal lifecycle.

## Solution

Add a Supabase-backed Account Profile table and a browser-facing profile
repository. Each signed-in Account gets one active profile with a globally
unique Handle, a Gamer Name, and a generated/default Avatar. The directory is
readable to signed-in Accounts for handle lookup, but anonymous visitors cannot
query it.

Handle lookup returns only invite-safe profile data: a directory profile id,
Handle, Gamer Name, and Avatar. It does not expose email addresses or raw
Supabase Auth user ids. Future multiplayer tables can reference the directory
profile id or resolve it server-side without making the Auth user id a public
discovery value.

The hosted Supabase project is not mutated by this implementation slice unless
the owner separately approves applying the source-controlled migration.

## User Stories

1. As a signed-in participant, I want a durable Account Profile, so that my game-facing identity is not regenerated independently in every browser.
2. As a signed-in participant, I want one active Gamer Name, so that other participants can recognise me without seeing my account identity.
3. As a signed-in participant, I want a globally unique Handle, so that future handle invites can disambiguate accounts.
4. As a signed-in participant, I want a generated/default Avatar, so that account-facing surfaces have a visual marker without uploaded pictures.
5. As a signed-in participant, I want my existing profile to load after refresh or sign back in, so that my identity remains stable.
6. As a signed-in participant, I want default profile creation to be lightweight, so that sign-in still reaches play quickly.
7. As a signed-in participant, I want handle lookup to find other active profiles, so that future Game Invites can start from a Handle.
8. As a signed-in participant, I do not want handle lookup to expose another participant's email or raw Auth user id, so that discovery does not leak account authority.
9. As an anonymous visitor, I do not want access to the profile directory, so that account discovery remains a signed-in feature.
10. As a future implementer, I want an invite-safe directory profile id, so that multiplayer can identify invite targets without publishing Auth user ids.
11. As a project owner, I want Account Profile rows protected by Row Level Security, so that browser clients can only create and update their own profile.
12. As a project owner, I want Handle uniqueness enforced by Postgres, so that concurrent clients cannot create duplicate Handles.
13. As a project owner, I want Account deletion to remove private active profile data, so that profile identity is not preserved as personal data after deletion.
14. As a future implementer, I want collaborative game history to snapshot participant display data later, so that deleting an Account Profile does not imply hard-deleting future completed collaborative history.

## Implementation Decisions

- Treat this as the durable profile prerequisite for signed-in 2-player asynchronous games, not as the multiplayer PRD.
- Create one active Account Profile per Account.
- Store profiles in Supabase Postgres behind Row Level Security.
- Key the profile row to the immutable Supabase Auth user id internally.
- Add a separate directory profile id for signed-in discovery and future invite references.
- Do not expose email addresses, provider identities, or raw Supabase Auth user ids through handle lookup.
- Handles are normalised to lowercase hyphenated text, globally unique, and 3 to 30 characters long.
- Gamer Names are normalised display text and limited to 40 characters.
- Avatars use the existing generated/default avatar key set; uploaded profile pictures remain out of scope.
- Signed-in Accounts may create and update only their own profile.
- Signed-in Accounts may look up active profiles by Handle.
- Anonymous clients have no table grants and no RLS path for profile lookup.
- Account deletion may cascade active profile rows because future collaborative history must use participant snapshots rather than live profile rows.
- Hosted schema mutation requires explicit owner approval. This slice only adds the source-controlled migration and local tests unless that approval is given later.

## Testing Decisions

- Use TDD: write one failing behaviour test, verify RED, implement the smallest GREEN change, then refactor only while green.
- Add repository tests at the public profile repository seam, using a fake Supabase client rather than hosted data.
- Add auth-session tests proving the signed-in shell uses a durable profile repository when supplied.
- Add migration-surface tests proving the table has RLS, no `anon` grant, signed-in lookup, owner-only create/update, global Handle uniqueness, and no direct Auth user id exposure in lookup columns.
- Preserve existing anonymous solo, signed-in solo, private favourites, and browser smoke tests.
- Do not run hosted Supabase writes without explicit owner approval.

## Out of Scope

- Pending Game creation.
- Game Invites and invite acceptance or decline.
- Multiplayer Slot Allocation, Slot Order, Turn completion, concealment, and Reveal.
- Share Consent, public discovery, public share links, feeds, leaderboards, reactions, reports, and moderation.
- Friend relationships and friend invite shortcuts.
- In-App Notifications, nudges, email notifications, push notifications, and manual pokes.
- Uploaded profile pictures.
- Multiple gamer profiles per Account.
- Anonymous-to-signed-in import.
- Applying the migration to the hosted Supabase project without explicit owner approval.

## Further Notes

Follow-up implementation tickets should start with handle-invite Pending Game
creation after this prerequisite lands. The first multiplayer PRD should keep
public sharing, Share Consent, friends, nudges, and social discovery out of the
initial issue set unless the owner explicitly expands scope.
