import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createAnonymousSoloGame,
  revealBatch,
  startGame,
  submitActiveSection,
  updateEntry,
} from "../assets/game-state.js";
import {
  loadCurrentAnonymousSoloGame,
  LOCAL_ANONYMOUS_SOLO_GAME_KEY,
  saveCurrentAnonymousSoloGame,
} from "../assets/local-game-storage.js";

describe("anonymous solo local game storage", () => {
  it("stores only the latest local game and recovers revealed state", () => {
    const storage = createFakeStorage();
    const revealedGame = completeRevealedGame({ random: () => 0 });
    const replacementGame = startGame(
      createAnonymousSoloGame({ rowCount: 1, random: () => 0.99 }),
    );

    saveCurrentAnonymousSoloGame(storage, revealedGame);

    assert.equal(storage.length, 1);
    assert.equal(storage.key(0), LOCAL_ANONYMOUS_SOLO_GAME_KEY);
    assert.deepEqual(loadCurrentAnonymousSoloGame(storage), revealedGame);
    assert.equal(loadCurrentAnonymousSoloGame(storage).revealed, true);

    saveCurrentAnonymousSoloGame(storage, replacementGame);

    assert.equal(storage.length, 1);
    assert.deepEqual(loadCurrentAnonymousSoloGame(storage), replacementGame);
  });
});

function completeRevealedGame({ random }) {
  let game = startGame(createAnonymousSoloGame({ rowCount: 1, random }));

  game = updateEntry(game, { rowIndex: 0, value: "brisk" });
  game = submitActiveSection(game);
  game = updateEntry(game, { rowIndex: 0, value: "teapot" });
  game = submitActiveSection(game);
  game = updateEntry(game, { rowIndex: 0, value: "ladder" });
  game = submitActiveSection(game);

  return revealBatch(game);
}

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
