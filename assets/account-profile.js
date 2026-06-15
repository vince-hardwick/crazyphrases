import {
  createAccountShell,
  createDefaultProfile,
} from "./account-shell.js?v=__ASSET_VERSION__";

const ACCOUNT_PROFILES_TABLE = "account_profiles";

export function createMemoryAccountProfileRepository({
  createProfileId = defaultCreateProfileId,
} = {}) {
  const rowsByAccountId = new Map();
  const accountIdByHandle = new Map();

  return {
    async ensureOwnProfile({ accountId }) {
      assertAccountId(accountId);

      const existing = rowsByAccountId.get(accountId);
      if (existing) {
        return toOwnProfile(existing);
      }

      const profileId = createProfileId();
      const profile = createDefaultProfile({
        accountId: profileId,
        existingHandles: [...accountIdByHandle.keys()],
      });
      const row = {
        accountId,
        profileId,
        ...normaliseProfile({ accountId, profile }),
      };

      rowsByAccountId.set(accountId, row);
      accountIdByHandle.set(row.handle, accountId);

      return toOwnProfile(row);
    },

    async loadOwnProfile({ accountId }) {
      assertAccountId(accountId);

      const row = rowsByAccountId.get(accountId);
      return row ? toOwnProfile(row) : null;
    },

    async updateOwnProfile({ accountId, profile }) {
      assertAccountId(accountId);

      const existing = rowsByAccountId.get(accountId);
      if (!existing) {
        throw new Error("Account Profile does not exist.");
      }

      const updatedProfile = normaliseProfile({ accountId, profile });
      const ownerOfHandle = accountIdByHandle.get(updatedProfile.handle);
      if (ownerOfHandle && ownerOfHandle !== accountId) {
        throw new Error("Handle is already in use.");
      }

      accountIdByHandle.delete(existing.handle);

      const row = {
        ...existing,
        ...updatedProfile,
      };
      rowsByAccountId.set(accountId, row);
      accountIdByHandle.set(row.handle, accountId);

      return toOwnProfile(row);
    },

    async lookupProfileByHandle({ handle }) {
      const accountId = accountIdByHandle.get(normaliseHandle(handle));
      const row = accountId ? rowsByAccountId.get(accountId) : null;

      return row ? toDirectoryProfile(row) : null;
    },
  };
}

export function createSupabaseAccountProfileRepository({
  createProfileId = defaultCreateProfileId,
  supabase,
} = {}) {
  if (!supabase || typeof supabase.from !== "function") {
    throw new Error("A Supabase client is required.");
  }

  async function loadOwnProfile({ accountId }) {
    assertAccountId(accountId);

    const response = await supabase
      .from(ACCOUNT_PROFILES_TABLE)
      .select("profile_id, handle, gamer_name, avatar_key")
      .eq("account_id", accountId)
      .maybeSingle();

    assertNoSupabaseError(response, "Could not load Account Profile");

    return response.data ? recoverSupabaseProfile(response.data) : null;
  }

  return {
    async ensureOwnProfile({ accountId }) {
      assertAccountId(accountId);

      const existing = await loadOwnProfile({ accountId });
      if (existing) {
        return existing;
      }

      const profileId = createProfileId();
      const baseProfile = createDefaultProfile({
        accountId: profileId,
        existingHandles: [],
      });

      for (let index = 0; index < 20; index += 1) {
        const profile =
          index === 0
            ? baseProfile
            : {
                ...baseProfile,
                handle: `${baseProfile.handle}-${index + 1}`,
              };

        const response = await supabase
          .from(ACCOUNT_PROFILES_TABLE)
          .insert({
            account_id: accountId,
            avatar_key: profile.avatarKey,
            gamer_name: profile.gamerName,
            handle: profile.handle,
            profile_id: profileId,
          })
          .select("profile_id, handle, gamer_name, avatar_key")
          .maybeSingle();

        if (!isUniqueConstraintError(response?.error)) {
          assertNoSupabaseError(response, "Could not create Account Profile");
          return recoverSupabaseProfile(response.data);
        }

        const racedExisting = await loadOwnProfile({ accountId });
        if (racedExisting) {
          return racedExisting;
        }
      }

      throw new Error("No available Account Profile Handle candidate.");
    },

    loadOwnProfile,

    async updateOwnProfile({ accountId, profile }) {
      assertAccountId(accountId);

      const normalisedProfile = normaliseProfile({ accountId, profile });
      const response = await supabase
        .from(ACCOUNT_PROFILES_TABLE)
        .update({
          avatar_key: normalisedProfile.avatarKey,
          gamer_name: normalisedProfile.gamerName,
          handle: normalisedProfile.handle,
        })
        .eq("account_id", accountId)
        .select("profile_id, handle, gamer_name, avatar_key")
        .maybeSingle();

      if (isUniqueConstraintError(response?.error)) {
        throw new Error("Handle is already in use.");
      }

      assertNoSupabaseError(response, "Could not update Account Profile");

      if (!response.data) {
        throw new Error("Account Profile does not exist.");
      }

      return recoverSupabaseProfile(response.data);
    },

    async lookupProfileByHandle({ handle }) {
      const response = await supabase
        .from(ACCOUNT_PROFILES_TABLE)
        .select("profile_id, handle, gamer_name, avatar_key")
        .eq("handle", normaliseHandle(handle))
        .maybeSingle();

      assertNoSupabaseError(response, "Could not look up Account Profile");

      return response.data ? recoverSupabaseProfile(response.data) : null;
    },
  };
}

function assertAccountId(accountId) {
  if (typeof accountId !== "string" || accountId.trim() === "") {
    throw new Error("A signed-in Account id is required.");
  }
}

function normaliseProfile({ accountId, profile }) {
  return createAccountShell({
    account: {
      id: accountId,
    },
    profile,
  }).profile;
}

function normaliseHandle(handle) {
  return String(handle ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toOwnProfile(row) {
  return {
    profileId: row.profileId,
    handle: row.handle,
    gamerName: row.gamerName,
    avatarKey: row.avatarKey,
  };
}

function toDirectoryProfile(row) {
  return {
    profileId: row.profileId,
    handle: row.handle,
    gamerName: row.gamerName,
    avatarKey: row.avatarKey,
  };
}

function recoverSupabaseProfile(row) {
  const profile = {
    profileId: row?.profile_id,
    handle: row?.handle,
    gamerName: row?.gamer_name,
    avatarKey: row?.avatar_key,
  };

  if (
    typeof profile.profileId !== "string" ||
    profile.profileId.trim() === "" ||
    typeof profile.handle !== "string" ||
    profile.handle.trim() === "" ||
    typeof profile.gamerName !== "string" ||
    profile.gamerName.trim() === "" ||
    typeof profile.avatarKey !== "string" ||
    profile.avatarKey.trim() === ""
  ) {
    throw new Error("A valid Account Profile row is required.");
  }

  return profile;
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

function isUniqueConstraintError(error) {
  return error?.code === "23505";
}

function defaultCreateProfileId() {
  return globalThis.crypto?.randomUUID?.() ?? `profile-${Date.now()}`;
}
