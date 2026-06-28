import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createFavouriteRowModel,
  formatFavouriteSavedDate,
  getBatchFavouriteCopyText,
  getPhraseFavouriteCopyText,
} from "../assets/favourites-view-model.js";

describe("favourites view model", () => {
  it("formats saved timestamps as fixed UK English dates", () => {
    assert.equal(
      formatFavouriteSavedDate("2026-06-26T15:31:42.000Z"),
      "26 Jun 2026",
    );
  });

  it("uses Solo as the participant indicator for current solo snapshots", () => {
    const model = createFavouriteRowModel({
      kind: "phrase",
      record: {
        id: "phrase-1",
        accountId: "account-1",
        createdAt: "2026-06-26T15:31:42.000Z",
        favourite: {
          type: "phrase",
          sourceMode: "signed-in-solo",
          templateId: "default-adjective-noun-noun",
          rowIndex: 1,
          phraseText: "Brisk teapot ladder",
          entries: [],
        },
      },
      currentHandle: "player-test-account",
    });

    assert.equal(model.savedDateText, "26 Jun 2026");
    assert.equal(model.savedDateAccessibleText, "Saved 26 Jun 2026");
    assert.equal(model.participantIndicator, "Solo");
    assert.equal(
      model.accessibleLabel,
      "Phrase favourite, saved 26 Jun 2026, Solo",
    );
  });

  it("uses a compact batch accessible label with phrase count", () => {
    const model = createFavouriteRowModel({
      kind: "batch",
      record: {
        id: "batch-1",
        accountId: "account-1",
        createdAt: "2026-06-26T15:31:42.000Z",
        favourite: {
          type: "batch",
          sourceMode: "signed-in-solo",
          templateId: "default-adjective-noun-noun",
          rowCount: 2,
          phrases: ["Brisk teapot ladder", "Calm pencil umbrella"],
          rows: [],
        },
      },
      currentHandle: "player-test-account",
    });

    assert.equal(model.primaryText, "Batch favourite");
    assert.equal(model.detailText, "2 phrases");
    assert.equal(
      model.accessibleLabel,
      "Batch favourite, 2 phrases, saved 26 Jun 2026, Solo",
    );
  });

  it("creates immutable snapshot copy payloads", () => {
    const phraseRecord = {
      favourite: {
        phraseText: "Brisk teapot ladder",
      },
    };
    const batchRecord = {
      favourite: {
        phrases: ["Brisk teapot ladder", "Calm pencil umbrella"],
      },
    };

    assert.equal(getPhraseFavouriteCopyText(phraseRecord), "Brisk teapot ladder");
    assert.equal(
      getBatchFavouriteCopyText(batchRecord),
      "Crazy Phrases\nBrisk teapot ladder\nCalm pencil umbrella",
    );
  });
});
