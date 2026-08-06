# Local Word Bank Review Workbench

## Purpose

This runbook owns local Windows startup and maintenance for the source-only Word
Bank review workbench. ADR 0024 owns its review-data, single-writer, stale-lock,
Git-checkpoint, publication, and deployment boundaries.

The workbench remains available at `http://127.0.0.1:4177/`. It does not need to
be launched from a terminal whose current directory is the review worktree. The
launched script's own location determines the project root and authoritative
`tools/word-bank/review-data` directory.

## Scheduled availability

The per-user task is named `Crazy Phrases Word Bank Review`. It runs at sign-in,
starts no duplicate when the expected writer is healthy, and does not open a
browser. Browse to `http://127.0.0.1:4177/` when review work is needed.

Preview task installation from the worktree that owns the intended review data:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\word-bank\windows\install-word-bank-review-task.ps1
```

Install it and make the page available immediately:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\word-bank\windows\install-word-bank-review-task.ps1 -Apply -StartNow
```

The task is deliberately bound to that exact worktree. If authoritative review
work later moves to another worktree, install from the new worktree with
`-Apply -Replace -StartNow`, verify `/api/health`, and only then remove the old
worktree. Never leave the task pointing at a deleted or superseded review-data
directory.

## Lock and listener safety

The launcher accepts an existing process only when all of these agree:

- the loopback service identity;
- the exact project and review-data roots;
- writable mode;
- the health PID and expected worktree lock PID.

It fails closed when port 4177 belongs to another service or worktree. When no
listener exists, unattended recovery is permitted only for a lock whose creation
time predates the current Windows boot. A missing or same-boot writer still needs
manual investigation and explicit recovery.

For explicit manual stale-lock recovery, first confirm that no writer remains,
then use the Windows command shim so PowerShell forwards the option separator:

```powershell
npm.cmd run word-bank:review:serve -- --recover-stale-lock --confirm-no-writer
```

Calling `npm` resolves to `npm.ps1` on this machine and may consume the standalone
`--`, causing npm to warn about unknown configuration and launch read-only.

## Maintenance

Stop the verified writer cleanly before changing or removing its worktree:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\word-bank\windows\stop-word-bank-review.ps1
```

Make the page available again without waiting for the next sign-in:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\word-bank\windows\start-word-bank-review.ps1
```

The stop command checks service identity, roots, mode, health PID, and lock PID,
then presents the private lock owner token to the loopback shutdown endpoint. It
refuses to stop an unverified process. Do not use Task Manager as the normal stop
path because forced termination cannot release the lock cleanly.

Ignored diagnostic logs are written under `output/word-bank-review/`.

## Boundary

Scheduled startup grants no authority to start a planned tranche, infer a review
decision, publish a shard, change the manifest, push Git commits, or deploy any
hosted environment. The workbench's exact-path local checkpoint authority remains
limited to ADR 0024's completed-tranche continuation rule.
