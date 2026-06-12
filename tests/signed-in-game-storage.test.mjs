import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createSignedInSoloGame,
  createAnonymousSoloGame,
  startGame,
} from "../assets/game-state.js";
import { saveCurrentAnonymousSoloGame } from "../assets/local-game-storage.js";
import {
  createLocalTestSignedInSoloGameRepository,
  createMemorySignedInSoloGameRepository,
} from "../assets/signed-in-game-storage.js";

describe("signed-in solo current-game persistence", () => {
  it("stores and resumes a started signed-in Solo Game setup by Account", async () => {
    const repository = createMemorySignedInSoloGameRepository();
    const accountId = "account-setup-owner";
    const otherAccountId = "account-other";

    assert.equal(await repository.loadCurrentGame({ accountId }), null);

    const startedGame = startGame(
      createSignedInSoloGame({
        accountId,
        rowCount: 10,
        random: () => 0.99,
      }),
    );

    const savedGame = await repository.saveCurrentGame({
      accountId,
      game: startedGame,
    });

    assert.equal(savedGame.mode, "signed-in-solo");
    assert.equal(savedGame.accountId, accountId);
    assert.equal(savedGame.rowCount, 10);
    assert.equal(savedGame.started, true);
    assert.equal(savedGame.activeSectionIndex, 0);
    assert.deepEqual(savedGame.sectionOrder, startedGame.sectionOrder);
    assert.deepEqual(
      await repository.loadCurrentGame({ accountId }),
      savedGame,
    );
    assert.equal(await repository.loadCurrentGame({ accountId: otherAccountId }), null);
  });

  it("rejects a signed-in Solo Game that has not been started", async () => {
    const repository = createMemorySignedInSoloGameRepository();
    const accountId = "account-unstarted";
    const unstartedGame = createSignedInSoloGame({ accountId, rowCount: 10 });

    await assert.rejects(
      () => repository.saveCurrentGame({ accountId, game: unstartedGame }),
      /started/i,
    );
    assert.equal(await repository.loadCurrentGame({ accountId }), null);
  });

  it("rejects a malformed signed-in Solo Game setup payload", async () => {
    const repository = createMemorySignedInSoloGameRepository();
    const accountId = "account-malformed";
    const startedGame = startGame(
      createSignedInSoloGame({ accountId, rowCount: 10 }),
    );

    await assert.rejects(
      () =>
        repository.saveCurrentGame({
          accountId,
          game: {
            ...startedGame,
            sectionOrder: [0, 0, 2],
          },
        }),
      /valid signed-in solo game/i,
    );
    assert.equal(await repository.loadCurrentGame({ accountId }), null);
  });

  it("keeps anonymous local recovery separate from local test signed-in persistence", async () => {
    const storage = createFakeStorage();
    const accountId = "account-local-test";
    const repository = createLocalTestSignedInSoloGameRepository(storage);
    const anonymousGame = startGame(
      createAnonymousSoloGame({ rowCount: 15, random: () => 0 }),
    );
    const signedInGame = startGame(
      createSignedInSoloGame({ accountId, rowCount: 10, random: () => 0.99 }),
    );

    saveCurrentAnonymousSoloGame(storage, anonymousGame);

    assert.equal(await repository.loadCurrentGame({ accountId }), null);

    await repository.saveCurrentGame({ accountId, game: signedInGame });

    assert.equal(storage.length, 2);
    assert.deepEqual(await repository.loadCurrentGame({ accountId }), signedInGame);
    assert.equal(
      await repository.loadCurrentGame({ accountId: "different-account" }),
      null,
    );
  });
});

function createFakeStorage() {
  const items = new Map();

  return {
    get length() {
      return items.size;
    },
    getItem(key) {
      return items.has(key) ? items.get(key) : null;
    },
    key(index) {
      return [...items.keys()][index] ?? null;
    },
    removeItem(key) {
      items.delete(key);
    },
    setItem(key, value) {
      items.set(key, String(value));
    },
  };
}
