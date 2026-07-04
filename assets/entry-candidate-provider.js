export function createSeedBackedEntryCandidateProvider(wordBank) {
  return {
    getEntryCandidates(entryKind) {
      const candidates = wordBank?.entryKinds?.[entryKind];
      return Array.isArray(candidates) ? [...candidates] : [];
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

function cleanWhitespace(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}
