const COMMONNESS_GRADES = ["common", "lessCommon", "rare"];
const NOUN_SEMANTIC_BANDS = [
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
];

export function validateEntryAssistWeightPolicy(policy) {
  if (
    policy?.schemaVersion !== 1 ||
    typeof policy.policyVersion !== "string" ||
    policy.policyVersion.trim() === ""
  ) {
    return false;
  }

  const adjective = policy.entryKinds?.adjective;
  const noun = policy.entryKinds?.noun;

  return (
    hasValidGradeWeights(adjective?.gradeWeights) &&
    hasValidGradeWeights(noun?.gradeWeights) &&
    Array.isArray(noun?.nounSemanticBands) &&
    noun.nounSemanticBands.length === NOUN_SEMANTIC_BANDS.length &&
    noun.nounSemanticBands.every(
      (band, index) => band === NOUN_SEMANTIC_BANDS[index],
    )
  );
}

export function selectEntryCandidate(
  candidates,
  {
    entryKind,
    policy,
    random = Math.random,
    usedCandidateKeys = [],
  } = {},
) {
  const available = Array.isArray(candidates)
    ? candidates
        .map((candidate) => ({ candidate, value: getCandidateValue(candidate) }))
        .filter(({ value }) => value !== "")
    : [];

  if (available.length === 0) {
    return null;
  }

  const used = new Set(usedCandidateKeys.map(candidateKey));
  const unused = available.filter(({ value }) => !used.has(candidateKey(value)));
  const pool = unused.length > 0 ? unused : available;

  if (!validateEntryAssistWeightPolicy(policy)) {
    return uniformChoice(pool, random).value;
  }

  const cells = new Map();

  for (const item of pool) {
    const descriptor = getCellDescriptor(item.candidate, entryKind, policy);

    if (!descriptor) {
      return uniformChoice(pool, random).value;
    }

    const cell = cells.get(descriptor.key) ?? {
      candidates: [],
      weight: descriptor.weight,
    };
    cell.candidates.push(item);
    cells.set(descriptor.key, cell);
  }

  const nonEmptyCells = [...cells.values()];
  const totalWeight = nonEmptyCells.reduce((sum, cell) => sum + cell.weight, 0);
  const cellRoll = boundedRandom(random()) * totalWeight;
  let cumulativeWeight = 0;
  let selectedCell = nonEmptyCells[nonEmptyCells.length - 1];

  for (const cell of nonEmptyCells) {
    cumulativeWeight += cell.weight;
    if (cellRoll < cumulativeWeight) {
      selectedCell = cell;
      break;
    }
  }

  return uniformChoice(selectedCell.candidates, random).value;
}

function getCellDescriptor(candidate, entryKind, policy) {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    candidate.entryKind !== entryKind ||
    !COMMONNESS_GRADES.includes(candidate.commonnessGrade)
  ) {
    return null;
  }

  const entryPolicy = policy.entryKinds[entryKind];
  const weight = entryPolicy?.gradeWeights?.[candidate.commonnessGrade];

  if (entryKind === "adjective") {
    return {
      key: candidate.commonnessGrade,
      weight,
    };
  }

  if (
    entryKind !== "noun" ||
    !entryPolicy.nounSemanticBands.includes(candidate.nounSemanticBand)
  ) {
    return null;
  }

  return {
    key: `${candidate.nounSemanticBand}\u0000${candidate.commonnessGrade}`,
    weight,
  };
}

function hasValidGradeWeights(weights) {
  return (
    weights &&
    Object.keys(weights).length === COMMONNESS_GRADES.length &&
    COMMONNESS_GRADES.every(
      (grade) => Number.isFinite(weights[grade]) && weights[grade] > 0,
    )
  );
}

function uniformChoice(candidates, random) {
  return candidates[Math.floor(boundedRandom(random()) * candidates.length)];
}

function boundedRandom(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.min(value, 1 - Number.EPSILON);
}

function getCandidateValue(candidate) {
  if (typeof candidate === "string") {
    return cleanWhitespace(candidate);
  }

  if (candidate && typeof candidate === "object") {
    for (const field of ["value", "canonicalText", "text"]) {
      if (typeof candidate[field] === "string") {
        const value = cleanWhitespace(candidate[field]);

        if (value !== "") {
          return value;
        }
      }
    }
  }

  return "";
}

function candidateKey(value) {
  return cleanWhitespace(value).toLocaleLowerCase("en-GB");
}

function cleanWhitespace(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}
