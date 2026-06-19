# Node and npm for Codex

## Purpose

This runbook records how Codex sessions should use Node.js, npm, npx, and npm
packages in this repository without rediscovering local NVM for Windows and
sandbox behaviour.

## Agent Fast Path

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

## Current Machine Setup

The desktop user's NVM for Windows configuration is:

```powershell
$env:NVM_HOME = "C:\Users\VinceHardwick\AppData\Local\nvm"
$env:NVM_SYMLINK = "C:\nvm4w\nodejs"
```

Outside the Codex filesystem sandbox, the active versions are:

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

Use the bundled Node executable for local no-network commands such as
`node --test` when it is sufficient.
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
