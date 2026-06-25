# 0021: Derived Cropped Images for Uploaded Avatars

## Status

Accepted. The owner selected the derived cropped image model for circular
Uploaded Avatar cropping on 2026-06-25. GitHub issue #64 was implemented through
PR #78 and promoted through production on 2026-06-25. The post-MVP visual
cropper UX follow-up is tracked by GitHub issue #79.

## Context

Uploaded Avatar support was shipped in #63 with direct browser uploads of the
validated original image file. That slice intentionally deferred circular mask
cropping, crop positioning, crop metadata, and derived cropped-image generation
to #64.

The #64 crop model needed to choose between three plausible storage contracts:

- save crop metadata beside the original image and apply the crop at render
  time;
- save a derived cropped image and make that derived object the active Avatar;
- save both the original image and a derived cropped image.

The choice affects the Account Profile Avatar descriptor, completed-game
participant snapshots, Storage lifecycle, cache behaviour, privacy posture,
cleanup, and future image-processing authority.

## Decision

Crazy Phrases saves a browser-generated derived cropped image for #64.

The selected source file is used for local validation, crop preview, and
browser-side image generation only. The #64 implementation does not upload or
retain the uncropped original source file as a live Avatar object.

The saved Uploaded Avatar object should be a fixed square raster image that
encodes the selected crop. The default target is a 256 x 256 PNG generated in
the browser. The object should use the existing public-read `avatars` bucket,
the existing opaque `uploaded/{uuid}.png` path convention, the existing owner
metadata table, and the existing Account Profile Avatar descriptor shape.

Circular display remains a presentation rule. The persisted object is the
normalised square crop; Avatar surfaces render it inside the circular Avatar
frame.

The #64 slice does not persist crop coordinates as rendering authority. Crop
position and scale may exist as draft UI state while the participant is editing,
but save/reload correctness comes from the derived image bytes. Reopening the
Profile editor after reload should show the saved derived image, not attempt to
reconstruct the old crop controls from stored coordinates.

Replacing the live Uploaded Avatar continues to use the existing lifecycle
model: the newly derived object becomes live when the Account Profile saves,
and the previous live object becomes historical rather than being deleted.
Completed-game participant snapshots continue to preserve the Avatar descriptor
object path used at play time.

The MVP #64 crop UI uses labelled numeric controls for scale, horizontal
position, and vertical position. A visual avatar cropper can replace that editor
later without changing this storage authority decision; the preferred post-MVP
interaction is an inline Profile-panel editor with a fixed square crop box,
drag-to-reposition image movement, explicit zoom controls, edge and corner
crop-box markers, and a crop guide overlay with a rule-of-thirds grid and centre
guides. The crop box should remain fully covered by image pixels; the editor
should clamp zoom and panning so blank or transparent space cannot be saved into
the derived Avatar.

If future work needs to retain originals, store crop metadata, regenerate
derivatives server-side, strip metadata through a formal media pipeline, or
transcode on the server, that work needs a separate issue and ADR or an explicit
amendment to this decision.

## Consequences

- The #64 implementation did not need new Account Profile descriptor columns
  because the derived image uses the existing Uploaded Avatar object path
  contract.
- The Storage row for a cropped Avatar records metadata about the derived image,
  not the original selected file.
- Browser crop generation failure is part of the save path and must not upload
  partial or original media or falsely report profile-save success.
- The existing direct authenticated browser upload path remains acceptable for
  derived-crop work as long as generated derived objects still satisfy the
  bucket, path, content type, byte-size, and dimension constraints.
- Tests should focus on the externally visible behaviour: circular crop preview,
  save, reload, Built-in Avatar restore, failure states, anonymous-mode DOM
  cleanup, and hosted dev/test Storage verification when implementation changes
  touch live Storage behaviour.
- Post-MVP crop-editor UX work should preserve the derived-image storage
  contract unless a future ADR explicitly changes it.
