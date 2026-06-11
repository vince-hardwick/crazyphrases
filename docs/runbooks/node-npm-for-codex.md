# Node and npm for Codex

## Purpose

This runbook records how Codex sessions should use Node.js, npm, npx, and npm packages in this repository without rediscovering local NVM for Windows and sandbox behaviour.

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
```

Codex also has a bundled Node runtime under:

```powershell
C:\Users\VinceHardwick\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe
```

Use the bundled Node executable for local no-network commands such as `node --test` when it is sufficient.

## Sandbox Behaviour

The Codex workspace sandbox can see `NVM_HOME` and `NVM_SYMLINK`, but it may be denied permission to list or execute files under those paths.

Known symptoms from sandboxed PowerShell:

```text
Access to the path 'C:\nvm4w\nodejs' is denied.
Program 'node.exe' failed to run ... Access is denied.
```

This does not mean Node.js, npm, npx, or NVM are missing from the machine. It means the sandbox is blocking execution outside the workspace.

## Best Practice for Future Codex Sessions

Use these rules:

- For project tests that need no package install, prefer the bundled Node executable:

  ```powershell
  & 'C:\Users\VinceHardwick\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test
  ```

- For npm, npx, or NVM operations, run the command outside the sandbox with an explicit escalation request. Examples:

  ```powershell
  npm --version
  npm install
  npm install --save-dev playwright
  npm ci
  npx playwright install chromium
  ```

- Do not work around sandbox execution denial by copying global Node installations into the repository.
- Do not install project dependencies into `output/` except as a temporary ignored diagnostic workaround. If a dependency is part of the project workflow, add it to `package.json` and commit the resulting `package-lock.json`.
- If a tool is needed only for one-off investigation and should not become a project dependency, keep any downloaded runtime under ignored `output/` and document that it is disposable.

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
