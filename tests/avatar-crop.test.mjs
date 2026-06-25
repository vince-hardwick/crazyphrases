import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_AVATAR_CROP,
  adjustAvatarCrop,
  calculateAvatarCropLayout,
} from "../assets/avatar-crop.js";

describe("Avatar crop geometry", () => {
  it("lays out a new landscape image as centre-cover at minimum zoom", () => {
    assert.deepEqual(
      calculateAvatarCropLayout({
        crop: DEFAULT_AVATAR_CROP,
        cropBoxSize: 180,
        sourceHeight: 180,
        sourceWidth: 300,
      }),
      {
        height: 180,
        width: 300,
        x: -60,
        y: 0,
      },
    );
  });

  it("adjusts draft crop state while clamping pan and zoom to supported bounds", () => {
    assert.deepEqual(
      adjustAvatarCrop(
        {
          scale: 2.9,
          x: 95,
          y: -95,
        },
        {
          scaleDelta: 0.3,
          xDelta: 10,
          yDelta: -10,
        },
      ),
      {
        scale: 3,
        x: 100,
        y: -100,
      },
    );
  });
});
