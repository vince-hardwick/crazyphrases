import {
  DEFAULT_BUILT_IN_AVATAR_KEY,
  createAccountShell,
  createDefaultProfile,
} from "./account-shell.js?v=__ASSET_VERSION__";

const ACCOUNT_PROFILES_TABLE = "account_profiles";
const PROFILE_SELECT_COLUMNS =
  "profile_id, gamer_tag, avatar_type, avatar_key, avatar_object_path";

export function createMemoryAccountProfileRepository({
  createProfileId = defaultCreateProfileId,
  initialProfiles = [],
  onChange = () => {},
} = {}) {
  const rowsByAccountId = new Map();
  const accountIdByEmailLookupKey = new Map();
  const accountIdByGamerTag = new Map();

  for (const profile of initialProfiles) {
    seedProfile(profile);
  }

  return {
    async ensureOwnProfile({ accountId, email } = {}) {
      assertAccountId(accountId);

      const existing = rowsByAccountId.get(accountId);
      if (existing) {
        const emailLookupKey = normaliseOptionalEmailLookupKey(email);
        if (emailLookupKey && existing.emailLookupKey !== emailLookupKey) {
          unindexLookupKeys(existing);
          existing.emailLookupKey = emailLookupKey;
          indexLookupKeys(existing, accountId);
          notifyChange();
        }

        return toOwnProfile(existing);
      }

      const profileId = createProfileId();
      const profile = createDefaultProfile({
        existingGamerTags: [...rowsByAccountId.values()].map(
          (row) => row.gamerTag,
        ),
      });
      const row = {
        accountId,
        ...normaliseProfile({
          accountId,
          profile: {
            ...profile,
            emailLookupKey: email,
          },
        }),
        profileId,
      };

      rowsByAccountId.set(accountId, row);
      indexLookupKeys(row, accountId);
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
      const ownerOfGamerTag = accountIdByGamerTag.get(
        normaliseGamerTagLookupKey(updatedProfile.gamerTag),
      );
      if (ownerOfGamerTag && ownerOfGamerTag !== accountId) {
        throw new Error("Gamer Tag is already in use.");
      }

      unindexLookupKeys(existing);

      const row = {
        ...existing,
        ...updatedProfile,
        profileId: existing.profileId,
      };
      rowsByAccountId.set(accountId, row);
      indexLookupKeys(row, accountId);
      notifyChange();

      return toOwnProfile(row);
    },

    async lookupProfileByLookupKey({ lookupKey }) {
      const lookup = normaliseLookupKey(lookupKey);
      const accountId =
        lookup.kind === "email"
          ? accountIdByEmailLookupKey.get(lookup.value)
          : accountIdByGamerTag.get(lookup.value);
      const row = accountId ? rowsByAccountId.get(accountId) : null;

      return {
        status: row ? "found" : "not-found",
        lookupKind: lookup.kind,
        ...(row ? { profile: toLookupProfile(row) } : {}),
        ...(!row ? { message: missingLookupMessage(lookup.kind) } : {}),
      };
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

    if (accountIdByGamerTag.has(normaliseGamerTagLookupKey(row.gamerTag))) {
      throw new Error("Gamer Tag is already in use.");
    }

    rowsByAccountId.set(accountId, row);
    indexLookupKeys(row, accountId);
  }

  function notifyChange() {
    onChange([...rowsByAccountId.values()].map(toStoredProfile));
  }

  function indexLookupKeys(row, accountId) {
    if (row.emailLookupKey) {
      accountIdByEmailLookupKey.set(row.emailLookupKey, accountId);
    }

    if (row.gamerTag) {
      accountIdByGamerTag.set(normaliseGamerTagLookupKey(row.gamerTag), accountId);
    }
  }

  function unindexLookupKeys(row) {
    if (row.emailLookupKey) {
      accountIdByEmailLookupKey.delete(row.emailLookupKey);
    }

    if (row.gamerTag) {
      accountIdByGamerTag.delete(normaliseGamerTagLookupKey(row.gamerTag));
    }
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
    async ensureOwnProfile({ accountId, email } = {}) {
      assertAccountId(accountId);

      const existing = await loadOwnProfile({ accountId });
      if (existing) {
        return existing;
      }

      const profileId = createProfileId();
      const baseProfile = createDefaultProfile();

      for (let index = 0; index < 20; index += 1) {
        const profile =
          index === 0
            ? baseProfile
            : {
                ...baseProfile,
                gamerTag: `${baseProfile.gamerTag} ${index + 1}`,
              };
        const normalisedProfile = normaliseProfile({ accountId, profile });

        const response = await supabase
          .from(ACCOUNT_PROFILES_TABLE)
          .insert({
            account_id: accountId,
            avatar_object_path: null,
            avatar_key: normalisedProfile.avatarKey,
            avatar_type: normalisedProfile.avatar.type,
            gamer_tag: normalisedProfile.gamerTag,
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

      throw new Error("No available Account Profile Gamer Tag candidate.");
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
          gamer_tag: normalisedProfile.gamerTag,
        })
        .eq("account_id", accountId)
        .select(PROFILE_SELECT_COLUMNS)
        .maybeSingle();

      if (isUniqueConstraintError(response?.error)) {
        throw new Error("Gamer Tag is already in use.");
      }

      assertNoSupabaseError(response, "Could not update Account Profile");

      if (!response.data) {
        throw new Error("Account Profile does not exist.");
      }

      return recoverSupabaseProfile(response.data);
    },

    async lookupProfileByLookupKey({ lookupKey }) {
      const lookup = normaliseLookupKey(lookupKey);
      const response = await supabase.rpc("lookup_account_profile", {
        lookup_key: lookup.value,
        lookup_kind: lookup.kind,
      });

      assertNoSupabaseError(response, "Could not look up Account Profile");

      const lookupRow = firstLookupRow(response.data);
      if (!lookupRow) {
        return {
          status: "not-found",
          lookupKind: lookup.kind,
          message: missingLookupMessage(lookup.kind),
        };
      }

      return {
        status: "found",
        lookupKind: lookup.kind,
        profile: recoverSupabaseLookupProfile(lookupRow),
      };
    },
  };
}

function assertAccountId(accountId) {
  if (typeof accountId !== "string" || accountId.trim() === "") {
    throw new Error("A signed-in Account id is required.");
  }
}

function normaliseProfile({ accountId, profile }) {
  const shellProfile = createAccountShell({
    account: {
      id: accountId,
    },
    profile: {
      ...profile,
      gamerTag: profile.gamerTag,
    },
  }).profile;
  const gamerTag = normaliseGamerTag(shellProfile.gamerTag);

  return {
    ...shellProfile,
    emailLookupKey: normaliseOptionalEmailLookupKey(
      profile.emailLookupKey ?? profile.lookupEmail ?? profile.email,
    ),
    gamerTag,
  };
}

function normaliseLookupKey(lookupKey) {
  const value = String(lookupKey ?? "").trim();
  if (value === "") {
    throw new Error("A lookup key is required.");
  }

  if (value.includes("@")) {
    return {
      kind: "email",
      value: normaliseEmailLookupKey(value),
    };
  }

  return {
    kind: "gamer-tag",
    value: normaliseGamerTagLookupKey(value),
  };
}

function normaliseOptionalEmailLookupKey(email) {
  const value = String(email ?? "").trim();
  return value === "" ? null : normaliseEmailLookupKey(value);
}

function normaliseEmailLookupKey(email) {
  return String(email ?? "").trim().toLowerCase();
}

function normaliseGamerTag(gamerTag) {
  const value = String(gamerTag ?? "").trim();
  return value === "" ? "Player" : value.slice(0, 40);
}

function normaliseGamerTagLookupKey(gamerTag) {
  return normaliseGamerTag(gamerTag).toLocaleLowerCase("en-GB");
}

function missingLookupMessage(lookupKind) {
  return lookupKind === "email"
    ? "No gamer found under that email address"
    : "No gamer found under that gamer tag.";
}

function toOwnProfile(row) {
  return {
    profileId: row.profileId,
    gamerTag: row.gamerTag,
    avatar: row.avatar,
    avatarKey: row.avatarKey,
  };
}

function toLookupProfile(row) {
  return {
    profileId: row.profileId,
    gamerTag: row.gamerTag,
    avatar: row.avatar,
    avatarKey: row.avatarKey,
  };
}

function toStoredProfile(row) {
  return {
    accountId: row.accountId,
    profileId: row.profileId,
    emailLookupKey: row.emailLookupKey,
    gamerTag: row.gamerTag,
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
  if (typeof row?.gamer_tag !== "string" || row.gamer_tag.trim() === "") {
    throw new Error("A valid Account Profile row is required.");
  }
  const gamerTag = row.gamer_tag;
  const profile = {
    ...toOwnProfile({
      ...normaliseProfile({
        accountId: "recovered-profile-row",
        profile: {
          avatar,
          avatarKey: row?.avatar_key,
          gamerTag,
          profileId: row?.profile_id,
        },
      }),
      profileId: row?.profile_id,
    }),
  };

  if (
    typeof profile.profileId !== "string" ||
    profile.profileId.trim() === "" ||
    typeof profile.gamerTag !== "string" ||
    profile.gamerTag.trim() === "" ||
    !profile.avatar ||
    typeof profile.avatar.type !== "string" ||
    typeof profile.avatarKey !== "string" ||
    profile.avatarKey.trim() === ""
  ) {
    throw new Error("A valid Account Profile row is required.");
  }

  return profile;
}

function recoverSupabaseLookupProfile(row) {
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
    profileId: row?.profile_id,
    gamerTag: normaliseGamerTag(row?.gamer_tag),
    avatar,
    avatarKey: avatar.type === "built-in" ? avatar.key : DEFAULT_BUILT_IN_AVATAR_KEY,
  };

  if (
    typeof profile.profileId !== "string" ||
    profile.profileId.trim() === "" ||
    typeof profile.gamerTag !== "string" ||
    profile.gamerTag.trim() === "" ||
    !profile.avatar ||
    typeof profile.avatar.type !== "string" ||
    typeof profile.avatarKey !== "string" ||
    profile.avatarKey.trim() === ""
  ) {
    throw new Error("A valid Account Profile lookup row is required.");
  }

  return profile;
}

function firstLookupRow(data) {
  return Array.isArray(data) ? data[0] ?? null : data;
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
    typeof profile?.gamerTag !== "string" ||
    profile.gamerTag.trim() === ""
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
    gamerTag: normalisedProfile.gamerTag,
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
