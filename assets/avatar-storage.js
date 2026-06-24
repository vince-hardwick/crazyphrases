export const AVATAR_BUCKET_NAME = "avatars";

const UPLOADED_AVATAR_OBJECTS_TABLE = "uploaded_avatar_objects";
const LOCAL_TEST_UPLOADS_STORAGE_KEY =
  "crazyphrases.localTest.uploadedAvatars.v1";
const MIME_TYPE_EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export function createUploadedAvatarObjectPath({
  contentType,
  createObjectId = defaultCreateObjectId,
} = {}) {
  const extension = MIME_TYPE_EXTENSIONS.get(contentType);
  if (!extension) {
    throw new Error("Uploaded Avatar content type is not supported.");
  }

  return `uploaded/${createObjectId()}.${extension}`;
}

export function createLocalTestAvatarStorageRepository(
  storage,
  { failureMode = null } = {},
) {
  return {
    async cleanupPendingUpload({ objectPath }) {
      assertUploadedObjectPath(objectPath);
      if (failureMode === "cleanup-fails") {
        throw new Error("Avatar cleanup failed.");
      }

      const uploads = loadUploads(storage);
      delete uploads[objectPath];
      saveUploads(storage, uploads);
    },

    async getPublicUrl({ objectPath }) {
      assertUploadedObjectPath(objectPath);
      return loadUploads(storage)[objectPath]?.publicUrl ?? null;
    },

    async registerPendingUpload(metadata) {
      assertUploadMetadata(metadata);

      const uploads = loadUploads(storage);
      uploads[metadata.objectPath] = {
        metadata: {
          ...metadata,
          bucketId: AVATAR_BUCKET_NAME,
          lifecycleStatus: "pending",
        },
        publicUrl: null,
      };
      saveUploads(storage, uploads);
    },

    async uploadAvatarObject({ contentType, file, objectPath }) {
      assertUploadedObjectPath(objectPath);
      assertSupportedContentType(contentType);
      if (failureMode === "upload-fails") {
        throw new Error("Avatar upload failed.");
      }

      const uploads = loadUploads(storage);
      if (!uploads[objectPath]) {
        throw new Error("Uploaded Avatar ownership metadata is required.");
      }

      uploads[objectPath] = {
        ...uploads[objectPath],
        publicUrl: await fileToDataUrl(file, contentType),
      };
      saveUploads(storage, uploads);
    },
  };
}

export function createSupabaseAvatarStorageRepository({ supabase } = {}) {
  if (
    !supabase ||
    typeof supabase.from !== "function" ||
    typeof supabase.storage?.from !== "function"
  ) {
    throw new Error("A Supabase client with Storage is required.");
  }

  const bucket = supabase.storage.from(AVATAR_BUCKET_NAME);

  return {
    async cleanupPendingUpload({ objectPath }) {
      assertUploadedObjectPath(objectPath);

      const removeResponse = await bucket.remove([objectPath]);
      assertNoSupabaseError(removeResponse, "Could not remove Uploaded Avatar");

      const metadataResponse = await supabase
        .from(UPLOADED_AVATAR_OBJECTS_TABLE)
        .delete()
        .eq("bucket_id", AVATAR_BUCKET_NAME)
        .eq("object_path", objectPath)
        .eq("lifecycle_status", "pending");
      assertNoSupabaseError(
        metadataResponse,
        "Could not remove Uploaded Avatar metadata",
      );
    },

    async getPublicUrl({ objectPath }) {
      assertUploadedObjectPath(objectPath);
      const response = bucket.getPublicUrl(objectPath);
      return response?.data?.publicUrl ?? null;
    },

    async registerPendingUpload(metadata) {
      assertUploadMetadata(metadata);

      const response = await supabase.from(UPLOADED_AVATAR_OBJECTS_TABLE).insert({
        account_id: metadata.accountId,
        bucket_id: AVATAR_BUCKET_NAME,
        byte_size: metadata.byteSize,
        content_type: metadata.contentType,
        height: metadata.height,
        lifecycle_status: "pending",
        object_path: metadata.objectPath,
        profile_id: metadata.profileId,
        width: metadata.width,
      });
      assertNoSupabaseError(
        response,
        "Could not register Uploaded Avatar metadata",
      );
    },

    async uploadAvatarObject({ contentType, file, objectPath }) {
      assertUploadedObjectPath(objectPath);
      assertSupportedContentType(contentType);

      const response = await bucket.upload(objectPath, file, {
        cacheControl: "31536000",
        contentType,
        upsert: false,
      });
      assertNoSupabaseError(response, "Avatar could not be uploaded");
    },
  };
}

function assertUploadMetadata(metadata) {
  assertText(metadata?.accountId, "An Account id is required.");
  assertText(metadata?.profileId, "An Account Profile id is required.");
  assertUploadedObjectPath(metadata?.objectPath);
  assertSupportedContentType(metadata?.contentType);

  for (const [key, minimum, maximum] of [
    ["byteSize", 1, 1024 * 1024],
    ["width", 128, 1024],
    ["height", 128, 1024],
  ]) {
    const value = metadata[key];
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new Error("Uploaded Avatar metadata is outside accepted bounds.");
    }
  }
}

function assertUploadedObjectPath(objectPath) {
  if (
    !/^uploaded\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|jpeg|png|webp)$/i.test(
      String(objectPath ?? ""),
    )
  ) {
    throw new Error("A valid Uploaded Avatar object path is required.");
  }
}

function assertSupportedContentType(contentType) {
  if (!MIME_TYPE_EXTENSIONS.has(contentType)) {
    throw new Error("Uploaded Avatar content type is not supported.");
  }
}

function assertText(value, message) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(message);
  }
}

function loadUploads(storage) {
  try {
    const parsed = JSON.parse(
      storage?.getItem(LOCAL_TEST_UPLOADS_STORAGE_KEY) ?? "{}",
    );
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function saveUploads(storage, uploads) {
  storage?.setItem(LOCAL_TEST_UPLOADS_STORAGE_KEY, JSON.stringify(uploads));
}

async function fileToDataUrl(file, contentType) {
  if (typeof FileReader === "function") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(String(reader.result)));
      reader.addEventListener("error", () => reject(reader.error));
      reader.readAsDataURL(file);
    });
  }

  const buffer = await file.arrayBuffer();
  const base64 =
    typeof Buffer === "function"
      ? Buffer.from(buffer).toString("base64")
      : arrayBufferToBase64(buffer);
  return `data:${contentType};base64,${base64}`;
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary);
}

function assertNoSupabaseError(response, message) {
  if (response?.error) {
    const detail =
      typeof response.error.message === "string"
        ? response.error.message
        : "Supabase request failed.";
    throw new Error(`${message}: ${detail}`);
  }
}

function defaultCreateObjectId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
    return [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10, 16).join(""),
    ].join("-");
  }

  throw new Error("A browser UUID generator is required.");
}
