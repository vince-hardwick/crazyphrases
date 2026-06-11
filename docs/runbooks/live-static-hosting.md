# Live Static Hosting Runbook

## Purpose

This runbook describes how to publish the temporary `crazyphrases.com` static landing page without exposing the server directory index or creating mixed-content browser warnings.

## Files To Upload

Upload these repository paths to the live web root for `crazyphrases.com`:

- `index.html`
- `assets/site.css`
- `assets/app.js`

The live web root is the hosting account directory that currently displays `Index of /` and contains `cgi-bin/`. On many shared hosts this is named `public_html`, `www`, `htdocs`, or the domain-specific document root shown in the hosting panel.

## Required Server Settings

- Serve `index.html` as the default directory index.
- Disable directory listing or autoindex.
- Redirect all `http://crazyphrases.com` and `http://www.crazyphrases.com` traffic to HTTPS.
- Keep the Let's Encrypt certificate active for both `crazyphrases.com` and `www.crazyphrases.com`.
- Do not add HTTP-only images, scripts, stylesheets, fonts, analytics, or embedded content.

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

Non-production environment DNS, runtime access control, feature-branch `dev` deployment, and the full promotion sequence are covered by `docs/runbooks/cloudflare-dns-and-access.md`.

Static asset URLs in deployed `index.html` are stamped with the workflow commit SHA before FTPS upload. Source `index.html` keeps `__ASSET_VERSION__` placeholders; deployed environments should show asset URLs such as `assets/app.js?v=<commit-sha>`. This prevents browsers from combining fresh HTML with stale JavaScript or CSS after a static deployment.

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

## Authority Boundary

Detecting the live host, document root, protocol, or branch does not authorize live mutation. Uploads and server setting changes require an explicit deployment action by the site owner or an approved deployment workflow.
