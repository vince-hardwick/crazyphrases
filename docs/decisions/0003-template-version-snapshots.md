# 0003: Template Version Snapshots

## Status

Accepted

## Context

Published templates may be edited after players have already used them to create games, batches, and favourite phrases. Silently changing those historical outputs would change the meaning of old games and could break in-progress play.

## Decision

Published templates are versioned, and each game snapshots the template version selected at setup. Existing games and saved batches keep their original structure, while new games may choose the latest published version.

## Consequences

- Template edits do not rewrite historical games, batches, or favourites.
- In-progress games remain stable even if the template creator publishes a new version.
- The app will need to distinguish template identity from template version in future data models and UI.
