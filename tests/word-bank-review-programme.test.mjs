import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseEsdbSourceText } from "../tools/word-bank/word-bank-pipeline.js";
import {
  assignRemainingCatalogueTranches,
  assembleSemanticGapTranche,
  buildSemanticSuggestionIndex,
  buildInitialReviewProgramme,
  buildSourceCatalogue,
  completeActiveTranche,
  createBaselineTranche,
  planNextNounSemanticGap,
  planRemainingNounCatalogue,
  reconcileEsdbSourceRecords,
  reopenCompletedTranche,
  saveNextDecision,
  startNextTranche,
  validateCurationDecision,
  validateReviewRegister,
} from "../tools/word-bank/word-bank-review-programme.js";

describe("Word Bank review programme", () => {
  it("reconciles ESDB records before applying the pinned British/shared size profile", () => {
    const sourceRecords = [
      ...parseEsdbSourceText(
        [
          "40 [12dicts]: B: harbour <n>",
          "50 [12dicts]: A: color <n>",
          "50 [12dicts]: B: colour <n>",
          "60 [12dicts]: shared <n>",
          "60 [12dicts]: _: neutral <n>",
          "70 [12dicts]: Bv: draught <n>",
          "70 [12dicts]: BV: antient <n>",
          "85 [ukacd]: B: abolla <n>",
        ].join("\n"),
        { sourceFile: "data/scowl-pre.txt" },
      ),
      ...parseEsdbSourceText("[compound-adjustment]: B: harbour <n>", {
        sourceFile: "data/compounds-auto",
      }),
    ];

    const reconciled = reconcileEsdbSourceRecords(sourceRecords);
    const harbour = reconciled.find(
      (candidate) => candidate.canonicalText === "harbour",
    );

    assert.equal(harbour.resolvedSourceSize, 40);
    assert.deepEqual(harbour.sourceFiles, [
      "data/compounds-auto",
      "data/scowl-pre.txt",
    ]);

    const catalogue = buildSourceCatalogue({
      entryKind: "noun",
      sourceRecords,
      baselineCandidates: ["legacy keepsake"],
    });

    assert.deepEqual(
      catalogue.candidates.map((candidate) => candidate.canonicalText),
      ["colour", "draught", "harbour", "legacy keepsake", "neutral", "shared"],
    );
    assert.deepEqual(
      catalogue.candidates.find((candidate) => candidate.canonicalText === "harbour")
        .suggestions,
      { commonnessGrade: "common" },
    );
    assert.equal(
      catalogue.candidates.find(
        (candidate) => candidate.canonicalText === "legacy keepsake",
      ).baseline,
      true,
    );
    assert.equal(
      catalogue.candidates.some((candidate) => candidate.canonicalText === "color"),
      false,
    );
    assert.equal(
      catalogue.candidates.some((candidate) => candidate.canonicalText === "antient"),
      false,
    );
    assert.equal(
      catalogue.candidates.some((candidate) => candidate.canonicalText === "abolla"),
      false,
    );
  });

  it("rejects duplicate baseline candidates instead of hiding catalogue ambiguity", () => {
    assert.throws(
      () =>
        buildSourceCatalogue({
          entryKind: "noun",
          sourceRecords: [],
          baselineCandidates: ["keepsake", "Keepsake"],
        }),
      /duplicate baseline candidate/i,
    );
  });

  it("suggests a noun band only when every exact case-normalised sense collapses to it", () => {
    const suggestions = buildSemanticSuggestionIndex([
      {
        lexname: "person",
        synsets: {
          "teacher-person": { members: ["Teacher", "school_teacher"] },
          "guide-person": { members: ["guide"] },
        },
      },
      {
        lexname: "group",
        synsets: {
          "teacher-group": { members: ["teachers"] },
        },
      },
      {
        lexname: "artifact",
        synsets: {
          "guide-artifact": { members: ["guide"] },
        },
      },
      {
        lexname: "Tops",
        synsets: {
          generic: { members: ["entity"] },
        },
      },
    ]);

    assert.equal(suggestions.get("teacher"), "People and Groups");
    assert.equal(suggestions.get("school teacher"), "People and Groups");
    assert.equal(suggestions.has("guide"), false);
    assert.equal(suggestions.has("entity"), false);
  });

  it("validates complete noun and adjective decisions without promoting suggestions", () => {
    assert.deepEqual(
      validateCurationDecision(
        {
          ukEnglishEligible: true,
          familyFriendly: false,
          curationDecision: "Accept",
          commonnessGrade: "lessCommon",
          nounSemanticBand: "Ideas and Communication",
        },
        { entryKind: "noun" },
      ),
      [],
    );
    assert.deepEqual(
      validateCurationDecision(
        {
          ukEnglishEligible: true,
          familyFriendly: true,
          curationDecision: "Accept",
          commonnessGrade: "common",
        },
        { entryKind: "adjective" },
      ),
      [],
    );
    assert.deepEqual(
      validateCurationDecision(
        {
          ukEnglishEligible: false,
          familyFriendly: true,
          curationDecision: "Accept",
        },
        { entryKind: "noun" },
      ),
      [
        "Accept requires UK-English eligibility.",
        "Accept requires a Commonness Grade.",
        "Accept requires a Noun Semantic Band.",
      ],
    );
    assert.deepEqual(
      validateCurationDecision(
        {
          ukEnglishEligible: false,
          familyFriendly: true,
          curationDecision: "Reject",
          commonnessGrade: "rare",
        },
        { entryKind: "adjective" },
      ),
      ["Reject must not retain a Commonness Grade."],
    );
  });

  it("initialises fixed published baselines as planned evidence without adopting decisions", () => {
    const nounCatalogue = fixtureCatalogue(["anchor", "biscuit"]);
    const adjectiveCatalogue = {
      schemaVersion: 1,
      entryKind: "adjective",
      candidates: [
        {
          canonicalText: "brisk",
          entryKind: "adjective",
          baseline: true,
          sourceEvidence: null,
          suggestions: { commonnessGrade: "common" },
        },
      ],
    };
    const programme = buildInitialReviewProgramme({
      nounCatalogue,
      adjectiveCatalogue,
      catalogueIdentity: { id: "pinned-noun-catalogue", candidateCount: 2 },
      publishedNounCandidates: [
        { canonicalText: "anchor", curationStatus: "accepted" },
        { canonicalText: "biscuit", curationStatus: "accepted" },
      ],
      publishedAdjectiveCandidates: [
        { canonicalText: "brisk", curationStatus: "accepted" },
      ],
    });

    assert.deepEqual(
      programme.index.tranches.map(({ id, lifecycle }) => [id, lifecycle]),
      [
        ["noun-baseline", "planned"],
        ["adjective-baseline", "planned"],
      ],
    );
    assert.equal(programme.nounBaseline.candidates[0].decision, null);
    assert.equal(
      programme.nounBaseline.candidates[0].previouslyPublished.curationStatus,
      "accepted",
    );
    assert.equal(programme.adjectiveBaseline.candidates[0].decision, null);
  });

  it("validates exactly-once register coverage and keeps progress derived", () => {
    const catalogue = fixtureCatalogue(["anchor", "biscuit", "choir", "delight"]);
    const baseline = createBaselineTranche({
      id: "noun-baseline",
      entryKind: "noun",
      catalogue,
      candidateTexts: ["anchor", "biscuit"],
    });
    const later = {
      ...createBaselineTranche({
        id: "noun-later-001",
        entryKind: "noun",
        catalogue,
        candidateTexts: ["choir", "delight"],
      }),
      purpose: "catalogue",
    };
    const index = fixtureIndex([
      trancheReference(baseline, "complete"),
      trancheReference(later, "planned"),
    ]);

    assert.deepEqual(
      validateReviewRegister({
        catalogue,
        index,
        tranches: [baseline, later],
        requireCompleteCoverage: true,
      }),
      { reviewed: 0, total: 4 },
    );

    later.candidates[0].canonicalText = "anchor";
    assert.throws(
      () =>
        validateReviewRegister({
          catalogue,
          index,
          tranches: [baseline, later],
          requireCompleteCoverage: true,
        }),
      /assigned.*more than once.*choir.*missing/i,
    );
  });

  it("enforces explicit activation, strict sequential saves, completion, and correction queues", () => {
    const catalogue = fixtureCatalogue(["anchor", "biscuit"]);
    const tranche = createBaselineTranche({
      id: "noun-baseline",
      entryKind: "noun",
      catalogue,
      candidateTexts: ["anchor", "biscuit"],
    });
    let index = fixtureIndex([trancheReference(tranche, "planned")]);

    index = startNextTranche(index, { checkpointed: true });
    assert.equal(index.tranches[0].lifecycle, "active");
    assert.throws(
      () => saveNextDecision(tranche, 2, acceptedNounDecision("Body")),
      /candidate 1 must be reviewed first/i,
    );

    let saved = saveNextDecision(
      tranche,
      1,
      acceptedNounDecision("Made Objects"),
    );
    saved = saveNextDecision(saved, 2, {
      ukEnglishEligible: false,
      familyFriendly: true,
      curationDecision: "Reject",
    });
    index = completeActiveTranche(index, saved, { confirmed: true });
    assert.equal(index.tranches[0].lifecycle, "complete");

    ({ index, tranche: saved } = reopenCompletedTranche(index, saved, {
      selectedSequences: [2],
    }));
    assert.equal(index.tranches[0].lifecycle, "active");
    assert.equal(saved.candidates[1].pendingCorrection, true);
    assert.equal(saved.candidates[0].pendingCorrection, undefined);
  });

  it("assembles a deterministic semantic-gap tranche from least-represented accepted cells", () => {
    const catalogue = fixtureCatalogue(
      ["aardvark", "badger", "choir", "drum", "eel"],
      {
        aardvark: ["rare", "Animals and Plants"],
        badger: ["rare", "Animals and Plants"],
        choir: ["common", "People and Groups"],
        drum: ["common", "Made Objects"],
        eel: ["rare", "Animals and Plants"],
      },
    );
    const acceptedBaseline = [
      acceptedCatalogueCandidate("teacher", "common", "People and Groups"),
      acceptedCatalogueCandidate("lantern", "common", "Made Objects"),
    ];

    const tranche = assembleSemanticGapTranche({
      catalogue,
      assignedCandidateTexts: [],
      acceptedCandidates: acceptedBaseline,
      id: "noun-gap-001",
      limit: 3,
    });

    assert.deepEqual(
      tranche.candidates.map((candidate) => candidate.canonicalText),
      ["aardvark", "badger", "choir"],
    );
    assert.equal(tranche.purpose, "semanticGap");
  });

  it("assigns every remaining noun through rotating grade lanes and spread band buckets", () => {
    const catalogue = fixtureCatalogue(
      ["baseline", "apple", "apricot", "boat", "cloud", "drum", "eel", "fern"],
      {
        apple: ["common", "Animals and Plants"],
        apricot: ["common", "Animals and Plants"],
        boat: ["common", "Made Objects"],
        cloud: ["common", null],
        drum: ["lessCommon", "Made Objects"],
        eel: ["rare", "Animals and Plants"],
        fern: ["rare", "Animals and Plants"],
      },
    );

    const tranches = assignRemainingCatalogueTranches({
      catalogue,
      assignedCandidateTexts: ["baseline"],
      idPrefix: "noun-catalogue",
      limit: 2,
    });

    assert.deepEqual(
      tranches.map((tranche) => [
        tranche.suggestionLane,
        tranche.candidates.map((candidate) => candidate.canonicalText),
      ]),
      [
        ["common", ["apple", "boat"]],
        ["lessCommon", ["drum"]],
        ["rare", ["eel", "fern"]],
        ["common", ["cloud", "apricot"]],
      ],
    );
    assert.equal(
      new Set(
        tranches.flatMap((tranche) =>
          tranche.candidates.map((candidate) => candidate.canonicalText),
        ),
      ).size,
      7,
    );
    assert.ok(tranches.every((tranche) => tranche.purpose === "catalogue"));
  });

  it("separates automatic semantic-gap planning from approval-gated remaining catalogue assignment", () => {
    const catalogue = fixtureCatalogue(
      ["baseline", "apple", "drum", "eel"],
      {
        baseline: ["common", "People and Groups"],
        apple: ["common", "Animals and Plants"],
        drum: ["lessCommon", "Made Objects"],
        eel: ["rare", "Animals and Plants"],
      },
    );
    const baseline = createBaselineTranche({
      id: "noun-baseline",
      entryKind: "noun",
      catalogue,
      candidateTexts: ["baseline"],
    });
    baseline.candidates[0].decision = acceptedNounDecision("People and Groups");
    const index = fixtureIndex([trancheReference(baseline, "complete")]);

    const plannedGap = planNextNounSemanticGap({
      catalogue,
      index,
      tranches: [baseline],
      limit: 1,
    });

    assert.deepEqual(
      [plannedGap.tranche.id, plannedGap.tranche.purpose],
      ["noun-semantic-gap-001", "semanticGap"],
    );
    assert.equal(plannedGap.index.tranches.at(-1).lifecycle, "planned");

    plannedGap.tranche.candidates[0].decision = acceptedNounDecision(
      "Animals and Plants",
    );
    plannedGap.index.tranches.at(-1).lifecycle = "complete";
    const repeatedGap = planNextNounSemanticGap({
      catalogue,
      index: plannedGap.index,
      tranches: [baseline, plannedGap.tranche],
      limit: 1,
    });
    assert.equal(repeatedGap.tranche.id, "noun-semantic-gap-002");
    repeatedGap.tranche.candidates[0].decision = acceptedNounDecision(
      "Made Objects",
    );
    repeatedGap.index.tranches.at(-1).lifecycle = "complete";
    assert.throws(
      () =>
        planRemainingNounCatalogue({
          catalogue,
          index: repeatedGap.index,
          tranches: [baseline, plannedGap.tranche, repeatedGap.tranche],
          approved: false,
        }),
      /explicit allowlist approval/i,
    );

    const plannedRemaining = planRemainingNounCatalogue({
      catalogue,
      index: repeatedGap.index,
      tranches: [baseline, plannedGap.tranche, repeatedGap.tranche],
      approved: true,
      limit: 1,
    });

    assert.deepEqual(
      plannedRemaining.addedTranches.map((tranche) => [tranche.id, tranche.purpose]),
      [
        ["noun-catalogue-001", "catalogue"],
      ],
    );
    assert.doesNotThrow(() =>
      validateReviewRegister({
        catalogue,
        index: plannedRemaining.index,
        tranches: [
          baseline,
          plannedGap.tranche,
          repeatedGap.tranche,
          ...plannedRemaining.addedTranches,
        ],
        requireCompleteCoverage: true,
      }),
    );
  });
});

function fixtureCatalogue(candidateTexts, suggestions = {}) {
  return {
    schemaVersion: 1,
    entryKind: "noun",
    candidates: candidateTexts.map((canonicalText) => ({
      canonicalText,
      entryKind: "noun",
      baseline: false,
      sourceEvidence: null,
      suggestions: suggestions[canonicalText]
        ? {
            commonnessGrade: suggestions[canonicalText][0],
            nounSemanticBand: suggestions[canonicalText][1],
          }
        : {},
    })),
  };
}

function fixtureIndex(tranches) {
  return {
    schemaVersion: 1,
    catalogue: { id: "noun-test-catalogue", entryKind: "noun" },
    tranches,
  };
}

function trancheReference(tranche, lifecycle) {
  return {
    id: tranche.id,
    entryKind: tranche.entryKind,
    path: `tools/word-bank/review-data/tranches/${tranche.id}.json`,
    purpose: tranche.purpose,
    lifecycle,
  };
}

function acceptedNounDecision(nounSemanticBand) {
  return {
    ukEnglishEligible: true,
    familyFriendly: true,
    curationDecision: "Accept",
    commonnessGrade: "common",
    nounSemanticBand,
  };
}

function acceptedCatalogueCandidate(canonicalText, commonnessGrade, nounSemanticBand) {
  return {
    canonicalText,
    entryKind: "noun",
    decision: {
      ukEnglishEligible: true,
      familyFriendly: true,
      curationDecision: "Accept",
      commonnessGrade,
      nounSemanticBand,
    },
  };
}
