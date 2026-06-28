# 0009: Branch-Based Dev Deployment and Main Promotion

## Status

Accepted

## Context

Crazy Phrases now has separate `dev`, `test`, and `production` runtime environments. Earlier deployment automation allowed manual deployment to any environment and a push to `main` targeted production directly after static verification.

That shape is too coarse for incremental feature slices. A feature branch needs a way to deploy the exact branch commit to `dev` for engineering inspection before merge. Formal testing should happen from the reviewed `main` line, and production should receive the same `main` commit that was deployed to `test`, not a different unreviewed ref.

The project uses GitHub Actions, GitHub Environments, Cloudflare Access, and cPanel FTPS hosting. These remain separate authority boundaries:

- Git branches and pull requests control source review.
- GitHub Actions runs control automation.
- GitHub Environment approvals authorize deployment jobs and environment secret access.
- Cloudflare Access controls browser access to protected runtime hostnames.
- cPanel controls the origin file store.

GitHub's repository warning that `main` was not protected exposed a gap in the
source-review boundary. Environment approval protects deployment mutation, but
it does not protect the repository source of truth from direct pushes,
force-pushes, branch deletion, or merges that bypass CI.

## Decision

Use a branch-to-environment promotion model:

1. Feature work happens on non-`main` branches such as `codex/**`, `feature/**`, `fix/**`, or `chore/**`.
2. CI runs on feature-branch pushes and pull requests.
3. A push to a feature branch can create a `dev` deployment request when it changes hosted static runtime paths. Source-only changes such as documentation, workflow files, package metadata, Supabase migrations, or tests rely on CI and do not automatically request `dev` deployment unless a hosted static runtime path changed in the same push. The `dev` GitHub Environment reviewer gate decides whether that branch commit may overwrite the shared `dev` environment.
4. For hosted runtime changes, the final feature-branch head must receive a fresh approved `dev` deployment and visible in-app browser smoke against `https://dev.crazyphrases.com/` before merge acceptance. If an older `dev` deployment request is waiting or points at a stale commit, cancel or ignore that run and request a fresh deployment for the commit that will be merged. CI, local smoke, or a previous branch deployment does not replace this pre-merge `dev` gate.
5. The implementing engineer inspects the feature branch in `dev` before asking for merge acceptance.
6. Reviewed work merges to `main` through a pull request.
7. `main` is protected by the active GitHub repository ruleset `Protect main`.
   The ruleset targets the default branch, blocks deletion and non-fast-forward
   pushes, requires updates to arrive through pull requests, requires review
   threads to be resolved, and requires the unique status check
   `CI / Verify static site` with latest-code policy before `main` can be
   updated.
8. The first `Protect main` ruleset does not require an approving review,
   because this is currently a user-owned solo repository and mandatory
   approval would create a false control or deadlock. Add a non-zero approval
   requirement, and CODEOWNERS where useful, before relying on additional
   maintainers or collaborators for source review.
9. Routine bypass actors are not configured for the `Protect main` ruleset.
   Any future bypass exception must be explicitly documented as a separate
   source-review authority decision.
10. A push to `main` deploys that exact `main` commit to `test`.
11. After the `test` deployment completes for a hosted runtime change, functional visible in-app browser smoke against `https://test.crazyphrases.com/` is mandatory before production approval or closeout. Commit-hash asset stamping is necessary evidence, but it is not sufficient; the promoted behaviour must be exercised in `test`.
12. The same promotion workflow then waits at the `production` GitHub Environment gate. A waiting `production` gate does not block `test` validation. Production approval is granted only after human testing in `test` confirms no blocking issues.
13. If the `production` environment reviewer gate is missing, unavailable, or suspected to be misconfigured, cancel the production job and restore an explicit approval gate before deploying.
14. When an agent-triggered commit, push, merge, or manual workflow request creates a deployment run that waits for GitHub Environment approval, the agent must stop and wait for the owner to confirm approval before continuing deployment-dependent validation or promotion.

`dev` is a shared inspection environment, not a stable release environment. It may be overwritten by the next approved feature-branch deployment. `test` and `production` deploy only from `main` unless a future ADR explicitly defines a hotfix exception.

Deployment workflows must deploy repository source files only through the documented GitHub Actions paths. Detecting that a run is on `main`, a feature branch, or a named environment does not itself authorize mutation; the relevant GitHub Environment approval remains the mutation authority.

## Consequences

- Feature slices can be verified in `dev` before they are merged.
- Runtime-changing feature slices cannot rely on stale `dev` deployments or
  local-only verification before merge; the shared `dev` environment must show
  the final branch head.
- Pull requests are now an enforced source-review boundary for `main`, not only
  a documented convention.
- The required CI check name must remain unique across workflows. If workflow
  job names change, update the `Protect main` ruleset before relying on the new
  check.
- Formal testing happens from `main`, which reduces the chance that production receives a commit different from the one tested.
- Test validation is behavioural, not just a deployment-stamp check. Agents must
  exercise the promoted runtime change in `test` before recommending production
  approval.
- A production deployment can be queued by automation, but the live mutation step remains gated by the `production` environment approval.
- The shared `dev` environment needs operator discipline: only approve the feature branch currently being inspected, because an approved deployment overwrites the previous `dev` contents.
- If multiple feature branches need simultaneous runtime review, the project will need either preview environments or branch-specific deployment targets. That is deferred until shared `dev` becomes a bottleneck.
