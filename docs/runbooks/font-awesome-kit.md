# Font Awesome Kit Runbook

## Purpose

This runbook owns operational guidance for the Font Awesome Kit selected by ADR
0020 for Built-in Avatar visuals.

## Project Kit

| Field | Value |
| --- | --- |
| Kit ID | `613901cfcc` |
| Hosted script | `https://kit.fontawesome.com/613901cfcc.js` |
| Integration method | Hosted SVG+JS Kit |
| Project config | `.font-awesome.md` |

Use this script in the static app pages that render Built-in Avatars:

```html
<script src="https://kit.fontawesome.com/613901cfcc.js" crossorigin="anonymous"></script>
```

## Agent Tooling

Font Awesome's AI-agent docs describe four skills: `/setup-fa`,
`/suggest-icon`, `/add-icon`, and `/fa-help`. This repository records the
selected integration in `.font-awesome.md` so future icon additions can use the
same Kit method consistently.

Do not install Font Awesome agent tools, the `fa` CLI, or package dependencies
just to read this repository's accepted integration details. Install or invoke
those tools only when the current task requires icon search, Kit inspection, or
automated icon insertion and the user has approved any resulting network or
package-manager work.

## Icon Markup

Use Kit-compatible inline icon markup. Keep the Crazy Phrases Avatar key as the
product/storage value and treat Font Awesome classes as rendering metadata.

```html
<i class="fa-solid fa-star" aria-hidden="true"></i>
```

Do not create project-local CSS classes beginning with `fa-`.

The accepted Built-in Avatar keys are:

```text
dice
hat-wizard
gamepad
ghost
puzzle-piece
biohazard
dragon
hurricane
jedi
pizza-slice
spaghetti-monster-flying
user-astronaut
yin-yang
```

Each key maps to the Classic Font Awesome icon with the same name.

Use Classic Solid for each Built-in Avatar when the named icon is available in
Solid in the pinned Kit. Use Classic Regular as a per-icon fallback only when
the named icon is not available in Solid. Record any fallback in `.font-awesome.md`
and in the implementation mapping.

Legacy built-in keys from the current implementation are not valid target keys
after #63. Migrate them as follows: `spark` to `dice`, `paper` to
`puzzle-piece`, `moon` to `yin-yang`, `star` to `user-astronaut`, `comet` to
`hurricane`, and `kite` to `dragon`. Unknown or invalid built-in keys fall back
to `dice`.

## Kit Configuration

For the Uploaded Avatar / Built-in Avatar slice:

- prefer a subsetted Kit containing only the icon styles or specific icons
  needed for the Built-in Avatar set;
- pin the Kit to the current Font Awesome 7 version available during
  implementation instead of leaving it on the default `Latest` auto-update
  setting;
- configure Font Awesome domain limiting for `crazyphrases.com`,
  `www.crazyphrases.com`, `dev.crazyphrases.com`, and
  `test.crazyphrases.com`;
- verify local development origins during implementation. Font Awesome docs say
  `localhost` is allowed by default, but agents should still verify
  `localhost` and `127.0.0.1` browser smoke paths used by this repo;
- do not commit Font Awesome account tokens, API tokens, package manager tokens,
  downloaded Pro assets, or Kit package credentials.

## Accessibility

Built-in Avatar icons represent labelled avatar choices. The Font Awesome icon
element may be decorative, but the surrounding Avatar preview, option, or
control must expose a text label such as the Avatar key's display name to
assistive technology.

## Validation

For #63, browser smoke tests should verify:

- the hosted Kit script loads in local/dev/test paths where practical;
- the 13 Built-in Avatar previews render visibly;
- each Built-in Avatar uses the verified Classic Solid style, or the recorded
  Classic Regular fallback where Solid is unavailable;
- Uploaded Avatar preview still renders without depending on Font Awesome;
- console logs are clean and mobile layout has no horizontal overflow.

If the project later introduces a strict Content Security Policy, re-check the
Font Awesome security docs before deployment. SVG+JS Kits may require explicit
CSP handling; if that becomes too costly, record a follow-up decision before
switching to CSS-only, package-manager, downloaded Kit, SVG sprite, or
self-hosted assets.

## Source Docs

- `https://docs.fontawesome.com/web/use-with/ai-agent-tools`
- `https://docs.fontawesome.com/web/setup/use-kit`
- `https://docs.fontawesome.com/web/add-icons/how-to`
- `https://docs.fontawesome.com/web/dig-deeper/accessibility`
- `https://docs.fontawesome.com/web/dig-deeper/performance`
- `https://docs.fontawesome.com/web/dig-deeper/security`
- `https://docs.fontawesome.com/web/dig-deeper/tokens`
