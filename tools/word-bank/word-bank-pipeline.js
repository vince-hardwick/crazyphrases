const ENTRY_KIND_BY_ESDB_POS = new Map([
  ["aj", "adjective"],
  ["n", "noun"],
  ["av", "adverb"],
  ["v", "verb"],
  ["d", "articleDeterminer"],
  ["pre", "preposition"],
  ["pn", "pronoun"],
  ["c", "conjunction"],
  ["i", "interjection"],
]);

const ACCEPTED_CURATION_STATUS = "accepted";
const FAMILY_FRIENDLY_STATUS = "familyFriendly";
const SHARD_SCHEMA_VERSION = 1;

export function mapEsdbPosToEntryKind(pos) {
  return ENTRY_KIND_BY_ESDB_POS.get(pos) ?? null;
}

export function parseEsdbSourceText(sourceText, { sourceFile } = {}) {
  return String(sourceText ?? "")
    .split(/\r?\n/)
    .map((line, index) =>
      parseEsdbSourceLine(line, {
        lineNumber: index + 1,
        sourceFile: sourceFile ?? "unknown",
      }),
    )
    .filter(Boolean);
}

export function getCandidateForm(value) {
  const candidate = cleanCandidateText(value);

  if (/^[a-z]+$/.test(candidate)) {
    return "singleWord";
  }

  if (/^[a-z]+(?:-[a-z]+)+$/.test(candidate)) {
    return "hyphenatedWord";
  }

  if (/^[a-z]+(?: [a-z]+){1,2}$/.test(candidate)) {
    return "openCompound";
  }

  return "unsupported";
}

export function buildProductionWordBank({
  curation,
  sourceConfig,
  sourceRecords,
} = {}) {
  validateCurationHeader(curation);
  validateSourceConfig(sourceConfig);

  const candidateRecords = Array.isArray(sourceRecords) ? sourceRecords : [];
  const sourceRecordByKey = new Map(
    candidateRecords.map((record) => [sourceRecordKey(record), record]),
  );
  const acceptedCandidates = [];
  const rejectedCandidates = [];

  for (const candidate of curation.candidates) {
    const normalizedCandidate = normalizeCurationCandidate(candidate, curation);

    if (normalizedCandidate.curationStatus !== ACCEPTED_CURATION_STATUS) {
      rejectedCandidates.push(normalizedCandidate);
      continue;
    }

    validateAcceptedCandidate(normalizedCandidate);

    const sourceRecord = sourceRecordByKey.get(
      `${normalizedCandidate.entryKind}\u0000${normalizedCandidate.canonicalText}`,
    );

    if (!sourceRecord) {
      throw new Error(
        `No supported ESDB source row for ${normalizedCandidate.entryKind} candidate "${normalizedCandidate.canonicalText}".`,
      );
    }

    acceptedCandidates.push(
      createShardCandidate({
        candidate: normalizedCandidate,
        sourceConfig,
        sourceRecord,
      }),
    );
  }

  const sortedCandidates = acceptedCandidates.sort((left, right) =>
    left.canonicalText.localeCompare(right.canonicalText),
  );
  const shardPath = curation.shardPath;
  const shard = {
    schemaVersion: SHARD_SCHEMA_VERSION,
    entryKind: curation.entryKind,
    version: curation.shardVersion,
    familyFriendly: true,
    source: {
      id: sourceConfig.id,
      version: sourceConfig.version,
      archiveSha256: sourceConfig.archiveSha256,
      license: sourceConfig.license,
    },
    curation: {
      version: curation.version,
      status: "family-friendly-only",
    },
    candidates: sortedCandidates,
  };
  const manifest = {
    schemaVersion: SHARD_SCHEMA_VERSION,
    version: curation.manifestVersion ?? curation.shardVersion,
    entryKinds: {
      [curation.entryKind]: {
        entryKind: curation.entryKind,
        version: curation.shardVersion,
        path: shardPath,
        candidateCount: sortedCandidates.length,
        familyFriendly: true,
        sourceId: sourceConfig.id,
        sourceVersion: sourceConfig.version,
      },
    },
  };
  const review = {
    schemaVersion: SHARD_SCHEMA_VERSION,
    entryKind: curation.entryKind,
    sourceId: sourceConfig.id,
    sourceVersion: sourceConfig.version,
    counts: {
      accepted: sortedCandidates.length,
      rejected: rejectedCandidates.length,
    },
    samples: {
      [curation.entryKind]: sampleCandidateTexts(sortedCandidates, 100),
    },
    rejected: rejectedCandidates.map(({ canonicalText, rejectionReason }) => ({
      canonicalText,
      rejectionReason: rejectionReason ?? "not accepted for production shard",
    })),
  };
  const result = {
    curation,
    manifest,
    review,
    shard,
    shardPath,
    sourceRecords: candidateRecords,
  };

  validateWordBankShard(shard);
  return result;
}

export function buildProductionWordBanks({
  curations,
  sourceConfig,
  sourceRecords,
} = {}) {
  if (!Array.isArray(curations) || curations.length === 0) {
    throw new Error("At least one Word Bank curation file is required.");
  }

  const shardResults = curations.map((curation) =>
    buildProductionWordBank({ curation, sourceConfig, sourceRecords }),
  );
  const manifestVersion =
    curations[0].manifestVersion ?? curations[0].shardVersion;
  const entryKinds = {};

  for (const result of shardResults) {
    const [entryKind, reference] = Object.entries(result.manifest.entryKinds)[0];

    if (
      (result.curation.manifestVersion ?? result.curation.shardVersion) !==
      manifestVersion
    ) {
      throw new Error("Word Bank curation files must share one manifest version.");
    }

    if (entryKinds[entryKind]) {
      throw new Error(`Duplicate Word Bank curation for Entry Kind "${entryKind}".`);
    }

    entryKinds[entryKind] = reference;
  }

  return {
    manifest: {
      schemaVersion: SHARD_SCHEMA_VERSION,
      version: manifestVersion,
      entryKinds,
    },
    shardResults,
  };
}

export function validateWordBankShard(shard) {
  if (shard?.schemaVersion !== SHARD_SCHEMA_VERSION) {
    throw new Error("Word Bank Shard schemaVersion must be 1.");
  }

  if (typeof shard.entryKind !== "string" || shard.entryKind.trim() === "") {
    throw new Error("Word Bank Shard entryKind is required.");
  }

  if (typeof shard.version !== "string" || shard.version.trim() === "") {
    throw new Error("Word Bank Shard version is required.");
  }

  if (!Array.isArray(shard.candidates) || shard.candidates.length === 0) {
    throw new Error("Word Bank Shard candidates must be a non-empty array.");
  }

  for (const candidate of shard.candidates) {
    for (const field of [
      "canonicalText",
      "sourceId",
      "sourceVersion",
      "entryKind",
      "candidateForm",
      "safetyStatus",
      "curationStatus",
    ]) {
      if (typeof candidate[field] !== "string" || candidate[field].trim() === "") {
        throw new Error(`Word Bank Shard candidate is missing ${field}.`);
      }
    }

    if (candidate.entryKind !== shard.entryKind) {
      throw new Error(
        `Word Bank Shard candidate "${candidate.canonicalText}" has mismatched entryKind.`,
      );
    }

    if (candidate.safetyStatus !== FAMILY_FRIENDLY_STATUS) {
      throw new Error(
        `Word Bank Shard candidate "${candidate.canonicalText}" is not family-friendly.`,
      );
    }

    if (candidate.curationStatus !== ACCEPTED_CURATION_STATUS) {
      throw new Error(
        `Word Bank Shard candidate "${candidate.canonicalText}" is not accepted.`,
      );
    }

    if (getCandidateForm(candidate.canonicalText) !== candidate.candidateForm) {
      throw new Error(
        `Word Bank Shard candidate "${candidate.canonicalText}" has incorrect candidateForm.`,
      );
    }
  }
}

function parseEsdbSourceLine(line, { lineNumber, sourceFile }) {
  if (!line || line.trim().startsWith("#") || !line.includes("<")) {
    return null;
  }

  const tagMatch = line.match(/<([^>]+)>/);

  if (!tagMatch) {
    return null;
  }

  const tag = tagMatch[1];
  const [pos, ...qualifiers] = tag.split("/");
  const entryKind = mapEsdbPosToEntryKind(pos);

  if (!entryKind || qualifiers.some((qualifier) => qualifier.trim() !== "")) {
    return null;
  }

  const beforeTag = line.slice(0, tagMatch.index);
  const canonicalText = cleanCandidateText(
    beforeTag.slice(beforeTag.lastIndexOf(":") + 1),
  );

  if (
    canonicalText === "" ||
    canonicalText === "-" ||
    getCandidateForm(canonicalText) === "unsupported"
  ) {
    return null;
  }

  const sourceSize = Number(line.match(/^\s*(\d+)/)?.[1] ?? 0);
  const sourceTags = [
    ...line.slice(0, line.indexOf(":")).matchAll(/\[([^\]]+)\]/g),
  ].map((match) => match[1]);

  return {
    canonicalText,
    entryKind,
    sourceFile,
    sourceLine: lineNumber,
    sourceSize,
    sourceTags,
  };
}

function validateCurationHeader(curation) {
  if (curation?.schemaVersion !== SHARD_SCHEMA_VERSION) {
    throw new Error("Word Bank curation schemaVersion must be 1.");
  }

  for (const field of ["entryKind", "version", "shardVersion", "shardPath"]) {
    if (typeof curation[field] !== "string" || curation[field].trim() === "") {
      throw new Error(`Word Bank curation ${field} is required.`);
    }
  }

  if (!Array.isArray(curation.candidates) || curation.candidates.length === 0) {
    throw new Error("Word Bank curation candidates must be a non-empty array.");
  }
}

function validateSourceConfig(sourceConfig) {
  for (const field of ["id", "version", "archiveSha256", "license"]) {
    if (
      typeof sourceConfig?.[field] !== "string" ||
      sourceConfig[field].trim() === ""
    ) {
      throw new Error(`Word Bank source config ${field} is required.`);
    }
  }
}

function normalizeCurationCandidate(candidate, curation) {
  const candidateRecord =
    typeof candidate === "string" ? { canonicalText: candidate } : candidate;
  const canonicalText = cleanCandidateText(candidateRecord?.canonicalText);

  if (canonicalText === "") {
    throw new Error("Word Bank curation candidate canonicalText is required.");
  }

  return {
    ...(curation.defaults ?? {}),
    ...candidateRecord,
    canonicalText,
    entryKind: candidateRecord.entryKind ?? curation.entryKind,
    candidateForm: candidateRecord.candidateForm ?? getCandidateForm(canonicalText),
  };
}

function validateAcceptedCandidate(candidate) {
  for (const field of ["entryKind", "candidateForm", "safetyStatus"]) {
    if (typeof candidate[field] !== "string" || candidate[field].trim() === "") {
      throw new Error(
        `Accepted Word Bank candidate "${candidate.canonicalText}" is missing ${field}.`,
      );
    }
  }

  if (candidate.safetyStatus !== FAMILY_FRIENDLY_STATUS) {
    throw new Error(
      `Accepted Word Bank candidate "${candidate.canonicalText}" must be family-friendly for this rollout.`,
    );
  }

  if (candidate.candidateForm === "unsupported") {
    throw new Error(
      `Accepted Word Bank candidate "${candidate.canonicalText}" has an unsupported candidate form.`,
    );
  }

  if (
    candidate.candidateForm === "openCompound" &&
    !isReviewedCompound(candidate.compoundReview)
  ) {
    throw new Error(
      `Accepted open compounds require compoundReview metadata: "${candidate.canonicalText}".`,
    );
  }
}

function isReviewedCompound(compoundReview) {
  return (
    compoundReview &&
    typeof compoundReview.reviewer === "string" &&
    compoundReview.reviewer.trim() !== "" &&
    typeof compoundReview.reviewedOn === "string" &&
    compoundReview.reviewedOn.trim() !== ""
  );
}

function createShardCandidate({ candidate, sourceConfig, sourceRecord }) {
  return {
    canonicalText: candidate.canonicalText,
    sourceId: sourceConfig.id,
    sourceVersion: sourceConfig.version,
    entryKind: candidate.entryKind,
    candidateForm: candidate.candidateForm,
    safetyStatus: candidate.safetyStatus,
    curationStatus: candidate.curationStatus,
    sourceFile: sourceRecord.sourceFile,
    sourceLine: sourceRecord.sourceLine,
    sourceSize: sourceRecord.sourceSize,
    sourceTags: sourceRecord.sourceTags,
  };
}

function sampleCandidateTexts(candidates, sampleSize) {
  return candidates
    .map((candidate) => candidate.canonicalText)
    .slice(0, sampleSize);
}

function sourceRecordKey(record) {
  return `${record.entryKind}\u0000${record.canonicalText}`;
}

function cleanCandidateText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}
