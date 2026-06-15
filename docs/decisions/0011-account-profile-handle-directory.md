# 0011: Account Profile and Handle Directory

## Status

Accepted

## Context

Signed-in Accounts need durable game-facing identity before handle-based
multiplayer invites can be implemented. The existing Account shell can generate
a local/default Handle, Gamer Name, and Avatar, but those values are not a
globally unique directory and do not survive as the same profile across devices.

The first multiplayer entry point is expected to use Handles. A browser-facing
lookup must expose enough profile data to invite another participant later
without exposing emails, provider identities, or raw Supabase Auth user ids as
public discovery values.

## Decision

Create a durable Account Profile / Handle Directory in Supabase Postgres.

The profile row is keyed internally to the immutable Supabase Auth user id, but
handle lookup exposes a separate directory profile id plus Handle, Gamer Name,
and Avatar. Browser-facing handle lookup must not expose emails or raw Supabase
Auth user ids.

The directory is readable by signed-in Accounts only. Anonymous visitors have no
table grant or Row Level Security path for profile lookup. Signed-in Accounts
may create and update only their own profile. Postgres enforces global Handle
uniqueness.

Account Profile rows are active personal/profile data. Account deletion may
remove them through the Auth foreign-key cascade. Future collaborative game
history must snapshot participant display data and use separate preservation
rules rather than depending on the live Account Profile row.

## Consequences

- Handle invites can start from a durable directory prerequisite without taking
  on the Pending Game lifecycle in the same slice.
- Future invite tables should use the directory profile id or a server-side
  resolution path instead of making Supabase Auth user ids public discovery
  values.
- Current profiles can change over time, while future completed collaborative
  games must preserve the participant display context that applied at play time.
- The first hosted migration was applied on 2026-06-16 after explicit owner
  approval. Future hosted schema mutations remain live backend mutations and
  require explicit owner approval or an accepted task-specific plan.
