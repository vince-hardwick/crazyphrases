# Git and GitHub CLI Auth for Codex

## Purpose

This runbook records how Codex sessions should use Git and the GitHub CLI for this repository without rediscovering authentication behaviour each time.

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

## GitHub CLI Sandbox Behaviour

Codex can find and execute `gh` inside the project sandbox, but sandboxed commands may not be able to read the Windows keyring token.

When that happens, `gh auth status` or GitHub API commands can report an invalid token even though the desktop user's PowerShell session shows a valid login.

Known symptom:

```text
HTTP 401: Requires authentication
The token in default is invalid.
```

Another known symptom is an unauthenticated GitHub API rate-limit response from
commands that should normally use the user's `gh` login:

```text
HTTP 403: API rate limit exceeded ...
Authenticated requests get a higher rate limit.
```

For this repository, treat that 403 as evidence that the sandboxed `gh` process
did not read the Windows keyring token before assuming GitHub itself is blocking
the logged-in user.

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

## Private GitHub Actions Logs

Codex should inspect private GitHub Actions run logs directly with `gh` rather
than asking the owner to paste log snippets into chat.

Prerequisites for the desktop user account:

```powershell
gh auth status -h github.com
gh auth refresh -h github.com -s repo,workflow
```

Use the existing user-level token in the Windows keyring. Do not create a
project-local token file, checked-in script, or long-lived `GH_TOKEN` workaround.

Useful commands:

```powershell
gh run list --repo vince-hardwick/crazyphrases --limit 10
gh run view <run-id> --repo vince-hardwick/crazyphrases
gh run view <run-id> --repo vince-hardwick/crazyphrases --log
gh run view <run-id> --repo vince-hardwick/crazyphrases --job <job-id> --log
```

If these commands report `401`, an unauthenticated `403`, or a rate-limit error
inside Codex, rerun the same command with sandbox escalation so `gh` can read the
desktop user's keyring token. If escalation still fails, ask the owner to refresh
the `repo` and `workflow` scopes from normal PowerShell.

## Plain Git Commands in Codex

Plain `git` commands have two separate Codex constraints in this Windows workspace:

1. The sandbox can read `.git`, but cannot write there. Commands such as `git fetch --prune` update `.git/FETCH_HEAD`, so sandboxed runs can fail with:

   ```text
   error: cannot open '.git/FETCH_HEAD': Permission denied
   ```

2. Networked Git commands may invoke Git Credential Manager and the Windows `schannel` credential path. Sandboxed runs can fail even when the desktop user's credentials are valid:

   ```text
   fatal: unable to access 'https://github.com/vince-hardwick/crazyphrases.git/': schannel: AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS (0x8009030e) - No credentials are available in the security package
   ```

These symptoms do not mean the repository is corrupt and do not justify changing remotes, storing tokens, disabling credential helpers, or editing project-local credentials.

Run networked Git commands that write `.git` or use Git Credential Manager outside the sandbox with an explicit escalation request. Known examples:

```powershell
git fetch --prune
git remote prune origin
```

Read-only commands that do not write `.git`, such as `git status`, `git branch --list`, and many `git ls-remote` checks, may still work inside the sandbox. Do not treat a successful `git ls-remote` as proof that `git fetch --prune` or `git remote prune origin` will work without escalation; they exercise different local write and credential paths.

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

If `git fetch --prune` fails with `.git/FETCH_HEAD` permission errors or `git remote prune origin` fails with `schannel` credential errors:

1. Confirm the command shape is expected and not destructive.
2. Rerun the same Git command with sandbox escalation.
3. If the escalated command also fails, then investigate normal Git authentication or repository state from a desktop PowerShell session.

## Security Boundary

Detecting that `gh` is installed, that a repository is public, or that a branch targets an environment does not authorize mutation. Repository changes, issue creation, workflow runs, deployment actions, and settings changes still require the relevant user request or approved workflow.
