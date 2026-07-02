const DEFAULT_GAMER_TAG = "Player";
export const DEFAULT_BUILT_IN_AVATAR_KEY = "dice";
export const BUILT_IN_AVATAR_KEYS = [
  "dice",
  "hat-wizard",
  "gamepad",
  "ghost",
  "puzzle-piece",
  "biohazard",
  "dragon",
  "hurricane",
  "jedi",
  "pizza-slice",
  "spaghetti-monster-flying",
  "user-astronaut",
  "yin-yang",
];

const LEGACY_BUILT_IN_AVATAR_KEYS = new Map([
  ["spark", "dice"],
  ["paper", "puzzle-piece"],
  ["moon", "yin-yang"],
  ["star", "user-astronaut"],
  ["comet", "hurricane"],
  ["kite", "dragon"],
]);

export function createAccountShell({
  account,
  profile,
  existingGamerTags = [],
} = {}) {
  assertAccount(account);

  const accountId = account.id;
  const resolvedProfile =
    profile ?? createDefaultProfile({ existingGamerTags });

  return {
    mode: "signed-in",
    statusLabel: "Account-backed mode",
    accountId,
    persistenceAuthority: {
      type: "account",
      accountId,
    },
    profile: normaliseProfile(resolvedProfile),
  };
}

export function createDefaultProfile({ existingGamerTags = [] } = {}) {
  const gamerTag = createUniqueGamerTag(DEFAULT_GAMER_TAG, {
    existingGamerTags,
  });

  return {
    gamerTag,
    avatar: createBuiltInAvatarDescriptor(
      BUILT_IN_AVATAR_KEYS[stableIndex(gamerTag, BUILT_IN_AVATAR_KEYS.length)],
    ),
    avatarKey:
      BUILT_IN_AVATAR_KEYS[stableIndex(gamerTag, BUILT_IN_AVATAR_KEYS.length)],
  };
}

export function createSignedOutShell() {
  return {
    mode: "anonymous-solo",
    statusLabel: "Anonymous solo",
    accountId: null,
    persistenceAuthority: {
      type: "local-browser",
    },
    profile: null,
  };
}

function assertAccount(account) {
  if (!account || typeof account.id !== "string" || account.id.trim() === "") {
    throw new Error("A signed-in Account id is required.");
  }
}

function normaliseProfile(profile) {
  const avatar = normaliseAvatarDescriptor(profile);

  return {
    profileId: normaliseProfileId(profile.profileId),
    gamerTag: normaliseGamerTag(profile.gamerTag),
    avatar,
    avatarKey:
      avatar.type === "built-in" ? avatar.key : DEFAULT_BUILT_IN_AVATAR_KEY,
  };
}

function normaliseProfileId(profileId) {
  const normalised = String(profileId ?? "").trim();
  return normalised === "" ? null : normalised;
}

function normaliseGamerTag(gamerTag) {
  const normalised = String(gamerTag ?? "").trim();
  return normalised === "" ? DEFAULT_GAMER_TAG : normalised.slice(0, 40);
}

export function normaliseBuiltInAvatarKey(avatarKey) {
  const normalised = slugify(avatarKey);
  const migrated = LEGACY_BUILT_IN_AVATAR_KEYS.get(normalised) ?? normalised;

  return BUILT_IN_AVATAR_KEYS.includes(migrated)
    ? migrated
    : DEFAULT_BUILT_IN_AVATAR_KEY;
}

export function createBuiltInAvatarDescriptor(avatarKey) {
  return {
    type: "built-in",
    key: normaliseBuiltInAvatarKey(avatarKey),
  };
}

export function createUploadedAvatarDescriptor({ objectPath } = {}) {
  const normalisedObjectPath = String(objectPath ?? "").trim();
  if (!isUploadedAvatarObjectPath(normalisedObjectPath)) {
    throw new Error("A valid Uploaded Avatar object path is required.");
  }

  return {
    type: "uploaded",
    objectPath: normalisedObjectPath,
  };
}

export function normaliseAvatarDescriptor(profile = {}) {
  if (profile.avatar?.type === "uploaded") {
    return createUploadedAvatarDescriptor({
      objectPath: profile.avatar.objectPath,
    });
  }

  if (profile.avatar?.type === "built-in") {
    return createBuiltInAvatarDescriptor(profile.avatar.key);
  }

  if (profile.avatarType === "uploaded") {
    return createUploadedAvatarDescriptor({
      objectPath: profile.avatarObjectPath,
    });
  }

  return createBuiltInAvatarDescriptor(profile.avatarKey);
}

function isUploadedAvatarObjectPath(objectPath) {
  return /^uploaded\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|jpeg|png|webp)$/i.test(
    objectPath,
  );
}

function createUniqueGamerTag(baseGamerTag, { existingGamerTags }) {
  const existing = new Set(
    existingGamerTags.map((gamerTag) =>
      String(gamerTag).trim().toLocaleLowerCase("en-GB"),
    ),
  );
  const base = normaliseGamerTag(baseGamerTag);
  const baseKey = base.toLocaleLowerCase("en-GB");

  if (!existing.has(baseKey)) {
    return base;
  }

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base} ${suffix}`;

    if (!existing.has(candidate.toLocaleLowerCase("en-GB"))) {
      return candidate;
    }
  }

  throw new Error("No available Gamer Tag candidate.");
}

function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stableIndex(value, length) {
  const total = [...String(value)].reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );
  return total % length;
}
