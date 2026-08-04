import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createReviewWorkbenchServer } from "../tools/word-bank/review-workbench-server.js";

const resources = [];

afterEach(async () => {
  await Promise.all(
    resources.splice(0).map(async (resource) => {
      if (resource.server) {
        await resource.server.close();
      }
      if (resource.root) {
        await rm(resource.root, { force: true, recursive: true });
      }
    }),
  );
});

describe("Word Bank review workbench server", () => {
  it("binds to loopback and exposes derived state, search, and strict sequential saves", async () => {
    const fixture = await createFixture();
    const server = await createReviewWorkbenchServer({
      projectRoot: fixture.projectRoot,
      reviewDataRoot: fixture.reviewDataRoot,
      port: 0,
      isGitCheckpointed: async () => true,
    });
    resources.push({ server, root: fixture.projectRoot });
    const address = await server.listen();

    assert.equal(address.host, "127.0.0.1");
    let state = await getJson(`${address.origin}/api/state`);
    assert.equal(state.mode, "writable");
    assert.deepEqual(state.tranches[0].progress, {
      reviewed: 0,
      total: 2,
      percentage: 0,
    });

    const search = await getJson(`${address.origin}/api/search?q=an`);
    assert.deepEqual(
      search.results.map(({ canonicalText, reviewState }) => [canonicalText, reviewState]),
      [["anchor", "pending"]],
    );

    state = await postJson(`${address.origin}/api/start-next`, {
      expectedIndexHash: state.hashes["register.json"],
    });
    assert.equal(state.tranches[0].lifecycle, "active");

    const skipped = await postJson(
      `${address.origin}/api/save-next`,
      {
        trancheId: "noun-baseline",
        sequence: 2,
        decision: acceptedNounDecision("Made Objects"),
        expectedTrancheHash: state.hashes["tranches/noun-baseline.json"],
      },
      { expectedStatus: 400 },
    );
    assert.match(skipped.error, /candidate 1 must be reviewed first/i);

    state = await postJson(`${address.origin}/api/save-next`, {
      trancheId: "noun-baseline",
      sequence: 1,
      decision: acceptedNounDecision("Made Objects"),
      expectedTrancheHash: state.hashes["tranches/noun-baseline.json"],
    });
    assert.deepEqual(state.tranches[0].progress, {
      reviewed: 1,
      total: 2,
      percentage: 50,
    });
    assert.equal(state.activeCandidate.sequence, 2);
  });

  it("opens an additional process read-only and rejects its mutations", async () => {
    const fixture = await createFixture();
    const writer = await createReviewWorkbenchServer({
      projectRoot: fixture.projectRoot,
      reviewDataRoot: fixture.reviewDataRoot,
      port: 0,
      isGitCheckpointed: async () => true,
    });
    const reader = await createReviewWorkbenchServer({
      projectRoot: fixture.projectRoot,
      reviewDataRoot: fixture.reviewDataRoot,
      port: 0,
      isGitCheckpointed: async () => true,
    });
    resources.push({ server: writer, root: fixture.projectRoot }, { server: reader });
    const writerAddress = await writer.listen();
    const readerAddress = await reader.listen();
    const writerState = await getJson(`${writerAddress.origin}/api/state`);
    const readerState = await getJson(`${readerAddress.origin}/api/state`);

    assert.equal(writerState.mode, "writable");
    assert.equal(readerState.mode, "readOnly");
    const blocked = await postJson(
      `${readerAddress.origin}/api/start-next`,
      { expectedIndexHash: readerState.hashes["register.json"] },
      { expectedStatus: 409 },
    );
    assert.match(blocked.error, /read-only/i);
  });

  it("refuses stale browser state after an external edit", async () => {
    const fixture = await createFixture();
    const server = await createReviewWorkbenchServer({
      projectRoot: fixture.projectRoot,
      reviewDataRoot: fixture.reviewDataRoot,
      port: 0,
      isGitCheckpointed: async () => true,
    });
    resources.push({ server, root: fixture.projectRoot });
    const address = await server.listen();
    const state = await getJson(`${address.origin}/api/state`);
    const registerPath = path.join(fixture.reviewDataRoot, "register.json");
    const register = fixtureRegister();
    register.externalEdit = true;
    await writeJson(registerPath, register);

    const conflict = await postJson(
      `${address.origin}/api/start-next`,
      { expectedIndexHash: state.hashes["register.json"] },
      { expectedStatus: 409 },
    );
    assert.match(conflict.error, /changed outside the workbench/i);
  });
});

async function createFixture() {
  const projectRoot = await mkdtemp(
    path.join(os.tmpdir(), "crazyphrases-review-workbench-"),
  );
  const reviewDataRoot = path.join(projectRoot, "tools", "word-bank", "review-data");
  await mkdir(path.join(reviewDataRoot, "tranches"), { recursive: true });
  await writeJson(path.join(reviewDataRoot, "register.json"), fixtureRegister());
  await writeJson(path.join(reviewDataRoot, "tranches", "noun-baseline.json"), {
    schemaVersion: 1,
    id: "noun-baseline",
    entryKind: "noun",
    purpose: "baseline",
    candidates: ["anchor", "lantern"].map((canonicalText, index) => ({
      sequence: index + 1,
      canonicalText,
      evidence: { resolvedSize: 40 },
      suggestions: {
        commonnessGrade: "common",
        nounSemanticBand: "Made Objects",
      },
      decision: null,
    })),
  });
  return { projectRoot, reviewDataRoot };
}

function fixtureRegister() {
  return {
    schemaVersion: 1,
    catalogue: { id: "fixture", entryKind: "noun", candidateCount: 2 },
    tranches: [
      {
        id: "noun-baseline",
        entryKind: "noun",
        path: "tranches/noun-baseline.json",
        purpose: "baseline",
        lifecycle: "planned",
      },
    ],
  };
}

function acceptedNounDecision(nounSemanticBand) {
  return {
    ukEnglishEligible: true,
    familyFriendly: true,
    curationDecision: "Accept",
    commonnessGrade: "common",
    nounSemanticBand,
  };
}

async function getJson(url) {
  const response = await fetch(url);
  assert.equal(response.status, 200);
  return response.json();
}

async function postJson(url, body, { expectedStatus = 200 } = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, expectedStatus);
  return response.json();
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
