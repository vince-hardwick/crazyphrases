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

## Deployment

The current public site is a static holding page. See `docs/runbooks/live-static-hosting.md` for the required upload path, HTTPS redirect, directory-listing, certificate checks, and GitHub Actions deployment setup.

DNS, Cloudflare Access, and non-production environment access controls are documented in `docs/runbooks/cloudflare-dns-and-access.md`.

Git and GitHub CLI authentication behaviour for Codex sessions is documented in `docs/runbooks/github-cli-auth-for-codex.md`.
