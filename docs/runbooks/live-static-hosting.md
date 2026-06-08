# Live Static Hosting Runbook

## Purpose

This runbook describes how to publish the temporary `crazyphrases.com` static landing page without exposing the server directory index or creating mixed-content browser warnings.

## Files To Upload

Upload these repository paths to the live web root for `crazyphrases.com`:

- `index.html`
- `assets/site.css`

The live web root is the hosting account directory that currently displays `Index of /` and contains `cgi-bin/`. On many shared hosts this is named `public_html`, `www`, `htdocs`, or the domain-specific document root shown in the hosting panel.

## Required Server Settings

- Serve `index.html` as the default directory index.
- Disable directory listing or autoindex.
- Redirect all `http://crazyphrases.com` and `http://www.crazyphrases.com` traffic to HTTPS.
- Keep the Let's Encrypt certificate active for both `crazyphrases.com` and `www.crazyphrases.com`.
- Do not add HTTP-only images, scripts, stylesheets, fonts, analytics, or embedded content.

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
