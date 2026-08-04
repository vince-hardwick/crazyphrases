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
const REVIEWED_SHARD_SCHEMA_VERSION = 2;
const COMMONNESS_GRADES = new Set(["common", "lessCommon", "rare"]);
const NOUN_SEMANTIC_BANDS = new Set([
  "People and Groups",
  "Animals and Plants",
  "Body",
  "Food and Drink",
  "Places",
  "Made Objects",
  "Nature and Materials",
  "Actions and Events",
  "Ideas and Communication",
  "Feelings and Conditions",
  "Measures and Relationships",
]);

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

export function buildReviewedDefaultShard({
  approved,
  curationVersion,
  entryKind,
  includedTrancheIds = [],
  reviewProgramme,
  semanticReference,
  sourceConfig,
  version,
} = {}) {
  if (approved !== true) {
    throw new Error("Reviewed shard generation requires explicit allowlist approval.");
  }

  if (!new Set(["adjective", "noun"]).has(entryKind)) {
    throw new Error("Reviewed shard Entry Kind must be adjective or noun.");
  }

  if (typeof version !== "string" || version.trim() === "") {
    throw new Error("Reviewed shard version is required.");
  }

  if (!Array.isArray(includedTrancheIds) || includedTrancheIds.length === 0) {
    throw new Error("Reviewed shard requires at least one included tranche.");
  }

  validateSourceConfig(sourceConfig);
  const referenceById = new Map(
    (reviewProgramme?.index?.tranches ?? []).map((reference) => [
      reference.id,
      reference,
    ]),
  );
  const trancheById = new Map(
    (reviewProgramme?.tranches ?? []).map((tranche) => [tranche.id, tranche]),
  );
  const candidatesByKey = new Map();

  for (const trancheId of includedTrancheIds) {
    const reference = referenceById.get(trancheId);
    const tranche = trancheById.get(trancheId);

    if (
      !reference ||
      reference.entryKind !== entryKind ||
      reference.lifecycle !== "complete" ||
      !tranche ||
      tranche.entryKind !== entryKind
    ) {
      throw new Error(
        `Reviewed shard tranche "${trancheId}" must exist and be complete for ${entryKind}.`,
      );
    }

    for (const candidate of tranche.candidates) {
      const errors = validateReviewedDecision(candidate.decision, entryKind);

      if (errors.length > 0) {
        throw new Error(
          `Reviewed candidate "${candidate.canonicalText}" is invalid. ${errors.join(" ")}`,
        );
      }

      if (
        candidate.decision.curationDecision !== "Accept" ||
        candidate.decision.ukEnglishEligible !== true ||
        candidate.decision.familyFriendly !== true
      ) {
        continue;
      }

      const key = cleanCandidateText(candidate.canonicalText);

      if (candidatesByKey.has(key)) {
        throw new Error(`Reviewed candidate "${key}" is included more than once.`);
      }

      const candidateForm = getCandidateForm(key);

      if (candidateForm === "unsupported") {
        throw new Error(`Reviewed candidate "${key}" has an unsupported form.`);
      }

      candidatesByKey.set(key, {
        canonicalText: key,
        sourceId: sourceConfig.id,
        sourceVersion: sourceConfig.version,
        entryKind,
        candidateForm,
        safetyStatus: FAMILY_FRIENDLY_STATUS,
        curationStatus: ACCEPTED_CURATION_STATUS,
        ukEnglishEligible: true,
        commonnessGrade: candidate.decision.commonnessGrade,
        ...(entryKind === "noun"
          ? { nounSemanticBand: candidate.decision.nounSemanticBand }
          : {}),
      });
    }
  }

  const shard = {
    schemaVersion: REVIEWED_SHARD_SCHEMA_VERSION,
    entryKind,
    version,
    familyFriendly: true,
    source: {
      id: sourceConfig.id,
      version: sourceConfig.version,
      archiveSha256: sourceConfig.archiveSha256,
      license: sourceConfig.license,
    },
    ...(entryKind === "noun"
      ? { semanticReference: validateSemanticReference(semanticReference) }
      : {}),
    curation: {
      version: curationVersion ?? version,
      status: "family-friendly-only",
      includedTrancheIds: [...includedTrancheIds],
    },
    candidates: [...candidatesByKey.values()].sort((left, right) =>
      left.canonicalText.localeCompare(right.canonicalText),
    ),
  };

  validateWordBankShard(shard);
  return shard;
}

export function validateWordBankShard(shard) {
  if (![SHARD_SCHEMA_VERSION, REVIEWED_SHARD_SCHEMA_VERSION].includes(shard?.schemaVersion)) {
    throw new Error("Word Bank Shard schemaVersion must be 1 or 2.");
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

    if (shard.schemaVersion === REVIEWED_SHARD_SCHEMA_VERSION) {
      const errors = validateReviewedDecision(
        {
          curationDecision: "Accept",
          familyFriendly: candidate.safetyStatus === FAMILY_FRIENDLY_STATUS,
          ukEnglishEligible: candidate.ukEnglishEligible,
          commonnessGrade: candidate.commonnessGrade,
          nounSemanticBand: candidate.nounSemanticBand,
        },
        shard.entryKind,
      );

      if (errors.length > 0) {
        throw new Error(
          `Word Bank Shard candidate "${candidate.canonicalText}" has invalid reviewed metadata. ${errors.join(" ")}`,
        );
      }
    }
  }

  if (shard.schemaVersion === REVIEWED_SHARD_SCHEMA_VERSION && shard.entryKind === "noun") {
    validateSemanticReference(shard.semanticReference);
  }
}

function validateReviewedDecision(decision, entryKind) {
  const errors = [];

  if (typeof decision?.ukEnglishEligible !== "boolean") {
    errors.push("UK-English eligibility must be explicitly set.");
  }

  if (typeof decision?.familyFriendly !== "boolean") {
    errors.push("Family-friendly must be explicitly set.");
  }

  if (!new Set(["Accept", "Reject"]).has(decision?.curationDecision)) {
    errors.push("Curation Decision must be Accept or Reject.");
    return errors;
  }

  if (decision.curationDecision === "Accept") {
    if (decision.ukEnglishEligible !== true) {
      errors.push("Accept requires UK-English eligibility.");
    }

    if (!COMMONNESS_GRADES.has(decision.commonnessGrade)) {
      errors.push("Accept requires a Commonness Grade.");
    }

    if (entryKind === "noun" && !NOUN_SEMANTIC_BANDS.has(decision.nounSemanticBand)) {
      errors.push("Accept requires a Noun Semantic Band.");
    }

    if (entryKind !== "noun" && decision.nounSemanticBand != null) {
      errors.push("Adjective decisions must not persist a Noun Semantic Band.");
    }
  } else if (decision.commonnessGrade != null || decision.nounSemanticBand != null) {
    errors.push("Reject must not retain a Commonness Grade or Noun Semantic Band.");
  }

  return errors;
}

function validateSemanticReference(reference) {
  for (const field of ["id", "version", "archiveSha256"]) {
    if (typeof reference?.[field] !== "string" || reference[field].trim() === "") {
      throw new Error(`Noun semantic reference ${field} is required.`);
    }
  }

  return structuredClone(reference);
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

  const evidenceText = line.slice(0, line.indexOf(":"));
  const sourceSizes = [...evidenceText.matchAll(/(?:^|\s)(\d{2})(?=\s|$)/g)].map(
    (match) => Number(match[1]),
  );
  const sourceSize = sourceSizes[0] ?? 0;
  const sourceTags = [
    ...evidenceText.matchAll(/\[([^\]]+)\]/g),
  ].map((match) => match[1]);
  const spellings = parseEsdbSpellings(beforeTag);

  return {
    canonicalText,
    entryKind,
    sourceSizes,
    sourceFile,
    sourceLine: lineNumber,
    sourceSize,
    sourceTags,
    spellings,
  };
}

function parseEsdbSpellings(beforeTag) {
  const firstColon = beforeTag.indexOf(":");
  const lastColon = beforeTag.lastIndexOf(":");

  if (firstColon === -1 || firstColon === lastColon) {
    return [{ profile: "_", variantLevel: 0 }];
  }

  const spellingText = beforeTag.slice(firstColon + 1, lastColon).trim();
  const spellings = spellingText
    .split(/\s+/)
    .map((token) => token.match(/^([ABZCD_])([.=?v~V@x-]?)$/))
    .filter(Boolean)
    .map((match) => ({
      profile: match[1],
      variantLevel: variantLevelFromMarker(match[2]),
    }));

  return spellings.length > 0
    ? spellings
    : [{ profile: "_", variantLevel: 0 }];
}

function variantLevelFromMarker(marker) {
  return (
    {
      "": 0,
      ".": 1,
      "=": 2,
      "?": 3,
      v: 4,
      "~": 5,
      V: 6,
      "@": 7,
      "-": 8,
      x: 9,
    }[marker] ?? 9
  );
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
