# Bare Landing Page Design

## Status

Approved for implementation

## Goal

Publish a minimal static landing page for `crazyphrases.com` so the public site does not expose the web server directory index while the full web app is planned.

## Scope

- Add a static `index.html` at the repository root.
- Add local CSS in `assets/site.css`.
- Avoid JavaScript, forms, analytics, fonts, third-party images, and external assets.
- Add a deployment runbook documenting the web root upload and server settings needed to avoid directory listing and insecure HTTP access.

## Design

The page is a single holding screen with the project name, a short "coming soon" message, and the contact address `hello@crazyphrases.com`. All assets are local and referenced with relative HTTPS-safe paths, so the page itself cannot introduce mixed-content warnings.

## Operational Requirements

- The live web root must contain `index.html` so directory listing is not the default response.
- HTTP requests should redirect to HTTPS.
- Directory listing should be disabled at the server or hosting-panel level.
- The TLS certificate should cover both `crazyphrases.com` and `www.crazyphrases.com`.
- Environment detection, such as host or protocol detection, must not grant authority to mutate live systems.

