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
import * as privateFavourites from "../assets/private-favourites.js";

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

  it("normalizes metadata-bearing Entry Candidates in Phrase Favourite snapshots", () => {
    const game = completeSignedInSoloGame();
    const entryCandidateProvider = {
      getEntryCandidates(entryKind) {
        return {
          adjective: [
            {
              canonicalText: "Brisk",
              entryKind: "adjective",
              source: "test",
            },
          ],
          noun: [
            {
              canonicalText: "Teapot",
              entryKind: "noun",
              source: "test",
            },
            {
              canonicalText: "Ladder",
              entryKind: "noun",
              source: "test",
            },
          ],
        }[entryKind] ?? [];
      },
    };

    const snapshot = createPhraseFavouriteSnapshot(game, {
      rowIndex: 0,
      entryCandidateProvider,
    });

    assert.equal(snapshot.phraseText, "Brisk Teapot Ladder");
    assert.deepEqual(snapshot.entries, [
      { entryKind: "adjective", value: "brisk", displayValue: "Brisk" },
      { entryKind: "noun", value: "teapot", displayValue: "Teapot" },
      { entryKind: "noun", value: "ladder", displayValue: "Ladder" },
    ]);
  });

  it("creates an immutable Batch Favourite snapshot from a revealed signed-in Solo Game", () => {
    assert.equal(typeof privateFavourites.createBatchFavouriteSnapshot, "function");

    const game = completeTwoRowSignedInSoloGame();
    const snapshot = privateFavourites.createBatchFavouriteSnapshot(game, {
      wordBank: {
        entryKinds: {
          adjective: ["Brisk", "Zippy"],
          noun: ["Teapot", "Ladder", "Helmet", "Rocket"],
        },
      },
    });

    assert.deepEqual(snapshot, {
      type: "batch",
      sourceMode: "signed-in-solo",
      templateId: "default-adjective-noun-noun",
      rowCount: 2,
      phrases: ["Brisk Teapot Ladder", "Zippy Helmet Rocket"],
      rows: [
        {
          rowIndex: 0,
          phraseText: "Brisk Teapot Ladder",
          entries: [
            { entryKind: "adjective", value: "brisk", displayValue: "Brisk" },
            { entryKind: "noun", value: "teapot", displayValue: "Teapot" },
            { entryKind: "noun", value: "ladder", displayValue: "Ladder" },
          ],
        },
        {
          rowIndex: 1,
          phraseText: "Zippy Helmet Rocket",
          entries: [
            { entryKind: "adjective", value: "zippy", displayValue: "Zippy" },
            { entryKind: "noun", value: "helmet", displayValue: "Helmet" },
            { entryKind: "noun", value: "rocket", displayValue: "Rocket" },
          ],
        },
      ],
    });
  });

  it("matches Favourite snapshots after Supabase jsonb key reordering", () => {
    const favourite = createPhraseFavouriteSnapshot(completeSignedInSoloGame(), {
      rowIndex: 0,
    });
    const reorderedFavourite = {
      entries: favourite.entries.map((entry) => ({
        displayValue: entry.displayValue,
        entryKind: entry.entryKind,
        value: entry.value,
      })),
      phraseText: favourite.phraseText,
      rowIndex: favourite.rowIndex,
      sourceMode: favourite.sourceMode,
      templateId: favourite.templateId,
      type: favourite.type,
    };

    assert.notEqual(JSON.stringify(reorderedFavourite), JSON.stringify(favourite));
    assert.equal(
      privateFavourites.areFavouriteSnapshotsEqual(reorderedFavourite, favourite),
      true,
    );
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

  it("removes Phrase Favourites only for their Account", async () => {
    let nextId = 1;
    const repository = createMemoryPrivateFavouritesRepository({
      createId: () => `phrase-favourite-${nextId++}`,
      now: () => "2026-06-15T15:00:00.000Z",
    });
    const favourite = createPhraseFavouriteSnapshot(completeSignedInSoloGame(), {
      rowIndex: 0,
    });

    const saved = await repository.savePhraseFavourite({
      accountId: "account-123",
      favourite,
    });
    const otherSaved = await repository.savePhraseFavourite({
      accountId: "other-account",
      favourite,
    });

    await repository.removePhraseFavourite({
      accountId: "other-account",
      favouriteId: saved.id,
    });
    assert.deepEqual(await repository.listPhraseFavourites({ accountId: "account-123" }), [
      saved,
    ]);
    assert.deepEqual(await repository.listPhraseFavourites({ accountId: "other-account" }), [
      otherSaved,
    ]);

    await repository.removePhraseFavourite({
      accountId: "account-123",
      favouriteId: saved.id,
    });

    assert.deepEqual(await repository.listPhraseFavourites({ accountId: "account-123" }), []);
    assert.deepEqual(await repository.listPhraseFavourites({ accountId: "other-account" }), [
      otherSaved,
    ]);
  });

  it("saves and lists Batch Favourites only for their Account", async () => {
    const repository = createMemoryPrivateFavouritesRepository({
      createId: () => "batch-favourite-1",
      now: () => "2026-06-15T16:30:00.000Z",
    });
    assert.equal(typeof repository.saveBatchFavourite, "function");
    assert.equal(typeof repository.listBatchFavourites, "function");

    const favourite = privateFavourites.createBatchFavouriteSnapshot(
      completeTwoRowSignedInSoloGame(),
    );

    const saved = await repository.saveBatchFavourite({
      accountId: "account-123",
      favourite,
    });
    const duplicate = await repository.saveBatchFavourite({
      accountId: "account-123",
      favourite,
    });

    assert.deepEqual(saved, {
      id: "batch-favourite-1",
      accountId: "account-123",
      favourite,
      createdAt: "2026-06-15T16:30:00.000Z",
    });
    assert.deepEqual(duplicate, saved);
    assert.deepEqual(await repository.listBatchFavourites({ accountId: "account-123" }), [
      saved,
    ]);
    assert.deepEqual(await repository.listBatchFavourites({ accountId: "other-account" }), []);
  });

  it("removes Batch Favourites only for their Account", async () => {
    let nextId = 1;
    const repository = createMemoryPrivateFavouritesRepository({
      createId: () => `batch-favourite-${nextId++}`,
      now: () => "2026-06-15T16:30:00.000Z",
    });
    const favourite = privateFavourites.createBatchFavouriteSnapshot(
      completeTwoRowSignedInSoloGame(),
    );

    const saved = await repository.saveBatchFavourite({
      accountId: "account-123",
      favourite,
    });
    const otherSaved = await repository.saveBatchFavourite({
      accountId: "other-account",
      favourite,
    });

    await repository.removeBatchFavourite({
      accountId: "other-account",
      favouriteId: saved.id,
    });
    assert.deepEqual(await repository.listBatchFavourites({ accountId: "account-123" }), [
      saved,
    ]);

    await repository.removeBatchFavourite({
      accountId: "account-123",
      favouriteId: saved.id,
    });

    assert.deepEqual(await repository.listBatchFavourites({ accountId: "account-123" }), []);
    assert.deepEqual(await repository.listBatchFavourites({ accountId: "other-account" }), [
      otherSaved,
    ]);
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

  it("removes local test Phrase Favourites from account-scoped storage", async () => {
    let nextId = 1;
    const storage = new MemoryStorage();
    const favourite = createPhraseFavouriteSnapshot(completeSignedInSoloGame(), {
      rowIndex: 0,
    });
    const repository = createLocalTestPrivateFavouritesRepository(storage, {
      createId: () => `phrase-favourite-${nextId++}`,
      now: () => "2026-06-15T15:00:00.000Z",
    });

    const saved = await repository.savePhraseFavourite({
      accountId: "account-123",
      favourite,
    });
    const otherSaved = await repository.savePhraseFavourite({
      accountId: "other-account",
      favourite,
    });

    await repository.removePhraseFavourite({
      accountId: "other-account",
      favouriteId: saved.id,
    });
    await repository.removePhraseFavourite({
      accountId: "account-123",
      favouriteId: saved.id,
    });

    const restoredRepository = createLocalTestPrivateFavouritesRepository(storage);

    assert.deepEqual(
      await restoredRepository.listPhraseFavourites({ accountId: "account-123" }),
      [],
    );
    assert.deepEqual(
      await restoredRepository.listPhraseFavourites({ accountId: "other-account" }),
      [otherSaved],
    );
  });

  it("recovers local test Batch Favourites from account-scoped storage", async () => {
    const storage = new MemoryStorage();
    const favourite = privateFavourites.createBatchFavouriteSnapshot(
      completeTwoRowSignedInSoloGame(),
    );
    const repository = createLocalTestPrivateFavouritesRepository(storage, {
      createId: () => "batch-favourite-1",
      now: () => "2026-06-15T16:30:00.000Z",
    });
    assert.equal(typeof repository.saveBatchFavourite, "function");
    assert.equal(typeof repository.listBatchFavourites, "function");

    await repository.saveBatchFavourite({
      accountId: "account-123",
      favourite,
    });

    const restoredRepository = createLocalTestPrivateFavouritesRepository(storage);

    assert.deepEqual(
      await restoredRepository.listBatchFavourites({ accountId: "account-123" }),
      [
        {
          id: "batch-favourite-1",
          accountId: "account-123",
          favourite,
          createdAt: "2026-06-15T16:30:00.000Z",
        },
      ],
    );
    assert.deepEqual(
      await restoredRepository.listBatchFavourites({ accountId: "other-account" }),
      [],
    );
  });

  it("removes local test Batch Favourites from account-scoped storage", async () => {
    let nextId = 1;
    const storage = new MemoryStorage();
    const favourite = privateFavourites.createBatchFavouriteSnapshot(
      completeTwoRowSignedInSoloGame(),
    );
    const repository = createLocalTestPrivateFavouritesRepository(storage, {
      createId: () => `batch-favourite-${nextId++}`,
      now: () => "2026-06-15T16:30:00.000Z",
    });

    const saved = await repository.saveBatchFavourite({
      accountId: "account-123",
      favourite,
    });
    const otherSaved = await repository.saveBatchFavourite({
      accountId: "other-account",
      favourite,
    });

    await repository.removeBatchFavourite({
      accountId: "other-account",
      favouriteId: saved.id,
    });
    await repository.removeBatchFavourite({
      accountId: "account-123",
      favouriteId: saved.id,
    });

    const restoredRepository = createLocalTestPrivateFavouritesRepository(storage);

    assert.deepEqual(
      await restoredRepository.listBatchFavourites({ accountId: "account-123" }),
      [],
    );
    assert.deepEqual(
      await restoredRepository.listBatchFavourites({ accountId: "other-account" }),
      [otherSaved],
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

  it("removes Phrase Favourites through account-scoped Supabase rows", async () => {
    const favourite = createPhraseFavouriteSnapshot(completeSignedInSoloGame(), {
      rowIndex: 0,
    });
    const supabase = createFakePrivateFavouritesSupabase();
    const repository = createSupabasePrivateFavouritesRepository({ supabase });

    const saved = await repository.savePhraseFavourite({
      accountId: "account-123",
      favourite,
    });
    const otherSaved = await repository.savePhraseFavourite({
      accountId: "other-account",
      favourite,
    });

    await repository.removePhraseFavourite({
      accountId: "other-account",
      favouriteId: saved.id,
    });
    assert.deepEqual(await repository.listPhraseFavourites({ accountId: "account-123" }), [
      saved,
    ]);

    await repository.removePhraseFavourite({
      accountId: "account-123",
      favouriteId: saved.id,
    });

    assert.deepEqual(await repository.listPhraseFavourites({ accountId: "account-123" }), []);
    assert.deepEqual(await repository.listPhraseFavourites({ accountId: "other-account" }), [
      otherSaved,
    ]);
  });

  it("reports Supabase Phrase Favourite remove failures", async () => {
    const favourite = createPhraseFavouriteSnapshot(completeSignedInSoloGame(), {
      rowIndex: 0,
    });
    const supabase = createFakePrivateFavouritesSupabase({
      deleteErrorByTable: {
        private_phrase_favourites: { message: "delete denied" },
      },
    });
    const repository = createSupabasePrivateFavouritesRepository({ supabase });
    const saved = await repository.savePhraseFavourite({
      accountId: "account-123",
      favourite,
    });

    await assert.rejects(
      () =>
        repository.removePhraseFavourite({
          accountId: "account-123",
          favouriteId: saved.id,
        }),
      /Could not remove private Phrase Favourite: delete denied/,
    );
  });

  it("saves and lists Batch Favourites through Supabase rows", async () => {
    const favourite = privateFavourites.createBatchFavouriteSnapshot(
      completeTwoRowSignedInSoloGame(),
    );
    const supabase = createFakePrivateFavouritesSupabase();
    const repository = createSupabasePrivateFavouritesRepository({ supabase });
    assert.equal(typeof repository.saveBatchFavourite, "function");
    assert.equal(typeof repository.listBatchFavourites, "function");

    const saved = await repository.saveBatchFavourite({
      accountId: "account-123",
      favourite,
    });
    const duplicate = await repository.saveBatchFavourite({
      accountId: "account-123",
      favourite,
    });

    assert.deepEqual(saved, {
      id: "batch-favourite-1",
      accountId: "account-123",
      favourite,
      createdAt: "2026-06-15T16:30:00.000Z",
    });
    assert.deepEqual(duplicate, saved);
    assert.deepEqual(await repository.listBatchFavourites({ accountId: "account-123" }), [
      saved,
    ]);
    assert.deepEqual(await repository.listBatchFavourites({ accountId: "other-account" }), []);
  });

  it("removes Batch Favourites through account-scoped Supabase rows", async () => {
    const favourite = privateFavourites.createBatchFavouriteSnapshot(
      completeTwoRowSignedInSoloGame(),
    );
    const supabase = createFakePrivateFavouritesSupabase();
    const repository = createSupabasePrivateFavouritesRepository({ supabase });

    const saved = await repository.saveBatchFavourite({
      accountId: "account-123",
      favourite,
    });
    const otherSaved = await repository.saveBatchFavourite({
      accountId: "other-account",
      favourite,
    });

    await repository.removeBatchFavourite({
      accountId: "other-account",
      favouriteId: saved.id,
    });
    assert.deepEqual(await repository.listBatchFavourites({ accountId: "account-123" }), [
      saved,
    ]);

    await repository.removeBatchFavourite({
      accountId: "account-123",
      favouriteId: saved.id,
    });

    assert.deepEqual(await repository.listBatchFavourites({ accountId: "account-123" }), []);
    assert.deepEqual(await repository.listBatchFavourites({ accountId: "other-account" }), [
      otherSaved,
    ]);
  });

  it("reports Supabase Batch Favourite remove failures", async () => {
    const favourite = privateFavourites.createBatchFavouriteSnapshot(
      completeTwoRowSignedInSoloGame(),
    );
    const supabase = createFakePrivateFavouritesSupabase({
      deleteErrorByTable: {
        private_batch_favourites: { message: "delete denied" },
      },
    });
    const repository = createSupabasePrivateFavouritesRepository({ supabase });
    const saved = await repository.saveBatchFavourite({
      accountId: "account-123",
      favourite,
    });

    await assert.rejects(
      () =>
        repository.removeBatchFavourite({
          accountId: "account-123",
          favouriteId: saved.id,
        }),
      /Could not remove private Batch Favourite: delete denied/,
    );
  });

  it("reports Supabase Batch Favourite save failures", async () => {
    const favourite = privateFavourites.createBatchFavouriteSnapshot(
      completeTwoRowSignedInSoloGame(),
    );
    const supabase = createFakePrivateFavouritesSupabase({
      insertErrorByTable: {
        private_batch_favourites: { message: "provider down" },
      },
    });
    const repository = createSupabasePrivateFavouritesRepository({ supabase });

    await assert.rejects(
      () =>
        repository.saveBatchFavourite({
          accountId: "account-123",
          favourite,
        }),
      /Could not save private Batch Favourite: provider down/,
    );
  });

  it("rejects malformed Supabase Batch Favourite rows", async () => {
    const supabase = createFakePrivateFavouritesSupabase({
      rowsByTable: {
        private_batch_favourites: [
          {
            id: "batch-favourite-1",
            account_id: "account-123",
            favourite: {
              type: "batch",
              sourceMode: "signed-in-solo",
              templateId: "default-adjective-noun-noun",
              rowCount: 2,
              phrases: ["Only one phrase"],
              rows: [],
            },
            created_at: "2026-06-15T16:30:00.000Z",
            source_fingerprint: "malformed-batch",
          },
        ],
      },
    });
    const repository = createSupabasePrivateFavouritesRepository({ supabase });

    await assert.rejects(
      () => repository.listBatchFavourites({ accountId: "account-123" }),
      /A valid private Batch Favourite row is required/,
    );
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

function completeTwoRowSignedInSoloGame() {
  let game = createSignedInSoloGame({
    accountId: "account-123",
    rowCount: 2,
    random: () => 0,
  });
  game = startGame(game);
  game = updateEntry(game, { rowIndex: 0, value: "brisk" });
  game = updateEntry(game, { rowIndex: 1, value: "zippy" });
  game = submitActiveSection(game);
  game = updateEntry(game, { rowIndex: 0, value: "teapot" });
  game = updateEntry(game, { rowIndex: 1, value: "helmet" });
  game = submitActiveSection(game);
  game = updateEntry(game, { rowIndex: 0, value: "ladder" });
  game = updateEntry(game, { rowIndex: 1, value: "rocket" });
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

function createFakePrivateFavouritesSupabase({
  deleteErrorByTable = {},
  insertErrorByTable = {},
  rowsByTable: initialRowsByTable = {},
} = {}) {
  const rowsByTable = new Map([
    ["private_phrase_favourites", []],
    ["private_batch_favourites", []],
  ]);
  for (const [tableName, rows] of Object.entries(initialRowsByTable)) {
    assert.ok(rowsByTable.has(tableName), `Unexpected table ${tableName}`);
    rowsByTable.set(
      tableName,
      rows.map((row) => ({ ...row })),
    );
  }

  return {
    from(tableName) {
      assert.ok(rowsByTable.has(tableName), `Unexpected table ${tableName}`);
      return new FakePrivateFavouritesQuery(rowsByTable.get(tableName), {
        deleteError: deleteErrorByTable[tableName] ?? null,
        insertError: insertErrorByTable[tableName] ?? null,
        tableName,
      });
    },
  };
}

class FakePrivateFavouritesQuery {
  constructor(rows, { deleteError, insertError, tableName }) {
    this.rows = rows;
    this.deleteError = deleteError;
    this.insertError = insertError;
    this.tableName = tableName;
    this.filters = {};
    this.operation = "select";
    this.insertedRow = null;
  }

  insert(row) {
    this.operation = "insert";
    this.insertedRow = row;
    return this;
  }

  delete() {
    this.operation = "delete";
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
      if (this.insertError) {
        return {
          data: null,
          error: this.insertError,
        };
      }

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
            message: `duplicate ${this.tableName}`,
          },
        };
      }

      const row = {
        id: `${this.tableName === "private_batch_favourites" ? "batch" : "phrase"}-favourite-${this.rows.length + 1}`,
        created_at:
          this.tableName === "private_batch_favourites"
            ? "2026-06-15T16:30:00.000Z"
            : "2026-06-15T15:00:00.000Z",
        ...this.insertedRow,
      };
      this.rows.push(row);
      return { data: row, error: null };
    }

    return { data: this.#matchingRows()[0] ?? null, error: null };
  }

  then(resolve, reject) {
    if (this.operation === "delete") {
      if (this.deleteError) {
        return Promise.resolve({ data: null, error: this.deleteError }).then(
          resolve,
          reject,
        );
      }

      const matchingRows = this.#matchingRows();
      for (const row of matchingRows) {
        this.rows.splice(this.rows.indexOf(row), 1);
      }
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    }

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
