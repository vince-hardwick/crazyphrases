# 0023: Private Email Lookup and Gamer Tag

## Status

Accepted

## Context

ADR `0011` accepted a durable Account Profile / Handle Directory with a
user-editable `Handle`, changeable `Gamer Name`, and browser-facing directory
lookup that avoided exposing email addresses. That model was correct for the
first Account Profile foundation at the time it was accepted.

The owner has now changed the product terminology and account-identity model
before the next account navigation and settings polish work proceeds. The new
accepted language is:

- `Gamer Name` becomes `Gamer Tag`;
- email-backed account lookup replaces the public `Handle` model;
- hosted email lookup is derived from Supabase Auth email rather than edited as
  a normal profile field;
- Gamer Tag is also an accepted lookup option.

This is a deliberate replacement of the earlier accepted model, not a
documentation cleanup.

## Decision

Supersede ADR `0011` for account-facing identity terminology and directory
authority.

Crazy Phrases still has one active Account Profile per Account, keyed
internally to the immutable Supabase Auth user id. The browser-facing lookup
surface continues to expose an invite-safe profile identifier and Avatar
descriptor, and it remains readable only to signed-in Accounts. Anonymous
visitors still have no profile lookup grant or Row Level Security path.

The game-facing display and public lookup value is `Gamer Tag`. It is
changeable profile data, but in the MVP it must remain globally unique enough
for exact signed-in lookup and invitation. A future design that permits
non-unique Gamer Tags must first define invite-result disambiguation without
exposing email addresses or raw Auth identities.

For hosted Auth Accounts, the private account lookup key is derived from the
email address associated with the authenticated Supabase Auth identity: the
email address submitted for email magic-link sign-in, or the email address
returned by a third-party Auth provider. This email-backed value is not a
public profile field, game-facing participant label, account-menu label,
participant snapshot, profile URL value, mention value, or normal editable
Account Profile field. Changing it requires a later accepted Auth-email or
account-identity design, not ordinary profile editing.

Signed-in lookup uses one lookup-key input. The participant does not choose a
lookup mode. The resolver infers whether the entered lookup key is an email
address or Gamer Tag and performs the corresponding exact lookup:

- known-email lookup, where the participant enters a full email address they
  already know;
- Gamer Tag lookup, where the participant enters another Account's Gamer Tag.

Known-email lookup must not become email discovery. It must not offer browse,
prefix, fuzzy, autocomplete, or list-all behaviour over email addresses. A
successful known-email lookup returns invite-safe profile data centred on Gamer
Tag and Avatar, plus any opaque directory profile id needed for invitation. It
must not return or display the submitted email address, any stored email-backed
lookup key, raw Supabase Auth user ids, provider identity ids, service
credentials, or non-opaque Uploaded Avatar storage identifiers. An email miss
uses the fixed result copy `No gamer found under that email address`.

Gamer Tag lookup returns the same invite-safe profile result shape and never
adds email addresses to the response. A Gamer Tag miss uses the fixed result
copy `No gamer found under that gamer tag.`.

The accepted hosted implementation may use a narrow authenticated
`SECURITY DEFINER` lookup RPC to resolve the private `email_lookup_key` without
granting direct browser `SELECT` access to that column. This is intentionally an
authenticated lookup surface, not an anonymous or public browsing surface. The
RPC must keep an authenticated-user guard, must not be executable by `anon` or
`public`, and must return only invite-safe fields such as opaque profile id,
Gamer Tag, and Avatar descriptor data. Supabase security advisors may flag this
shape as an authenticated-callable `SECURITY DEFINER` function; that warning is
expected unless and until the lookup is redesigned through an equivalent
narrower server-owned path that preserves the same privacy boundary.

Hosted legacy Account Profile preservation is not required for this transition.
On 2026-07-02, the owner confirmed that only one hosted user account exists and
that account/profile data may be removed because the owner can re-register via
Google sign-in. Source-controlled migrations for this identity boundary should
fail fast if legacy Account Profile rows remain rather than silently
compatibility-mapping old Handle/Gamer Name values. Any hosted deletion, schema
migration, or data reset remains a live backend mutation and must follow the
documented dev, test, and production approval gates.

Hosted Accounts without a usable Auth email are not inviteable by generated
placeholder email lookup values. The app should fail closed for known-email
lookup and surface a recoverable account setup or sign-in problem rather than
exposing raw Auth ids, provider ids, random local handles, or an editable
fallback email-backed value. Gamer Tag lookup may still work for such an
Account only if its profile has a valid Gamer Tag under the accepted profile
rules.

Completed multiplayer and favourite snapshots should preserve the participant
identity values needed for their display context, including Gamer Tag and
Avatar. Private email-backed lookup values are not historical display values and
should not be snapshotted for participant display. Any future feature that
allows changing the Auth email must define how known-email lookup, invitation
resolution, and privacy expectations behave before it ships.

## Consequences

- ADR `0011` remains historical provenance for the original Handle Directory
  implementation, but ADR `0023` is the current identity and lookup authority.
- Account-menu and Settings work must not expose the email-backed lookup key as
  public identity or ship it as a normal editable profile field for hosted
  Accounts.
- Invite lookup, participant disambiguation, profile copy, tests, DTO naming,
  product docs, and browser-facing labels should use Gamer Tag and Avatar for
  displayed identity. Email is only a known lookup input.
- Browser-facing lookup may accept known email or Gamer Tag, but successful
  lookup responses must not expose email addresses, raw Auth ids, or provider
  identity ids.
- Existing hosted Account Profile rows should be cleared through an approved
  hosted reset before applying the migration; do not preserve them by mapping
  old Handle/Gamer Name values into the new known-email lookup and Gamer Tag
  behaviour. Local test fixtures may still carry legacy storage names while they
  are being renamed.
- Local tests can use deterministic test email addresses as lookup input
  without requiring real email delivery or exposing those addresses as returned
  profile data.
- Additional hosted Auth providers remain separately deferred; this decision
  only defines how their returned email value feeds private known-email lookup
  if and when such a provider is accepted.
