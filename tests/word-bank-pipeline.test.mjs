import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildProductionWordBank,
  buildReviewedDefaultShard,
  getCandidateForm,
  mapEsdbPosToEntryKind,
  parseEsdbSourceText,
  validateWordBankShard,
} from "../tools/word-bank/word-bank-pipeline.js";

const sourceConfig = {
  id: "esdb-scowl-v2",
  version: "test-revision",
  archiveSha256: "TESTHASH",
  license: "SCOWL compatible test fixture",
};

describe("Word Bank production pipeline", () => {
  it("maps ESDB adjective tags to the Crazy Phrases Entry Kind", () => {
    assert.equal(mapEsdbPosToEntryKind("aj"), "adjective");
    assert.equal(mapEsdbPosToEntryKind("n"), "noun");
    assert.equal(mapEsdbPosToEntryKind("av"), "adverb");
    assert.equal(mapEsdbPosToEntryKind("v"), "verb");
    assert.equal(mapEsdbPosToEntryKind("unknown"), null);
  });

  it("parses game-ready ESDB adjective source rows while filtering proper names", () => {
    const records = parseEsdbSourceText(
      [
        "35 [12dicts] [ukfreq]: brisk <aj>",
        "35 [12dicts]: topsy-turvy <aj>",
        "35 [12dicts]: crystal clear <aj>",
        "50 [name]: Aaronic <aj/person>",
        "35 [12dicts]: teapot <n>",
      ].join("\n"),
      { sourceFile: "data/scowl-pre.txt" },
    );

    assert.deepEqual(
      records.map((record) => record.canonicalText),
      ["brisk", "topsy-turvy", "crystal clear", "teapot"],
    );
    assert.equal(
      records.some((record) => record.canonicalText === "Aaronic"),
      false,
    );
  });

  it("classifies supported candidate forms and rejects arbitrary fragments", () => {
    assert.equal(getCandidateForm("brisk"), "singleWord");
    assert.equal(getCandidateForm("topsy-turvy"), "hyphenatedWord");
    assert.equal(getCandidateForm("crystal clear"), "openCompound");
    assert.equal(getCandidateForm("not a sentence fragment"), "unsupported");
    assert.equal(getCandidateForm("not_ok"), "unsupported");
  });

  it("builds deterministic metadata-bearing adjective shard output", () => {
    const result = buildProductionWordBank({
      curation: {
        schemaVersion: 1,
        entryKind: "adjective",
        version: "test-adjective-curation",
        shardVersion: "test-adjective-shard",
        shardPath: "assets/word-bank/shards/adjective.test.json",
        candidates: [
          accepted("crystal clear", {
            compoundReview: reviewedCompound("lexical colour/intensity adjective"),
          }),
          accepted("brisk"),
          accepted("topsy-turvy"),
          rejected("out of the blue", "phrase-like source entry"),
        ],
      },
      sourceConfig,
      sourceRecords: parseEsdbSourceText(
        [
          "35 [12dicts] [ukfreq]: brisk <aj>",
          "35 [12dicts]: topsy-turvy <aj>",
          "35 [12dicts]: crystal clear <aj>",
          "35 [12dicts]: out of the blue <aj>",
        ].join("\n"),
        { sourceFile: "data/scowl-pre.txt" },
      ),
    });

    assert.deepEqual(
      result.shard.candidates.map((candidate) => candidate.canonicalText),
      ["brisk", "crystal clear", "topsy-turvy"],
    );
    assert.deepEqual(
      result.shard.candidates.map((candidate) => candidate.candidateForm),
      ["singleWord", "openCompound", "hyphenatedWord"],
    );
    assert.deepEqual(result.shard.candidates[0], {
      canonicalText: "brisk",
      sourceId: "esdb-scowl-v2",
      sourceVersion: "test-revision",
      entryKind: "adjective",
      candidateForm: "singleWord",
      safetyStatus: "familyFriendly",
      curationStatus: "accepted",
      sourceFile: "data/scowl-pre.txt",
      sourceLine: 1,
      sourceSize: 35,
      sourceTags: ["12dicts", "ukfreq"],
    });
    assert.equal(result.manifest.entryKinds.adjective.path, result.shardPath);
    assert.equal(result.manifest.entryKinds.adjective.candidateCount, 3);
    assert.equal(result.review.counts.accepted, 3);
    assert.equal(result.review.counts.rejected, 1);
    assert.deepEqual(result.review.samples.adjective, [
      "brisk",
      "crystal clear",
      "topsy-turvy",
    ]);

    assert.doesNotThrow(() => validateWordBankShard(result.shard));
    assert.deepEqual(
      buildProductionWordBank({
        curation: result.curation,
        sourceConfig,
        sourceRecords: result.sourceRecords,
      }),
      result,
    );
  });

  it("builds deterministic metadata-bearing noun shard output", () => {
    const result = buildProductionWordBank({
      curation: {
        schemaVersion: 1,
        entryKind: "noun",
        version: "test-noun-curation",
        shardVersion: "test-noun-shard",
        shardPath: "assets/word-bank/shards/noun.test.json",
        candidates: [
          accepted("alarm clock", {
            compoundReview: reviewedCompound("lexical clock type"),
          }),
          accepted("teapot"),
          accepted("yo-yo"),
          rejected("once upon a time", "phrase-like source entry"),
        ],
      },
      sourceConfig,
      sourceRecords: parseEsdbSourceText(
        [
          "35 [12dicts] [ukfreq]: teapot <n>",
          "35 [12dicts]: yo-yo <n>",
          "35 [12dicts]: alarm clock <n>",
          "35 [12dicts]: once upon a time <n>",
        ].join("\n"),
        { sourceFile: "data/scowl-pre.txt" },
      ),
    });

    assert.deepEqual(
      result.shard.candidates.map((candidate) => candidate.canonicalText),
      ["alarm clock", "teapot", "yo-yo"],
    );
    assert.deepEqual(
      result.shard.candidates.map((candidate) => candidate.candidateForm),
      ["openCompound", "singleWord", "hyphenatedWord"],
    );
    assert.equal(result.shard.entryKind, "noun");
    assert.equal(result.manifest.entryKinds.noun.path, result.shardPath);
    assert.equal(result.manifest.entryKinds.noun.candidateCount, 3);
    assert.deepEqual(result.review.samples.noun, [
      "alarm clock",
      "teapot",
      "yo-yo",
    ]);

    assert.doesNotThrow(() => validateWordBankShard(result.shard));
    assert.deepEqual(
      buildProductionWordBank({
        curation: result.curation,
        sourceConfig,
        sourceRecords: result.sourceRecords,
      }),
      result,
    );
  });

  it("fails clearly for under-labelled accepted adjective candidates", () => {
    assert.throws(
      () =>
        buildProductionWordBank({
          curation: {
            schemaVersion: 1,
            entryKind: "adjective",
            version: "bad-curation",
            shardVersion: "bad-shard",
            shardPath: "assets/word-bank/shards/adjective.bad.json",
            candidates: [{ canonicalText: "brisk", curationStatus: "accepted" }],
          },
          sourceConfig,
          sourceRecords: parseEsdbSourceText("35 [12dicts]: brisk <aj>", {
            sourceFile: "data/scowl-pre.txt",
          }),
        }),
      /safetyStatus/i,
    );
  });

  it("rejects accepted open compounds that have not been reviewed", () => {
    assert.throws(
      () =>
        buildProductionWordBank({
          curation: {
            schemaVersion: 1,
            entryKind: "adjective",
            version: "bad-compound-curation",
            shardVersion: "bad-compound-shard",
            shardPath: "assets/word-bank/shards/adjective.bad-compound.json",
            candidates: [accepted("crystal clear")],
          },
          sourceConfig,
          sourceRecords: parseEsdbSourceText("35 [12dicts]: crystal clear <aj>", {
            sourceFile: "data/scowl-pre.txt",
          }),
        }),
      /open compounds require compoundReview/i,
    );
  });

  it("rejects accepted candidates without a matching safe source row", () => {
    assert.throws(
      () =>
        buildProductionWordBank({
          curation: {
            schemaVersion: 1,
            entryKind: "adjective",
            version: "bad-source-curation",
            shardVersion: "bad-source-shard",
            shardPath: "assets/word-bank/shards/adjective.bad-source.json",
            candidates: [accepted("brisk")],
          },
          sourceConfig,
          sourceRecords: parseEsdbSourceText("50 [name]: brisk <aj/person>", {
            sourceFile: "data/scowl-pre.txt",
          }),
        }),
      /No supported ESDB source row/i,
    );
  });

  it("builds a schema-v2 default shard only from approved completed review decisions", () => {
    const reviewProgramme = {
      index: {
        tranches: [
          { id: "noun-baseline", entryKind: "noun", lifecycle: "complete" },
          { id: "noun-semantic-gap-001", entryKind: "noun", lifecycle: "complete" },
        ],
      },
      tranches: [
        reviewedTranche("noun-baseline", [
          reviewedCandidate("anchor", acceptedReviewDecision("Made Objects")),
          reviewedCandidate("badger", {
            ...acceptedReviewDecision("Animals and Plants"),
            familyFriendly: false,
          }),
        ]),
        reviewedTranche("noun-semantic-gap-001", [
          reviewedCandidate("lantern", acceptedReviewDecision("Made Objects")),
          reviewedCandidate("rejected", {
            ukEnglishEligible: false,
            familyFriendly: true,
            curationDecision: "Reject",
            commonnessGrade: null,
            nounSemanticBand: null,
          }),
        ]),
      ],
    };

    assert.throws(
      () =>
        buildReviewedDefaultShard({
          approved: false,
          entryKind: "noun",
          includedTrancheIds: ["noun-baseline", "noun-semantic-gap-001"],
          reviewProgramme,
          sourceConfig,
          version: "noun-reviewed-v1",
        }),
      /explicit allowlist approval/i,
    );

    const shard = buildReviewedDefaultShard({
      approved: true,
      curationVersion: "issue245-reviewed-nouns",
      entryKind: "noun",
      includedTrancheIds: ["noun-baseline", "noun-semantic-gap-001"],
      reviewProgramme,
      semanticReference: {
        id: "open-english-wordnet-core",
        version: "2025",
        archiveSha256: "OEWNTESTHASH",
      },
      sourceConfig,
      version: "noun-reviewed-v1",
    });

    assert.equal(shard.schemaVersion, 2);
    assert.deepEqual(
      shard.candidates.map((candidate) => candidate.canonicalText),
      ["anchor", "lantern"],
    );
    assert.deepEqual(shard.candidates[0], {
      canonicalText: "anchor",
      sourceId: "esdb-scowl-v2",
      sourceVersion: "test-revision",
      entryKind: "noun",
      candidateForm: "singleWord",
      safetyStatus: "familyFriendly",
      curationStatus: "accepted",
      ukEnglishEligible: true,
      commonnessGrade: "common",
      nounSemanticBand: "Made Objects",
    });
    assert.deepEqual(shard.semanticReference, {
      id: "open-english-wordnet-core",
      version: "2025",
      archiveSha256: "OEWNTESTHASH",
    });
    assert.doesNotThrow(() => validateWordBankShard(shard));
  });
});

function accepted(canonicalText, overrides = {}) {
  return {
    canonicalText,
    curationStatus: "accepted",
    safetyStatus: "familyFriendly",
    ...overrides,
  };
}

function rejected(canonicalText, reason) {
  return {
    canonicalText,
    curationStatus: "rejected",
    rejectionReason: reason,
    safetyStatus: "familyFriendly",
  };
}

function reviewedCompound(note) {
  return {
    reviewer: "codex",
    reviewedOn: "2026-07-05",
    note,
  };
}

function reviewedTranche(id, candidates) {
  return { schemaVersion: 1, id, entryKind: "noun", candidates };
}

function reviewedCandidate(canonicalText, decision) {
  return { canonicalText, decision };
}

function acceptedReviewDecision(nounSemanticBand) {
  return {
    ukEnglishEligible: true,
    familyFriendly: true,
    curationDecision: "Accept",
    commonnessGrade: "common",
    nounSemanticBand,
  };
}
