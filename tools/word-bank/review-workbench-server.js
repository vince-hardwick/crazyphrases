import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { openReviewStore } from "./review-store.js";
import {
  completeActiveTranche,
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
} = {}) {
  const store = await openReviewStore({ root: reviewDataRoot });
  let listening = false;
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

    if (request.method === "POST" && url.pathname === "/api/start-next") {
      assertWritable();
      const body = await readJsonBody(request);
      const state = await loadReviewData();
      const completedReference = [...state.index.data.tranches]
        .reverse()
        .find((reference) => reference.lifecycle === "complete");
      const checkpointed = completedReference
        ? await isGitCheckpointed({
            projectRoot,
            paths: ["register.json", completedReference.path].map((relativePath) =>
              path.join(
                path.relative(projectRoot, reviewDataRoot),
                ...relativePath.split("/"),
              ),
            ),
          })
        : true;
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
      const replacement = completeActiveTranche(state.index.data, loaded.data, {
        confirmed: body.confirmed,
      });
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

    return {
      mode: store.mode,
      catalogue: state.index.data.catalogue,
      tranches,
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
