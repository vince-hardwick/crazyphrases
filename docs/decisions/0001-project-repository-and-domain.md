# 0001: Project Repository and Domain

## Status

Accepted

## Context

The project is being started for a purchased domain, `crazyphrases.com`, and will be planned, designed, and implemented in Codex.

## Decision

Use the private GitHub repository `vince-hardwick/crazyphrases` as the durable source of truth for the project. Keep local Codex work aligned with `origin/main`.

Local working tree and Git metadata ownership should belong to the desktop user account `AzureAD\VinceHardwick`. Codex may still edit project files and perform Git operations through approved commands, but account ownership is a filesystem convention only and does not grant authority to mutate live systems.

## Consequences

- Project planning, implementation, and operational documentation should be committed with code changes.
- Environment detection must not grant mutation authority for live systems; deployment or live changes require explicit authorization paths.
- The remote repository is private and uses `main` as its default branch.
