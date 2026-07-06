# 0025: Original Uploaded Avatars with Cover-Fit Rendering

## Status

Accepted. This decision supersedes ADR 0021 for current Uploaded Avatar
storage and rendering behaviour as of 2026-07-06.

## Context

ADR 0021 selected browser-generated derived cropped images for Uploaded
Avatars. That model shipped a crop editor, browser-side square PNG generation,
and saved metadata for the generated image rather than the source file.

The accepted product direction now removes the avatar image crop controls and
UI. Participants should choose a valid image, see it fill the Avatar frame, and
save it without positioning, zooming, or generating a derived crop.

## Decision

Crazy Phrases stores the original validated Uploaded Avatar file as the active
Avatar object. The app does not resize, crop, transcode, strip metadata, or
generate a derived image in the browser during the Profile save path.

Uploaded Avatar surfaces render the saved image with cover-fit presentation
inside the existing Avatar container. Circular Avatar framing remains a
presentation rule owned by CSS, not a persisted media transformation.

The uploaded object path uses the accepted opaque `uploaded/{uuid}.{extension}`
convention with the extension derived from the original content type. Ownership
metadata records the original validated file's content type, byte size, width,
and height.

Crop state is not part of the current Account Profile draft model. The app does
not mount crop editor DOM, crop-box markers, crop guide overlays, zoom controls,
reset-crop controls, or an avatar-crop helper asset.

Previously saved derived-crop Uploaded Avatar objects remain valid historical
Uploaded Avatar objects. They render through the same cover-fit Avatar surfaces;
the app does not try to reconstruct old crop state from them.

## Consequences

- The Profile save path no longer has a crop-generation failure mode.
- Local and hosted validation should assert original-file metadata and cover-fit
  rendering rather than 256 x 256 derived PNG output.
- Future work that reintroduces crop controls, server-side processing, metadata
  stripping, derivative generation, or transcoding needs a separate issue and
  ADR or an explicit amendment to this decision.
- Hosted dev or test validation is required when future changes alter Storage
  upload behaviour, Account Profile persistence, Supabase schema or policies,
  or production Uploaded Avatar write paths.
