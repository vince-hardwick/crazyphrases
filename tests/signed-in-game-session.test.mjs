import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createSignedInGameSession } from "../assets/signed-in-game-session.js";

describe("signed-in current-game session", () => {
  it("saves the first Supabase game and then advances with the loaded revision", async () => {
    const calls = [];
    const game = {
      mode: "signed-in-solo",
      accountId: "account-123",
      started: true,
    };
    const repository = {
      async saveCurrentGameRecord(request) {
        calls.push(request);
        return {
          game: request.game,
          revision: request.expectedRevision ? request.expectedRevision + 1 : 1,
        };
      },
    };
    const session = createSignedInGameSession({ repository });

    await session.saveCurrentGame({
      accountId: "account-123",
      game,
    });
    await session.saveCurrentGame({
      accountId: "account-123",
      game,
    });

    assert.deepEqual(calls, [
      {
        accountId: "account-123",
        game,
      },
      {
        accountId: "account-123",
        expectedRevision: 1,
        game,
      },
    ]);
  });

  it("uses the loaded Supabase revision on the next save", async () => {
    const calls = [];
    const game = {
      mode: "signed-in-solo",
      accountId: "account-456",
      started: true,
    };
    const repository = {
      async loadCurrentGameRecord(request) {
        calls.push({
          method: "load",
          request,
        });
        return {
          game,
          revision: 4,
        };
      },
      async saveCurrentGameRecord(request) {
        calls.push({
          method: "save",
          request,
        });
        return {
          game: request.game,
          revision: request.expectedRevision + 1,
        };
      },
    };
    const session = createSignedInGameSession({ repository });

    assert.equal(
      await session.loadCurrentGame({ accountId: "account-456" }),
      game,
    );
    await session.saveCurrentGame({
      accountId: "account-456",
      game,
    });

    assert.deepEqual(calls, [
      {
        method: "load",
        request: {
          accountId: "account-456",
        },
      },
      {
        method: "save",
        request: {
          accountId: "account-456",
          expectedRevision: 4,
          game,
        },
      },
    ]);
  });

  it("resets the loaded revision after deleting the current game", async () => {
    const calls = [];
    const game = {
      mode: "signed-in-solo",
      accountId: "account-789",
      started: true,
    };
    const repository = {
      async saveCurrentGameRecord(request) {
        calls.push({
          method: "save",
          request,
        });
        return {
          game: request.game,
          revision: request.expectedRevision ? request.expectedRevision + 1 : 1,
        };
      },
      async deleteCurrentGame(request) {
        calls.push({
          method: "delete",
          request,
        });
      },
    };
    const session = createSignedInGameSession({ repository });

    await session.saveCurrentGame({
      accountId: "account-789",
      game,
    });
    await session.deleteCurrentGame({ accountId: "account-789" });
    await session.saveCurrentGame({
      accountId: "account-789",
      game,
    });

    assert.deepEqual(calls, [
      {
        method: "save",
        request: {
          accountId: "account-789",
          game,
        },
      },
      {
        method: "delete",
        request: {
          accountId: "account-789",
        },
      },
      {
        method: "save",
        request: {
          accountId: "account-789",
          game,
        },
      },
    ]);
  });
});
