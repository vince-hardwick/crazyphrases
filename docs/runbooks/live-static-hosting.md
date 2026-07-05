# Live Static Hosting Runbook

## Purpose

This runbook describes how to publish the static `crazyphrases.com` site without exposing the server directory index or creating mixed-content browser warnings. The current production site is the static anonymous solo Crazy Phrases app.

## Deployment Payload

GitHub Actions is the authoritative deployment path. The deployment workflows
upload from the repository root and exclude source-only paths. This means new
runtime files are included automatically when they are not under an excluded
source-only path.

Runtime payload includes:

- `.htaccess`
- `index.html`
- browser runtime files under `assets/`, including JavaScript modules, CSS,
  runtime JSON data, and rendered browser-safe Supabase config

Source-only paths must stay out of FTPS uploads:

- `.gitattributes`
- `.gitignore`
- `.github/`
- `AGENTS.md`
- `CONTEXT.md`
- `README.md`
- `docs/`
- `output/`
- `package.json`
- `package-lock.json`
- `supabase/`
- `tests/`

The payload contract is protected by `.github/workflows/deploy-dev.yml`,
`.github/workflows/promote.yml`, and
`tests/workflow-deployment-surface.test.mjs`. If the app moves to a build output
directory or a framework-specific source tree, update both workflows and the
deployment-surface regression test in the same change.

For an explicitly approved emergency manual upload, mirror the same contract:
upload `.htaccess`, `index.html`, and every required runtime file under
`assets/`; do not upload source-only paths listed above. Prefer the documented
workflow path unless the owner has approved a manual recovery action.

The live web root is the hosting account directory that currently displays `Index of /` and contains `cgi-bin/`. On many shared hosts this is named `public_html`, `www`, `htdocs`, or the domain-specific document root shown in the hosting panel.

## Required Server Settings

- Serve `index.html` as the default directory index.
- Disable directory listing or autoindex.
- Redirect all `http://crazyphrases.com` and `http://www.crazyphrases.com` traffic to HTTPS.
- Keep the Let's Encrypt certificate active for both `crazyphrases.com` and `www.crazyphrases.com`.
- Do not add HTTP-only images, scripts, stylesheets, fonts, analytics, or embedded content.

## Cache Policy

The deployed `.htaccess` file sets no-store/no-cache headers for `index.html`. This keeps the HTML shell from being cached across deployments, so browsers and Cloudflare should revalidate the asset version URLs after each deployment.

The deployed `.htaccess` file also allows long-lived immutable caching for `.css` and `.js` files. Those files must remain referenced through commit-stamped URLs such as `assets/app.js?v=<commit-sha>` and `./game-state.js?v=<commit-sha>`. Runtime data assets fetched by browser code, such as `assets/word-bank-seed.json`, `assets/word-bank/manifest.json`, and production Word Bank shard files, must also use a deployed asset-version query string when referenced from JavaScript.

## GitHub Actions Deployment

Production deployment is managed by `.github/workflows/promote.yml`.

The GitHub repository must have a `production` environment with a required reviewer gate and these environment secrets:

- `FTP_SERVER`
- `FTP_USERNAME`
- `FTP_PASSWORD`
- `FTP_SERVER_DIR`

Use FTPS credentials from the hosting provider. The `FTP_SERVER_DIR` value should point at the live web root that contains `index.html` and `cgi-bin/`, for example `public_html/` or the domain-specific document root shown in cPanel. The value must end with `/`.

The `FTP_SERVER` value must point to a direct FTP/FTPS endpoint, not a Cloudflare-proxied hostname. If using `ftp.crazyphrases.com`, keep that DNS record DNS only in Cloudflare.

The promotion workflow verifies required files, runs available static-site tests, checks for insecure `http://` asset references, deploys the merged `main` commit to `test`, then waits for production approval before uploading the same workflow run's commit over FTPS.

The static hosting payload is intentionally limited to runtime web files. Source-only repository paths such as `.gitattributes`, `.gitignore`, `.github/`, `docs/`, `tests/`, `output/`, `supabase/`, `package.json`, and `package-lock.json` must stay out of FTPS uploads for `dev`, `test`, and `production`.

Non-production environment DNS, runtime access control, feature-branch `dev` deployment, and the full promotion sequence are covered by `docs/runbooks/cloudflare-dns-and-access.md`.

Static asset URLs in deployed `index.html` are stamped with the workflow commit SHA before FTPS upload. Source `index.html` keeps `__ASSET_VERSION__` placeholders; deployed environments should show asset URLs such as `assets/app.js?v=<commit-sha>`. Browser module imports and runtime data fetches are stamped too; for example, source `assets/app.js` imports `./game-state.js?v=__ASSET_VERSION__`, imports `./local-game-storage.js?v=__ASSET_VERSION__`, fetches `assets/word-bank-seed.json?v=__ASSET_VERSION__`, fetches `assets/word-bank/manifest.json?v=__ASSET_VERSION__`, and appends the same asset-version query string when fetching manifest-referenced Word Bank shards. Deployed files should use the same commit SHA in those URLs. This prevents browsers from combining fresh HTML or JavaScript with stale transitive modules or stale word-bank data after a static deployment.

## Example Nginx Settings

Use hosting-panel controls when available. If direct nginx configuration is available, the live server should follow this shape:

```nginx
server {
    listen 80;
    server_name crazyphrases.com www.crazyphrases.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name crazyphrases.com www.crazyphrases.com;

    root /path/to/crazyphrases-web-root;
    index index.html;
    autoindex off;
}
```

Do not copy this directly without replacing `/path/to/crazyphrases-web-root` with the hosting account's actual document root.

## Verification

After upload and server configuration:

```powershell
curl.exe -I http://www.crazyphrases.com/
curl.exe -I https://www.crazyphrases.com/
```

Expected:

- The HTTP response is `301` or `308` and redirects to `https://www.crazyphrases.com/`.
- The HTTPS response is `200`.
- The page source contains no `http://` asset URLs.
- The browser no longer shows `Index of /`.
- The page opens the Crazy Phrases anonymous solo game rather than a holding page.

If sandboxed `curl.exe` or `Invoke-WebRequest` fails before an HTTP response
with Windows Schannel or `Authentication failed` wording, follow
`docs/runbooks/cloudflare-dns-and-access.md` section `Codex Sandbox TLS Client
Failures` before treating the public site or asset as private, broken, or
misconfigured.

## Authority Boundary

Detecting the live host, document root, protocol, or branch does not authorize live mutation. Uploads and server setting changes require an explicit deployment action by the site owner or an approved deployment workflow.
