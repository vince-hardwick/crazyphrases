import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createSignedInSoloGame,
  revealBatch,
  startGame,
  submitActiveSection,
  updateEntry,
} from "../assets/game-state.js";
import {
  createLocalTestPrivateFavouritesRepository,
  createMemoryPrivateFavouritesRepository,
  createPhraseFavouriteSnapshot,
  createSupabasePrivateFavouritesRepository,
} from "../assets/private-favourites.js";

describe("private favourites", () => {
  it("creates an immutable Phrase Favourite snapshot from a revealed signed-in Solo Game", () => {
    const game = completeSignedInSoloGame();
    const snapshot = createPhraseFavouriteSnapshot(game, {
      rowIndex: 0,
      wordBank: {
        entryKinds: {
          adjective: ["Brisk"],
          noun: ["Teapot", "Ladder"],
        },
      },
    });

    assert.deepEqual(snapshot, {
      type: "phrase",
      sourceMode: "signed-in-solo",
      templateId: "default-adjective-noun-noun",
      rowIndex: 0,
      phraseText: "Brisk Teapot Ladder",
      entries: [
        { entryKind: "adjective", value: "brisk", displayValue: "Brisk" },
        { entryKind: "noun", value: "teapot", displayValue: "Teapot" },
        { entryKind: "noun", value: "ladder", displayValue: "Ladder" },
      ],
    });
  });

  it("saves and lists Phrase Favourites only for their Account", async () => {
    const repository = createMemoryPrivateFavouritesRepository({
      createId: () => "phrase-favourite-1",
      now: () => "2026-06-15T15:00:00.000Z",
    });
    const favourite = createPhraseFavouriteSnapshot(completeSignedInSoloGame(), {
      rowIndex: 0,
    });

    const saved = await repository.savePhraseFavourite({
      accountId: "account-123",
      favourite,
    });
    const duplicate = await repository.savePhraseFavourite({
      accountId: "account-123",
      favourite,
    });

    assert.deepEqual(saved, {
      id: "phrase-favourite-1",
      accountId: "account-123",
      favourite,
      createdAt: "2026-06-15T15:00:00.000Z",
    });
    assert.deepEqual(duplicate, saved);
    assert.deepEqual(await repository.listPhraseFavourites({ accountId: "account-123" }), [
      saved,
    ]);
    assert.deepEqual(await repository.listPhraseFavourites({ accountId: "other-account" }), []);
  });

  it("recovers local test Phrase Favourites from account-scoped storage", async () => {
    const storage = new MemoryStorage();
    const favourite = createPhraseFavouriteSnapshot(completeSignedInSoloGame(), {
      rowIndex: 0,
    });
    const repository = createLocalTestPrivateFavouritesRepository(storage, {
      createId: () => "phrase-favourite-1",
      now: () => "2026-06-15T15:00:00.000Z",
    });

    await repository.savePhraseFavourite({
      accountId: "account-123",
      favourite,
    });

    const restoredRepository = createLocalTestPrivateFavouritesRepository(storage);

    assert.deepEqual(
      await restoredRepository.listPhraseFavourites({ accountId: "account-123" }),
      [
        {
          id: "phrase-favourite-1",
          accountId: "account-123",
          favourite,
          createdAt: "2026-06-15T15:00:00.000Z",
        },
      ],
    );
    assert.deepEqual(
      await restoredRepository.listPhraseFavourites({ accountId: "other-account" }),
      [],
    );
  });

  it("saves and lists Phrase Favourites through Supabase rows", async () => {
    const favourite = createPhraseFavouriteSnapshot(completeSignedInSoloGame(), {
      rowIndex: 0,
    });
    const supabase = createFakePrivateFavouritesSupabase();
    const repository = createSupabasePrivateFavouritesRepository({ supabase });

    const saved = await repository.savePhraseFavourite({
      accountId: "account-123",
      favourite,
    });
    const duplicate = await repository.savePhraseFavourite({
      accountId: "account-123",
      favourite,
    });

    assert.deepEqual(saved, {
      id: "phrase-favourite-1",
      accountId: "account-123",
      favourite,
      createdAt: "2026-06-15T15:00:00.000Z",
    });
    assert.deepEqual(duplicate, saved);
    assert.deepEqual(await repository.listPhraseFavourites({ accountId: "account-123" }), [
      saved,
    ]);
    assert.deepEqual(await repository.listPhraseFavourites({ accountId: "other-account" }), []);
  });
});

function completeSignedInSoloGame() {
  let game = createSignedInSoloGame({
    accountId: "account-123",
    rowCount: 1,
    random: () => 0,
  });
  game = startGame(game);
  game = updateEntry(game, { rowIndex: 0, value: "brisk" });
  game = submitActiveSection(game);
  game = updateEntry(game, { rowIndex: 0, value: "teapot" });
  game = submitActiveSection(game);
  game = updateEntry(game, { rowIndex: 0, value: "ladder" });
  game = submitActiveSection(game);
  return revealBatch(game);
}

class MemoryStorage {
  #items = new Map();

  getItem(key) {
    return this.#items.get(key) ?? null;
  }

  setItem(key, value) {
    this.#items.set(key, String(value));
  }
}

function createFakePrivateFavouritesSupabase() {
  const rows = [];

  return {
    from(tableName) {
      assert.equal(tableName, "private_phrase_favourites");
      return new FakePrivateFavouritesQuery(rows);
    },
  };
}

class FakePrivateFavouritesQuery {
  constructor(rows) {
    this.rows = rows;
    this.filters = {};
    this.operation = "select";
    this.insertedRow = null;
  }

  insert(row) {
    this.operation = "insert";
    this.insertedRow = row;
    return this;
  }

  select() {
    return this;
  }

  eq(column, value) {
    this.filters[column] = value;
    return this;
  }

  order() {
    return this;
  }

  async maybeSingle() {
    if (this.operation === "insert") {
      const existingRow = this.rows.find(
        (row) =>
          row.account_id === this.insertedRow.account_id &&
          row.source_fingerprint === this.insertedRow.source_fingerprint,
      );

      if (existingRow) {
        return {
          data: null,
          error: {
            code: "23505",
            message: "duplicate private phrase favourite",
          },
        };
      }

      const row = {
        id: `phrase-favourite-${this.rows.length + 1}`,
        created_at: "2026-06-15T15:00:00.000Z",
        ...this.insertedRow,
      };
      this.rows.push(row);
      return { data: row, error: null };
    }

    return { data: this.#matchingRows()[0] ?? null, error: null };
  }

  then(resolve, reject) {
    return Promise.resolve({ data: this.#matchingRows(), error: null }).then(
      resolve,
      reject,
    );
  }

  #matchingRows() {
    return this.rows.filter((row) =>
      Object.entries(this.filters).every(([column, value]) => row[column] === value),
    );
  }
}
