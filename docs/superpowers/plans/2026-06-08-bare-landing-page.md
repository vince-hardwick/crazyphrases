# Bare Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal static landing page and deployment guidance for `crazyphrases.com`.

**Architecture:** Use plain HTML and CSS with no external assets. Keep deployment/server behavior documented separately from page code.

**Tech Stack:** Static HTML, CSS, GitHub, live web server upload.

---

### Task 1: Static Holding Page

**Files:**
- Create: `index.html`
- Create: `assets/site.css`

- [ ] Add `index.html` with semantic page content, local stylesheet reference, and no external asset URLs.
- [ ] Add `assets/site.css` with responsive styling and no imports.
- [ ] Verify `index.html` does not contain `http://`.

### Task 2: Deployment Runbook

**Files:**
- Create: `docs/runbooks/live-static-hosting.md`
- Modify: `README.md`

- [ ] Document the upload target, HTTPS redirect requirement, directory listing requirement, and certificate coverage checks.
- [ ] Link the runbook from `README.md`.

### Task 3: Verification And Commit

**Files:**
- Inspect: `index.html`
- Inspect: `assets/site.css`
- Inspect: `docs/runbooks/live-static-hosting.md`
- Inspect: `README.md`

- [ ] Run local text checks for external insecure URLs and expected files.
- [ ] Check git status.
- [ ] Commit the page and documentation.
- [ ] Push `main` to `origin/main`.

