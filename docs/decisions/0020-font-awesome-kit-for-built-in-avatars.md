# 0020: Font Awesome Kit for Built-in Avatars

## Status

Accepted. Source-controlled #63 implementation renders Built-in Avatar previews
with the Font Awesome Kit-compatible Classic Solid icon classes. The app loads
the hosted Kit dynamically on non-localhost origins; local browser smoke tests
verify stable markup and Avatar behaviour without requiring the owner-managed
Kit to allow every local test origin.

## Context

The current Account Profile surface stores built-in Avatar keys but does not
render visual avatar images. The Uploaded Avatar slice needs a visible
Built-in Avatar fallback so uploaded images and project-provided avatars are
both real visual choices.

The owner has a Font Awesome Kit for this project:

- Kit ID: `613901cfcc`
- Hosted script URL: `https://kit.fontawesome.com/613901cfcc.js`

Font Awesome's current docs describe Kits as the hosted one-line integration for
web projects, and its AI agent tooling supports SVG+JS Kit integrations by
generating `<i>` tags for a Kit script. The docs also recommend a committed
`.font-awesome.md` project configuration file so future agent-assisted icon
additions use the same integration method.

## Decision

The first Uploaded Avatar slice should introduce Built-in Avatar visuals through
the owner's Font Awesome Kit `613901cfcc`.

Use the hosted SVG+JS Kit script in the static app rather than adding Font
Awesome npm packages or downloading/self-hosting the Kit in this slice. The
source implementation may inject this script dynamically so local automated
tests do not fail when the owner-managed Kit blocks a local origin:

```html
<script src="https://kit.fontawesome.com/613901cfcc.js" crossorigin="anonymous"></script>
```

Built-in Avatar rendering should use Font Awesome Kit-compatible icon markup.
The first Built-in Avatar set replaces the old transitional six-key list with
stable Crazy Phrases Avatar keys that intentionally match Classic Font Awesome
icon names:

- `dice`
- `hat-wizard`
- `gamepad`
- `ghost`
- `puzzle-piece`
- `biohazard`
- `dragon`
- `hurricane`
- `jedi`
- `pizza-slice`
- `spaghetti-monster-flying`
- `user-astronaut`
- `yin-yang`

These values are still Crazy Phrases product/storage keys. The matching Classic
Font Awesome family and icon names are rendering metadata and must not make
Account Profile data depend on Font Awesome CSS class strings. Use the Classic
Solid style for all 13 Built-in Avatars when those icons are available in the
pinned Kit; use Classic Regular as a per-icon fallback only when a requested
icon is not available in Solid.

The old transitional built-in keys are legacy-only after #63. Migrate them to
the accepted set as follows:

| Legacy Key | Accepted Built-in Avatar Key |
| --- | --- |
| `spark` | `dice` |
| `paper` | `puzzle-piece` |
| `moon` | `yin-yang` |
| `star` | `user-astronaut` |
| `comet` | `hurricane` |
| `kite` | `dragon` |

Unknown or invalid built-in keys should fall back to `dice`.

The Kit should be configured in Font Awesome to load only the icon styles or
specific icons needed for the Built-in Avatar set where practical. Domain
limiting should include Crazy Phrases production, test, and development domains;
local verification origins such as `localhost` and `127.0.0.1` must be checked
during implementation. Do not commit Font Awesome account tokens or package
manager tokens.

The Kit version should be pinned to the current Font Awesome 7 version available
when #63 was implemented, rather than using Font Awesome's default `Latest`
auto-update setting. Future Font Awesome upgrades are deliberate maintenance
work and require visual/browser smoke coverage for Built-in Avatars.

Built-in Avatar icons are visual representations of labelled avatar choices.
The icon element itself may be decorative, but the surrounding control or image
preview must expose the selected Avatar label to assistive technology.

## Consequences

- The static app gains a hosted third-party runtime dependency on
  `kit.fontawesome.com` for Built-in Avatar rendering.
- Browser smoke tests for #63 must verify stable Built-in Avatar markup and
  behaviour locally, and must verify that the Kit loads and icons render in
  hosted `dev`/`test` where practical.
- Built-in Avatar visuals should remain stable across routine deployments; Font
  Awesome version upgrades must be intentional rather than automatic.
- If a strict Content Security Policy is introduced later, it must explicitly
  account for the Font Awesome Kit script and any generated style/font/SVG
  behaviour, or the project must switch to a CSP-compatible Font Awesome
  integration.
- The old transitional keys (`spark`, `paper`, `moon`, `star`, `comet`, `kite`)
  are not the target Built-in Avatar product keys for #63.
- #63 must include migration or normalisation coverage for legacy built-in keys
  and invalid built-in keys.
- The accepted 13-key Built-in Avatar set must be implemented as stable mapping
  data and reflected in Account Profile tests.
- Implementation must verify the selected Solid or Regular style for every
  Built-in Avatar against the pinned Kit before promotion.
