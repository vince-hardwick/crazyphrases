const AUTOMATIC_SOURCE_SIZES = new Set([35, 40, 50, 60, 70, 80]);
const AUTOMATIC_SPELLING_PROFILES = new Set(["_", "B"]);
const MAX_AUTOMATIC_VARIANT_LEVEL = 4;
const NOUN_BAND_BY_LEXNAME = new Map([
  ["person", "People and Groups"],
  ["group", "People and Groups"],
  ["animal", "Animals and Plants"],
  ["plant", "Animals and Plants"],
  ["body", "Body"],
  ["food", "Food and Drink"],
  ["location", "Places"],
  ["artifact", "Made Objects"],
  ["object", "Nature and Materials"],
  ["substance", "Nature and Materials"],
  ["phenomenon", "Nature and Materials"],
  ["act", "Actions and Events"],
  ["event", "Actions and Events"],
  ["process", "Actions and Events"],
  ["cognition", "Ideas and Communication"],
  ["communication", "Ideas and Communication"],
  ["motive", "Ideas and Communication"],
  ["feeling", "Feelings and Conditions"],
  ["attribute", "Feelings and Conditions"],
  ["state", "Feelings and Conditions"],
  ["quantity", "Measures and Relationships"],
  ["relation", "Measures and Relationships"],
  ["time", "Measures and Relationships"],
  ["possession", "Measures and Relationships"],
  ["shape", "Measures and Relationships"],
]);
const COMMONNESS_GRADES = new Set(["common", "lessCommon", "rare"]);
const NOUN_SEMANTIC_BANDS = new Set(NOUN_BAND_BY_LEXNAME.values());

export function buildInitialReviewProgramme({
  nounCatalogue,
  adjectiveCatalogue,
  catalogueIdentity,
  publishedNounCandidates,
  publishedAdjectiveCandidates,
} = {}) {
  const nounBaseline = attachPublishedEvidence(
    createBaselineTranche({
      id: "noun-baseline",
      entryKind: "noun",
      catalogue: nounCatalogue,
      candidateTexts: (publishedNounCandidates ?? []).map(
        (candidate) => candidate.canonicalText,
      ),
    }),
    publishedNounCandidates,
  );
  const adjectiveBaseline = attachPublishedEvidence(
    createBaselineTranche({
      id: "adjective-baseline",
      entryKind: "adjective",
      catalogue: adjectiveCatalogue,
      candidateTexts: (publishedAdjectiveCandidates ?? []).map(
        (candidate) => candidate.canonicalText,
      ),
    }),
    publishedAdjectiveCandidates,
  );

  return {
    index: {
      schemaVersion: 1,
      programmeVersion: "2026-08-04-issue245-initial-review",
      catalogue: clone(catalogueIdentity),
      tranches: [
        createTrancheReference(nounBaseline, "planned"),
        createTrancheReference(adjectiveBaseline, "planned"),
      ],
    },
    nounBaseline,
    adjectiveBaseline,
  };
}

export function validateCurationDecision(decision, { entryKind } = {}) {
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

    if (
      entryKind === "noun" &&
      !NOUN_SEMANTIC_BANDS.has(decision.nounSemanticBand)
    ) {
      errors.push("Accept requires a Noun Semantic Band.");
    }

    if (entryKind !== "noun" && decision.nounSemanticBand != null) {
      errors.push("Adjective decisions must not persist a Noun Semantic Band.");
    }
  } else {
    if (decision.commonnessGrade != null) {
      errors.push("Reject must not retain a Commonness Grade.");
    }

    if (decision.nounSemanticBand != null) {
      errors.push("Reject must not retain a Noun Semantic Band.");
    }
  }

  return errors;
}

export function createBaselineTranche({
  id,
  entryKind,
  catalogue,
  candidateTexts,
} = {}) {
  if (typeof id !== "string" || id.trim() === "") {
    throw new Error("Review tranche id is required.");
  }

  if (!Array.isArray(candidateTexts) || candidateTexts.length === 0) {
    throw new Error("Review tranche candidates are required.");
  }

  if (candidateTexts.length > 250) {
    throw new Error("Review tranches may contain at most 250 candidates.");
  }

  const catalogueByText = new Map(
    (catalogue?.candidates ?? []).map((candidate) => [
      normalizeCandidateText(candidate.canonicalText),
      candidate,
    ]),
  );
  const seen = new Set();

  return {
    schemaVersion: 1,
    id,
    entryKind,
    purpose: "baseline",
    candidates: candidateTexts.map((candidateText, index) => {
      const key = normalizeCandidateText(candidateText);
      const candidate = catalogueByText.get(key);

      if (seen.has(key)) {
        throw new Error(`Duplicate tranche candidate: "${candidateText}".`);
      }

      if (!candidate || candidate.entryKind !== entryKind) {
        throw new Error(`Candidate "${candidateText}" is not in the ${entryKind} catalogue.`);
      }

      seen.add(key);
      return {
        sequence: index + 1,
        canonicalText: candidate.canonicalText,
        evidence: clone(candidate.sourceEvidence),
        suggestions: clone(candidate.suggestions ?? {}),
        decision: null,
      };
    }),
  };
}

export function validateReviewRegister({
  catalogue,
  index,
  tranches,
  requireCompleteCoverage = false,
} = {}) {
  const errors = [];
  const trancheById = new Map((tranches ?? []).map((tranche) => [tranche.id, tranche]));
  const activeReferences = (index?.tranches ?? []).filter(
    (reference) => reference.lifecycle === "active",
  );

  if (activeReferences.length > 1) {
    errors.push("Review Register may have at most one active tranche.");
  }

  const assignedCounts = new Map();
  const assignedLabels = new Map();
  let reviewed = 0;
  let total = 0;

  for (const reference of index?.tranches ?? []) {
    const tranche = trancheById.get(reference.id);

    if (!tranche) {
      errors.push(`Review tranche "${reference.id}" is missing.`);
      continue;
    }

    if (tranche.entryKind !== reference.entryKind) {
      errors.push(`Review tranche "${reference.id}" has mismatched Entry Kind.`);
    }

    if (tranche.candidates.length > 250) {
      errors.push(`Review tranche "${reference.id}" exceeds 250 candidates.`);
    }

    total += tranche.candidates.length;

    for (const candidate of tranche.candidates) {
      const key = registerCandidateKey(tranche.entryKind, candidate.canonicalText);
      assignedCounts.set(key, (assignedCounts.get(key) ?? 0) + 1);
      assignedLabels.set(key, `${tranche.entryKind} "${candidate.canonicalText}"`);

      if (
        validateCurationDecision(candidate.decision, {
          entryKind: tranche.entryKind,
        }).length === 0
      ) {
        reviewed += 1;
      }
    }
  }

  for (const [candidate, count] of assignedCounts) {
    if (count > 1) {
      errors.push(`Candidate ${assignedLabels.get(candidate)} is assigned more than once.`);
    }
  }

  const catalogueKeys = new Set(
    (catalogue?.candidates ?? []).map((candidate) =>
      registerCandidateKey(candidate.entryKind, candidate.canonicalText),
    ),
  );

  for (const candidate of assignedCounts.keys()) {
    if (!catalogueKeys.has(candidate)) {
      errors.push(
        `Assigned candidate ${assignedLabels.get(candidate)} is outside the Source Catalogue.`,
      );
    }
  }

  if (requireCompleteCoverage) {
    for (const candidate of catalogue?.candidates ?? []) {
      const key = registerCandidateKey(candidate.entryKind, candidate.canonicalText);

      if (!assignedCounts.has(key)) {
        errors.push(`Catalogue candidate "${candidate.canonicalText}" is missing.`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }

  return { reviewed, total };
}

export function startNextTranche(index, { checkpointed } = {}) {
  if ((index?.tranches ?? []).some((tranche) => tranche.lifecycle === "active")) {
    throw new Error("An active tranche must be completed before starting another.");
  }

  if (
    (index?.tranches ?? []).some((tranche) => tranche.lifecycle === "complete") &&
    checkpointed !== true
  ) {
    throw new Error("The completed tranche and Register index require a local Git checkpoint.");
  }

  const nextIndex = (index?.tranches ?? []).findIndex(
    (tranche) => tranche.lifecycle === "planned",
  );

  if (nextIndex === -1) {
    throw new Error("There is no planned tranche to start.");
  }

  const updated = clone(index);
  updated.tranches[nextIndex].lifecycle = "active";
  return updated;
}

export function saveNextDecision(tranche, sequence, decision) {
  const updated = clone(tranche);
  const correctionMode = updated.candidates.some(
    (candidate) => candidate.pendingCorrection === true,
  );
  const firstPending = updated.candidates.find((candidate) =>
    correctionMode
      ? candidate.pendingCorrection === true
      : validateCurationDecision(candidate.decision, {
          entryKind: updated.entryKind,
        }).length > 0,
  );

  if (!firstPending) {
    throw new Error("The tranche has no pending candidate.");
  }

  if (firstPending.sequence !== sequence) {
    throw new Error(`Candidate ${firstPending.sequence} must be reviewed first.`);
  }

  const errors = validateCurationDecision(decision, {
    entryKind: updated.entryKind,
  });

  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }

  firstPending.decision = clone(decision);
  delete firstPending.pendingCorrection;
  return updated;
}

export function completeActiveTranche(index, tranche, { confirmed } = {}) {
  if (confirmed !== true) {
    throw new Error("Completing a tranche requires explicit confirmation.");
  }

  const referenceIndex = (index?.tranches ?? []).findIndex(
    (reference) => reference.id === tranche?.id,
  );

  if (referenceIndex === -1 || index.tranches[referenceIndex].lifecycle !== "active") {
    throw new Error("Only the active tranche can be completed.");
  }

  const errors = tranche.candidates.flatMap((candidate) =>
    validateCurationDecision(candidate.decision, { entryKind: tranche.entryKind }),
  );

  if (tranche.candidates.some((candidate) => candidate.pendingCorrection === true)) {
    errors.push("Every selected correction must be saved before completion.");
  }

  if (errors.length > 0) {
    throw new Error(`Complete Tranche is unavailable. ${errors.join(" ")}`);
  }

  const updated = clone(index);
  updated.tranches[referenceIndex].lifecycle = "complete";
  return updated;
}

export function reopenCompletedTranche(
  index,
  tranche,
  { selectedSequences = [] } = {},
) {
  if ((index?.tranches ?? []).some((reference) => reference.lifecycle === "active")) {
    throw new Error("A completed tranche can be reopened only when no tranche is active.");
  }

  const referenceIndex = (index?.tranches ?? []).findIndex(
    (reference) => reference.id === tranche?.id,
  );

  if (referenceIndex === -1 || index.tranches[referenceIndex].lifecycle !== "complete") {
    throw new Error("Only a completed tranche can be reopened.");
  }

  const selected = new Set(selectedSequences);

  if (selected.size === 0) {
    throw new Error("Select at least one candidate for correction.");
  }

  const updatedIndex = clone(index);
  const updatedTranche = clone(tranche);

  for (const sequence of selected) {
    if (!updatedTranche.candidates.some((candidate) => candidate.sequence === sequence)) {
      throw new Error(`Correction candidate ${sequence} is not in the tranche.`);
    }
  }

  updatedIndex.tranches[referenceIndex].lifecycle = "active";
  updatedTranche.candidates = updatedTranche.candidates.map((candidate) =>
    selected.has(candidate.sequence)
      ? { ...candidate, pendingCorrection: true }
      : candidate,
  );

  return { index: updatedIndex, tranche: updatedTranche };
}

export function assembleSemanticGapTranche({
  catalogue,
  assignedCandidateTexts = [],
  acceptedCandidates = [],
  id,
  limit = 250,
} = {}) {
  const assigned = new Set(assignedCandidateTexts.map(normalizeCandidateText));
  const cellCounts = new Map();

  for (const candidate of acceptedCandidates) {
    const decision = candidate.decision;

    if (
      candidate.entryKind === "noun" &&
      decision?.curationDecision === "Accept" &&
      COMMONNESS_GRADES.has(decision.commonnessGrade) &&
      NOUN_SEMANTIC_BANDS.has(decision.nounSemanticBand)
    ) {
      const key = cellKey(decision.commonnessGrade, decision.nounSemanticBand);
      cellCounts.set(key, (cellCounts.get(key) ?? 0) + 1);
    }
  }

  const remaining = (catalogue?.candidates ?? []).filter((candidate) => {
    const suggestions = candidate.suggestions ?? {};
    return (
      !assigned.has(normalizeCandidateText(candidate.canonicalText)) &&
      COMMONNESS_GRADES.has(suggestions.commonnessGrade) &&
      NOUN_SEMANTIC_BANDS.has(suggestions.nounSemanticBand)
    );
  });
  const selected = [];

  while (remaining.length > 0 && selected.length < limit) {
    remaining.sort((left, right) => {
      const leftCell = cellKey(
        left.suggestions.commonnessGrade,
        left.suggestions.nounSemanticBand,
      );
      const rightCell = cellKey(
        right.suggestions.commonnessGrade,
        right.suggestions.nounSemanticBand,
      );
      const countDifference =
        (cellCounts.get(leftCell) ?? 0) - (cellCounts.get(rightCell) ?? 0);

      return countDifference !== 0 ? countDifference : compareCandidates(left, right);
    });

    const candidate = remaining.shift();
    selected.push(candidate);
    const key = cellKey(
      candidate.suggestions.commonnessGrade,
      candidate.suggestions.nounSemanticBand,
    );
    cellCounts.set(key, (cellCounts.get(key) ?? 0) + 1);
  }

  return {
    ...createBaselineTranche({
      id,
      entryKind: "noun",
      catalogue,
      candidateTexts: selected.map((candidate) => candidate.canonicalText),
    }),
    purpose: "semanticGap",
  };
}

export function buildSemanticSuggestionIndex(nounLexnameDocuments = []) {
  const bandsByLemma = new Map();

  for (const document of nounLexnameDocuments) {
    const band = NOUN_BAND_BY_LEXNAME.get(document?.lexname);

    if (!band || !document?.synsets || typeof document.synsets !== "object") {
      continue;
    }

    for (const synset of Object.values(document.synsets)) {
      for (const member of synset?.members ?? []) {
        const lemma = normalizeSemanticLemma(member);
        const bands = bandsByLemma.get(lemma) ?? new Set();
        bands.add(band);
        bandsByLemma.set(lemma, bands);
      }
    }
  }

  return new Map(
    [...bandsByLemma.entries()]
      .filter(([, bands]) => bands.size === 1)
      .map(([lemma, bands]) => [lemma, [...bands][0]]),
  );
}

export function reconcileEsdbSourceRecords(sourceRecords = []) {
  const recordsByCandidate = new Map();

  for (const record of sourceRecords) {
    if (!record || typeof record.canonicalText !== "string") {
      continue;
    }

    const key = candidateKey(record.entryKind, record.canonicalText);
    const records = recordsByCandidate.get(key) ?? [];
    records.push(record);
    recordsByCandidate.set(key, records);
  }

  return [...recordsByCandidate.values()]
    .map((records) => reconcileCandidateRecords(records))
    .sort(compareCandidates);
}

export function buildSourceCatalogue({
  entryKind,
  sourceRecords = [],
  baselineCandidates = [],
  semanticSuggestions = new Map(),
} = {}) {
  if (typeof entryKind !== "string" || entryKind.trim() === "") {
    throw new Error("Source Catalogue entryKind is required.");
  }

  const baselineTexts = normalizeBaselineCandidates(baselineCandidates);
  const baselineKeys = new Set(baselineTexts.map((text) => candidateKey(entryKind, text)));
  const candidatesByKey = new Map();

  for (const sourceCandidate of reconcileEsdbSourceRecords(sourceRecords)) {
    if (sourceCandidate.entryKind !== entryKind) {
      continue;
    }

    const key = candidateKey(entryKind, sourceCandidate.canonicalText);
    const baseline = baselineKeys.has(key);

    if (!baseline && !isAutomaticallyAdmitted(sourceCandidate)) {
      continue;
    }

    candidatesByKey.set(
      key,
      createCatalogueCandidate(sourceCandidate, { baseline, semanticSuggestions }),
    );
  }

  for (const canonicalText of baselineTexts) {
    const key = candidateKey(entryKind, canonicalText);
    const existing = candidatesByKey.get(key);

    candidatesByKey.set(
      key,
      existing ?? {
        canonicalText,
        entryKind,
        baseline: true,
        sourceEvidence: null,
        suggestions: {},
      },
    );
  }

  return {
    schemaVersion: 1,
    entryKind,
    profile: {
      sourceSizes: [...AUTOMATIC_SOURCE_SIZES],
      spellingProfiles: [...AUTOMATIC_SPELLING_PROFILES],
      variantLevels: [0, 1, 2, 3, 4],
    },
    candidates: [...candidatesByKey.values()].sort(compareCandidates),
  };
}

function reconcileCandidateRecords(records) {
  const first = records[0];
  const positiveSizes = records.flatMap((record) =>
    (Array.isArray(record.sourceSizes) ? record.sourceSizes : [record.sourceSize]).filter(
      (size) => Number.isInteger(size) && size > 0,
    ),
  );
  const spellingMap = new Map();

  for (const record of records) {
    const spellings = Array.isArray(record.spellings)
      ? record.spellings
      : [{ profile: "_", variantLevel: 0 }];

    for (const spelling of spellings) {
      const key = `${spelling.profile}:${spelling.variantLevel}`;
      spellingMap.set(key, spelling);
    }
  }

  return {
    canonicalText: first.canonicalText,
    entryKind: first.entryKind,
    resolvedSourceSize:
      positiveSizes.length > 0 ? Math.min(...positiveSizes) : null,
    sourceFiles: [...new Set(records.map((record) => record.sourceFile))].sort(),
    sourceTags: [...new Set(records.flatMap((record) => record.sourceTags ?? []))].sort(),
    spellings: [...spellingMap.values()].sort((left, right) =>
      `${left.profile}:${left.variantLevel}`.localeCompare(
        `${right.profile}:${right.variantLevel}`,
      ),
    ),
  };
}

function isAutomaticallyAdmitted(candidate) {
  return (
    AUTOMATIC_SOURCE_SIZES.has(candidate.resolvedSourceSize) &&
    candidate.spellings.some(
      ({ profile, variantLevel }) =>
        AUTOMATIC_SPELLING_PROFILES.has(profile) &&
        Number.isInteger(variantLevel) &&
        variantLevel <= MAX_AUTOMATIC_VARIANT_LEVEL,
    )
  );
}

function createCatalogueCandidate(candidate, { baseline, semanticSuggestions }) {
  const commonnessGrade = suggestCommonnessGrade(candidate.resolvedSourceSize);
  const nounSemanticBand =
    candidate.entryKind === "noun"
      ? semanticSuggestions.get(normalizeSemanticLemma(candidate.canonicalText))
      : null;

  return {
    canonicalText: candidate.canonicalText,
    entryKind: candidate.entryKind,
    baseline,
    sourceEvidence: {
      resolvedSize: candidate.resolvedSourceSize,
      sourceFiles: candidate.sourceFiles,
      sourceTags: candidate.sourceTags,
      spellings: candidate.spellings,
    },
    suggestions: {
      ...(commonnessGrade ? { commonnessGrade } : {}),
      ...(nounSemanticBand ? { nounSemanticBand } : {}),
    },
  };
}

function suggestCommonnessGrade(sourceSize) {
  if (sourceSize === 35 || sourceSize === 40) {
    return "common";
  }

  if (sourceSize === 50 || sourceSize === 60) {
    return "lessCommon";
  }

  if (sourceSize === 70 || sourceSize === 80) {
    return "rare";
  }

  return null;
}

function normalizeBaselineCandidates(baselineCandidates) {
  const candidates = [];
  const seen = new Set();

  for (const candidate of baselineCandidates) {
    const canonicalText = String(
      typeof candidate === "string" ? candidate : candidate?.canonicalText ?? "",
    )
      .trim()
      .replace(/\s+/g, " ");
    const key = canonicalText.toLocaleLowerCase("en-GB");

    if (canonicalText === "") {
      throw new Error("Baseline candidate canonicalText is required.");
    }

    if (seen.has(key)) {
      throw new Error(`Duplicate baseline candidate: "${canonicalText}".`);
    }

    seen.add(key);
    candidates.push(canonicalText);
  }

  return candidates;
}

function candidateKey(entryKind, canonicalText) {
  return `${entryKind}\u0000${canonicalText.toLocaleLowerCase("en-GB")}`;
}

function normalizeCandidateText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-GB");
}

function registerCandidateKey(entryKind, canonicalText) {
  return `${entryKind}\u0000${normalizeCandidateText(canonicalText)}`;
}

function cellKey(commonnessGrade, nounSemanticBand) {
  return `${commonnessGrade}\u0000${nounSemanticBand}`;
}

function attachPublishedEvidence(tranche, publishedCandidates = []) {
  const publishedByText = new Map(
    publishedCandidates.map((candidate) => [
      normalizeCandidateText(candidate.canonicalText),
      candidate,
    ]),
  );
  const updated = clone(tranche);

  updated.candidates = updated.candidates.map((candidate) => ({
    ...candidate,
    previouslyPublished: clone(
      publishedByText.get(normalizeCandidateText(candidate.canonicalText)),
    ),
  }));
  return updated;
}

function createTrancheReference(tranche, lifecycle) {
  return {
    id: tranche.id,
    entryKind: tranche.entryKind,
    path: `tranches/${tranche.id}.json`,
    purpose: tranche.purpose,
    lifecycle,
  };
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function normalizeSemanticLemma(value) {
  return String(value ?? "")
    .trim()
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-GB");
}

function compareCandidates(left, right) {
  return left.canonicalText < right.canonicalText
    ? -1
    : left.canonicalText > right.canonicalText
      ? 1
      : 0;
}
