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

    async loadPinnedEntryCandidateValues(reference) {
      const candidates = await this.loadPinnedEntryCandidateRecords(reference);

      return candidates
        .map(getEntryCandidateValue)
        .map(cleanWhitespace)
        .filter(Boolean);
    },

    async loadPinnedEntryCandidateRecords(reference) {
      const validatedReference = validatePinnedReference(reference);

      if (!validatedReference || typeof fetchJson !== "function") {
        return [];
      }

      const cacheKey = getShardCacheKey(
        validatedReference.entryKind,
        validatedReference,
      );
      const cachedShard = loadedShardsByVersion.get(cacheKey);

      if (
        cachedShard?.pinnedReference &&
        pinnedReferencesMatch(cachedShard.pinnedReference, validatedReference)
      ) {
        return cloneCandidates(cachedShard.candidates);
      }

      try {
        const shard = await fetchJson(validatedReference.path);
        const candidates = getPinnedShardCandidates(shard, validatedReference);

        if (candidates.length > 0) {
          loadedShardsByVersion.set(cacheKey, {
            candidates,
            entryKind: validatedReference.entryKind,
            path: validatedReference.path,
            pinnedReference: { ...validatedReference },
            version: validatedReference.version,
          });
        }

        return cloneCandidates(candidates);
      } catch {
        return [];
      }
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
        const candidateRecords = getEntryCandidateRecords(provider, entryKind);

        snapshotEntryKinds[entryKind] = {
          candidates,
          candidateRecords,
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

function validatePinnedReference(reference) {
  if (
    !reference ||
    typeof reference.entryKind !== "string" ||
    cleanWhitespace(reference.entryKind) === "" ||
    typeof reference.version !== "string" ||
    cleanWhitespace(reference.version) === "" ||
    typeof reference.path !== "string" ||
    !/^assets\/word-bank\/shards\/[a-z0-9.-]+\.json$/.test(reference.path) ||
    !Number.isInteger(reference.candidateCount) ||
    reference.candidateCount <= 0 ||
    reference.familyFriendly !== true ||
    typeof reference.sourceId !== "string" ||
    cleanWhitespace(reference.sourceId) === "" ||
    typeof reference.sourceVersion !== "string" ||
    cleanWhitespace(reference.sourceVersion) === ""
  ) {
    return null;
  }

  return reference;
}

function pinnedReferencesMatch(left, right) {
  return [
    "entryKind",
    "version",
    "path",
    "candidateCount",
    "familyFriendly",
    "sourceId",
    "sourceVersion",
  ].every((field) => left[field] === right[field]);
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

export function getEntryCandidateRecords(entryCandidateProvider, entryKind) {
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

  return cloneCandidates(
    candidates.filter(
      (candidate) => cleanWhitespace(getEntryCandidateValue(candidate)) !== "",
    ),
  );
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

function getPinnedShardCandidates(shard, reference) {
  if (
    !shard ||
    shard.schemaVersion !== 1 ||
    shard.entryKind !== reference.entryKind ||
    shard.version !== reference.version ||
    shard.familyFriendly !== true ||
    shard.source?.id !== reference.sourceId ||
    shard.source?.version !== reference.sourceVersion ||
    !Array.isArray(shard.candidates) ||
    shard.candidates.length !== reference.candidateCount ||
    !shard.candidates.every(
      (candidate) =>
        candidate?.entryKind === reference.entryKind &&
        candidate.safetyStatus === "familyFriendly" &&
        candidate.curationStatus === "accepted" &&
        cleanWhitespace(getEntryCandidateValue(candidate)) !== "",
    )
  ) {
    return [];
  }

  return shard.candidates;
}

function cleanWhitespace(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function cloneCandidates(candidates) {
  return candidates.map((candidate) =>
    candidate && typeof candidate === "object"
      ? structuredClone(candidate)
      : candidate,
  );
}
