# Architecture Decision Records

This directory holds durable architecture, governance, deployment, lifecycle, and source-of-truth decisions for Crazy Phrases.

## Current Records

- `0001-project-repository-and-domain.md` - repository, domain, local ownership, and live-mutation authority boundary.
- `0002-public-repository-and-gated-deployments.md` - public repository visibility and production deployment gate.
- `0003-template-version-snapshots.md` - template version snapshots for games and historical outputs.
- `0004-cached-word-bank-for-entry-candidates.md` - cached/local word-bank boundary for low-latency entry candidates.
- `0005-asynchronous-games-by-default.md` - asynchronous game execution profile.
- `0006-cloudflare-dns-and-access-for-environments.md` - Cloudflare DNS and Access model for dev/test/production environments.
- `0007-account-deletion-preserves-collaborative-history.md` - account deletion and collaborative history preservation.
- `0008-static-first-anonymous-solo.md` - static-first anonymous solo implementation boundary.
- `0009-branch-based-dev-and-main-promotion.md` - feature-branch dev deployment and main-line test/production promotion.
- `0010-supabase-auth-and-postgres-for-signed-in-state.md` - Supabase Auth and Postgres source-of-truth boundary for signed-in accounts and game state.
- `0011-account-profile-handle-directory.md` - durable Account Profile and Handle Directory boundary.
- `0012-pending-game-invite-response-authority.md` - Pending Game invitee response authority, visibility, and decline cancellation boundary.
- `0013-pending-game-start-conversion-authority.md` - Pending Game to Started Game conversion authority and durable setup boundary.
- `0014-started-game-turn-submission-authority.md` - Started Game Turn storage, active-turn visibility, and submission authority boundary.

## Status Values

- `Proposed` - drafted for review, not yet the working rule.
- `Accepted` - current working decision; this is the active ADR status.
- `Superseded` - replaced by a later ADR; keep a link to the replacement.
- `Deprecated` - no longer recommended, but not replaced by one clear decision.
- `Obsolete` - no longer applicable and not safe to follow; keep only for historical context.

Use `Proposed` for draft ADRs. Do not leave draft or obsolete decisions looking accepted.

## When To Create A New ADR

Create a new ADR when a decision changes a durable project boundary, including:

- a deployment, environment, runtime, service, or integration boundary;
- a source-of-truth or mutation-authority rule;
- a data lifecycle, deletion, preservation, or historical integrity rule;
- a security, authentication, secrets, or access-control policy;
- a storage format, versioning rule, or compatibility contract that future work must preserve;
- a workflow rule that affects how Codex or other agents should behave across tasks;
- a material reversal or replacement of an accepted decision.

Prefer a new ADR when a future agent should be able to read the record independently and understand why one path was chosen over plausible alternatives.

## When To Amend An Existing ADR

Amend an existing ADR when the change clarifies or records implementation progress for the same decision, including:

- status changes from `Proposed` to `Accepted`;
- updated validation evidence;
- small terminology fixes that do not change the decision;
- narrow additions that complete the originally accepted architecture;
- links to follow-up ADRs that supersede one part of the original decision.

Do not use ADRs for every product preference. Product behaviour normally belongs in `docs/product-rules.md`; implementation tasks belong in plans or GitHub Issues; deferred ideas belong in `docs/backlog.md`.
