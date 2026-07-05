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
  manifestUrl,
  seedWordBank,
} = {}) {
  const seedProvider = createSeedBackedEntryCandidateProvider(seedWordBank);
  let loadedManifest = manifest ?? null;
  const loadedShardsByEntryKind = new Map();
  const loadedShardsByVersion = new Map();
  const pendingLoads = new Map();
  let pendingManifestLoad = null;

  return {
    async loadManifest() {
      return loadManifest();
    },

    async refreshManifest() {
      return loadManifest({ refresh: true });
    },

    async loadEntryKind(entryKind) {
      if (pendingLoads.has(entryKind)) {
        return pendingLoads.get(entryKind);
      }

      const currentManifest = await loadManifest();
      const shardReference = currentManifest?.entryKinds?.[entryKind];

      if (loadedShardsByEntryKind.has(entryKind)) {
        const loadedShard = loadedShardsByEntryKind.get(entryKind);

        if (
          loadedShard.version === shardReference?.version &&
          loadedShard.path === shardReference?.path
        ) {
          return loadedShard.candidates;
        }
      }

      if (!shardReference?.path || typeof fetchJson !== "function") {
        return [];
      }

      const cacheKey = getShardCacheKey(entryKind, shardReference);
      const cachedShard = loadedShardsByVersion.get(cacheKey);

      if (cachedShard) {
        loadedShardsByEntryKind.set(entryKind, cachedShard);
        return cachedShard.candidates;
      }

      const load = fetchJson(shardReference.path)
        .then((shard) => {
          const candidates = getShardCandidates(shard, {
            entryKind,
            version: shardReference.version,
          });

          if (candidates.length > 0) {
            const loadedShard = {
              candidates,
              entryKind,
              path: shardReference.path,
              version: shardReference.version,
            };
            loadedShardsByVersion.set(cacheKey, loadedShard);
            loadedShardsByEntryKind.set(entryKind, loadedShard);
          }

          return candidates;
        })
        .catch(() => loadedShardsByEntryKind.get(entryKind)?.candidates ?? [])
        .finally(() => {
          pendingLoads.delete(entryKind);
        });

      pendingLoads.set(entryKind, load);
      return load;
    },

    getEntryCandidates(entryKind) {
      const shardCandidates = loadedShardsByEntryKind.get(entryKind)?.candidates;

      if (Array.isArray(shardCandidates) && shardCandidates.length > 0) {
        return [...shardCandidates];
      }

      return seedProvider.getEntryCandidates(entryKind);
    },

    createSnapshot(entryKinds = []) {
      const snapshotEntryKinds = {};

      for (const entryKind of uniqueEntryKinds(entryKinds)) {
        const loadedShard = loadedShardsByEntryKind.get(entryKind);
        const provider = loadedShard
          ? {
              getEntryCandidates() {
                return loadedShard.candidates;
              },
            }
          : seedProvider;
        const candidates = getEntryCandidateValues(provider, entryKind);

        snapshotEntryKinds[entryKind] = {
          candidates,
          entryKind,
          source: loadedShard ? "wordBankShard" : "seed",
          version:
            loadedShard?.version ??
            seedWordBank?.metadata?.version ??
            "seed-fallback",
        };
      }

      return {
        schemaVersion: 1,
        entryKinds: snapshotEntryKinds,
      };
    },
  };

  async function loadManifest({ refresh = false } = {}) {
    if (loadedManifest && !refresh) {
      return loadedManifest;
    }

    if (pendingManifestLoad) {
      return pendingManifestLoad;
    }

    if (!manifestUrl || typeof fetchJson !== "function") {
      return null;
    }

    pendingManifestLoad = fetchJson(manifestUrl)
      .then((fetchedManifest) => {
        loadedManifest = fetchedManifest;
        return loadedManifest;
      })
      .catch(() => loadedManifest)
      .finally(() => {
        pendingManifestLoad = null;
      });

    return pendingManifestLoad;
  }
}

function getShardCacheKey(entryKind, shardReference) {
  return `${entryKind}:${shardReference.version ?? ""}:${shardReference.path}`;
}

function uniqueEntryKinds(entryKinds) {
  return [...new Set(entryKinds.filter((entryKind) => typeof entryKind === "string"))];
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
