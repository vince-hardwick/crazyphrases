# 0007: Account Deletion Preserves Collaborative History

## Status

Accepted

## Context

Crazy Phrases content is collaborative: games, batches, shared phrases, consent records, template remixes, and leaderboards can involve multiple account holders. Hard-deleting every trace of one account can damage other participants' history and break public discovery or attribution lineage.

## Decision

Account deletion deactivates or anonymizes the account identity while preserving collaborative game history, shared phrases, consent records, leaderboard integrity, and template lineage where needed. Personal/private data such as personal word lists should be deleted.

## Consequences

- Other participants' completed games and saved outputs remain intact after one account is deleted.
- Private account-owned data needs a deletion path separate from collaborative records.
- Future implementation must distinguish personal data deletion from preservation of collaborative history.
