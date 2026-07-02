import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createMemoryAccountProfileRepository,
  createSupabaseAccountProfileRepository,
} from "../assets/account-profile.js";

describe("Account Profile repository", () => {
  it("resolves one lookup key input by known email or Gamer Tag without exposing email", async () => {
    const repository = createMemoryAccountProfileRepository({
      initialProfiles: [
        {
          accountId: "auth-account-private-lookup",
          emailLookupKey: "Captain.Spoon@Example.test",
          gamerTag: "Captain Spoon",
          avatarKey: "dragon",
          profileId: "profile-private-lookup-1",
        },
      ],
    });

    const expectedProfile = {
      profileId: "profile-private-lookup-1",
      gamerTag: "Captain Spoon",
      avatar: {
        type: "built-in",
        key: "dragon",
      },
      avatarKey: "dragon",
    };

    const byEmail = await repository.lookupProfileByLookupKey({
      lookupKey: " captain.spoon@example.test ",
    });
    const byGamerTag = await repository.lookupProfileByLookupKey({
      lookupKey: "Captain Spoon",
    });

    assert.deepEqual(byEmail, {
      status: "found",
      lookupKind: "email",
      profile: expectedProfile,
    });
    assert.deepEqual(byGamerTag, {
      status: "found",
      lookupKind: "gamer-tag",
      profile: expectedProfile,
    });
    assert.equal(JSON.stringify(byEmail).includes("captain.spoon@example.test"), false);
    assert.equal(JSON.stringify(byGamerTag).includes("captain.spoon@example.test"), false);
    assert.equal("emailLookupKey" in byEmail.profile, false);
    assert.equal("accountId" in byEmail.profile, false);
  });

  it("returns lookup-specific miss copy for one lookup key input", async () => {
    const repository = createMemoryAccountProfileRepository();

    assert.deepEqual(
      await repository.lookupProfileByLookupKey({
        lookupKey: "missing@example.test",
      }),
      {
        status: "not-found",
        lookupKind: "email",
        message: "No gamer found under that email address",
      },
    );
    assert.deepEqual(
      await repository.lookupProfileByLookupKey({
        lookupKey: "Missing Gamer",
      }),
      {
        status: "not-found",
        lookupKind: "gamer-tag",
        message: "No gamer found under that gamer tag.",
      },
    );
  });

  it("stores the Auth email as a private lookup key when creating a profile", async () => {
    const repository = createMemoryAccountProfileRepository({
      createProfileId: () => "profile-private-lookup-3",
    });

    const profile = await repository.ensureOwnProfile({
      accountId: "auth-account-private-lookup-create",
      email: " Created.Player@Example.test ",
    });
    const lookup = await repository.lookupProfileByLookupKey({
      lookupKey: "created.player@example.test",
    });

    assert.deepEqual(lookup, {
      status: "found",
      lookupKind: "email",
      profile: {
        profileId: "profile-private-lookup-3",
        gamerTag: "Player",
        avatar: profile.avatar,
        avatarKey: profile.avatarKey,
      },
    });
    assert.equal(JSON.stringify(profile).includes("created.player@example.test"), false);
    assert.equal(JSON.stringify(lookup).includes("created.player@example.test"), false);
  });

  it("creates durable profiles with Gamer Tag identity without exposing Auth identity", async () => {
    const repository = createMemoryAccountProfileRepository({
      createProfileId: () => "profile-directory-1",
    });

    const profile = await repository.ensureOwnProfile({
      accountId: "auth-account-1",
    });
    const duplicate = await repository.ensureOwnProfile({
      accountId: "auth-account-1",
    });

    assert.deepEqual(duplicate, profile);
    assert.deepEqual(profile, {
      profileId: "profile-directory-1",
      gamerTag: "Player",
      avatar: {
        type: "built-in",
        key: profile.avatarKey,
      },
      avatarKey: profile.avatarKey,
    });
    assert.equal("accountId" in profile, false);
    assert.equal("handle" in profile, false);
    assert.equal("gamerName" in profile, false);
    assert.equal("lookupProfileByHandle" in repository, false);
    assert.equal(JSON.stringify(profile).includes("auth-account-1"), false);
  });

  it("creates durable profiles through Supabase rows with Gamer Tag identity", async () => {
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

    assert.deepEqual(duplicate, profile);
    assert.deepEqual(profile, {
      profileId: "profile-directory-2",
      gamerTag: "Player",
      avatar: {
        type: "built-in",
        key: profile.avatarKey,
      },
      avatarKey: profile.avatarKey,
    });
    assert.equal("accountId" in profile, false);
    assert.equal("handle" in profile, false);
    assert.equal("gamerName" in profile, false);
    assert.equal("lookupProfileByHandle" in repository, false);
    assert.equal(JSON.stringify(profile).includes("auth-account-2"), false);
  });

  it("does not transmit private email lookup or legacy identity columns from the browser", async () => {
    const supabase = createFakeAccountProfilesSupabase();
    const repository = createSupabaseAccountProfileRepository({
      createProfileId: () => "profile-private-lookup-4",
      supabase,
    });

    const profile = await repository.ensureOwnProfile({
      accountId: "auth-account-private-lookup-hosted",
      email: " Hosted.Player@Example.test ",
    });

    assert.deepEqual(supabase.insertCalls, [
      {
        tableName: "account_profiles",
        row: {
          account_id: "auth-account-private-lookup-hosted",
          avatar_object_path: null,
          avatar_key: profile.avatarKey,
          avatar_type: "built-in",
          gamer_tag: "Player",
          profile_id: "profile-private-lookup-4",
        },
      },
    ]);
    assert.equal("email_lookup_key" in supabase.insertCalls[0].row, false);
    assert.equal("handle" in supabase.insertCalls[0].row, false);
    assert.equal("gamer_name" in supabase.insertCalls[0].row, false);
    assert.equal(JSON.stringify(profile).includes("hosted.player@example.test"), false);
  });

  it("does not expose the obsolete public directory lookup surface", async () => {
    const supabase = createFakeAccountProfilesSupabase();
    const repository = createSupabaseAccountProfileRepository({
      createProfileId: () => "profile-directory-3",
      supabase,
    });

    const profile = await repository.ensureOwnProfile({
      accountId: "auth-account-3",
    });

    assert.deepEqual(profile, {
      profileId: "profile-directory-3",
      gamerTag: "Player",
      avatar: {
        type: "built-in",
        key: profile.avatarKey,
      },
      avatarKey: profile.avatarKey,
    });
    assert.equal("lookupProfileByHandle" in repository, false);
    assert.equal(supabase.tableCalls.includes("account_profile_directory"), false);
  });

  it("resolves Supabase lookup keys through a private lookup resolver", async () => {
    const supabase = createFakeAccountProfilesSupabase({
      lookupProfiles: [
        {
          emailLookupKey: "captain.spoon@example.test",
          gamerTag: "Captain Spoon",
          avatarKey: "dragon",
          profileId: "profile-private-lookup-2",
        },
      ],
    });
    const repository = createSupabaseAccountProfileRepository({
      supabase,
    });
    const expectedProfile = {
      profileId: "profile-private-lookup-2",
      gamerTag: "Captain Spoon",
      avatar: {
        type: "built-in",
        key: "dragon",
      },
      avatarKey: "dragon",
    };

    const byEmail = await repository.lookupProfileByLookupKey({
      lookupKey: " Captain.Spoon@Example.test ",
    });
    const byGamerTag = await repository.lookupProfileByLookupKey({
      lookupKey: "CAPTAIN SPOON",
    });

    assert.deepEqual(byEmail, {
      status: "found",
      lookupKind: "email",
      profile: expectedProfile,
    });
    assert.deepEqual(byGamerTag, {
      status: "found",
      lookupKind: "gamer-tag",
      profile: expectedProfile,
    });
    assert.deepEqual(supabase.rpcCalls, [
      {
        functionName: "lookup_account_profile",
        params: {
          lookup_key: "captain.spoon@example.test",
          lookup_kind: "email",
        },
      },
      {
        functionName: "lookup_account_profile",
        params: {
          lookup_key: "captain spoon",
          lookup_kind: "gamer-tag",
        },
      },
    ]);
    assert.equal(JSON.stringify(byEmail).includes("captain.spoon@example.test"), false);
    assert.deepEqual(supabase.tableCalls, []);
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
    it(`updates ${repositoryName} profiles while keeping Gamer Tags globally unique`, async () => {
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
          gamerTag: "Captain Spoon",
          avatarKey: "moon",
        },
      });

      assert.deepEqual(updated, {
        profileId: first.profileId,
        gamerTag: "Captain Spoon",
        avatar: {
          type: "built-in",
          key: "yin-yang",
        },
        avatarKey: "yin-yang",
      });
      assert.equal("handle" in updated, false);
      assert.equal("gamerName" in updated, false);
      await assert.rejects(
        () =>
          repository.updateOwnProfile({
            accountId: `${repositoryName}-account-2`,
            profile: {
              gamerTag: "Captain Spoon",
              avatarKey: "star",
            },
          }),
        /gamer tag/i,
      );
    });

    it(`persists Uploaded Avatar descriptors through the ${repositoryName} profile surface`, async () => {
      const repository = createRepository();
      const first = await repository.ensureOwnProfile({
        accountId: `${repositoryName}-uploaded-account`,
      });
      const uploadedAvatar = {
        type: "uploaded",
        objectPath: "uploaded/00000000-0000-4000-8000-000000000063.png",
      };

      const updated = await repository.updateOwnProfile({
        accountId: `${repositoryName}-uploaded-account`,
        profile: {
          gamerTag: "Uploaded Avatar",
          avatar: uploadedAvatar,
        },
      });

      assert.deepEqual(updated, {
        profileId: first.profileId,
        gamerTag: "Uploaded Avatar",
        avatar: uploadedAvatar,
        avatarKey: "dice",
      });
      assert.equal("handle" in updated, false);
      assert.equal("gamerName" in updated, false);
      assert.equal(JSON.stringify(updated).includes(`${repositoryName}-uploaded-account`), false);
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
      /const hostedAccountProfileRepository =\s*createSupabaseAccountProfileRepository\(\{ supabase \}\)/,
    );
    assert.match(
      appSource,
      /profileRepository: hostedAccountProfileRepository/,
    );
    assert.match(
      appSource,
      /accountProfileRepository = hostedAccountProfileRepository/,
    );
  });
});

function createProfileIdSequence(prefix) {
  let nextId = 1;

  return () => `${prefix}-${nextId++}`;
}

function createFakeAccountProfilesSupabase({
  lookupProfiles = [],
} = {}) {
  const rows = [];

  return {
    insertCalls: [],
    rpcCalls: [],
    tableCalls: [],
    from(tableName) {
      assert.equal(tableName, "account_profiles");
      this.tableCalls.push(tableName);
      return new FakeAccountProfilesQuery(rows, {
        insertCalls: this.insertCalls,
        tableName,
      });
    },
    async rpc(functionName, params) {
      assert.equal(functionName, "lookup_account_profile");
      this.rpcCalls.push({
        functionName,
        params,
      });

      const profile = lookupProfiles.find((candidate) => {
        if (params.lookup_kind === "email") {
          return candidate.emailLookupKey === params.lookup_key;
        }

        return (
          candidate.gamerTag.trim().toLocaleLowerCase("en-GB") ===
          params.lookup_key
        );
      });

      return {
        data: profile
          ? [
              {
                avatar_key: profile.avatarKey,
                avatar_object_path: null,
                avatar_type: "built-in",
                gamer_tag: profile.gamerTag,
                profile_id: profile.profileId,
              },
            ]
          : [],
        error: null,
      };
    },
  };
}

class FakeAccountProfilesQuery {
  constructor(rows, { insertCalls, tableName }) {
    this.rows = rows;
    this.filters = {};
    this.operation = "select";
    this.insertedRow = null;
    this.insertCalls = insertCalls;
    this.tableName = tableName;
  }

  insert(row) {
    this.operation = "insert";
    this.insertedRow = row;
    this.insertCalls.push({
      tableName: this.tableName,
      row,
    });
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
    if (this.operation === "insert") {
      if (
        this.rows.some(
          (row) =>
            row.account_id === this.insertedRow.account_id ||
            row.gamer_tag === this.insertedRow.gamer_tag,
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
        this.updatedRow.gamer_tag &&
        this.rows.some(
          (row) =>
            row !== existing &&
            row.gamer_tag === this.updatedRow.gamer_tag,
        )
      ) {
        return {
          data: null,
          error: {
            code: "23505",
            message: "duplicate gamer tag",
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
