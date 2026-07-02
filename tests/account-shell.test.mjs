import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  BUILT_IN_AVATAR_KEYS,
  DEFAULT_BUILT_IN_AVATAR_KEY,
  createAccountShell,
  createSignedOutShell,
} from "../assets/account-shell.js";

describe("signed-in account shell", () => {
  it("creates a safe default profile shell for a signed-in Account", () => {
    const shell = createAccountShell({
      account: {
        id: "auth-user-123",
        email: "alice@example.com",
      },
      profile: null,
    });

    assert.equal(shell.mode, "signed-in");
    assert.equal(shell.statusLabel, "Account-backed mode");
    assert.equal(shell.accountId, "auth-user-123");
    assert.deepEqual(shell.persistenceAuthority, {
      type: "account",
      accountId: "auth-user-123",
    });
    assert.equal(shell.profile.gamerTag, "Player");
    assert.equal("gamerName" in shell.profile, false);
    assert.equal("handle" in shell.profile, false);
    assert.equal(typeof shell.profile.avatarKey, "string");
    assert.equal(BUILT_IN_AVATAR_KEYS.includes(shell.profile.avatarKey), true);
    assert.deepEqual(shell.profile.avatar, {
      type: "built-in",
      key: shell.profile.avatarKey,
    });
    assert.equal(JSON.stringify(shell).includes("alice@example.com"), false);
  });

  it("keeps Gamer Tag separate from persistence authority", () => {
    const shell = createAccountShell({
      account: {
        id: "account-authority-456",
        email: "not-for-display@example.com",
      },
      profile: {
        gamerTag: "Captain Spoon",
        avatarKey: "dragon",
      },
    });

    assert.equal(shell.profile.gamerTag, "Captain Spoon");
    assert.equal("gamerName" in shell.profile, false);
    assert.equal("handle" in shell.profile, false);
    assert.equal(shell.profile.avatarKey, "dragon");
    assert.deepEqual(shell.profile.avatar, {
      type: "built-in",
      key: "dragon",
    });
    assert.equal(shell.persistenceAuthority.accountId, "account-authority-456");
    assert.notEqual(shell.persistenceAuthority.accountId, shell.profile.gamerTag);
  });

  it("migrates transitional Avatar keys to the accepted Built-in Avatar set", () => {
    const legacyKeyMappings = new Map([
      ["spark", "dice"],
      ["paper", "puzzle-piece"],
      ["moon", "yin-yang"],
      ["star", "user-astronaut"],
      ["comet", "hurricane"],
      ["kite", "dragon"],
    ]);

    for (const [legacyKey, acceptedKey] of legacyKeyMappings) {
      const shell = createAccountShell({
        account: { id: `legacy-${legacyKey}` },
        profile: {
          gamerTag: "Legacy Player",
          avatarKey: legacyKey,
        },
      });

      assert.equal(shell.profile.avatarKey, acceptedKey);
      assert.deepEqual(shell.profile.avatar, {
        type: "built-in",
        key: acceptedKey,
      });
    }
  });

  it("falls invalid Built-in Avatar keys back to dice", () => {
    const shell = createAccountShell({
      account: { id: "invalid-avatar-key-account" },
      profile: {
        gamerTag: "Fallback Player",
        avatarKey: "not-a-real-avatar",
      },
    });

    assert.equal(shell.profile.avatarKey, DEFAULT_BUILT_IN_AVATAR_KEY);
    assert.deepEqual(shell.profile.avatar, {
      type: "built-in",
      key: DEFAULT_BUILT_IN_AVATAR_KEY,
    });
  });

  it("keeps Uploaded Avatar descriptors distinct from Built-in Avatar keys", () => {
    const shell = createAccountShell({
      account: { id: "uploaded-avatar-account" },
      profile: {
        gamerTag: "Upload Player",
        avatar: {
          type: "uploaded",
          objectPath: "uploaded/00000000-0000-4000-8000-000000000063.webp",
        },
      },
    });

    assert.equal(shell.profile.avatarKey, DEFAULT_BUILT_IN_AVATAR_KEY);
    assert.deepEqual(shell.profile.avatar, {
      type: "uploaded",
      objectPath: "uploaded/00000000-0000-4000-8000-000000000063.webp",
    });
  });

  it("generates a unique default Gamer Tag without exposing account identity", () => {
    const firstShell = createAccountShell({
      account: { id: "same-account-seed" },
      profile: null,
    });
    const secondShell = createAccountShell({
      account: { id: "same-account-seed" },
      profile: null,
      existingGamerTags: [firstShell.profile.gamerTag],
    });

    assert.equal(firstShell.profile.gamerTag, "Player");
    assert.equal(secondShell.profile.gamerTag, "Player 2");
    assert.equal(secondShell.profile.gamerTag.includes("@"), false);
  });

  it("describes signed-out play as anonymous local mode", () => {
    const shell = createSignedOutShell();

    assert.deepEqual(shell, {
      mode: "anonymous-solo",
      statusLabel: "Anonymous solo",
      accountId: null,
      persistenceAuthority: {
        type: "local-browser",
      },
      profile: null,
    });
  });
});
