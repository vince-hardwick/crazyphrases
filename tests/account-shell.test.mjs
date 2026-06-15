import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
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
    assert.equal(shell.profile.gamerName, "Player");
    assert.match(shell.profile.handle, /^player-/);
    assert.equal(typeof shell.profile.avatarKey, "string");
    assert.equal(JSON.stringify(shell).includes("alice@example.com"), false);
  });

  it("keeps Gamer Name and Handle separate from persistence authority", () => {
    const shell = createAccountShell({
      account: {
        id: "account-authority-456",
        email: "not-for-display@example.com",
      },
      profile: {
        gamerName: "Captain Spoon",
        handle: "Captain-Spoon",
        avatarKey: "moon",
      },
    });

    assert.equal(shell.profile.gamerName, "Captain Spoon");
    assert.equal(shell.profile.handle, "captain-spoon");
    assert.equal(shell.profile.avatarKey, "moon");
    assert.equal(shell.persistenceAuthority.accountId, "account-authority-456");
    assert.notEqual(shell.persistenceAuthority.accountId, shell.profile.handle);
  });

  it("generates a unique default Handle without exposing account identity", () => {
    const firstShell = createAccountShell({
      account: { id: "same-account-seed" },
      profile: null,
    });
    const secondShell = createAccountShell({
      account: { id: "same-account-seed" },
      profile: null,
      existingHandles: [firstShell.profile.handle],
    });

    assert.equal(firstShell.profile.handle, "player-same-account-seed");
    assert.equal(secondShell.profile.handle, "player-same-account-seed-2");
    assert.equal(secondShell.profile.handle.includes("@"), false);
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
