export const AVATAR_CROP_OUTPUT_SIZE = 256;
export const DEFAULT_AVATAR_CROP = Object.freeze({
  scale: 1,
  x: 0,
  y: 0,
});

export async function createDerivedAvatarFile({
  crop = DEFAULT_AVATAR_CROP,
  file,
  outputSize = AVATAR_CROP_OUTPUT_SIZE,
} = {}) {
  const source = await loadAvatarCropSource(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas unavailable.");
    }

    const layout = calculateAvatarCropLayout({
      crop,
      cropBoxSize: outputSize,
      sourceHeight: source.height,
      sourceWidth: source.width,
    });

    context.drawImage(source.image, layout.x, layout.y, layout.width, layout.height);
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
    if (!blob) {
      throw new Error("Canvas export failed.");
    }

    return new File([blob], "avatar-crop.png", { type: "image/png" });
  } finally {
    source.close();
  }
}

export function normaliseAvatarCrop(crop = {}) {
  return {
    scale: clampNumber(crop.scale, 1, 3, DEFAULT_AVATAR_CROP.scale),
    x: clampNumber(crop.x, -100, 100, DEFAULT_AVATAR_CROP.x),
    y: clampNumber(crop.y, -100, 100, DEFAULT_AVATAR_CROP.y),
  };
}

export function calculateAvatarCropLayout({
  crop = DEFAULT_AVATAR_CROP,
  cropBoxSize = AVATAR_CROP_OUTPUT_SIZE,
  sourceHeight,
  sourceWidth,
} = {}) {
  const normalisedCrop = normaliseAvatarCrop(crop);
  const baseScale = Math.max(cropBoxSize / sourceWidth, cropBoxSize / sourceHeight);
  const width = sourceWidth * baseScale * normalisedCrop.scale;
  const height = sourceHeight * baseScale * normalisedCrop.scale;
  const maxOffsetX = Math.max(0, (width - cropBoxSize) / 2);
  const maxOffsetY = Math.max(0, (height - cropBoxSize) / 2);

  return {
    height,
    width,
    x: (cropBoxSize - width) / 2 + (normalisedCrop.x / 100) * maxOffsetX,
    y: (cropBoxSize - height) / 2 + (normalisedCrop.y / 100) * maxOffsetY,
  };
}

export function adjustAvatarCrop(
  crop = DEFAULT_AVATAR_CROP,
  { scaleDelta = 0, xDelta = 0, yDelta = 0 } = {},
) {
  const normalisedCrop = normaliseAvatarCrop(crop);
  return normaliseAvatarCrop({
    scale: normalisedCrop.scale + scaleDelta,
    x: normalisedCrop.x + xDelta,
    y: normalisedCrop.y + yDelta,
  });
}

function clampNumber(value, min, max, fallback) {
  return Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

async function loadAvatarCropSource(file) {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      close() {
        bitmap.close?.();
      },
      height: bitmap.height,
      image: bitmap,
      width: bitmap.width,
    };
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", reject, { once: true });
      image.src = objectUrl;
    });

    return {
      close() {
        URL.revokeObjectURL(objectUrl);
      },
      height: image.naturalHeight,
      image,
      width: image.naturalWidth,
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}
