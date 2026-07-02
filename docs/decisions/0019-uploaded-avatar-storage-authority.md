# 0019: Uploaded Avatar Storage Authority

## Status

Accepted. Source-controlled #63 implementation merged to `main` through PR #74
and has been promoted through production. The hosted `avatars` Storage bucket,
ownership metadata, and Storage policies have been applied after explicit owner
approval. Hosted `dev` and `test` browser upload/write/reload/restore
validation passed through the real Storage bucket, and production passed a
non-write browser smoke. Production uploaded-avatar write smoke remains
separately approval-gated. ADR 0021 extends this decision for #64 by selecting
derived cropped images, rather than persistent crop metadata or retained
originals, as the storage authority for circular Uploaded Avatar cropping. The
#64 implementation merged to `main` through PR #78 and has been promoted through
production.

## Context

At decision time, the Account Profile implementation stored only a transitional
built-in Avatar key. The profile personalisation slice replaced that with the
accepted Built-in Avatar key set and allowed an account holder to use an
Uploaded Avatar, which introduced user-supplied media storage, serving,
deletion, and access control concerns that were not covered by the existing
Account Profile / Handle Directory decision, now superseded for identity
terminology by ADR `0023`.

The main alternatives are:

- storing image bytes in Postgres;
- committing uploaded assets into the static site deployment;
- using a separate media service;
- using Supabase Storage alongside the existing Supabase Auth and Postgres
  signed-in boundary.

## Decision

Uploaded Avatar image bytes belong in Supabase Storage. Supabase Postgres remains
the Account Profile and lookup-directory source of truth, storing only the avatar
choice and the invite-safe reference or metadata needed to render an Avatar.

Account Profile data should represent the current Avatar as an explicit Avatar
descriptor rather than overloading the current built-in `avatar_key` string. The
descriptor distinguishes Built-in Avatars from Uploaded Avatars. Built-in Avatar
descriptors carry a project-provided avatar key; Uploaded Avatar descriptors
carry an opaque Storage object path or equivalent opaque reference. The lookup
directory may expose the Avatar descriptor only while it remains invite-safe.
Completed-game participant snapshots must preserve the Avatar descriptor used at
play time rather than reading the latest live Account Profile when history is
rendered.

Browser-facing profile data must continue to avoid raw Supabase Auth user ids,
email addresses, provider identities, service keys, secret storage details, and
any storage authority value that would allow mutation outside the signed-in
account holder's permitted path.

Uploaded Avatars should be served from a public-read Supabase Storage bucket
using opaque object paths that do not encode raw account ids, email addresses,
provider identities, Gamer Tags, lookup keys, or other account-identifying values.
Read access is public because Avatars are game-facing display assets, while
upload, replacement, and deletion authority remains restricted to the owning
signed-in Account through Storage policies or an equivalent approved
server-owned path.

The accepted bucket name is `avatars`. First-slice Uploaded Avatar originals
should use opaque object paths under the `uploaded/` prefix, such as
`uploaded/{uuid}.{ext}`. The extension should match the accepted raster format
after validation. The object path must not encode account identity; the Postgres
ownership row is the authority for owner and lifecycle state.

The first Uploaded Avatar slice accepts only raster JPEG, PNG, and WebP files.
It rejects SVG, GIF, HEIC/HEIF, video, animated formats, and non-image uploads.
Uploads are capped at 1 MiB, decoded image dimensions must be no larger than
1024 x 1024 pixels, and decoded image dimensions must be at least 128 x 128
pixels.

The first slice uses stable user-facing validation and save messages:
"Choose a JPEG, PNG, or WebP image.", "Choose an image smaller than 1 MB.",
"Choose an image at least 128 by 128 pixels.", "Choose an image no larger than
1024 by 1024 pixels.", "This image could not be read. Choose another file.",
"Avatar could not be uploaded. Try again.", "Profile could not be saved. Your
previous avatar is still active.", and "Profile saved."

The first slice does not include image-content moderation, automated safety
scanning, human review queues, report queues, or public-discovery safety
workflows. Uploaded Avatars remain account-bound game-facing identity assets in
existing signed-in profile and participant contexts.

The first slice stores the original validated file bytes. It does not resize,
crop, strip metadata, or transcode Uploaded Avatar files. Image processing,
derivative generation, and metadata stripping remain separate future work.

Selecting an Uploaded Avatar file is a local validation and preview action only.
The browser must not upload the file to hosted Storage until the signed-in
participant activates the explicit Save profile action. If upload or profile
save fails, the previously saved Avatar remains active and the UI shows a clear
failure state.

If file upload succeeds but saving the Account Profile Avatar descriptor fails,
the app should attempt best-effort cleanup of the newly uploaded object and any
matching ownership metadata. Cleanup failure must not switch the active Avatar
or falsely show success; it should leave the object marked or discoverable as
abandoned for later lifecycle cleanup.

#63 requires hosted Supabase validation before merge or promotion because it
creates or depends on real Storage bucket, Storage policy, ownership metadata,
and direct browser upload behaviour. Hosted validation remains approval-gated
and should run in dev or test first. Production uploaded-avatar write smoke
requires separate explicit approval.

The #63 Uploaded Avatar slice did not store crop coordinates, generate derived
cropped images, or add a crop-positioning UI. ADR 0021 owns the #64
crop-storage model, which is now implemented with browser-generated derived
cropped PNG objects. The richer #79 visual cropper is now implemented on top of
that storage model without changing Storage authority.

The first slice must render a basic Avatar preview in the existing Profile
editor for both Built-in Avatars and Uploaded Avatars. Existing participant or
profile identity surfaces should consume the Avatar descriptor where they
already show avatar identity. The slice must not add new public profile pages,
friend cards, leaderboard identity, or broader social surfaces.

Anonymous users must not receive Uploaded Avatar controls, hidden file inputs,
upload preview DOM, upload event wiring, or browser storage-upload paths.
Uploaded Avatar controls belong only inside the signed-in Profile editor
surface.

Replacing the live Account Profile's Uploaded Avatar must not delete older
uploaded objects that may still be referenced by completed-game participant
snapshots, batch favourites, or other durable history/favourite snapshots. The
first slice should upload the new object, save the new Avatar descriptor, and
clean up only clearly unreferenced abandoned objects from failed or retried
uploads where practical. The avatar image gallery slice should add cleanup for
superseded Uploaded Avatar objects once reference checks prove that no current
profile, completed-game history, batch favourite, or other durable snapshot can
still render them. Account-deletion media retention remains a separate lifecycle
decision.

Participants may remove the live Uploaded Avatar from their Account Profile by
choosing and saving a Built-in Avatar. That changes the live Account Profile
descriptor back to the selected Built-in Avatar but does not delete older
uploaded objects that may still be referenced by completed-game participant
snapshots.

Supabase Storage object deletion must use the Storage API, not direct SQL
deletion from `storage.objects`. SQL may verify metadata and drive reference
checks, but application cleanup must remove object bytes through a Storage API
path such as `supabase.storage.from("avatars").remove(paths)`, then reconcile the
private uploaded-avatar ownership metadata. Deletion authority must still be
owner-scoped through Storage RLS or a separately approved narrow server-owned
route.

The first Uploaded Avatar slice should use direct authenticated browser uploads
to Supabase Storage rather than adding an Edge Function or custom server upload
path. The static browser client validates the file, uploads it as the signed-in
Account, and then saves the Avatar descriptor to Postgres. Implementation must
verify current Supabase Storage policy support before committing to exact policy
SQL. If owner-scoped upload, replacement, and deletion cannot be enforced
cleanly with opaque object paths, the slice must use a narrow approved fallback
such as a server-owned upload path or companion ownership metadata instead of
encoding account-identifying values in object paths.

The uploaded-avatar schema should include a Postgres ownership row for each
uploaded object. That row records the owning Account Profile, the opaque Storage
object path or reference, and enough lifecycle metadata to distinguish current
live-profile references, historical snapshot references, and clearly abandoned
objects from failed or retried uploads. This ownership table is not a public
directory surface; browser-facing Account Profile and lookup-directory data must
expose only the invite-safe Avatar descriptor.

No Supabase Storage bucket existed for uploaded avatars at decision time. The
#63 branch creates the public-read `avatars` bucket, ownership metadata table,
and owner-scoped Storage policies through a source-controlled migration, and
that migration was applied to hosted Supabase on 2026-06-24 after explicit
owner approval. Further hosted upload/write/cleanup smokes remain live hosted
mutations and require explicit owner approval or an accepted task-specific plan.
Prefer authenticated Supabase MCP tooling for hosted bucket and policy work when
it exposes the required operation; use the Supabase CLI as the fallback when MCP
is unavailable for that operation.

## Consequences

- Postgres schema changes should model avatar representation and references,
  not image bytes.
- Built-in Avatars and Uploaded Avatars must coexist in Account Profile data and
  in completed-game participant snapshots.
- Code that still reads `avatar_key` is a transitional built-in Avatar
  representation and should not become the long-term uploaded-media contract.
- Uploaded Avatar URLs can be cached and rendered by static browser clients
  without signed-URL refresh handling, but object paths must stay opaque and
  mutation authority must remain owner-scoped.
- The `avatars` bucket and `uploaded/{uuid}.{ext}` object path convention are
  part of the first-slice storage contract.
- #63 stores original validated files. #64 stores browser-generated derived
  cropped PNG files as the active Uploaded Avatar object.
- ADR 0021 introduces the #64 derived cropped-image model while preserving the
  existing Avatar descriptor, bucket, and opaque object-path authority.
- Image moderation and abuse handling are not solved by #63 and must be
  revisited before Uploaded Avatars are used in public discovery surfaces.
- Replacing a live profile Avatar must not break completed-game history that
  snapshots an older Uploaded Avatar descriptor.
- Superseded Uploaded Avatar cleanup belongs with the avatar image gallery slice
  once no completed game, batch favourite, current profile, or other durable
  snapshot can render the old object.
- The default upload path is direct authenticated browser upload; adding a
  server-owned upload path requires a concrete policy limitation or other
  approved need.
- Opaque Storage object paths should be paired with owner-scoped Postgres
  metadata rather than encoding account identity into the path.
- Storage policy design must be part of the uploaded-avatar slice, not a later
  afterthought.
- Local and fake Storage tests are necessary but insufficient; hosted validation
  evidence must be recorded before claiming #63 complete.
- Exact Supabase Storage commands and API calls must be verified against current
  Supabase documentation during implementation.
