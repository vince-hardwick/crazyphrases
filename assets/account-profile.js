import {
  createAccountShell,
  createDefaultProfile,
} from "./account-shell.js?v=__ASSET_VERSION__";

const ACCOUNT_PROFILES_TABLE = "account_profiles";
const ACCOUNT_PROFILE_DIRECTORY_TABLE = "account_profile_directory";
const PROFILE_SELECT_COLUMNS =
  "profile_id, handle, gamer_name, avatar_type, avatar_key, avatar_object_path";

export function createMemoryAccountProfileRepository({
  createProfileId = defaultCreateProfileId,
  initialProfiles = [],
  onChange = () => {},
} = {}) {
  const rowsByAccountId = new Map();
  const accountIdByHandle = new Map();

  for (const profile of initialProfiles) {
    seedProfile(profile);
  }

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
        ...normaliseProfile({ accountId, profile }),
        profileId,
      };

      rowsByAccountId.set(accountId, row);
      accountIdByHandle.set(row.handle, accountId);
      notifyChange();

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
        profileId: existing.profileId,
      };
      rowsByAccountId.set(accountId, row);
      accountIdByHandle.set(row.handle, accountId);
      notifyChange();

      return toOwnProfile(row);
    },

    async lookupProfileByHandle({ handle }) {
      const accountId = accountIdByHandle.get(normaliseHandle(handle));
      const row = accountId ? rowsByAccountId.get(accountId) : null;

      return row ? toDirectoryProfile(row) : null;
    },
  };

  function seedProfile(profile) {
    const accountId = profile.accountId;
    assertAccountId(accountId);

    if (rowsByAccountId.has(accountId)) {
      throw new Error("Account Profile already exists.");
    }

    const profileId = profile.profileId ?? createProfileId();
    const row = {
      accountId,
      ...normaliseProfile({ accountId, profile }),
      profileId,
    };

    if (accountIdByHandle.has(row.handle)) {
      throw new Error("Handle is already in use.");
    }

    rowsByAccountId.set(accountId, row);
    accountIdByHandle.set(row.handle, accountId);
  }

  function notifyChange() {
    onChange([...rowsByAccountId.values()].map(toStoredProfile));
  }
}

export function createLocalTestAccountProfileRepository(
  storage,
  {
    createProfileId = defaultCreateProfileId,
    failureMode = null,
    initialProfiles = [],
    storageKey = "crazyphrases.localTest.accountProfiles.v1",
  } = {},
) {
  const repository = createMemoryAccountProfileRepository({
    createProfileId,
    initialProfiles: loadStoredProfiles(storage, storageKey) ?? initialProfiles,
    onChange(profiles) {
      saveStoredProfiles(storage, storageKey, profiles);
    },
  });

  return {
    ...repository,
    async updateOwnProfile({ accountId, profile }) {
      if (failureMode === "save-fails") {
        throw new Error("Local test Account Profile save failed.");
      }

      return repository.updateOwnProfile({ accountId, profile });
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
      .select(PROFILE_SELECT_COLUMNS)
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
            avatar_object_path: null,
            avatar_key: profile.avatarKey,
            avatar_type: profile.avatar.type,
            gamer_name: profile.gamerName,
            handle: profile.handle,
            profile_id: profileId,
          })
          .select(PROFILE_SELECT_COLUMNS)
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
          avatar_object_path:
            normalisedProfile.avatar.type === "uploaded"
              ? normalisedProfile.avatar.objectPath
              : null,
          avatar_key: normalisedProfile.avatarKey,
          avatar_type: normalisedProfile.avatar.type,
          gamer_name: normalisedProfile.gamerName,
          handle: normalisedProfile.handle,
        })
        .eq("account_id", accountId)
        .select(PROFILE_SELECT_COLUMNS)
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
        .from(ACCOUNT_PROFILE_DIRECTORY_TABLE)
        .select(PROFILE_SELECT_COLUMNS)
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
    avatar: row.avatar,
    avatarKey: row.avatarKey,
  };
}

function toDirectoryProfile(row) {
  return {
    profileId: row.profileId,
    handle: row.handle,
    gamerName: row.gamerName,
    avatar: row.avatar,
    avatarKey: row.avatarKey,
  };
}

function toStoredProfile(row) {
  return {
    accountId: row.accountId,
    profileId: row.profileId,
    handle: row.handle,
    gamerName: row.gamerName,
    avatar: row.avatar,
    avatarKey: row.avatarKey,
  };
}

function recoverSupabaseProfile(row) {
  const avatar =
    row?.avatar_type === "uploaded"
      ? {
          type: "uploaded",
          objectPath: row?.avatar_object_path,
        }
      : {
          type: "built-in",
          key: row?.avatar_key,
        };
  const profile = {
    ...normaliseProfile({
      accountId: "recovered-profile-row",
      profile: {
        avatar,
        avatarKey: row?.avatar_key,
        gamerName: row?.gamer_name,
        handle: row?.handle,
        profileId: row?.profile_id,
      },
    }),
    profileId: row?.profile_id,
  };

  if (
    typeof profile.profileId !== "string" ||
    profile.profileId.trim() === "" ||
    typeof profile.handle !== "string" ||
    profile.handle.trim() === "" ||
    typeof profile.gamerName !== "string" ||
    profile.gamerName.trim() === "" ||
    !profile.avatar ||
    typeof profile.avatar.type !== "string" ||
    typeof profile.avatarKey !== "string" ||
    profile.avatarKey.trim() === ""
  ) {
    throw new Error("A valid Account Profile row is required.");
  }

  return profile;
}

function loadStoredProfiles(storage, storageKey) {
  try {
    const parsed = JSON.parse(storage?.getItem(storageKey) ?? "null");
    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed.map(recoverStoredProfile);
  } catch {
    return null;
  }
}

function saveStoredProfiles(storage, storageKey, profiles) {
  storage?.setItem(storageKey, JSON.stringify(profiles));
}

function recoverStoredProfile(profile) {
  if (
    typeof profile?.accountId !== "string" ||
    profile.accountId.trim() === "" ||
    typeof profile?.profileId !== "string" ||
    profile.profileId.trim() === "" ||
    typeof profile?.handle !== "string" ||
    profile.handle.trim() === "" ||
    typeof profile?.gamerName !== "string" ||
    profile.gamerName.trim() === ""
  ) {
    throw new Error("A valid stored Account Profile is required.");
  }

  const normalisedProfile = normaliseProfile({
    accountId: profile.accountId,
    profile,
  });

  return {
    accountId: profile.accountId,
    profileId: profile.profileId,
    handle: normalisedProfile.handle,
    gamerName: normalisedProfile.gamerName,
    avatar: normalisedProfile.avatar,
    avatarKey: normalisedProfile.avatarKey,
  };
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
