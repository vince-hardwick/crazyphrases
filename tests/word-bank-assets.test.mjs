import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateWordBankShard } from "../tools/word-bank/word-bank-pipeline.js";

const manifest = readJson("../assets/word-bank/manifest.json");
const adjectiveShard = readJson(
  "../assets/word-bank/shards/adjective.2026-07-05-esdb-v2-1e5b7d3-tracer.json",
);
const nounShard = readJson(
  "../assets/word-bank/shards/noun.2026-07-05-esdb-v2-1e5b7d3-noun-tracer.json",
);

describe("production Word Bank assets", () => {
  it("commits a manifest that references immutable adjective and noun shards", () => {
    const adjectiveReference = manifest.entryKinds.adjective;
    const nounReference = manifest.entryKinds.noun;

    assert.equal(manifest.schemaVersion, 1);
    assert.equal(adjectiveReference.entryKind, "adjective");
    assert.equal(adjectiveReference.version, adjectiveShard.version);
    assert.equal(
      adjectiveReference.path,
      "assets/word-bank/shards/adjective.2026-07-05-esdb-v2-1e5b7d3-tracer.json",
    );
    assert.equal(adjectiveReference.candidateCount, adjectiveShard.candidates.length);
    assert.equal(adjectiveReference.familyFriendly, true);

    assert.ok(nounReference);
    assert.equal(nounReference.entryKind, "noun");
    assert.match(
      nounReference.path,
      /^assets\/word-bank\/shards\/noun\.[a-z0-9.-]+\.json$/,
    );
    assert.equal(nounReference.version, nounShard.version);
    assert.equal(nounReference.candidateCount, nounShard.candidates.length);
    assert.equal(nounReference.familyFriendly, true);
  });

  it("commits a family-friendly metadata-bearing adjective shard", () => {
    validateWordBankShard(adjectiveShard);

    assert.equal(adjectiveShard.entryKind, "adjective");
    assert.equal(adjectiveShard.source.id, "esdb-scowl-v2");
    assert.equal(
      adjectiveShard.source.version,
      "1e5b7d3a72f47a71da5d28686c1dd4b397178485",
    );
    assert.equal(adjectiveShard.candidates.length >= 100, true);
    assert.equal(
      adjectiveShard.candidates.every(
        (candidate) =>
          candidate.entryKind === "adjective" &&
          candidate.safetyStatus === "familyFriendly" &&
          candidate.curationStatus === "accepted",
      ),
      true,
    );
    assert.equal(
      adjectiveShard.candidates.some(
        (candidate) => candidate.candidateForm === "hyphenatedWord",
      ),
      true,
    );
    assert.equal(
      adjectiveShard.candidates.some(
        (candidate) => candidate.candidateForm === "openCompound",
      ),
      true,
    );
  });

  it("commits a family-friendly metadata-bearing noun shard", () => {
    validateWordBankShard(nounShard);

    assert.equal(nounShard.entryKind, "noun");
    assert.equal(nounShard.source.id, "esdb-scowl-v2");
    assert.equal(
      nounShard.source.version,
      "1e5b7d3a72f47a71da5d28686c1dd4b397178485",
    );
    assert.equal(nounShard.candidates.length >= 200, true);
    assert.equal(
      nounShard.candidates.every(
        (candidate) =>
          candidate.entryKind === "noun" &&
          candidate.safetyStatus === "familyFriendly" &&
          candidate.curationStatus === "accepted",
      ),
      true,
    );
    assert.equal(
      nounShard.candidates.some(
        (candidate) => candidate.candidateForm === "hyphenatedWord",
      ),
      true,
    );
    assert.equal(
      nounShard.candidates.some(
        (candidate) => candidate.candidateForm === "openCompound",
      ),
      true,
    );
  });
});

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}
