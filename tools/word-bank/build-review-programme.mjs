import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseEsdbSourceText } from "./word-bank-pipeline.js";
import {
  buildInitialReviewProgramme,
  buildSemanticSuggestionIndex,
  buildSourceCatalogue,
  validateReviewRegister,
} from "./word-bank-review-programme.js";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const projectRoot = path.resolve(scriptDir, "..", "..");
const reviewDataRoot = path.join(scriptDir, "review-data");

if (path.resolve(process.argv[1] ?? "") === scriptPath) {
  await main(process.argv.slice(2));
}

async function main(rawArgs) {
  const args = parseArgs(rawArgs);
  const inputs = await loadPinnedReviewInputs();
  const expected = buildInitialReviewProgramme({
    nounCatalogue: inputs.nounCatalogue,
    adjectiveCatalogue: inputs.adjectiveBaselineCatalogue,
    catalogueIdentity: inputs.catalogueIdentity,
    publishedNounCandidates: inputs.publishedNounShard.candidates,
    publishedAdjectiveCandidates: inputs.publishedAdjectiveShard.candidates,
  });

  if (args.initialise) {
    await initialiseReviewData(expected);
    console.log(
      `Initialised ${expected.nounBaseline.candidates.length} noun and ${expected.adjectiveBaseline.candidates.length} adjective baseline candidates without curation decisions.`,
    );
  } else {
    await checkReviewData(expected, {
      nounCatalogue: inputs.nounCatalogue,
      adjectiveCatalogue: inputs.adjectiveBaselineCatalogue,
    });
    console.log(
      `Validated the review programme against ${inputs.nounCatalogue.candidates.length} pinned noun Source Catalogue candidates.`,
    );
  }
}

export async function loadPinnedReviewInputs() {
  const esdbConfig = await readJson(
    path.join(scriptDir, "source-config", "esdb-scowl-v2.json"),
  );
  const semanticConfig = await readJson(
    path.join(scriptDir, "source-config", "open-english-wordnet-2025.json"),
  );
  const manifest = await readJson(
    path.join(projectRoot, "assets", "word-bank", "manifest.json"),
  );
  const publishedNounShard = await readJson(
    path.join(projectRoot, ...manifest.entryKinds.noun.path.split("/")),
  );
  const publishedAdjectiveShard = await readJson(
    path.join(projectRoot, ...manifest.entryKinds.adjective.path.split("/")),
  );
  const esdbRoot = await resolveEsdbRoot(esdbConfig);
  const semanticRoot = await resolveSemanticRoot(semanticConfig);
  const sourceRecords = (
    await Promise.all(
      esdbConfig.extractFiles
        .filter((sourceFile) => sourceFile.startsWith("data/"))
        .map(async (sourceFile) =>
          parseEsdbSourceText(await readUtf8(path.join(esdbRoot, sourceFile)), {
            sourceFile,
          }),
        ),
    )
  ).flat();
  const semanticSuggestions = buildSemanticSuggestionIndex(
    await Promise.all(
      semanticConfig.nounLexnames.map(async (lexname) => ({
        lexname,
        synsets: await readJson(path.join(semanticRoot, `noun.${lexname}.json`)),
      })),
    ),
  );
  const nounCatalogue = buildSourceCatalogue({
    entryKind: "noun",
    sourceRecords,
    baselineCandidates: publishedNounShard.candidates,
    semanticSuggestions,
  });
  const adjectiveCatalogue = buildSourceCatalogue({
    entryKind: "adjective",
    sourceRecords,
    baselineCandidates: publishedAdjectiveShard.candidates,
  });
  const adjectiveBaselineTexts = new Set(
    publishedAdjectiveShard.candidates.map((candidate) => candidate.canonicalText),
  );
  const adjectiveBaselineCatalogue = {
    ...adjectiveCatalogue,
    candidates: adjectiveCatalogue.candidates.filter((candidate) =>
      adjectiveBaselineTexts.has(candidate.canonicalText),
    ),
  };
  const catalogueIdentity = createCatalogueIdentity({
    esdbConfig,
    nounCatalogue,
    semanticConfig,
  });

  return {
    adjectiveBaselineCatalogue,
    catalogueIdentity,
    nounCatalogue,
    publishedAdjectiveShard,
    publishedNounShard,
  };
}

function parseArgs(rawArgs) {
  const parsed = { initialise: false };

  for (const arg of rawArgs) {
    if (arg === "--initialise") {
      parsed.initialise = true;
    } else if (arg !== "--check") {
      throw new Error(`Unknown review-programme option: ${arg}`);
    }
  }

  return parsed;
}

async function initialiseReviewData(programme) {
  const targets = [
    path.join(reviewDataRoot, "register.json"),
    path.join(reviewDataRoot, "tranches", "noun-baseline.json"),
    path.join(reviewDataRoot, "tranches", "adjective-baseline.json"),
  ];

  if (targets.some((target) => existsSync(target))) {
    throw new Error(
      "Review data already exists. Use --check; initialisation never replaces operator data.",
    );
  }

  await mkdir(path.join(reviewDataRoot, "tranches"), { recursive: true });
  await writeJson(targets[0], programme.index);
  await writeJson(targets[1], programme.nounBaseline);
  await writeJson(targets[2], programme.adjectiveBaseline);
}

async function checkReviewData(programme, { nounCatalogue, adjectiveCatalogue }) {
  const actualIndex = await readJson(path.join(reviewDataRoot, "register.json"));
  const actualTranches = await loadRegisteredReviewTranches(
    reviewDataRoot,
    actualIndex,
  );
  const actualNounBaseline = actualTranches.find(
    (tranche) => tranche.id === "noun-baseline",
  );
  const actualAdjectiveBaseline = actualTranches.find(
    (tranche) => tranche.id === "adjective-baseline",
  );

  assertJsonEqual(
    actualIndex.catalogue,
    programme.index.catalogue,
    "Review Register catalogue identity is not reproducible",
  );
  assertBaselineEvidence(actualNounBaseline, programme.nounBaseline);
  assertBaselineEvidence(actualAdjectiveBaseline, programme.adjectiveBaseline);
  validateReviewRegister({
    catalogue: {
      candidates: [
        ...nounCatalogue.candidates,
        ...adjectiveCatalogue.candidates,
      ],
    },
    index: actualIndex,
    tranches: actualTranches,
    requireCompleteCoverage: false,
  });
}

export async function loadRegisteredReviewTranches(root, index) {
  return Promise.all(
    index.tranches.map((reference) =>
      readJson(path.join(root, ...reference.path.split("/"))),
    ),
  );
}

function assertBaselineEvidence(actual, expected) {
  const withoutDecision = (tranche) => ({
    ...tranche,
    candidates: tranche.candidates.map(
      ({ decision: _decision, pendingCorrection: _pendingCorrection, ...candidate }) =>
        candidate,
    ),
  });

  assertJsonEqual(
    withoutDecision(actual),
    withoutDecision(expected),
    `${actual.id} roster or evidence is not reproducible`,
  );
}

function assertJsonEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}.`);
  }
}

function createCatalogueIdentity({ esdbConfig, nounCatalogue, semanticConfig }) {
  const digest = createHash("sha256");

  for (const candidate of nounCatalogue.candidates) {
    digest.update(
      `${candidate.canonicalText}\u0000${candidate.sourceEvidence?.resolvedSize ?? ""}\u0000${candidate.suggestions.commonnessGrade ?? ""}\u0000${candidate.suggestions.nounSemanticBand ?? ""}\n`,
      "utf8",
    );
  }

  return {
    id: `noun-${esdbConfig.id}-${esdbConfig.shortVersion}-b0-4-size35-80-oewn-2025`,
    entryKind: "noun",
    candidateCount: nounCatalogue.candidates.length,
    sha256: digest.digest("hex").toUpperCase(),
    source: {
      id: esdbConfig.id,
      version: esdbConfig.version,
      archiveSha256: esdbConfig.archiveSha256,
      sizes: [35, 40, 50, 60, 70, 80],
      spellingProfiles: ["_", "B"],
      variantLevels: [0, 1, 2, 3, 4],
    },
    semanticReference: {
      id: semanticConfig.id,
      version: semanticConfig.version,
      archiveSha256: semanticConfig.archiveSha256,
    },
    generator: "tools/word-bank/build-review-programme.mjs",
  };
}

async function resolveEsdbRoot(config) {
  const scratchRoot = reviewScratchPath("esdb");
  const archivePath = await ensureArchive(config);
  await resetScratchDirectory(scratchRoot);
  execFileSync(
    "tar",
    [
      "-xf",
      archivePath,
      "-C",
      scratchRoot,
      ...config.extractFiles.map(
        (sourceFile) => `${config.archiveRoot}/${sourceFile}`,
      ),
    ],
    { stdio: "pipe" },
  );
  return path.join(scratchRoot, config.archiveRoot);
}

async function resolveSemanticRoot(config) {
  const scratchRoot = reviewScratchPath("oewn");
  const archivePath = await ensureArchive(config);
  await resetScratchDirectory(scratchRoot);
  execFileSync(
    "tar",
    [
      "-xf",
      archivePath,
      "-C",
      scratchRoot,
      ...config.nounLexnames.map((lexname) => `noun.${lexname}.json`),
    ],
    { stdio: "pipe" },
  );
  return scratchRoot;
}

async function ensureArchive(config) {
  const downloadRoot = path.join(
    os.tmpdir(),
    "crazyphrases-word-bank-build",
    "downloads",
  );
  const archivePath = path.join(downloadRoot, `${config.id}-${config.version}.zip`);
  await mkdir(downloadRoot, { recursive: true });

  if (!existsSync(archivePath)) {
    const legacyArchive =
      config.id === "esdb-scowl-v2"
        ? path.join(downloadRoot, `${config.id}-${config.shortVersion}.zip`)
        : config.id === "open-english-wordnet-core"
          ? path.join(downloadRoot, "english-wordnet-2025-json.zip")
          : null;

    if (legacyArchive && existsSync(legacyArchive)) {
      await writeFile(archivePath, await readFile(legacyArchive));
    } else {
      await downloadFile(config.archiveUrl, archivePath);
    }
  }

  const actualHash = createHash("sha256")
    .update(await readFile(archivePath))
    .digest("hex")
    .toUpperCase();

  if (actualHash !== config.archiveSha256.toUpperCase()) {
    throw new Error(
      `Unexpected SHA-256 for ${config.id}. Expected ${config.archiveSha256}, got ${actualHash}.`,
    );
  }

  return archivePath;
}

async function resetScratchDirectory(scratchRoot) {
  const allowedRoot = path.join(os.tmpdir(), "crazyphrases-word-bank-review");
  const resolved = path.resolve(scratchRoot);

  if (!resolved.startsWith(`${path.resolve(allowedRoot)}${path.sep}`)) {
    throw new Error(`Refusing to reset unexpected scratch path: ${resolved}`);
  }

  await rm(resolved, { force: true, recursive: true });
  await mkdir(resolved, { recursive: true });
}

function reviewScratchPath(name) {
  return path.join(os.tmpdir(), "crazyphrases-word-bank-review", name);
}

async function downloadFile(url, destinationPath) {
  await new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume();
        downloadFile(new URL(response.headers.location, url).toString(), destinationPath)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Download failed with HTTP ${response.statusCode}: ${url}`));
        return;
      }

      const output = createWriteStream(destinationPath);
      response.pipe(output);
      output.on("finish", () => output.close(resolve));
      output.on("error", reject);
    });

    request.on("error", reject);
  });
}

async function readJson(filePath) {
  return JSON.parse(await readUtf8(filePath));
}

async function readUtf8(filePath) {
  return readFile(filePath, "utf8");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
