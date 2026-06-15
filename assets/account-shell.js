const DEFAULT_GAMER_NAME = "Player";
const DEFAULT_AVATAR_KEYS = [
  "spark",
  "paper",
  "moon",
  "star",
  "comet",
  "kite",
];

export function createAccountShell({ account, profile, existingHandles = [] } = {}) {
  assertAccount(account);

  const accountId = account.id;
  const resolvedProfile =
    profile ?? createDefaultProfile({ accountId, existingHandles });

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

export function createDefaultProfile({ accountId, existingHandles = [] }) {
  const handle = createUniqueHandle(`player-${handleSeed(accountId)}`, {
    existingHandles,
  });

  return {
    handle,
    gamerName: DEFAULT_GAMER_NAME,
    avatarKey: DEFAULT_AVATAR_KEYS[stableIndex(accountId, DEFAULT_AVATAR_KEYS.length)],
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
  return {
    handle: normaliseHandle(profile.handle),
    gamerName: normaliseGamerName(profile.gamerName),
    avatarKey: normaliseAvatarKey(profile.avatarKey),
  };
}

function normaliseHandle(handle) {
  const normalised = slugify(handle).slice(0, 30);

  if (normalised.length < 3) {
    throw new Error("Handle must be at least 3 characters.");
  }

  return normalised;
}

function normaliseGamerName(gamerName) {
  const normalised = String(gamerName ?? "").trim();
  return normalised === "" ? DEFAULT_GAMER_NAME : normalised.slice(0, 40);
}

function normaliseAvatarKey(avatarKey) {
  const normalised = slugify(avatarKey);
  return DEFAULT_AVATAR_KEYS.includes(normalised) ? normalised : DEFAULT_AVATAR_KEYS[0];
}

function createUniqueHandle(baseHandle, { existingHandles }) {
  const existing = new Set(
    existingHandles.map((handle) => String(handle).trim().toLowerCase()),
  );
  const base = normaliseHandle(baseHandle);

  if (!existing.has(base)) {
    return base;
  }

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;

    if (!existing.has(candidate)) {
      return candidate;
    }
  }

  throw new Error("No available handle candidate.");
}

function handleSeed(accountId) {
  return slugify(accountId).slice(0, 18) || "account";
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
