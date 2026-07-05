#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildProductionWordBanks,
  parseEsdbSourceText,
} from "./word-bank-pipeline.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..", "..");

const args = parseArgs(process.argv.slice(2));
const sourceConfig = await readJson(
  path.join(scriptDir, "source-config", "esdb-scowl-v2.json"),
);
const curations = await Promise.all(
  ["adjective.tracer.json", "noun.tracer.json"].map((fileName) =>
    readJson(path.join(scriptDir, "curation", fileName)),
  ),
);
const sourceRoot = await resolveSourceRoot({ args, sourceConfig });
const sourceRecords = (
  await Promise.all(
    sourceConfig.extractFiles
      .filter((sourceFile) => sourceFile.startsWith("data/"))
      .map(async (sourceFile) =>
        parseEsdbSourceText(await readUtf8(path.join(sourceRoot, sourceFile)), {
          sourceFile,
        }),
      ),
  )
).flat();
const result = buildProductionWordBanks({
  curations,
  sourceConfig,
  sourceRecords,
});

await writeOrCheckOutput({
  args,
  result,
});

console.log(
  `Built ${result.shardResults
    .map(({ shard }) => `${shard.candidates.length} ${shard.entryKind}`)
    .join(", ")} Word Bank candidates from ${sourceConfig.id} ${sourceConfig.shortVersion}.`,
);

function parseArgs(rawArgs) {
  const parsed = {
    assetsDir: path.join(projectRoot, "assets", "word-bank"),
    check: false,
    downloadDir: path.join(
      os.tmpdir(),
      "crazyphrases-word-bank-build",
      "downloads",
    ),
    reviewDir: path.join(projectRoot, "output", "word-bank-review"),
    scratchDir: path.join(os.tmpdir(), "crazyphrases-word-bank-build", "source"),
    sourceArchive: null,
    sourceDir: null,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (arg === "--check") {
      parsed.check = true;
      continue;
    }

    if (arg.startsWith("--") && index + 1 < rawArgs.length) {
      const value = rawArgs[index + 1];
      index += 1;

      if (arg === "--assets-dir") {
        parsed.assetsDir = path.resolve(value);
      } else if (arg === "--download-dir") {
        parsed.downloadDir = path.resolve(value);
      } else if (arg === "--review-dir") {
        parsed.reviewDir = path.resolve(value);
      } else if (arg === "--scratch-dir") {
        parsed.scratchDir = path.resolve(value);
      } else if (arg === "--source-archive") {
        parsed.sourceArchive = path.resolve(value);
      } else if (arg === "--source-dir") {
        parsed.sourceDir = path.resolve(value);
      } else {
        throw new Error(`Unknown Word Bank build option: ${arg}`);
      }

      continue;
    }

    throw new Error(`Unknown Word Bank build option: ${arg}`);
  }

  return parsed;
}

async function resolveSourceRoot({ args, sourceConfig }) {
  if (args.sourceDir) {
    return args.sourceDir;
  }

  const archivePath =
    args.sourceArchive ??
    path.join(args.downloadDir, `${sourceConfig.id}-${sourceConfig.shortVersion}.zip`);

  await mkdir(path.dirname(archivePath), { recursive: true });

  if (!existsSync(archivePath)) {
    await downloadFile(sourceConfig.archiveUrl, archivePath);
  }

  await verifySha256(archivePath, sourceConfig.archiveSha256);
  await rm(args.scratchDir, { force: true, recursive: true });
  await mkdir(args.scratchDir, { recursive: true });

  execFileSync(
    "tar",
    [
      "-xf",
      archivePath,
      "-C",
      args.scratchDir,
      ...sourceConfig.extractFiles.map(
        (sourceFile) => `${sourceConfig.archiveRoot}/${sourceFile}`,
      ),
    ],
    { stdio: "pipe" },
  );

  return path.join(args.scratchDir, sourceConfig.archiveRoot);
}

async function writeOrCheckOutput({ args, result }) {
  const manifestPath = path.join(args.assetsDir, "manifest.json");
  const manifestJson = stringifyJson(result.manifest);

  if (args.check) {
    await assertFileMatches(manifestPath, manifestJson);
    await Promise.all(
      result.shardResults.map(async (shardResult) =>
        assertFileMatches(
          path.join(projectRoot, shardResult.shardPath.replaceAll("/", path.sep)),
          stringifyJson(shardResult.shard),
        ),
      ),
    );
    return;
  }

  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, manifestJson, "utf8");
  await Promise.all(
    result.shardResults.map(async (shardResult) => {
      const shardPath = path.join(
        projectRoot,
        shardResult.shardPath.replaceAll("/", path.sep),
      );
      const reviewPath = path.join(
        args.reviewDir,
        `${shardResult.shard.entryKind}.${shardResult.shard.version}.review.json`,
      );

      await mkdir(path.dirname(shardPath), { recursive: true });
      await mkdir(path.dirname(reviewPath), { recursive: true });
      await writeFile(shardPath, stringifyJson(shardResult.shard), "utf8");
      await writeFile(reviewPath, stringifyJson(shardResult.review), "utf8");
    }),
  );
}

async function assertFileMatches(filePath, expectedContent) {
  const actualContent = await readUtf8(filePath);

  if (normalizeLineEndings(actualContent) !== expectedContent) {
    throw new Error(`${path.relative(projectRoot, filePath)} is not reproducible.`);
  }
}

async function verifySha256(filePath, expectedHash) {
  const actualHash = createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex")
    .toUpperCase();

  if (actualHash !== expectedHash.toUpperCase()) {
    throw new Error(
      `Unexpected SHA-256 for ${filePath}. Expected ${expectedHash}, got ${actualHash}.`,
    );
  }
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
      output.on("finish", () => {
        output.close(resolve);
      });
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

function stringifyJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n/g, "\n");
}
