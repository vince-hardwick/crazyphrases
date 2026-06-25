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

    const normalisedCrop = normaliseAvatarCrop(crop);
    const baseScale = Math.max(
      outputSize / source.width,
      outputSize / source.height,
    );
    const scale = baseScale * normalisedCrop.scale;
    const drawWidth = source.width * scale;
    const drawHeight = source.height * scale;
    const maxOffsetX = Math.max(0, (drawWidth - outputSize) / 2);
    const maxOffsetY = Math.max(0, (drawHeight - outputSize) / 2);
    const drawX =
      (outputSize - drawWidth) / 2 + (normalisedCrop.x / 100) * maxOffsetX;
    const drawY =
      (outputSize - drawHeight) / 2 + (normalisedCrop.y / 100) * maxOffsetY;

    context.drawImage(source.image, drawX, drawY, drawWidth, drawHeight);
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
