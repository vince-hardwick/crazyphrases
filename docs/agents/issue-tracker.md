# Issue Tracker: GitHub

Issues, PRDs, and implementation tickets for this repo live in GitHub Issues for:

```text
vince-hardwick/crazyphrases
```

Use the GitHub CLI for issue operations where possible.

## GitHub CLI Auth

Codex can execute `gh`, but sandboxed commands may not be able to read the Windows keyring token. For authenticated GitHub CLI operations, follow `docs/runbooks/github-cli-auth-for-codex.md` before interpreting auth failures. If a sandboxed issue or PR command reports `401`, `invalid token`, unauthenticated `403`, or API rate limiting, rerun the same command with sandbox escalation before asking the owner to re-authenticate or switching to manual GitHub UI instructions.

Do not put GitHub tokens in project files, checked-in scripts, or long-lived project-local environment variables.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`
- **Read an issue**: `gh issue view <number> --comments`
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments`
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply or remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close an issue**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` when running inside this clone.

## Publishing PRDs

When a skill says to publish a PRD to the issue tracker, create a GitHub issue with the PRD body and apply the `ready-for-agent` label unless the user asks for a different state.
