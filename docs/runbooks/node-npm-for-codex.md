# Node and npm for Codex

## Purpose

This runbook records how Codex sessions should use Node.js, npm, npx, and npm
packages in this repository without rediscovering local NVM for Windows and
sandbox behaviour.

## Agent Fast Path

- Use a corrected stable Node release: 22.23.4 or later within major 22 for the existing local toolchain, or 24.22.1 or later within major 24. Run `node .github/scripts/check-node.mjs` before package retrieval; npm also enforces the package engine requirement. CI selects `>=24.22.1 <25` and runs the same check with `--ci` before installing dependencies. These minimums include the October 2026 certificate security fix; the older dated observations below are historical evidence, not supported baselines.

- Do not rediscover the Node/NVM PATH issue. The sandbox can see
  `C:\Users\VinceHardwick\AppData\Local\nvm` and `C:\nvm4w\nodejs`, but cannot
  execute NVM-managed binaries there; direct execution failed with
  `Access is denied` on 2026-06-19.
- For quick no-network Node test runs, use sandboxed `node --test`. If the
  current Codex app process has not inherited the user-level PATH fallback yet,
  append the bundled Node directory for that command or call bundled `node.exe`
  by absolute path.
- For package-manager-backed verification, prefer escalated `npm test`; on
  2026-06-19 it ran through the owner's NVM-managed Node v22.19.0 toolchain and
  passed 149/149 tests.
- Use sandbox escalation for `npm`, `npx`, `pnpm`, and `nvm` operations rather
  than copying global Node tools into the repository or installing temporary
  project-local packages.
- `pnpm` is available through Corepack from the owner's toolchain; `corepack
  enable pnpm` was run on 2026-06-19 and `pnpm --version` returned `11.8.0`.

## GitHub Actions runner security

`actions/setup-node` selects Node for shell commands such as `npm test`. JavaScript
actions, including checkout, setup-node itself and the FTPS deployment action,
use a separate executable supplied by the GitHub runner. Updating the shell
toolchain does not update that executable.

Every workflow job starts with a Bash check before checkout or any other action.
The check locates the active `Runner.Worker` process and its bundled Node 24,
requires stable Node 24.22.1 or later within major 24, and tests certificate
validation in both that executable and curl. Both published eMudhra incident
test chains must be rejected for a certificate trust reason, while `nodejs.org`
must remain reachable with valid HTTPS. A timeout, DNS failure, missing runtime
or unrecognised result blocks the job; it does not establish protection.

The canonical check is `.github/scripts/check-runner-security.sh`. It is also
embedded in each workflow because repository files are unavailable before
checkout. YAML aliases reuse the step within each workflow. The tests in
`tests/runner-security.test.mjs` enforce that every job starts with the check and
that every embedded copy matches the canonical script. Update them together.

Use the **CI** workflow's manual dispatch, or its normal feature-branch push
trigger, for a diagnostic that has no deployment step, environment or secrets.
Its first step records the actual runner Node path/version and certificate
results. If it fails, retain the log and resolve the provider runtime or trust
store problem before retrying. Do not remove the check or disable certificate
verification to make deployment pass. The check detects and blocks an unsafe
runner; it does not patch GitHub's managed executable. Availability of the
external incident test hosts is therefore a deliberate dependency of CI.

### Temporary owner-approved recovery exception (2026-10-22)

The repository owner explicitly authorised a temporary exception because the
GitHub-hosted runner's bundled Node 24.21.0 failed this guard and the runner
provider patch was not yet confirmed. The owner-approved pull-request checks
are limited to CI on PR #255 (`codex/runner-security-checks`), PR #256
(`codex/hosting-security-hardening`), and PR #257
(`codex/recovered-stash-publication-20261023`). For those exact PR numbers and
head refs, CI uses the exception only when both `GITHUB_ACTOR` and
`GITHUB_TRIGGERING_ACTOR` are `vince-hardwick`. The workflow guard checks both
the PR merge ref and source branch so another pull request cannot inherit it.

As a temporary exception to ADR 0009's feature-branch push checks, CI does not
run a second `push` check for those three branches; their PR checks are the
required review path. Other branch pushes retain the ordinary runner guard.

All other recovery runs are limited to manually dispatched workflows with
`allow_unpatched_runner: true`. The guard accepts them only when both
`GITHUB_ACTOR` and `GITHUB_TRIGGERING_ACTOR` are `vince-hardwick`, the event is
`workflow_dispatch`, and the workflow/ref pair is one of the following:

- CI on `codex/runner-security-checks`, `codex/hosting-security-hardening`, or
  `main`;
- Deploy dev on `codex/hosting-security-hardening` or, for this approved run,
  `codex/recovered-stash-publication-20261023`;
- Promote website or FTPS preflight on `main`.

Noun-review branches, non-owner PR attempts, and every other workflow/ref/event
pair remain blocked. The exception skips the runner version and certificate
probes; it is a temporary recovery measure, not evidence that the runner is
safe. Preserve this guard, its workflow/ref restrictions, and the normal
environment approval and test gates. After the specifically authorised
recovery work is complete, disable the workflows again while awaiting provider
confirmation of the runner patch. Remove the exception only after the compliant
runner has been verified and the recovery work no longer depends on it.

The check covers the workflow runner only. Hosting services, Cloudflare and
other clients have separate runtimes and trust stores that need their own
evidence. The incident probes do not establish that every possible certificate
chain or every client on a machine is protected.

## Current Machine Setup

The desktop user's NVM for Windows configuration is:

```powershell
$env:NVM_HOME = "C:\Users\VinceHardwick\AppData\Local\nvm"
$env:NVM_SYMLINK = "C:\nvm4w\nodejs"
```

The following records the June 2026 setup. Check current versions directly rather than treating this historical list as the supported baseline:

```powershell
nvm version  # 1.2.2
node --version  # v22.19.0
npm --version  # 11.14.1
npx --version  # 11.14.1
corepack --version  # 0.34.0
pnpm --version  # 11.8.0
```

Codex also has a bundled Node runtime under:

```powershell
C:\Users\VinceHardwick\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe
```

Use a bundled Node executable only after it passes the runtime check above; its version is independent of the selected NVM installation.
On 2026-06-19, that bundled Node `bin` directory was added to the
Windows user-level `Path` as a sandbox-friendly fallback. Existing Codex desktop
processes may keep their original inherited environment until the app is
restarted; in the same already-running session, temporarily append the bundled
Node `bin` directory to `$env:PATH` or call `node.exe` by absolute path.

The project owner's Windows user account has NVM and the active Node.js install
on its normal `PATH`. When a Codex sandboxed shell reports `node`, `npm`, `npx`,
or `nvm` as missing, do not treat that as machine state. Prefer an explicit
sandbox escalation request for commands that should run through the owner's
normal NVM-managed toolchain.

## Sandbox Behaviour

The Codex workspace sandbox can see `NVM_HOME` and `NVM_SYMLINK`, but it may be
denied permission to list or execute files under those paths.
On 2026-06-19, sandboxed PowerShell could `Test-Path` the NVM-managed
`node.exe`, `npm.cmd`, `npx.cmd`, and `nvm.exe`, but direct execution failed
with `Access is denied`. That is an execution boundary, not a missing PATH
entry.

Known symptoms from sandboxed PowerShell:

```text
Access to the path 'C:\nvm4w\nodejs' is denied.
Program 'node.exe' failed to run ... Access is denied.
The term 'node' is not recognized as a name of a cmdlet, function, script file, or executable program.
```

This does not mean Node.js, npm, npx, or NVM are missing from the machine. It
means the sandbox is blocking execution outside the workspace.

## Best Practice for Future Codex Sessions

Use these rules:

- When the repository workflow calls for the owner's installed Node.js, npm,
  npx, or NVM, run the command outside the sandbox with an explicit escalation
  request instead of rediscovering or reinstalling Node:

  ```powershell
  node --version
  node --test
  npm --version
  npx --version
  pnpm --version
  nvm version
  ```

  Most escalated CLI commands should still run as the owner account without a
  separate Windows UAC prompt. UAC is only expected for installers or operations
  that write to protected machine locations.

- For quick local tests that need no package install and do not depend on the
  owner's exact Node version, use sandboxed `node --test`. If the current Codex
  app process has not picked up the user-level PATH update yet, append the
  bundled Node directory for that command or call the executable by absolute
  path:

  ```powershell
  $env:PATH = "$env:PATH;C:\Users\VinceHardwick\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
  node --test
  & 'C:\Users\VinceHardwick\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test
  ```

- For npm, npx, or NVM operations, default to the owner's installed toolchain
  through sandbox escalation. Examples:

  ```powershell
  npm --version
  npm install
  npm install --save-dev playwright
  npm ci
  npx playwright install chromium
  ```

- For package-manager-backed verification in this repository, prefer escalated
  `npm test` over manually spelling out the long bundled Node path. On
  2026-06-19, escalated `npm test` used the NVM-managed Node v22.19.0 toolchain
  and passed 149/149 tests.

- Do not work around sandbox execution denial by copying global Node
  installations into the repository.
- Do not install project dependencies into `output/` except as a temporary
  ignored diagnostic workaround. If a dependency is part of the project
  workflow, add it to `package.json` and commit the resulting
  `package-lock.json`.
- If a tool is needed only for one-off investigation and should not become a
  project dependency, keep any downloaded runtime under ignored `output/` and
  document that it is disposable.

## npm Dependency Rules

For repository dependencies:

1. Add runtime dependencies with:

   ```powershell
   npm install <package>
   ```

2. Add development/test dependencies with:

   ```powershell
   npm install --save-dev <package>
   ```

3. Commit both `package.json` and `package-lock.json`.
4. CI should use:

   ```powershell
   npm ci
   ```

   when `package-lock.json` exists, because `npm ci` installs the exact locked dependency tree and does not rewrite `package.json` or `package-lock.json`.

5. Use `npm install` intentionally when dependencies are being added or updated, because it may update the lockfile to match `package.json`.

## Documentation Basis

Context7 lookups for the official npm CLI docs and OpenAI Codex docs were used when this runbook was written.

Relevant documented behaviour:

- `npm install` installs dependencies and may update `package-lock.json` when the lockfile does not satisfy `package.json`.
- `npm ci` is intended for automated environments and requires an existing lockfile that matches `package.json`.
- Codex setup/dependency workflows support package managers such as npm, yarn, pnpm, pip, pipenv, Poetry, and pnpm, with network access governed by sandbox/environment configuration.

## Security Boundary

Installing or updating dependencies can execute package lifecycle scripts and download code from the network. Treat dependency changes as code changes:

- require the user's request or approval;
- use sandbox escalation when the sandbox blocks npm/NVM execution or network access;
- inspect and commit lockfile changes deliberately;
- do not store tokens or private registry credentials in the repository.
