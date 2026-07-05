import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createManifestBackedEntryCandidateProvider,
  getEntryCandidateValues,
} from "../assets/entry-candidate-provider.js";

describe("manifest-backed Entry Candidate provider", () => {
  it("uses a loaded production adjective shard before seed fallback", async () => {
    const provider = createManifestBackedEntryCandidateProvider({
      manifest: {
        entryKinds: {
          adjective: {
            path: "assets/word-bank/shards/adjective.test.json",
            version: "test-adjective",
          },
        },
      },
      seedWordBank: {
        entryKinds: {
          adjective: ["brisk"],
          noun: ["teapot"],
        },
      },
      fetchJson: async (path) => {
        assert.equal(path, "assets/word-bank/shards/adjective.test.json");

        return {
          entryKind: "adjective",
          version: "test-adjective",
          candidates: [
            {
              canonicalText: "topsy-turvy",
              entryKind: "adjective",
              candidateForm: "hyphenatedWord",
              safetyStatus: "familyFriendly",
              curationStatus: "accepted",
            },
          ],
        };
      },
    });

    assert.deepEqual(getEntryCandidateValues(provider, "adjective"), ["brisk"]);

    await provider.loadEntryKind("adjective");

    assert.deepEqual(getEntryCandidateValues(provider, "adjective"), [
      "topsy-turvy",
    ]);
    assert.deepEqual(getEntryCandidateValues(provider, "noun"), ["teapot"]);
  });

  it("keeps using seed candidates when a production shard is unavailable", async () => {
    const provider = createManifestBackedEntryCandidateProvider({
      manifest: {
        entryKinds: {
          adjective: {
            path: "assets/word-bank/shards/adjective.test.json",
            version: "test-adjective",
          },
        },
      },
      seedWordBank: {
        entryKinds: {
          adjective: ["brisk"],
        },
      },
      fetchJson: async () => {
        throw new Error("offline");
      },
    });

    await provider.loadEntryKind("adjective");

    assert.deepEqual(getEntryCandidateValues(provider, "adjective"), ["brisk"]);
    assert.deepEqual(getEntryCandidateValues(provider, "verb"), []);
  });

  it("does not substitute another Entry Kind when a shard is missing", async () => {
    const provider = createManifestBackedEntryCandidateProvider({
      manifest: {
        entryKinds: {
          adjective: {
            path: "assets/word-bank/shards/adjective.test.json",
            version: "test-adjective",
          },
        },
      },
      seedWordBank: {
        entryKinds: {
          noun: ["teapot"],
        },
      },
      fetchJson: async () => ({
        entryKind: "adjective",
        version: "test-adjective",
        candidates: [
          {
            canonicalText: "brisk",
            entryKind: "adjective",
            candidateForm: "singleWord",
            safetyStatus: "familyFriendly",
            curationStatus: "accepted",
          },
        ],
      }),
    });

    await provider.loadEntryKind("adjective");

    assert.deepEqual(getEntryCandidateValues(provider, "adjective"), ["brisk"]);
    assert.deepEqual(getEntryCandidateValues(provider, "noun"), ["teapot"]);
    assert.deepEqual(getEntryCandidateValues(provider, "adverb"), []);
  });

  it("uses loaded production noun shards without exposing unsafe noun records", async () => {
    const provider = createManifestBackedEntryCandidateProvider({
      manifest: {
        entryKinds: {
          noun: {
            path: "assets/word-bank/shards/noun.test.json",
            version: "test-noun",
          },
        },
      },
      seedWordBank: {
        entryKinds: {
          noun: ["teapot"],
        },
      },
      fetchJson: async (path) => {
        assert.equal(path, "assets/word-bank/shards/noun.test.json");

        return {
          entryKind: "noun",
          version: "test-noun",
          candidates: [
            {
              canonicalText: "alarm clock",
              entryKind: "noun",
              candidateForm: "openCompound",
              safetyStatus: "familyFriendly",
              curationStatus: "accepted",
            },
            {
              canonicalText: "unsafe noun",
              entryKind: "noun",
              candidateForm: "openCompound",
              safetyStatus: "potentiallyOffensive",
              curationStatus: "accepted",
            },
          ],
        };
      },
    });

    assert.deepEqual(getEntryCandidateValues(provider, "noun"), ["teapot"]);

    await provider.loadEntryKind("noun");

    assert.deepEqual(getEntryCandidateValues(provider, "noun"), ["alarm clock"]);
  });
});
