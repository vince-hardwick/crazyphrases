import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { openReviewStore } from "./review-store.js";
import {
  completeActiveTranche,
  planNextNounSemanticGap,
  reopenCompletedTranche,
  saveNextDecision,
  startNextTranche,
  validateCurationDecision,
} from "./word-bank-review-programme.js";

const execFileAsync = promisify(execFile);

export async function createReviewWorkbenchServer({
  projectRoot,
  reviewDataRoot = path.join(projectRoot, "tools", "word-bank", "review-data"),
  staticRoot = path.join(projectRoot, "tools", "word-bank", "workbench"),
  port = 4177,
  isGitCheckpointed = defaultIsGitCheckpointed,
  createGitCheckpoint = createExactGitCheckpoint,
  loadNounCatalogue = defaultLoadNounCatalogue,
  nounPlanningOptions = {},
} = {}) {
  const store = await openReviewStore({ root: reviewDataRoot });
  let listening = false;
  let preparationPromise = null;
  const httpServer = createServer(async (request, response) => {
    try {
      await routeRequest(request, response);
    } catch (error) {
      const status = statusForError(error);
      sendJson(response, status, { error: error.message });
    }
  });

  return {
    mode: store.mode,
    async listen() {
      if (!listening) {
        await new Promise((resolve, reject) => {
          httpServer.once("error", reject);
          httpServer.listen(port, "127.0.0.1", () => {
            httpServer.off("error", reject);
            resolve();
          });
        });
        listening = true;
      }

      const address = httpServer.address();
      return {
        host: "127.0.0.1",
        port: address.port,
        origin: `http://127.0.0.1:${address.port}`,
      };
    },
    async close() {
      if (listening) {
        await new Promise((resolve, reject) =>
          httpServer.close((error) => (error ? reject(error) : resolve())),
        );
        listening = false;
      }
      await store.close();
    },
  };

  async function routeRequest(request, response) {
    const url = new URL(request.url, "http://127.0.0.1");

    if (request.method === "GET" && url.pathname === "/api/state") {
      sendJson(response, 200, await readWorkbenchState());
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/search") {
      sendJson(response, 200, await searchCandidates(url.searchParams.get("q")));
      return;
    }

    if (request.method === "GET" && isStaticPath(url.pathname)) {
      await sendStaticFile(response, staticRoot, url.pathname);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/prepare-next") {
      assertWritable();
      const body = await readJsonBody(request);
      sendJson(response, 200, await prepareNextReviewTranche(body));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/start-next") {
      assertWritable();
      const body = await readJsonBody(request);
      const state = await loadReviewData();
      const checkpointed = await isStartNextCheckpointed(state.index.data);
      const replacement = startNextTranche(state.index.data, { checkpointed });
      await store.save("register.json", replacement, {
        expectedHash: body.expectedIndexHash,
        validate: validateIndexShape,
      });
      sendJson(response, 200, await readWorkbenchState());
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/save-next") {
      assertWritable();
      const body = await readJsonBody(request);
      const state = await loadReviewData();
      const reference = state.index.data.tranches.find(
        (candidate) => candidate.id === body.trancheId,
      );

      if (!reference || reference.lifecycle !== "active") {
        throw new Error("Only the active tranche can be reviewed.");
      }

      const loaded = state.tranches.get(reference.id);
      const replacement = saveNextDecision(
        loaded.data,
        Number(body.sequence),
        body.decision,
      );
      await store.save(reference.path, replacement, {
        expectedHash: body.expectedTrancheHash,
        validate: (candidate) => validateTrancheShape(candidate, reference),
      });
      sendJson(response, 200, await readWorkbenchState());
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/complete") {
      assertWritable();
      const body = await readJsonBody(request);
      const state = await loadReviewData();
      const reference = state.index.data.tranches.find(
        (candidate) => candidate.id === body.trancheId,
      );

      if (!reference) {
        throw new Error(`Unknown tranche: ${body.trancheId}.`);
      }

      const loaded = state.tranches.get(reference.id);
      assertExpectedHash(
        loaded.hash,
        body.expectedTrancheHash,
        `${reference.path} changed outside the workbench`,
      );
      let replacement = completeActiveTranche(state.index.data, loaded.data, {
        confirmed: body.confirmed,
      });

      if (
        reference.entryKind === "noun" &&
        reference.purpose === "baseline" &&
        !replacement.tranches.some(
          (candidate) =>
            candidate.entryKind === "noun" &&
            new Set(["semanticGap", "catalogue"]).has(candidate.purpose),
        )
      ) {
        const catalogue = await loadNounCatalogue();
        const planned = planNextNounSemanticGap({
          catalogue,
          index: replacement,
          tranches: [...state.tranches.values()].map((candidate) => candidate.data),
          ...nounPlanningOptions,
        });

        const plannedReference = planned.index.tranches.find(
          (candidate) => candidate.id === planned.tranche.id,
        );
        await store.create(plannedReference.path, planned.tranche, {
          validate: (candidate) => validateTrancheShape(candidate, plannedReference),
        });

        replacement = planned.index;
      }

      await store.save("register.json", replacement, {
        expectedHash: body.expectedIndexHash,
        validate: validateIndexShape,
      });
      sendJson(response, 200, await readWorkbenchState());
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/reopen") {
      assertWritable();
      const body = await readJsonBody(request);
      const state = await loadReviewData();
      const reference = state.index.data.tranches.find(
        (candidate) => candidate.id === body.trancheId,
      );

      if (!reference) {
        throw new Error(`Unknown tranche: ${body.trancheId}.`);
      }

      const loaded = state.tranches.get(reference.id);
      const replacements = reopenCompletedTranche(state.index.data, loaded.data, {
        selectedSequences: body.selectedSequences,
      });
      const savedTranche = await store.save(reference.path, replacements.tranche, {
        expectedHash: body.expectedTrancheHash,
        validate: (candidate) => validateTrancheShape(candidate, reference),
      });

      try {
        await store.save("register.json", replacements.index, {
          expectedHash: body.expectedIndexHash,
          validate: validateIndexShape,
        });
      } catch (error) {
        error.message = `${error.message} The correction queue was saved safely, but the Register index was not changed.`;
        throw error;
      }

      assertExpectedHash(
        savedTranche.hash,
        (await store.load(reference.path)).hash,
        "Correction queue persistence failed",
      );
      sendJson(response, 200, await readWorkbenchState());
      return;
    }

    sendJson(response, 404, { error: "Not found." });
  }

  function assertWritable() {
    if (store.mode !== "writable") {
      throw new Error("This review workbench instance is read-only.");
    }
  }

  async function readWorkbenchState() {
    const state = await loadReviewData();
    const tranches = state.index.data.tranches.map((reference) => {
      const loaded = state.tranches.get(reference.id);
      return createTrancheSummary(reference, loaded.data);
    });
    const activeReference = state.index.data.tranches.find(
      (reference) => reference.lifecycle === "active",
    );
    const activeTranche = activeReference
      ? state.tranches.get(activeReference.id).data
      : null;
    const plannedReference = state.index.data.tranches.find(
      (reference) => reference.lifecycle === "planned",
    );

    return {
      mode: store.mode,
      catalogue: state.index.data.catalogue,
      tranches,
      startNextReady: plannedReference
        ? await isStartNextCheckpointed(state.index.data)
        : false,
      activeCandidate: activeTranche
        ? createActiveCandidate(activeReference, activeTranche)
        : null,
      hashes: {
        "register.json": state.index.hash,
        ...Object.fromEntries(
          state.index.data.tranches.map((reference) => [
            reference.path,
            state.tranches.get(reference.id).hash,
          ]),
        ),
      },
    };
  }

  async function prepareNextReviewTranche(body) {
    if (preparationPromise) {
      return preparationPromise;
    }

    preparationPromise = prepareNextReviewTrancheOnce(body);

    try {
      return await preparationPromise;
    } finally {
      preparationPromise = null;
    }
  }

  async function prepareNextReviewTrancheOnce(body) {
    let state = await loadReviewData();
    const incomplete = state.index.data.tranches.find(
      (reference) => reference.lifecycle !== "complete",
    );

    if (incomplete) {
      return readWorkbenchState();
    }

    assertExpectedHash(
      state.index.hash,
      body.expectedIndexHash,
      "register.json changed outside the workbench",
    );

    const completedReference = state.index.data.tranches.at(-1);

    if (!completedReference) {
      throw new Error("There is no completed tranche to checkpoint.");
    }

    const completed = state.tranches.get(completedReference.id);
    assertExpectedHash(
      completed.hash,
      body.expectedTrancheHash,
      `${completedReference.path} changed outside the workbench`,
    );

    await createGitCheckpoint({
      projectRoot,
      paths: toProjectReviewPaths(["register.json", completedReference.path]),
      message: `Checkpoint completed ${completedReference.id.replaceAll("-", " ")} review`,
    });

    state = await loadReviewData();
    const catalogue = await loadNounCatalogue();
    const planned = planNextNounSemanticGap({
      catalogue,
      index: state.index.data,
      tranches: [...state.tranches.values()].map((candidate) => candidate.data),
      ...nounPlanningOptions,
    });
    const plannedReference = planned.index.tranches.at(-1);
    const savedTranche = await store.create(plannedReference.path, planned.tranche, {
      validate: (candidate) => validateTrancheShape(candidate, plannedReference),
    });
    const savedIndex = await store.save("register.json", planned.index, {
      expectedHash: state.index.hash,
      validate: validateIndexShape,
    });

    assertExpectedHash(
      (await store.load(plannedReference.path)).hash,
      savedTranche.hash,
      `${plannedReference.path} changed outside the workbench`,
    );
    assertExpectedHash(
      (await store.load("register.json")).hash,
      savedIndex.hash,
      "register.json changed outside the workbench",
    );

    await createGitCheckpoint({
      projectRoot,
      paths: toProjectReviewPaths(["register.json", plannedReference.path]),
      message: `Plan ${plannedReference.id.replaceAll("-", " ")} review tranche`,
    });

    return readWorkbenchState();
  }

  async function isStartNextCheckpointed(index) {
    const completedReference = [...index.tranches]
      .reverse()
      .find((reference) => reference.lifecycle === "complete");

    if (!completedReference) {
      return true;
    }

    return isGitCheckpointed({
      projectRoot,
      paths: toProjectReviewPaths([
        "register.json",
        completedReference.path,
        ...index.tranches.map((reference) => reference.path),
      ]),
    });
  }

  function toProjectReviewPaths(relativePaths) {
    const relativeRoot = path.relative(projectRoot, reviewDataRoot);
    return [...new Set(relativePaths)].map((relativePath) =>
      path.join(relativeRoot, ...relativePath.split("/")),
    );
  }

  async function searchCandidates(rawQuery) {
    const query = normalizeText(rawQuery);

    if (query === "") {
      return { results: [] };
    }

    const state = await loadReviewData();
    const results = [];

    for (const reference of state.index.data.tranches) {
      const tranche = state.tranches.get(reference.id).data;

      for (const candidate of tranche.candidates) {
        const normalizedCandidate = normalizeText(candidate.canonicalText);

        if (!normalizedCandidate.startsWith(query)) {
          continue;
        }

        results.push({
          canonicalText: candidate.canonicalText,
          entryKind: tranche.entryKind,
          trancheId: tranche.id,
          sequence: candidate.sequence,
          lifecycle: reference.lifecycle,
          reviewState:
            validateCurationDecision(candidate.decision, {
              entryKind: tranche.entryKind,
            }).length === 0
              ? candidate.pendingCorrection === true
                ? "pendingCorrection"
                : "reviewed"
              : "pending",
          exact: normalizedCandidate === query,
          candidate: { ...candidate, entryKind: tranche.entryKind },
        });
      }
    }

    results.sort(
      (left, right) =>
        Number(right.exact) - Number(left.exact) ||
        normalizeText(left.canonicalText).localeCompare(
          normalizeText(right.canonicalText),
        ) ||
        left.entryKind.localeCompare(right.entryKind),
    );
    return { results };
  }

  async function loadReviewData() {
    const index = await store.load("register.json");
    const tranches = new Map(
      await Promise.all(
        index.data.tranches.map(async (reference) => [
          reference.id,
          await store.load(reference.path),
        ]),
      ),
    );
    return { index, tranches };
  }
}

function createTrancheSummary(reference, tranche) {
  const reviewed = tranche.candidates.filter(
    (candidate) =>
      validateCurationDecision(candidate.decision, {
        entryKind: tranche.entryKind,
      }).length === 0 && candidate.pendingCorrection !== true,
  ).length;
  const total = tranche.candidates.length;

  return {
    ...reference,
    progress: {
      reviewed,
      total,
      percentage: total === 0 ? 0 : Math.floor((reviewed / total) * 100),
    },
  };
}

function createActiveCandidate(reference, tranche) {
  const correctionMode = tranche.candidates.some(
    (candidate) => candidate.pendingCorrection === true,
  );
  const candidate = tranche.candidates.find((item) =>
    correctionMode
      ? item.pendingCorrection === true
      : validateCurationDecision(item.decision, {
          entryKind: tranche.entryKind,
        }).length > 0,
  );

  return candidate
    ? {
        trancheId: tranche.id,
        entryKind: tranche.entryKind,
        lifecycle: reference.lifecycle,
        correctionMode,
        ...candidate,
      }
    : null;
}

function validateIndexShape(index) {
  if (
    index?.schemaVersion !== 1 ||
    !Array.isArray(index.tranches) ||
    index.tranches.filter((reference) => reference.lifecycle === "active").length > 1 ||
    index.tranches.some(
      (reference) =>
        !new Set(["planned", "active", "complete"]).has(reference.lifecycle),
    )
  ) {
    throw new Error("The replacement Review Register index is invalid.");
  }
}

function validateTrancheShape(tranche, reference) {
  if (
    tranche?.schemaVersion !== 1 ||
    tranche.id !== reference.id ||
    tranche.entryKind !== reference.entryKind ||
    !Array.isArray(tranche.candidates) ||
    tranche.candidates.length === 0 ||
    tranche.candidates.length > 250 ||
    tranche.candidates.some(
      (candidate, index) =>
        candidate.sequence !== index + 1 ||
        typeof candidate.canonicalText !== "string" ||
        candidate.canonicalText.trim() === "",
    )
  ) {
    throw new Error(`The replacement tranche "${reference.id}" is invalid.`);
  }
}

async function defaultIsGitCheckpointed({ projectRoot, paths }) {
  const { stdout } = await execFileAsync(
    "git",
    ["status", "--porcelain", "--untracked-files=all", "--", ...paths],
    { cwd: projectRoot, windowsHide: true },
  );
  return stdout.trim() === "";
}

export async function createExactGitCheckpoint({ projectRoot, paths, message }) {
  const exactPaths = [...new Set(paths)];

  if (exactPaths.length === 0 || typeof message !== "string" || message.trim() === "") {
    throw new Error("An exact path set and commit message are required.");
  }

  const { stdout: statusBefore } = await execFileAsync(
    "git",
    ["status", "--porcelain", "--untracked-files=all", "--", ...exactPaths],
    { cwd: projectRoot, windowsHide: true },
  );

  if (statusBefore.trim() === "") {
    return { created: false };
  }

  try {
    await execFileAsync("git", ["add", "--", ...exactPaths], {
      cwd: projectRoot,
      windowsHide: true,
    });
    await execFileAsync(
      "git",
      ["commit", "--only", "-m", message, "--", ...exactPaths],
      { cwd: projectRoot, windowsHide: true },
    );
  } catch (error) {
    throw new Error(`Automatic local Git checkpoint failed: ${error.message}`);
  }

  const checkpointed = await defaultIsGitCheckpointed({
    projectRoot,
    paths: exactPaths,
  });

  if (!checkpointed) {
    throw new Error("Automatic local Git checkpoint left review paths uncommitted.");
  }

  const { stdout: head } = await execFileAsync("git", ["rev-parse", "HEAD"], {
    cwd: projectRoot,
    windowsHide: true,
  });
  return { created: true, head: head.trim() };
}

async function defaultLoadNounCatalogue() {
  const { loadPinnedReviewInputs } = await import("./build-review-programme.mjs");
  const inputs = await loadPinnedReviewInputs();
  return inputs.nounCatalogue;
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      throw new Error("Request body is too large.");
    }
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

async function sendStaticFile(response, staticRoot, pathname) {
  const fileName =
    pathname === "/" ? "index.html" : pathname === "/app.js" ? "app.js" : "styles.css";
  const contentType =
    fileName.endsWith(".html")
      ? "text/html; charset=utf-8"
      : fileName.endsWith(".js")
        ? "text/javascript; charset=utf-8"
        : "text/css; charset=utf-8";
  const source = await readFile(path.join(staticRoot, fileName));
  response.writeHead(200, {
    "content-type": contentType,
    "cache-control": "no-store",
    "content-security-policy":
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  });
  response.end(source);
}

function isStaticPath(pathname) {
  return pathname === "/" || pathname === "/app.js" || pathname === "/styles.css";
}

function statusForError(error) {
  if (/read-only|changed outside|Git checkpoint/i.test(error?.message)) {
    return 409;
  }
  return 400;
}

function assertExpectedHash(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}; reload before continuing.`);
  }
}

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-GB");
}
