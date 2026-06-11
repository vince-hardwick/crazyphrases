# 0002: Public Repository and Gated Deployments

## Status

Accepted

## Context

The project started as a private GitHub repository. The owner is comfortable making the project open source because `crazyphrases.com` is a personal/fun project, and public repository visibility unlocks GitHub Environment required reviewers for the production deployment workflow on the current GitHub plan.

The project has cPanel hosting with FTP/FTPS credentials and a live web root. The live site should be updated with minimal manual steps after local planning, implementation, and verification.

## Decision

Make `vince-hardwick/crazyphrases` public and use GitHub Actions as the deployment controller. Deployments to the live cPanel web root must go through the `production` GitHub Environment and wait for the required reviewer gate before FTPS upload.

Until the public repository visibility and required reviewer gate have both been verified, the deployment workflow must remain manually triggered with `workflow_dispatch` only.

Store FTP connection details only as GitHub Environment secrets:

- `FTP_SERVER`
- `FTP_USERNAME`
- `FTP_PASSWORD`
- `FTP_SERVER_DIR`

The repository may contain source, plans, decisions, runbooks, tests, and deployment workflow definitions, but must not contain live credentials.

## Consequences

- Source code, project docs, implementation plans, and commit history are public.
- GitHub remains the durable source of truth.
- After the `production` required reviewer gate is verified, a push to `main` may start the promotion workflow, but the live mutation step must remain gated by the `production` environment reviewer. See `0009-branch-based-dev-and-main-promotion.md` for the current branch-to-environment promotion model.
- Before the required reviewer gate is verified, deployment must be started explicitly from GitHub Actions with `workflow_dispatch`.
- Detecting that a run is on `main`, in GitHub Actions, or targeting `production` does not itself grant live mutation authority; the environment approval is the authority boundary.
- If GitHub Environment protection rules become unavailable, production deployment must fall back to manual `workflow_dispatch` until an equivalent explicit approval gate is restored.
