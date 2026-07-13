# Multiplayer Game Play Surface Entry Assist Design

> **Status:** Implemented in source for GitHub issue #230, with the corrected
> hosted migration applied and verified as
> `20260713092820 pin_multiplayer_entry_assist_shards`. Final-head deployment,
> functional smoke, promotion, cleanup, and tracker closeout remain
> approval-gated; runtime UI completion is not yet established. Current product
> and architecture authority is
> `docs/product-rules.md` and ADRs 0024 and 0027; operational continuation is
> Task 6 of the implementation plan.

## Goal

Add dice-based Entry Assist to an active Multiplayer Game Play Surface without
weakening participant concealment, database-owned section authority, the
family-friendly MVP boundary, or Game-stable Word Bank behaviour.

## Scope

- Supported Multiplayer section rows receive the same familiar dice affordance
  as Solo entry rows.
- Suggestions come from the Started Game's pinned immutable Word Bank Shard
  reference for the active Entry Kind.
- The current MVP uses only `familyFriendly` / `accepted` candidates.
- Unsupported or unavailable Entry Kinds lose only their dice affordance.
  Typed entry and section submission remain available.
- The Account Entry Assist Safety Setting UI, persistence, and opt-in candidate
  tier remain deferred to GitHub issue #247.

## Considered Approaches

### Pin immutable shard references on the Started Game

This is the selected approach. At Game start, database-owned logic records
server-approved immutable shard references for the Default Template's supported
Entry Kinds. The participant-scoped loader returns only the active Entry Kind's
reference, and the browser loads that exact static shard.

This preserves ADR 0024's static Word Bank delivery model, keeps Started Games
stable across later manifest changes, and prevents a modified browser from
supplying arbitrary candidates or paths.

### Store complete candidate arrays on every Started Game

This would provide strong snapshot semantics, but it would duplicate candidate
lists for every Game and turn Supabase into a Word Bank delivery path. That
would conflict with the accepted static-shard boundary and is rejected.

### Resolve the current manifest whenever the surface opens

This would require the smallest implementation change, but a manifest update
could change suggestions for an in-progress Game. It does not satisfy the
Game-stability rule and is rejected.

## Architecture

The database owns a private registry of approved immutable Word Bank Shard
references. Each reference identifies an Entry Kind, immutable asset path,
version, and family-friendly curation tier. Browser roles receive no direct
read or mutation authority over the registry.

Starting an accepted Pending Game selects the approved references required by
the Default Template and stores a serialised reference snapshot on the Started
Game. If every supported reference cannot be pinned, starting fails before a
partial Started Game is created. Environment or route detection does not grant
authority to select or alter the snapshot.

The participant-scoped Game Play Surface loader remains the read authority. For
an active state, it returns the current participant's section plus either the
matching pinned reference or explicit Entry Assist unavailability. It does not
return another participant's assigned section, entries, or unrelated Entry Kind
references.

The browser Entry Candidate Provider gains a pinned-reference load path. It
fetches the immutable static asset and accepts it only when its Entry Kind,
version, path, curation tier, and candidate records match the pinned contract.
It never substitutes the manifest's newer reference for a Started Game.

The currently rendered authorised Multiplayer form owns only transient dice
interaction state, including repeat avoidance. That state is not persisted
across renders or shared across participants. Clicking dice fills or replaces
the selected input locally and creates no hosted mutation. The existing
participant-section submission remains the sole mutation that persists those
entries.

## Failure Behaviour

- Missing approved references prevent Game start rather than creating a partial
  Started Game.
- A missing, malformed, unsupported, or unavailable active-section reference
  leaves the Game Play Surface active with typed entry and submission intact.
- A shard fetch or validation failure disables only the applicable dice actions
  with the existing restrained `Random word unavailable` accessible copy.
- Candidate exhaustion permits repeats, matching Solo behaviour.
- Existing Account-session and route-request guards continue to discard stale
  asynchronous results after navigation or Account changes.
- Entry Assist failure must not convert an authorised active state into a broad
  `Game unavailable.` state.

## Security And Concealment

- The browser cannot choose shard paths, versions, candidates, or curation
  tiers for another participant.
- The private registry is not exposed through the Data API.
- Any privileged database function keeps an empty `search_path`, performs an
  explicit `auth.uid()` and participant-authority check, and has explicit
  execute revocations and grants.
- The active loader exposes only the reference needed for the current section.
- Dice selection does not exclude or otherwise signal another participant's
  concealed entries.
- The current family-friendly-only runtime boundary remains unchanged.

## Agreed TDD Seams

### Database contract

- Game start pins only server-approved family-friendly references.
- Browser-supplied unapproved references cannot be stored.
- The active participant loader returns only the current section's reference
  and no other participant content.

### Repository and provider contract

- Loader responses recover only allowlisted Entry Assist reference shapes.
- The provider loads the exact pinned immutable shard.
- Entry Kind, version, path, curation-tier, and candidate-record mismatches make
  Entry Assist unavailable without failing the Game surface.

### Browser behaviour

- Supported rows expose accessible dice controls that fill and replace the
  selected value.
- Unsupported or unavailable Entry Kinds expose no usable dice action while
  typed entry and submission still succeed.
- A Started Game keeps its pinned reference after the current manifest changes.

### Hosted functional seam

The hosted schema and authority contract is verified. After an approved
final-head development deployment, a visible two-Account smoke still needs to
cover adjective and noun dice assistance, section submission, concealment, and
bounded fixture cleanup. Data mutation, deployment, test promotion, and
production promotion retain their separate documented approval boundaries.

## TDD Sequence

Implementation proceeds in vertical red-green slices:

1. Pin and load one approved active-section shard reference through local and
   Supabase repository contracts.
2. Load and validate that exact reference through the provider.
3. Add one working Multiplayer dice interaction through the browser seam.
4. Add unavailable and unsupported Entry Kind behaviour without blocking typed
   submission.
5. Prove manifest-change stability and concealment, then run the full suite and
   hosted approval-gated verification route.

Each slice adds one failing public-behaviour test before the minimum production
change. Tests do not target private rendering helpers.

## Out Of Scope

- Expanding or rebalancing the noun shard; tracked by GitHub issue #245.
- Defining future built-in Entry Kind shards; tracked by GitHub issue #246.
- Implementing the Account Entry Assist Safety Setting or opt-in candidate tier;
  tracked by GitHub issue #247.
- Changing participant-section submission or Reveal authority.
- Adding playable templates, user-defined Entry Kinds, or a service-backed Word
  Bank.

## Completion Route

Implementation must update the owning product rule, ADR, migration runbook,
backlog status, and hosted-state ledger where their state changes. Hosted
migration verification is complete, but issue #230 closes only after automated
tests, approved final-head development deployment, visible functional smoke,
required promotion verification, bounded cleanup, and tracker reconciliation
complete. Parent PRD #226 closes only when no accepted child scope remains open.
