import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createManifestBackedEntryCandidateProvider,
  getEntryCandidateValues,
} from "../assets/entry-candidate-provider.js";

describe("manifest-backed Entry Candidate provider", () => {
  it("checks the manifest on demand and caches a loaded immutable shard version", async () => {
    const fetchCalls = [];
    const provider = createManifestBackedEntryCandidateProvider({
      manifestUrl: "assets/word-bank/manifest.json",
      seedWordBank: {
        entryKinds: {
          adjective: ["seed brisk"],
        },
      },
      fetchJson: async (path) => {
        fetchCalls.push(path);

        if (path === "assets/word-bank/manifest.json") {
          return {
            entryKinds: {
              adjective: {
                path: "assets/word-bank/shards/adjective.v1.json",
                version: "adjective-v1",
              },
            },
          };
        }

        if (path === "assets/word-bank/shards/adjective.v1.json") {
          return {
            entryKind: "adjective",
            version: "adjective-v1",
            candidates: [
              {
                canonicalText: "brisk",
                entryKind: "adjective",
                candidateForm: "singleWord",
                safetyStatus: "familyFriendly",
                curationStatus: "accepted",
              },
            ],
          };
        }

        throw new Error(`Unexpected fetch path: ${path}`);
      },
    });

    assert.deepEqual(getEntryCandidateValues(provider, "adjective"), [
      "seed brisk",
    ]);

    await provider.loadEntryKind("adjective");
    await provider.loadEntryKind("adjective");

    assert.deepEqual(fetchCalls, [
      "assets/word-bank/manifest.json",
      "assets/word-bank/shards/adjective.v1.json",
    ]);
    assert.deepEqual(getEntryCandidateValues(provider, "adjective"), ["brisk"]);
  });

  it("keeps the cached shard when a refreshed manifest points to an unavailable newer version", async () => {
    const fetchCalls = [];
    let activeVersion = "v1";
    let failV2Shard = true;
    const provider = createManifestBackedEntryCandidateProvider({
      manifestUrl: "assets/word-bank/manifest.json",
      seedWordBank: {
        entryKinds: {
          adjective: ["seed brisk"],
        },
      },
      fetchJson: async (path) => {
        fetchCalls.push(path);

        if (path === "assets/word-bank/manifest.json") {
          return {
            entryKinds: {
              adjective: {
                path: `assets/word-bank/shards/adjective.${activeVersion}.json`,
                version: `adjective-${activeVersion}`,
              },
            },
          };
        }

        if (path === "assets/word-bank/shards/adjective.v1.json") {
          return {
            entryKind: "adjective",
            version: "adjective-v1",
            candidates: [
              {
                canonicalText: "brisk",
                entryKind: "adjective",
                candidateForm: "singleWord",
                safetyStatus: "familyFriendly",
                curationStatus: "accepted",
              },
            ],
          };
        }

        if (path === "assets/word-bank/shards/adjective.v2.json") {
          if (failV2Shard) {
            throw new Error("new shard unavailable");
          }

          return {
            entryKind: "adjective",
            version: "adjective-v2",
            candidates: [
              {
                canonicalText: "nimble",
                entryKind: "adjective",
                candidateForm: "singleWord",
                safetyStatus: "familyFriendly",
                curationStatus: "accepted",
              },
            ],
          };
        }

        throw new Error(`Unexpected fetch path: ${path}`);
      },
    });

    await provider.loadEntryKind("adjective");
    assert.deepEqual(getEntryCandidateValues(provider, "adjective"), ["brisk"]);

    activeVersion = "v2";
    await provider.refreshManifest();
    await provider.loadEntryKind("adjective");

    assert.deepEqual(getEntryCandidateValues(provider, "adjective"), ["brisk"]);

    failV2Shard = false;
    await provider.loadEntryKind("adjective");

    assert.deepEqual(getEntryCandidateValues(provider, "adjective"), ["nimble"]);
    assert.deepEqual(fetchCalls, [
      "assets/word-bank/manifest.json",
      "assets/word-bank/shards/adjective.v1.json",
      "assets/word-bank/manifest.json",
      "assets/word-bank/shards/adjective.v2.json",
      "assets/word-bank/shards/adjective.v2.json",
    ]);
  });

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
