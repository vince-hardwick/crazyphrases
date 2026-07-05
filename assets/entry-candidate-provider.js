export function createSeedBackedEntryCandidateProvider(wordBank) {
  return {
    getEntryCandidates(entryKind) {
      const candidates = wordBank?.entryKinds?.[entryKind];
      return Array.isArray(candidates) ? [...candidates] : [];
    },
  };
}

export function createManifestBackedEntryCandidateProvider({
  fetchJson,
  manifest,
  seedWordBank,
} = {}) {
  const seedProvider = createSeedBackedEntryCandidateProvider(seedWordBank);
  const loadedShards = new Map();
  const pendingLoads = new Map();

  return {
    async loadEntryKind(entryKind) {
      if (loadedShards.has(entryKind)) {
        return loadedShards.get(entryKind);
      }

      if (pendingLoads.has(entryKind)) {
        return pendingLoads.get(entryKind);
      }

      const shardReference = manifest?.entryKinds?.[entryKind];

      if (!shardReference?.path || typeof fetchJson !== "function") {
        return [];
      }

      const load = fetchJson(shardReference.path)
        .then((shard) => {
          const candidates = getShardCandidates(shard, {
            entryKind,
            version: shardReference.version,
          });

          if (candidates.length > 0) {
            loadedShards.set(entryKind, candidates);
          }

          return candidates;
        })
        .catch(() => [])
        .finally(() => {
          pendingLoads.delete(entryKind);
        });

      pendingLoads.set(entryKind, load);
      return load;
    },

    getEntryCandidates(entryKind) {
      const shardCandidates = loadedShards.get(entryKind);

      if (Array.isArray(shardCandidates) && shardCandidates.length > 0) {
        return [...shardCandidates];
      }

      return seedProvider.getEntryCandidates(entryKind);
    },
  };
}

export function getEntryCandidateValues(entryCandidateProvider, entryKind) {
  if (
    !entryCandidateProvider ||
    typeof entryCandidateProvider.getEntryCandidates !== "function"
  ) {
    return [];
  }

  const candidates = entryCandidateProvider.getEntryCandidates(entryKind);

  if (!Array.isArray(candidates)) {
    return [];
  }

  return candidates
    .map(getEntryCandidateValue)
    .map(cleanWhitespace)
    .filter(Boolean);
}

export function hasEntryCandidates(entryCandidateProvider, entryKind) {
  return getEntryCandidateValues(entryCandidateProvider, entryKind).length > 0;
}

function getEntryCandidateValue(candidate) {
  if (typeof candidate === "string") {
    return candidate;
  }

  if (candidate && typeof candidate === "object") {
    for (const field of ["value", "canonicalText", "text"]) {
      const value = candidate[field];

      if (typeof value === "string" && cleanWhitespace(value) !== "") {
        return value;
      }
    }
  }

  return "";
}

function getShardCandidates(shard, { entryKind, version }) {
  if (
    !shard ||
    shard.entryKind !== entryKind ||
    (version && shard.version !== version) ||
    !Array.isArray(shard.candidates)
  ) {
    return [];
  }

  return shard.candidates.filter(
    (candidate) =>
      candidate?.entryKind === entryKind &&
      candidate.safetyStatus === "familyFriendly" &&
      candidate.curationStatus === "accepted",
  );
}

function cleanWhitespace(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}
