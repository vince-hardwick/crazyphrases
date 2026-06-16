import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createMemoryAccountProfileRepository,
  createSupabaseAccountProfileRepository,
} from "../assets/account-profile.js";

describe("Account Profile repository", () => {
  it("creates and looks up durable profiles without exposing Auth identity", async () => {
    const repository = createMemoryAccountProfileRepository({
      createProfileId: () => "profile-directory-1",
    });

    const profile = await repository.ensureOwnProfile({
      accountId: "auth-account-1",
    });
    const duplicate = await repository.ensureOwnProfile({
      accountId: "auth-account-1",
    });
    const lookup = await repository.lookupProfileByHandle({
      handle: profile.handle.toUpperCase(),
    });

    assert.deepEqual(duplicate, profile);
    assert.deepEqual(lookup, {
      profileId: "profile-directory-1",
      handle: profile.handle,
      gamerName: "Player",
      avatarKey: profile.avatarKey,
    });
    assert.equal("accountId" in lookup, false);
    assert.equal(JSON.stringify(lookup).includes("auth-account-1"), false);
  });

  it("creates and looks up durable profiles through Supabase rows", async () => {
    const supabase = createFakeAccountProfilesSupabase();
    const repository = createSupabaseAccountProfileRepository({
      createProfileId: () => "profile-directory-2",
      supabase,
    });

    const profile = await repository.ensureOwnProfile({
      accountId: "auth-account-2",
    });
    const duplicate = await repository.ensureOwnProfile({
      accountId: "auth-account-2",
    });
    const lookup = await repository.lookupProfileByHandle({
      handle: profile.handle.toUpperCase(),
    });

    assert.deepEqual(duplicate, profile);
    assert.deepEqual(lookup, {
      profileId: "profile-directory-2",
      handle: profile.handle,
      gamerName: "Player",
      avatarKey: profile.avatarKey,
    });
    assert.equal("accountId" in lookup, false);
    assert.equal(JSON.stringify(lookup).includes("auth-account-2"), false);
  });

  it("looks up Supabase profiles through an invite-safe directory surface", async () => {
    const supabase = createFakeAccountProfilesSupabase({
      rejectRawHandleLookup: true,
    });
    const repository = createSupabaseAccountProfileRepository({
      createProfileId: () => "profile-directory-3",
      supabase,
    });

    const profile = await repository.ensureOwnProfile({
      accountId: "auth-account-3",
    });
    const lookup = await repository.lookupProfileByHandle({
      handle: profile.handle,
    });

    assert.deepEqual(lookup, {
      profileId: "profile-directory-3",
      handle: profile.handle,
      gamerName: "Player",
      avatarKey: profile.avatarKey,
    });
    assert.deepEqual(supabase.tableCalls.slice(-1), ["account_profile_directory"]);
  });

  for (const [repositoryName, createRepository] of [
    [
      "memory",
      () =>
        createMemoryAccountProfileRepository({
          createProfileId: createProfileIdSequence("memory-profile"),
        }),
    ],
    [
      "supabase",
      () =>
        createSupabaseAccountProfileRepository({
          createProfileId: createProfileIdSequence("supabase-profile"),
          supabase: createFakeAccountProfilesSupabase(),
        }),
    ],
  ]) {
    it(`updates ${repositoryName} profiles while keeping Handles globally unique`, async () => {
      const repository = createRepository();
      const first = await repository.ensureOwnProfile({
        accountId: `${repositoryName}-account-1`,
      });
      await repository.ensureOwnProfile({
        accountId: `${repositoryName}-account-2`,
      });

      const updated = await repository.updateOwnProfile({
        accountId: `${repositoryName}-account-1`,
        profile: {
          handle: "Captain Spoon",
          gamerName: "Captain Spoon",
          avatarKey: "moon",
        },
      });

      assert.deepEqual(updated, {
        profileId: first.profileId,
        handle: "captain-spoon",
        gamerName: "Captain Spoon",
        avatarKey: "moon",
      });
      assert.equal(await repository.lookupProfileByHandle({ handle: first.handle }), null);
      assert.deepEqual(
        await repository.lookupProfileByHandle({ handle: "CAPTAIN SPOON" }),
        updated,
      );
      await assert.rejects(
        () =>
          repository.updateOwnProfile({
            accountId: `${repositoryName}-account-2`,
            profile: {
              handle: "captain-spoon",
              gamerName: "Imposter Spoon",
              avatarKey: "star",
            },
          }),
        /handle/i,
      );
    });
  }

  it("wires hosted auth to the Supabase Account Profile repository", () => {
    const appSource = readFileSync(
      new URL("../assets/app.js", import.meta.url),
      "utf8",
    );

    assert.match(appSource, /createSupabaseAccountProfileRepository/);
    assert.match(
      appSource,
      /profileRepository: createSupabaseAccountProfileRepository\(\{ supabase \}\)/,
    );
  });
});

function createProfileIdSequence(prefix) {
  let nextId = 1;

  return () => `${prefix}-${nextId++}`;
}

function createFakeAccountProfilesSupabase({
  rejectRawHandleLookup = false,
} = {}) {
  const rows = [];

  return {
    tableCalls: [],
    from(tableName) {
      assert.ok(
        ["account_profiles", "account_profile_directory"].includes(tableName),
      );
      this.tableCalls.push(tableName);
      return new FakeAccountProfilesQuery(rows, {
        rejectRawHandleLookup,
        tableName,
      });
    },
  };
}

class FakeAccountProfilesQuery {
  constructor(rows, { rejectRawHandleLookup, tableName }) {
    this.rows = rows;
    this.filters = {};
    this.operation = "select";
    this.insertedRow = null;
    this.rejectRawHandleLookup = rejectRawHandleLookup;
    this.tableName = tableName;
  }

  insert(row) {
    this.operation = "insert";
    this.insertedRow = row;
    return this;
  }

  update(row) {
    this.operation = "update";
    this.updatedRow = row;
    return this;
  }

  select() {
    return this;
  }

  eq(column, value) {
    this.filters[column] = value;
    return this;
  }

  async maybeSingle() {
    if (
      this.rejectRawHandleLookup &&
      this.tableName === "account_profiles" &&
      this.operation === "select" &&
      Object.hasOwn(this.filters, "handle")
    ) {
      return {
        data: null,
        error: {
          message: "raw Account Profile table is not a directory lookup surface",
        },
      };
    }

    if (this.operation === "insert") {
      if (
        this.rows.some(
          (row) =>
            row.account_id === this.insertedRow.account_id ||
            row.handle === this.insertedRow.handle,
        )
      ) {
        return {
          data: null,
          error: {
            code: "23505",
            message: "duplicate account profile",
          },
        };
      }

      const row = {
        created_at: "2026-06-16T10:00:00.000Z",
        updated_at: "2026-06-16T10:00:00.000Z",
        ...this.insertedRow,
      };
      this.rows.push(row);
      return {
        data: row,
        error: null,
      };
    }

    if (this.operation === "update") {
      const existing = this.#matchingRows()[0] ?? null;

      if (!existing) {
        return {
          data: null,
          error: null,
        };
      }

      if (
        this.updatedRow.handle &&
        this.rows.some(
          (row) =>
            row !== existing &&
            row.handle === this.updatedRow.handle,
        )
      ) {
        return {
          data: null,
          error: {
            code: "23505",
            message: "duplicate handle",
          },
        };
      }

      Object.assign(existing, this.updatedRow, {
        updated_at: "2026-06-16T10:05:00.000Z",
      });

      return {
        data: existing,
        error: null,
      };
    }

    return {
      data: this.#matchingRows()[0] ?? null,
      error: null,
    };
  }

  #matchingRows() {
    return this.rows.filter((row) =>
      Object.entries(this.filters).every(([column, value]) => row[column] === value),
    );
  }
}
