# GitHub CLI Auth for Codex

## Purpose

This runbook records how Codex sessions should use the GitHub CLI for this repository without rediscovering authentication behaviour each time.

## Current Setup

GitHub CLI is installed at:

```powershell
C:\Program Files\GitHub CLI\gh.exe
```

It is on `PATH` for this project workspace.

The repository uses GitHub:

```powershell
vince-hardwick/crazyphrases
```

## Authentication Model

Use normal user-level GitHub CLI authentication. The token should stay in the Windows keyring, not in project files, shell scripts, checked-in config, or long-lived plaintext environment variables.

Authenticate or refresh the token from a normal PowerShell session as the desktop user:

```powershell
gh auth login -h github.com --web --git-protocol https --scopes repo,workflow
```

Verify from normal PowerShell:

```powershell
gh auth status -h github.com
gh repo view vince-hardwick/crazyphrases --json nameWithOwner,hasIssuesEnabled,isPrivate
```

## Codex Sandbox Behaviour

Codex can find and execute `gh` inside the project sandbox, but sandboxed commands may not be able to read the Windows keyring token.

When that happens, `gh auth status` or GitHub API commands can report an invalid token even though the desktop user's PowerShell session shows a valid login.

Known symptom:

```text
HTTP 401: Requires authentication
The token in default is invalid.
```

This does not necessarily mean GitHub CLI is missing or the user is logged out. It can mean the sandbox cannot access the Windows keyring.

## Best Practice for Future Codex Sessions

For authenticated GitHub CLI operations in Codex, use the existing user-level `gh` authentication and run the required `gh` command outside the sandbox with an explicit escalation request.

Examples of operations that may need escalation because they read the keyring token:

- `gh auth status`
- `gh repo view`
- `gh repo edit`
- `gh issue create`
- `gh issue list`
- `gh workflow run`
- `gh run view`

Do not copy tokens into the repository, commit credentials, or create project-local token files. Do not work around keyring access by setting a persistent project-level `GH_TOKEN`.

## Troubleshooting

If authenticated `gh` commands fail in Codex:

1. Ask the user to verify normal PowerShell auth:

   ```powershell
   gh auth status -h github.com
   ```

2. If PowerShell shows a valid keyring login, rerun the needed Codex `gh` command with sandbox escalation.
3. If PowerShell also fails, refresh the login:

   ```powershell
   gh auth login -h github.com --web --git-protocol https --scopes repo,workflow
   ```

## Security Boundary

Detecting that `gh` is installed, that a repository is public, or that a branch targets an environment does not authorize mutation. Repository changes, issue creation, workflow runs, deployment actions, and settings changes still require the relevant user request or approved workflow.

