import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createAnonymousSoloGame,
  generateEntryCandidate,
  getActiveSection,
  recoverAnonymousSoloGame,
  renderPhrases,
  revealBatch,
  serializeAnonymousSoloGame,
  startGame,
  submitActiveSection,
  updateEntry,
} from "../assets/game-state.js";

const seedWordBank = JSON.parse(
  readFileSync(new URL("../assets/word-bank-seed.json", import.meta.url), "utf8"),
);

describe("anonymous solo game state", () => {
  it("starts the default template with a concealed active section in resolved order", () => {
    const game = createAnonymousSoloGame({ rowCount: 20, random: () => 0.99 });

    assert.equal(game.mode, "anonymous-solo");
    assert.equal(game.rowCount, 20);
    assert.deepEqual(
      game.sections.map((section) => section.kind),
      ["adjective", "noun", "noun"],
    );
    assert.deepEqual(game.sectionOrder.toSorted(), [0, 1, 2]);
    assert.equal(game.activeSectionIndex, 0);
    assert.equal(game.started, false);

    const activeSection = getActiveSection(game);
    assert.equal(activeSection.kind, "noun");
    assert.equal(activeSection.label, "Fill these nouns");
    assert.equal(activeSection.rows.length, 20);
    assert.ok(activeSection.rows.every((row) => row.value === ""));
  });

  it("requires all active section rows before advancing", () => {
    let game = startGame(createAnonymousSoloGame({ rowCount: 2, random: () => 0 }));

    game = updateEntry(game, { rowIndex: 0, value: "peculiar" });
    assert.throws(() => submitActiveSection(game), /all rows/i);

    game = updateEntry(game, { rowIndex: 1, value: "luminous" });
    game = submitActiveSection(game);

    assert.equal(game.activeSectionIndex, 1);
    assert.deepEqual(
      game.sections[0].rows.map((row) => row.value),
      ["peculiar", "luminous"],
    );
    assert.equal(game.sections[0].locked, true);
  });

  it("does not reveal or accept further entries until all sections are submitted", () => {
    let game = startGame(createAnonymousSoloGame({ rowCount: 1, random: () => 0 }));

    game = updateEntry(game, { rowIndex: 0, value: "peculiar" });
    game = submitActiveSection(game);

    assert.throws(() => revealBatch(game), /every section/i);

    game = updateEntry(game, { rowIndex: 0, value: "turnip" });
    game = submitActiveSection(game);
    game = updateEntry(game, { rowIndex: 0, value: "orchestra" });
    game = submitActiveSection(game);

    assert.throws(
      () => updateEntry(game, { rowIndex: 0, value: "rewritten" }),
      /complete/i,
    );
  });

  it("reveals completed phrases in original row order", () => {
    let game = startGame(createAnonymousSoloGame({ rowCount: 2, random: () => 0 }));

    game = updateEntry(game, { rowIndex: 0, value: "  peculiar " });
    game = updateEntry(game, { rowIndex: 1, value: "luminous" });
    game = submitActiveSection(game);

    game = updateEntry(game, { rowIndex: 0, value: " turnip" });
    game = updateEntry(game, { rowIndex: 1, value: "biscuit  " });
    game = submitActiveSection(game);

    game = updateEntry(game, { rowIndex: 0, value: "  orchestra" });
    game = updateEntry(game, { rowIndex: 1, value: "cabinet" });
    game = submitActiveSection(game);

    game = revealBatch(game);

    assert.equal(game.revealed, true);
    assert.deepEqual(renderPhrases(game), [
      "Peculiar turnip orchestra",
      "Luminous biscuit cabinet",
    ]);
  });

  it("recovers a serialized local anonymous solo game with its resolved progress", () => {
    let game = startGame(createAnonymousSoloGame({ rowCount: 2, random: () => 0 }));

    game = updateEntry(game, { rowIndex: 0, value: "peculiar" });
    game = updateEntry(game, { rowIndex: 1, value: "luminous" });
    game = submitActiveSection(game);
    game = generateEntryCandidate(game, {
      rowIndex: 0,
      wordBank: {
        entryKinds: {
          adjective: ["brisk"],
          noun: ["teapot", "cabinet"],
        },
      },
      random: () => 0,
    });

    const recoveredGame = recoverAnonymousSoloGame(
      serializeAnonymousSoloGame(game),
    );

    assert.deepEqual(recoveredGame, game);
    assert.deepEqual(recoveredGame.sectionOrder, [0, 1, 2]);
    assert.equal(recoveredGame.activeSectionIndex, 1);
    assert.equal(getActiveSection(recoveredGame).rows[0].value, "teapot");
  });

  it("ignores invalid local anonymous solo recovery payloads", () => {
    assert.equal(recoverAnonymousSoloGame(null), null);
    assert.equal(recoverAnonymousSoloGame("not json"), null);
    assert.equal(
      recoverAnonymousSoloGame(
        JSON.stringify({
          schemaVersion: 0,
          game: createAnonymousSoloGame({ rowCount: 2 }),
        }),
      ),
      null,
    );
    assert.equal(
      recoverAnonymousSoloGame(
        JSON.stringify({
          schemaVersion: 1,
          game: { mode: "signed-in-solo" },
        }),
      ),
      null,
    );
  });

  it("normalizes Word Bank matches for display without rewriting stored entries", () => {
    const wordBank = {
      entryKinds: {
        adjective: ["brisk"],
        noun: ["teapot"],
      },
    };
    let game = startGame(createAnonymousSoloGame({ rowCount: 1, random: () => 0 }));

    game = updateEntry(game, { rowIndex: 0, value: "BRISK" });
    game = submitActiveSection(game);
    game = updateEntry(game, { rowIndex: 0, value: "TEAPOT" });
    game = submitActiveSection(game);
    game = updateEntry(game, { rowIndex: 0, value: "QwOrbLe" });
    game = submitActiveSection(game);
    game = revealBatch(game);

    assert.deepEqual(
      game.sections.map((section) => section.rows[0].value),
      ["BRISK", "TEAPOT", "QwOrbLe"],
    );
    assert.deepEqual(renderPhrases(game, { wordBank }), [
      "Brisk teapot QwOrbLe",
    ]);
  });

  it("does not add phrase or row numbers to rendered phrase text", () => {
    let game = startGame(createAnonymousSoloGame({ rowCount: 1, random: () => 0 }));

    game = updateEntry(game, { rowIndex: 0, value: "brisk" });
    game = submitActiveSection(game);
    game = updateEntry(game, { rowIndex: 0, value: "teapot" });
    game = submitActiveSection(game);
    game = updateEntry(game, { rowIndex: 0, value: "ladder" });
    game = submitActiveSection(game);
    game = revealBatch(game);

    assert.deepEqual(renderPhrases(game), ["Brisk teapot ladder"]);
  });

  it("does not accept entries before the phrase count is locked in", () => {
    const game = createAnonymousSoloGame({ rowCount: 2, random: () => 0 });

    assert.throws(
      () => updateEntry(game, { rowIndex: 0, value: "peculiar" }),
      /start/i,
    );

    const startedGame = startGame(game);
    const updatedGame = updateEntry(startedGame, {
      rowIndex: 0,
      value: "peculiar",
    });

    assert.equal(updatedGame.sections[0].rows[0].value, "peculiar");
  });

  it("fills a requested row from the active section entry kind", () => {
    const wordBank = {
      entryKinds: {
        adjective: ["brisk", "calm"],
        noun: ["teapot"],
      },
    };
    let game = startGame(createAnonymousSoloGame({ rowCount: 2, random: () => 0 }));

    game = generateEntryCandidate(game, {
      rowIndex: 1,
      wordBank,
      random: () => 0,
    });

    assert.equal(game.sections[0].rows[0].value, "");
    assert.equal(game.sections[0].rows[1].value, "brisk");
  });

  it("avoids repeated dice candidates per entry kind until candidates are exhausted", () => {
    const wordBank = {
      entryKinds: {
        adjective: ["brisk", "calm"],
        noun: ["teapot"],
      },
    };
    let game = startGame(createAnonymousSoloGame({ rowCount: 3, random: () => 0 }));

    game = generateEntryCandidate(game, {
      rowIndex: 0,
      wordBank,
      random: () => 0,
    });
    game = generateEntryCandidate(game, {
      rowIndex: 1,
      wordBank,
      random: () => 0,
    });
    game = generateEntryCandidate(game, {
      rowIndex: 2,
      wordBank,
      random: () => 0,
    });

    assert.deepEqual(
      game.sections[0].rows.map((row) => row.value),
      ["brisk", "calm", "brisk"],
    );
  });
});

describe("seed Word Bank", () => {
  it("loads a family-friendly adjective and noun seed asset", () => {
    assert.equal(seedWordBank.metadata.version, "2026-06-issue-3-seed");
    assert.equal(seedWordBank.metadata.familyFriendly, true);
    assert.equal(seedWordBank.entryKinds.adjective.length >= 90, true);
    assert.equal(seedWordBank.entryKinds.noun.length >= 180, true);
  });

  it("keeps seed entries unique and suitable for family-friendly play", () => {
    const unsuitableTerms = new Set([
      "blood",
      "damn",
      "hate",
      "hell",
      "kill",
      "murder",
      "nude",
      "sex",
      "weapon",
    ]);

    for (const [entryKind, entries] of Object.entries(seedWordBank.entryKinds)) {
      const normalizedEntries = entries.map((entry) => entry.trim().toLowerCase());

      assert.deepEqual(
        normalizedEntries,
        [...new Set(normalizedEntries)],
        `${entryKind} entries should be unique`,
      );

      assert.equal(
        normalizedEntries.every((entry) => !unsuitableTerms.has(entry)),
        true,
        `${entryKind} entries should avoid obvious unsuitable terms`,
      );
    }
  });
});
