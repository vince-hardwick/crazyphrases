# 0014: Started Game Turn Submission Authority

## Status

Superseded by ADR 0015 for future multiplayer execution.

This ADR remains historical evidence for the first source-controlled Started
Game turn-submission slice and for the narrow mutation-authority principle. Do
not extend the global active-Turn sequencing model for future Reveal work.

## Context

The Started Game foundation stores participant snapshots and resolved random
Slot Allocation / Slot Order, but deliberately leaves turns unavailable.

The next vertical slice needs persisted turn storage and one submitted turn for
a Started Game. It must preserve concealment: a participant may see and submit
only their currently active Slot Assignment, and waiting status must not reveal
another participant's entry kind, slot id, or entries. This slice still must not
add Reveal, Share Consent, invite expiry, creator cancellation UI, friends,
nudges, public discovery, or broader profile/account UI.

Browser clients need a simple way to load and submit a turn, but detecting the
signed-in Account, branch, hostname, or runtime context must not itself
authorise mutation.

## Decision

Started Game turn storage is owned by Postgres.

`public.game_turns` stores one Turn per resolved Slot Order entry. The database
creates these turns from the already resolved game `slot_order` and
`slot_allocation` when a Started Game is created. Browser clients may select
only the current account's active Turn, and only when every earlier Turn in the
same Game has already been submitted.

`public.game_entries` stores submitted row entries for a Turn. Browser clients
do not receive direct table insert, update, or delete authority for entries.
Instead, they call a narrow authenticated RPC that validates all of the
following atomically:

- the caller is the participant assigned to the target Turn;
- the target Turn is the first unsubmitted Turn in Slot Order;
- the Turn is not already submitted;
- the submitted payload contains exactly one non-empty Entry for every row in
  the Game.

After validation, the RPC writes the Entries and marks the Turn as submitted.
Submitted Entries are locked for this MVP slice. Later draft editing, Reveal,
correction requests, and completed-game history surfaces must build on this
lock boundary rather than bypass it.

## Consequences

- Turn submission has a dedicated authority path instead of granting broad
  browser write authority on turn or entry tables.
- Future Reveal work can read locked Entries without changing the submission
  contract.
- A participant cannot use direct table reads to discover another participant's
  active slot or entries before Reveal.
- The UI may honestly show "your turn" or "waiting" states without implying
  Reveal or completed phrase rendering exists.
- Hosted migration application remains a live backend mutation and requires
  explicit owner approval or the documented deployment workflow gate.
