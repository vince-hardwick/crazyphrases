export const DEFAULT_TEMPLATE_ID = "default-adjective-noun-noun";
const ALLOWED_ROW_COUNTS = new Set([10, 15, 20, 25, 30]);

export function createTestPendingGameRepository({
  createPendingGameId = defaultCreatePendingGameId,
  profiles = [],
} = {}) {
  const profilesByAccountId = new Map(
    profiles.map((profile) => [profile.accountId, normaliseProfile(profile)]),
  );
  const profilesByHandle = new Map(
    profiles.map((profile) => [
      normaliseHandle(profile.handle),
      normaliseProfile(profile),
    ]),
  );

  return {
    async createPendingGameFromHandle({
      creatorAccountId,
      inviteeHandle,
      rowCount = 20,
    }) {
      assertAccountId(creatorAccountId);
      assertRowCount(rowCount);

      const creatorProfile = profilesByAccountId.get(creatorAccountId);
      if (!creatorProfile) {
        throw new Error("Creator Account Profile is required.");
      }

      const inviteeProfile = profilesByHandle.get(normaliseHandle(inviteeHandle));
      if (!inviteeProfile) {
        throw new Error("Invitee Handle was not found.");
      }

      if (creatorProfile.profileId === inviteeProfile.profileId) {
        throw new Error("A creator cannot invite their own Handle.");
      }

      return createPendingGameDto({
        id: createPendingGameId(),
        rowCount,
        status: "pending",
        templateId: DEFAULT_TEMPLATE_ID,
        participants: [
          createParticipantDto(creatorProfile, {
            inviteStatus: "accepted",
            role: "creator",
          }),
          createParticipantDto(inviteeProfile, {
            inviteStatus: "pending",
            role: "invitee",
          }),
        ],
      });
    },
  };
}

function createPendingGameDto({ id, participants, rowCount, status, templateId }) {
  return {
    id,
    status,
    templateId,
    rowCount,
    participants,
  };
}

function createParticipantDto(profile, { inviteStatus, role }) {
  return {
    role,
    inviteStatus,
    profileId: profile.profileId,
    handle: profile.handle,
    gamerName: profile.gamerName,
    avatarKey: profile.avatarKey,
  };
}

function normaliseProfile(profile) {
  return {
    accountId: profile.accountId,
    profileId: assertText(profile.profileId, "A profile id is required."),
    handle: normaliseHandle(profile.handle),
    gamerName: assertText(profile.gamerName, "A Gamer Name is required."),
    avatarKey: assertText(profile.avatarKey, "An Avatar key is required."),
  };
}

function assertAccountId(accountId) {
  assertText(accountId, "A signed-in Account id is required.");
}

function assertRowCount(rowCount) {
  if (!ALLOWED_ROW_COUNTS.has(rowCount)) {
    throw new Error("A supported row count is required.");
  }
}

function assertText(value, message) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(message);
  }

  return value.trim();
}

function normaliseHandle(handle) {
  return String(handle ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function defaultCreatePendingGameId() {
  return globalThis.crypto?.randomUUID?.() ?? `pending-game-${Date.now()}`;
}
