import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  selectEntryCandidate,
  validateEntryAssistWeightPolicy,
} from "../assets/entry-assist-weight-policy.js";

const policy = JSON.parse(
  readFileSync(
    new URL("../assets/word-bank/entry-assist-weight-policy.json", import.meta.url),
    "utf8",
  ),
);

describe("Entry Assist Weight Policy", () => {
  it("defines 6/3/1 grade weights for adjectives and every noun band", () => {
    assert.equal(validateEntryAssistWeightPolicy(policy), true);
    assert.deepEqual(policy.entryKinds.adjective.gradeWeights, {
      common: 6,
      lessCommon: 3,
      rare: 1,
    });
    assert.equal(policy.entryKinds.noun.nounSemanticBands.length, 11);
    assert.deepEqual(policy.entryKinds.noun.gradeWeights, {
      common: 6,
      lessCommon: 3,
      rare: 1,
    });
  });

  it("selects a weighted non-empty noun cell before selecting uniformly within it", () => {
    const candidates = [
      noun("anchor", "Made Objects", "common"),
      noun("lantern", "Made Objects", "common"),
      noun("otter", "Animals and Plants", "rare"),
    ];

    assert.equal(
      selectEntryCandidate(candidates, {
        entryKind: "noun",
        policy,
        random: sequenceRandom(0.9, 0),
      }),
      "otter",
    );
    assert.equal(
      selectEntryCandidate(candidates, {
        entryKind: "noun",
        policy,
        random: sequenceRandom(0.1, 0.99),
      }),
      "lantern",
    );
  });

  it("uses adjective grade cells without a noun band", () => {
    assert.equal(
      selectEntryCandidate(
        [
          adjective("brisk", "common"),
          adjective("wondrous", "rare"),
        ],
        {
          entryKind: "adjective",
          policy,
          random: sequenceRandom(0.9, 0),
        },
      ),
      "wondrous",
    );
  });

  it("preserves repeat avoidance before weighted selection", () => {
    assert.equal(
      selectEntryCandidate(
        [
          adjective("brisk", "common"),
          adjective("wondrous", "rare"),
        ],
        {
          entryKind: "adjective",
          policy,
          random: sequenceRandom(0, 0),
          usedCandidateKeys: ["brisk"],
        },
      ),
      "wondrous",
    );
  });

  it("falls back uniformly within the same candidates when policy or metadata is invalid", () => {
    const candidates = [
      adjective("brisk", "common"),
      adjective("wondrous", "rare"),
    ];

    assert.equal(
      selectEntryCandidate(candidates, {
        entryKind: "adjective",
        policy: { schemaVersion: 99 },
        random: () => 0.75,
      }),
      "wondrous",
    );
    assert.equal(
      selectEntryCandidate(["brisk", "wondrous"], {
        entryKind: "adjective",
        policy,
        random: () => 0.75,
      }),
      "wondrous",
    );
  });
});

function noun(canonicalText, nounSemanticBand, commonnessGrade) {
  return {
    canonicalText,
    entryKind: "noun",
    nounSemanticBand,
    commonnessGrade,
  };
}

function adjective(canonicalText, commonnessGrade) {
  return {
    canonicalText,
    entryKind: "adjective",
    commonnessGrade,
  };
}

function sequenceRandom(...values) {
  let index = 0;
  return () => values[index++];
}
