# 0001: Project Repository and Domain

## Status

Accepted

## Context

The project is being started for a purchased domain, `crazyphrases.com`, and will be planned, designed, and implemented in Codex.

## Decision

Use a private GitHub repository named `crazyphrases` as the durable source of truth for the project. Keep local Codex work aligned with that repository once GitHub authentication is available.

## Consequences

- Project planning, implementation, and operational documentation should be committed with code changes.
- Environment detection must not grant mutation authority for live systems; deployment or live changes require explicit authorization paths.
- Until GitHub authentication is restored, remote repository creation and pushes remain blocked.

