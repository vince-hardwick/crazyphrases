# PRD: Circular Crop for Uploaded Avatars

Status: Published PRD provenance. Implemented through GitHub issue #64 and PR
#78, promoted through production on 2026-06-25. Post-MVP visual cropper UX was
implemented through GitHub issue #79 and PR #92, then promoted through
production on 2026-06-25.
Date: 2026-06-25
Issue: https://github.com/vince-hardwick/crazyphrases/issues/64

## Problem Statement

Signed-in participants can now upload an Account Profile Uploaded Avatar, but
they cannot control how the image appears inside the Avatar frame. The current
default fit can crop important parts of the image, produce inconsistent Avatar
composition, and make the new personalisation feature feel unfinished.

Crazy Phrases needs a focused circular crop experience that lets a participant
position an uploaded image for game-facing Avatar display, then saves the result
in a way that remains stable across reloads, participant snapshots, completed
game history, and future profile rendering.

## Solution

Add circular mask cropping to the signed-in Profile editor for Uploaded
Avatars. After a participant selects a valid JPEG, PNG, or WebP image, the
Profile editor shows a circular preview and lets the participant adjust the
image position and scale inside the Avatar frame before saving.

Crazy Phrases should save a derived cropped image, not crop metadata as the
rendering authority. On Save profile, the browser generates a fixed square
derived image from the selected crop, uploads that derived image to the existing
Avatar Storage contract, and saves the Account Profile Avatar descriptor so it
points at the derived object. Reloading the Profile editor restores the saved
derived image directly.

Built-in Avatars keep their current behaviour. Anonymous visitors continue to
receive no Uploaded Avatar controls, cropper DOM, upload event wiring, or
Storage upload path.

## User Stories

1. As a signed-in participant, I want to choose an Uploaded Avatar image and see
   it in a circular preview, so that I understand how it will appear in games.
2. As a signed-in participant, I want to move the selected image horizontally
   inside the circular frame, so that I can centre the part of the image that
   matters.
3. As a signed-in participant, I want to move the selected image vertically
   inside the circular frame, so that faces or meaningful details are not cut
   off.
4. As a signed-in participant, I want to zoom the selected image within safe
   bounds, so that the circular Avatar frame is filled without empty edges.
5. As a signed-in participant, I want the crop controls to work on a phone, so
   that I can set my Avatar without using a desktop browser.
6. As a keyboard user, I want crop position and scale controls I can focus and
   operate, so that I do not need pointer dragging to crop my Avatar.
7. As a screen-reader user, I want labelled crop controls and a meaningful
   preview description, so that the cropper is understandable where practical.
8. As a signed-in participant, I want Save profile to upload only after I have
   chosen the crop, so that previewing or adjusting an image does not mutate
   hosted Storage.
9. As a signed-in participant, I want the saved Avatar to match the crop I
   previewed, so that save behaviour feels trustworthy.
10. As a signed-in participant, I want the cropped Avatar to survive reload, so
    that my profile does not revert to the uncropped image.
11. As a signed-in participant, I want the cropped Avatar to remain active when
    I sign out and sign back in, so that account-backed profile state remains
    durable.
12. As a signed-in participant, I want upload, crop-generation, and profile-save
    failures to show clear messages, so that I know whether my previous Avatar
    is still active.
13. As a signed-in participant, I want a failed crop or upload to leave my
    previous Avatar unchanged, so that a broken save does not corrupt my
    profile.
14. As a signed-in participant, I want switching back to a Built-in Avatar to
    remove the Uploaded Avatar preview from the live Profile editor, so that the
    active Avatar state is unambiguous.
15. As a participant who uses only Built-in Avatars, I want the cropper to stay
    out of the way, so that existing Avatar selection remains simple.
16. As an anonymous visitor, I want no hidden cropper, upload input, or Storage
    upload wiring in the DOM, so that signed-in-only media controls are not
    mounted outside Account-backed mode.
17. As a future game-history viewer, I want completed games to keep rendering
    the Avatar descriptor captured at play time, so that later profile changes
    do not rewrite history.
18. As a maintainer, I want the active Uploaded Avatar descriptor to point at
    the derived cropped image, so that rendering does not need crop metadata.
19. As a maintainer, I want the original selected file to remain local to the
    crop interaction, so that #64 does not introduce original-media retention
    or a second media lifecycle.
20. As a maintainer, I want derived Avatar object paths to remain opaque, so
    that Storage paths do not encode account ids, Handles, Gamer Names, or email
    addresses.
21. As a maintainer, I want cropper tests at the same user-flow level as the
    existing Uploaded Avatar smoke, so that implementation details can change
    without weakening coverage.
22. As a maintainer, I want hosted dev/test validation before promotion when
    Storage behaviour changes, so that the real bucket, policies, and
    descriptor persistence are verified before production.

## Implementation Decisions

- The crop model is derived-image authority. The active Uploaded Avatar is the
  generated cropped image object, not the original selected file plus persisted
  crop metadata.
- The original selected file is local draft input for validation, preview, and
  browser-side crop generation only. It should not be uploaded or retained as a
  live Avatar object in this slice.
- The derived object should be a fixed square PNG, with a 256 x 256 target
  unless implementation evidence shows an existing project constant should own
  that size.
- The derived object should use the existing Avatar Storage bucket, existing
  opaque Uploaded Avatar object path shape, existing ownership metadata, and
  existing Account Profile Avatar descriptor.
- Circular display remains a rendering rule. The saved object is a normalised
  square crop, and Avatar surfaces render it inside the circular frame.
- Crop position and scale may exist as draft UI state only. Save/reload
  behaviour must not depend on reconstructing crop metadata after reload.
- The signed-in Profile editor is the only UI surface in scope. The cropper
  appears only after a valid Uploaded Avatar file has been selected.
- The Profile editor should provide accessible, labelled controls for scale and
  position. Pointer dragging can be added, but keyboard-operable controls are
  required for the implementation to be complete.
- The cropper must keep the selected image covering the circular frame. It must
  prevent saved crops with blank edges inside the Avatar circle.
- Save profile should generate the derived image before registering/uploading
  the Storage object. If crop generation fails, no Storage upload should occur.
- If upload succeeds but profile save fails, the existing previous-Avatar safety
  rule still applies: the previous Avatar remains active, the UI reports
  failure, and cleanup of the new pending object is best-effort.
- The Account Profile, Handle Directory, Pending Game participant snapshot, and
  Started Game participant snapshot contracts continue to carry the Uploaded
  Avatar descriptor, not raw Storage ownership metadata.
- No public profile pages, friends UI, leaderboard identity, moderation surface,
  safety scanning, original-image retention, historical-avatar garbage
  collection, account-deletion media-retention rule, or server-side media
  pipeline is included in this slice.

## Testing Decisions

- The highest-value test seam is the signed-in Profile editor user flow:
  select a valid image, adjust crop controls, preview the circular crop, Save
  profile, reload, verify the saved derived image renders, switch back to a
  Built-in Avatar, and verify the Uploaded Avatar preview is gone.
- Tests should assert external behaviour rather than internal cropper
  implementation. They should not depend on private helper names, pixel math
  internals, or DOM structure beyond stable user-facing controls and existing
  data attributes used for smoke coverage.
- Browser smoke coverage should include mobile viewport overflow checks for the
  crop UI.
- Browser smoke coverage should include anonymous-mode DOM cleanup, confirming
  that cropper controls, upload controls, and preview nodes are absent when the
  Account Profile surface is unmounted.
- Browser smoke coverage should include failure paths for invalid input,
  crop-generation failure where practical, upload failure, and profile-save
  failure after upload.
- Storage repository tests should cover the derived object contract: generated
  PNG content type, fixed square dimensions, byte-size metadata, opaque object
  path, pending registration before upload, and best-effort cleanup order.
- Account Profile repository tests should continue to prove that Uploaded
  Avatar descriptors persist without exposing account identity.
- Migration-surface tests are required only if implementation changes schema,
  grants, policies, functions, constraints, bucket configuration, or object path
  validation. If the existing schema is sufficient, tests should document that
  #64 reuses the existing Storage authority.
- Hosted dev/test validation is required before merge or promotion if the
  implementation changes direct browser upload behaviour or Storage metadata.
  Production Uploaded Avatar write smoke remains separately approval-gated.

## Out of Scope

- Persisting crop metadata as rendering authority.
- Uploading or retaining the uncropped original selected file.
- Saving both an original and a derived cropped object.
- Server-side image processing, Edge Functions, worker pipelines, metadata
  stripping, transcoding, or derivative regeneration.
- Image-content moderation, automated safety scanning, human review queues,
  report queues, or public-discovery safety workflows.
- Public profile pages, friend cards, leaderboards, public discovery identity,
  or broader account-settings redesign.
- Historical Uploaded Avatar garbage collection.
- Account Deletion media-retention rules.
- Production uploaded-avatar write smoke without separate explicit approval.

## Further Notes

The owner confirmed on 2026-06-25 that Crazy Phrases should save a derived
cropped image for #64.

The #64 MVP shipped with labelled numerical controls for scale, horizontal
position, and vertical position. The owner accepted that implementation for MVP
after manual file upload and crop-control testing, while deferring a visual
avatar cropper to #79. The preferred post-MVP interaction uses a crop box with
edge and corner crop handles, plus a crop guide overlay with a rule-of-thirds
grid and centre guides.

This PRD depends on the shipped #63 Uploaded Avatar infrastructure and the
accepted ADRs for Uploaded Avatar Storage authority and Built-in Avatar visuals.
Current authority for future changes lives in `docs/product-rules.md`, ADRs
0019 and 0021, `docs/backlog.md`, and the issue tracker.
