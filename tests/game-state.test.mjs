import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createAnonymousSoloGame,
  getActiveSection,
  renderPhrases,
  revealBatch,
  startGame,
  submitActiveSection,
  updateEntry,
} from "../assets/game-state.js";

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
});
