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
  createSupabaseSignedInSoloGameRepository,
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

  it("deletes local test signed-in persistence without deleting anonymous recovery", async () => {
    const storage = createFakeStorage();
    const accountId = "account-local-delete";
    const repository = createLocalTestSignedInSoloGameRepository(storage);
    const anonymousGame = startGame(
      createAnonymousSoloGame({ rowCount: 15, random: () => 0 }),
    );
    const signedInGame = startGame(
      createSignedInSoloGame({ accountId, rowCount: 10, random: () => 0.99 }),
    );

    saveCurrentAnonymousSoloGame(storage, anonymousGame);
    await repository.saveCurrentGame({ accountId, game: signedInGame });

    await repository.deleteCurrentGame({ accountId });

    assert.equal(await repository.loadCurrentGame({ accountId }), null);
    assert.equal(storage.length, 1);
  });

  it("stores and resumes a started signed-in Solo Game setup through Supabase by Account", async () => {
    const supabase = createFakeSupabaseClient();
    const repository = createSupabaseSignedInSoloGameRepository({ supabase });
    const accountId = "00000000-0000-4000-8000-000000000025";
    const otherAccountId = "00000000-0000-4000-8000-000000000999";

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

    assert.deepEqual(savedGame, startedGame);
    assert.deepEqual(
      await repository.loadCurrentGame({ accountId }),
      startedGame,
    );
    assert.equal(
      await repository.loadCurrentGame({ accountId: otherAccountId }),
      null,
    );
  });

  it("deletes a Supabase current game so the next save starts a fresh record", async () => {
    const supabase = createFakeSupabaseClient();
    const repository = createSupabaseSignedInSoloGameRepository({ supabase });
    const accountId = "00000000-0000-4000-8000-000000000029";
    const firstGame = startGame(
      createSignedInSoloGame({
        accountId,
        rowCount: 10,
        random: () => 0.99,
      }),
    );
    const nextGame = startGame(
      createSignedInSoloGame({
        accountId,
        rowCount: 15,
        random: () => 0,
      }),
    );

    await repository.saveCurrentGame({ accountId, game: firstGame });
    await repository.deleteCurrentGame({ accountId });

    assert.equal(await repository.loadCurrentGame({ accountId }), null);

    const savedRecord = await repository.saveCurrentGameRecord({
      accountId,
      game: nextGame,
    });

    assert.equal(savedRecord.revision, 1);
    assert.deepEqual(savedRecord.game, nextGame);
  });

  it("advances the Supabase current-game revision when replacing a fresh Account record", async () => {
    const supabase = createFakeSupabaseClient();
    const repository = createSupabaseSignedInSoloGameRepository({ supabase });
    const accountId = "00000000-0000-4000-8000-000000000026";
    const firstGame = startGame(
      createSignedInSoloGame({
        accountId,
        rowCount: 10,
        random: () => 0.99,
      }),
    );
    const replacementGame = startGame(
      createSignedInSoloGame({
        accountId,
        rowCount: 15,
        random: () => 0,
      }),
    );

    const firstRecord = await repository.saveCurrentGameRecord({
      accountId,
      game: firstGame,
    });
    const savedReplacementGame = await repository.saveCurrentGame({
      accountId,
      expectedRevision: firstRecord.revision,
      game: replacementGame,
    });
    const replacementRecord = await repository.loadCurrentGameRecord({
      accountId,
    });

    assert.equal(firstRecord.revision, 1);
    assert.equal(replacementRecord.revision, 2);
    assert.deepEqual(savedReplacementGame, replacementGame);
    assert.deepEqual(replacementRecord.game, replacementGame);
  });

  it("does not silently overwrite an existing Supabase current game without an expected revision", async () => {
    const supabase = createFakeSupabaseClient();
    const repository = createSupabaseSignedInSoloGameRepository({ supabase });
    const accountId = "00000000-0000-4000-8000-000000000027";
    const firstGame = startGame(
      createSignedInSoloGame({
        accountId,
        rowCount: 10,
        random: () => 0.99,
      }),
    );
    const replacementGame = startGame(
      createSignedInSoloGame({
        accountId,
        rowCount: 15,
        random: () => 0,
      }),
    );

    const firstRecord = await repository.saveCurrentGameRecord({
      accountId,
      game: firstGame,
    });

    await assert.rejects(
      () =>
        repository.saveCurrentGameRecord({
          accountId,
          game: replacementGame,
        }),
      /could not save current signed-in solo game/i,
    );
    assert.deepEqual(
      await repository.loadCurrentGameRecord({ accountId }),
      firstRecord,
    );
  });

  it("rejects a stale Supabase current-game save when the expected revision no longer matches", async () => {
    const supabase = createFakeSupabaseClient();
    const repository = createSupabaseSignedInSoloGameRepository({ supabase });
    const accountId = "00000000-0000-4000-8000-000000000028";
    const firstGame = startGame(
      createSignedInSoloGame({
        accountId,
        rowCount: 10,
        random: () => 0.99,
      }),
    );
    const newerGame = startGame(
      createSignedInSoloGame({
        accountId,
        rowCount: 15,
        random: () => 0,
      }),
    );
    const staleGame = startGame(
      createSignedInSoloGame({
        accountId,
        rowCount: 20,
        random: () => 0.5,
      }),
    );

    const firstRecord = await repository.saveCurrentGameRecord({
      accountId,
      game: firstGame,
    });
    const newerRecord = await repository.saveCurrentGameRecord({
      accountId,
      expectedRevision: firstRecord.revision,
      game: newerGame,
    });

    await assert.rejects(
      () =>
        repository.saveCurrentGameRecord({
          accountId,
          expectedRevision: firstRecord.revision,
          game: staleGame,
        }),
      /changed before it could be saved/i,
    );
    assert.deepEqual(
      await repository.loadCurrentGameRecord({ accountId }),
      newerRecord,
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

function createFakeSupabaseClient() {
  const currentGames = new Map();

  return {
    from(tableName) {
      assert.equal(tableName, "signed_in_solo_current_games");
      return new FakeCurrentGamesQuery(currentGames);
    },
  };
}

class FakeCurrentGamesQuery {
  constructor(
    currentGames,
    { filters = {}, operation = "select", row = null } = {},
  ) {
    this.currentGames = currentGames;
    this.filters = filters;
    this.operation = operation;
    this.row = row;
  }

  eq(column, value) {
    return new FakeCurrentGamesQuery(this.currentGames, {
      filters: {
        ...this.filters,
        [column]: value,
      },
      operation: this.operation,
      row: this.row,
    });
  }

  insert(row) {
    return new FakeCurrentGamesQuery(this.currentGames, {
      filters: this.filters,
      operation: "insert",
      row,
    });
  }

  update(row) {
    return new FakeCurrentGamesQuery(this.currentGames, {
      filters: this.filters,
      operation: "update",
      row,
    });
  }

  delete() {
    return new FakeCurrentGamesQuery(this.currentGames, {
      filters: this.filters,
      operation: "delete",
      row: this.row,
    });
  }

  select() {
    return this;
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  async execute() {
    if (this.operation === "delete") {
      this.currentGames.delete(this.filters.account_id);
      return {
        data: null,
        error: null,
      };
    }

    throw new Error(
      `Unsupported fake Supabase await operation: ${this.operation}`,
    );
  }

  async maybeSingle() {
    if (this.operation === "select") {
      return {
        data: this.currentGames.get(this.filters.account_id) ?? null,
        error: null,
      };
    }

    if (this.operation === "update") {
      const existingRow = this.currentGames.get(this.filters.account_id);

      if (!existingRow || existingRow.revision !== this.filters.revision) {
        return {
          data: null,
          error: null,
        };
      }

      const row = {
        ...existingRow,
        ...this.row,
      };
      this.currentGames.set(row.account_id, row);

      return {
        data: row,
        error: null,
      };
    }

    throw new Error(
      `Unsupported fake Supabase maybeSingle operation: ${this.operation}`,
    );
  }

  async single() {
    if (this.operation !== "insert") {
      throw new Error(
        `Unsupported fake Supabase single operation: ${this.operation}`,
      );
    }

    if (this.currentGames.has(this.row.account_id)) {
      return {
        data: null,
        error: {
          message:
            "duplicate key value violates unique constraint signed_in_solo_current_games_pkey",
        },
      };
    }

    const row = {
      ...this.row,
      revision: 1,
    };
    this.currentGames.set(row.account_id, row);

    return {
      data: row,
      error: null,
    };
  }
}
