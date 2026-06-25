import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  AVATAR_BUCKET_NAME,
  createLocalTestAvatarStorageRepository,
  createSupabaseAvatarStorageRepository,
  createUploadedAvatarObjectPath,
} from "../assets/avatar-storage.js";

describe("Avatar Storage repository", () => {
  it("creates opaque Uploaded Avatar object paths without account identity", () => {
    const objectPath = createUploadedAvatarObjectPath({
      contentType: "image/png",
      createObjectId: () => "00000000-0000-4000-8000-000000000063",
    });

    assert.equal(
      objectPath,
      "uploaded/00000000-0000-4000-8000-000000000063.png",
    );
    assert.equal(objectPath.includes("auth-account"), false);
    assert.equal(objectPath.includes("captain-spoon"), false);
  });

  it("stores local test uploads only after the upload step and can clean them up", async () => {
    const storage = createMemoryStorage();
    const repository = createLocalTestAvatarStorageRepository(storage);
    const objectPath = "uploaded/00000000-0000-4000-8000-000000000063.png";

    await repository.registerPendingUpload({
      accountId: "auth-account-1",
      byteSize: 7,
      contentType: "image/png",
      height: 128,
      objectPath,
      profileId: "profile-directory-1",
      width: 128,
    });

    assert.equal(await repository.getPublicUrl({ objectPath }), null);

    await repository.uploadAvatarObject({
      contentType: "image/png",
      file: new File(["avatar!"], "avatar.png", { type: "image/png" }),
      objectPath,
    });

    assert.match(
      await repository.getPublicUrl({ objectPath }),
      /^data:image\/png;base64,/,
    );

    await repository.cleanupPendingUpload({ objectPath });

    assert.equal(await repository.getPublicUrl({ objectPath }), null);
  });

  it("registers ownership metadata before direct Supabase Storage upload", async () => {
    const supabase = createFakeSupabase();
    const repository = createSupabaseAvatarStorageRepository({ supabase });
    const objectPath = "uploaded/00000000-0000-4000-8000-000000000063.webp";

    await repository.registerPendingUpload({
      accountId: "11111111-1111-4111-8111-111111111111",
      byteSize: 512,
      contentType: "image/webp",
      height: 256,
      objectPath,
      profileId: "22222222-2222-4222-8222-222222222222",
      width: 256,
    });
    await repository.uploadAvatarObject({
      contentType: "image/webp",
      file: new File(["avatar"], "avatar.webp", { type: "image/webp" }),
      objectPath,
    });

    assert.deepEqual(supabase.calls.slice(0, 2), [
      {
        table: "uploaded_avatar_objects",
        operation: "insert",
        row: {
          account_id: "11111111-1111-4111-8111-111111111111",
          bucket_id: AVATAR_BUCKET_NAME,
          byte_size: 512,
          content_type: "image/webp",
          height: 256,
          lifecycle_status: "pending",
          object_path: objectPath,
          profile_id: "22222222-2222-4222-8222-222222222222",
          width: 256,
        },
      },
      {
        bucket: AVATAR_BUCKET_NAME,
        operation: "upload",
        objectPath,
        options: {
          cacheControl: "31536000",
          contentType: "image/webp",
          upsert: false,
        },
      },
    ]);
    assert.equal(
      await repository.getPublicUrl({ objectPath }),
      `https://storage.example/${AVATAR_BUCKET_NAME}/${objectPath}`,
    );
  });

  it("cleans up Storage object bytes before deleting pending ownership metadata", async () => {
    const supabase = createFakeSupabase();
    const repository = createSupabaseAvatarStorageRepository({ supabase });
    const objectPath = "uploaded/00000000-0000-4000-8000-000000000063.jpg";

    await repository.cleanupPendingUpload({ objectPath });

    assert.deepEqual(supabase.calls, [
      {
        bucket: AVATAR_BUCKET_NAME,
        operation: "remove",
        objectPaths: [objectPath],
      },
      {
        table: "uploaded_avatar_objects",
        operation: "delete",
        filters: {
          bucket_id: AVATAR_BUCKET_NAME,
          lifecycle_status: "pending",
          object_path: objectPath,
        },
      },
    ]);
  });
});

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

function createFakeSupabase() {
  const calls = [];

  return {
    calls,
    from(table) {
      return new FakeSupabaseTableQuery({ calls, table });
    },
    storage: {
      from(bucket) {
        return {
          getPublicUrl(objectPath) {
            return {
              data: {
                publicUrl: `https://storage.example/${bucket}/${objectPath}`,
              },
            };
          },
          async remove(objectPaths) {
            calls.push({
              bucket,
              operation: "remove",
              objectPaths,
            });
            return { data: objectPaths, error: null };
          },
          async upload(objectPath, file, options) {
            calls.push({
              bucket,
              operation: "upload",
              objectPath,
              options,
            });
            assert.equal(file instanceof File, true);
            return { data: { path: objectPath }, error: null };
          },
        };
      },
    },
  };
}

class FakeSupabaseTableQuery {
  constructor({ calls, table }) {
    this.calls = calls;
    this.filters = {};
    this.table = table;
  }

  insert(row) {
    this.calls.push({
      table: this.table,
      operation: "insert",
      row,
    });
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  eq(column, value) {
    this.filters[column] = value;
    return this;
  }

  async maybeSingle() {
    return { data: null, error: null };
  }

  then(resolve) {
    if (this.operation === "delete") {
      this.calls.push({
        table: this.table,
        operation: "delete",
        filters: this.filters,
      });
    }

    return Promise.resolve({ data: null, error: null }).then(resolve);
  }
}
