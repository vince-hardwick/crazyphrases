# crazyphrases.com

Planning, design, and implementation workspace for the `crazyphrases.com` web app.

Start with `AGENTS.md` and `docs/planning/agent-context-map.md` for agent working conventions and document routing.

## Repository

- GitHub repository name: `crazyphrases`
- Intended visibility: public
- Primary domain: `crazyphrases.com`
- Development environment: Codex local workspace
- Remote: `https://github.com/vince-hardwick/crazyphrases.git`

The local `main` branch tracks `origin/main`.

## Repository Hygiene

Track shared project control files such as `.gitignore`, `.htaccess`,
`AGENTS.md`, `CONTEXT.md`, `package.json`, and `package-lock.json`.

- `.gitignore` is the shared ignore policy. Personal-only ignores belong in
  `.git/info/exclude`.
- `.htaccess` is runtime static-hosting configuration and is deployed with the
  site.
- `package.json` and `package-lock.json` define the deterministic local and CI
  test toolchain.
- `AGENTS.md` and `CONTEXT.md` are public project/agent source-of-truth files.

Do not commit credentials or local generated state. Deployment workflows must
keep source-only paths such as docs, tests, package files, and agent guidance
out of FTPS uploads as documented in the hosting runbooks.

## Deployment

The current public site is a static Crazy Phrases app. See `docs/runbooks/live-static-hosting.md` for the required upload path, runtime payload contract, HTTPS redirect, directory-listing, certificate checks, cache-busting rules, and GitHub Actions deployment setup.

DNS, Cloudflare Access, and non-production environment access controls are documented in `docs/runbooks/cloudflare-dns-and-access.md`.

Git and GitHub CLI authentication behaviour for Codex sessions is documented in `docs/runbooks/github-cli-auth-for-codex.md`. Open that runbook before using authenticated `gh` commands from Codex; sandboxed `401`, invalid-token, unauthenticated `403`, or rate-limit responses usually mean the command needs Windows-keyring access through sandbox escalation.
