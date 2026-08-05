import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { chromium } from "playwright";

import {
  createExactGitCheckpoint,
  createReviewWorkbenchServer,
} from "../tools/word-bank/review-workbench-server.js";

const resources = [];
const execFileAsync = promisify(execFile);

afterEach(async () => {
  await Promise.all(
    resources.splice(0).map(async (resource) => {
      if (resource.browser) {
        await resource.browser.close();
      }
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

  it("keeps help controls out of the candidate Tab path without duplicating sequence copy", async () => {
    const page = await openActiveReviewPage();

    const helpButtons = page.locator("button.help");
    await helpButtons.first().waitFor();
    assert.ok((await helpButtons.count()) > 0);
    assert.deepEqual(
      await helpButtons.evaluateAll((buttons) =>
        buttons.map((button) => button.tabIndex),
      ),
      Array(await helpButtons.count()).fill(-1),
    );

    const keyboardStops = await page
      .locator("button, input")
      .evaluateAll((controls) =>
        controls
          .filter((control) => control.tabIndex >= 0 && !control.disabled)
          .map((control) => ({
            className: control.className,
            type: control.getAttribute("type"),
          })),
      );
    assert.equal(
      keyboardStops.every(
        ({ className, type }) =>
          !String(className).split(/\s+/).includes("help") &&
          (type === "radio" || type === "button" || type === "submit"),
      ),
      true,
    );

    await page.locator("[data-home]").focus();
    await page.keyboard.press("Tab");
    assert.equal(
      await page.locator(':focus[name="ukEnglishEligible"][value="true"]').count(),
      1,
    );
    await page.keyboard.press("Space");
    assert.equal(
      await page.locator('[name="ukEnglishEligible"][value="true"]').isChecked(),
      true,
    );
    await page.keyboard.press("Control+Enter");
    await page.getByText("Family-friendly must be explicitly set.").waitFor();
    assert.equal(await page.getByRole("heading", { name: "anchor" }).isVisible(), true);

    assert.equal(await page.getByText(/sequence\s+\d+/i).count(), 0);
    assert.equal(await page.getByText("0% reviewed — 0 of 2").isVisible(), true);
  });

  it("aligns separated help affordances and reveals field help from decision focus", async () => {
    const page = await openActiveReviewPage({
      viewport: { width: 1024, height: 900 },
    });

    await assertHelpRowsAligned(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await assertHelpRowsAligned(page);

    const ukEnglishYes = page.locator(
      '[name="ukEnglishEligible"][value="true"]',
    );
    await ukEnglishYes.focus();
    assert.equal(
      await page.locator("#help-ukenglisheligible").isVisible(),
      true,
    );

    const commonGrade = page.locator('[name="commonnessGrade"][value="common"]');
    await commonGrade.focus();
    assert.equal(await page.locator("#help-grade-common").isVisible(), true);

    const evidenceHelp = page.locator('[aria-controls="help-size-evidence"]');
    await evidenceHelp.click();
    assert.equal(await page.locator("#help-size-evidence").isVisible(), true);
  });

  it("returns a successful Save & Next to the top and the first Tab stop", async () => {
    const page = await openActiveReviewPage({
      viewport: { width: 390, height: 500 },
    });

    await selectRadioByKeyboard(
      page,
      '[name="ukEnglishEligible"][value="true"]',
    );
    await selectRadioByKeyboard(page, '[name="familyFriendly"][value="true"]');
    await selectRadioByKeyboard(
      page,
      '[name="curationDecision"][value="Accept"]',
    );
    await selectRadioByKeyboard(
      page,
      '[name="commonnessGrade"][value="common"]',
    );
    await selectRadioByKeyboard(
      page,
      '[name="nounSemanticBand"][value="Made Objects"]',
    );

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    assert.ok((await page.evaluate(() => window.scrollY)) > 0);
    await page.getByRole("button", { name: "Save & Next" }).click();
    await page.getByRole("heading", { name: "lantern" }).waitFor();

    const saveResult = await page.evaluate(() => ({
      candidate: document.querySelector(".candidate-word")?.textContent?.trim(),
      errors: document.querySelector("[data-errors]")?.textContent?.trim(),
    }));
    assert.deepEqual(saveResult, { candidate: "lantern", errors: "" });

    const reset = await page.evaluate(() => {
      const firstTabStop = document.querySelector(
        'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"])',
      );
      return {
        activeLabel: document.activeElement?.textContent?.trim(),
        firstTabStopIsActive: firstTabStop === document.activeElement,
        scrollY: window.scrollY,
      };
    });
    assert.deepEqual(reset, {
      activeLabel: "Back to Register",
      firstTabStopIsActive: true,
      scrollY: 0,
    });
  });

  it("prepares the next tranche before rendering an all-complete Register", async () => {
    const fixture = await createCompletedSemanticGapFixture();
    const server = await createReviewWorkbenchServer({
      projectRoot: fixture.projectRoot,
      reviewDataRoot: fixture.reviewDataRoot,
      staticRoot: path.resolve("tools", "word-bank", "workbench"),
      port: 0,
      isGitCheckpointed: async () => true,
      createGitCheckpoint: async () => ({ created: true }),
      loadNounCatalogue: async () => ({
        schemaVersion: 1,
        entryKind: "noun",
        candidates: [
          catalogueCandidate("anchor", "common", "Made Objects"),
          catalogueCandidate("lantern", "common", "Made Objects"),
          catalogueCandidate("drum", "lessCommon", "Made Objects"),
        ],
      }),
      nounPlanningOptions: { limit: 1 },
    });
    resources.push({ server, root: fixture.projectRoot });
    const address = await server.listen();
    const browser = await chromium.launch();
    resources.push({ browser });
    const page = await browser.newPage();
    await page.goto(address.origin);

    await page.getByRole("heading", { name: "noun-semantic-gap-002" }).waitFor();
    assert.equal(
      await page.getByText("noun · planned", { exact: true }).isVisible(),
      true,
    );
    assert.equal(
      await page.getByRole("button", { name: "Start next tranche" }).isEnabled(),
      true,
    );
    assert.equal(
      await page
        .getByText(/Starting another tranche requires the latest completed tranche/i)
        .count(),
      0,
    );
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

  it("silently plans only the first semantic gap after baseline completion", async () => {
    const fixture = await createFixture();
    let checkpointPaths = [];
    const server = await createReviewWorkbenchServer({
      projectRoot: fixture.projectRoot,
      reviewDataRoot: fixture.reviewDataRoot,
      port: 0,
      isGitCheckpointed: async ({ paths }) => {
        checkpointPaths = paths;
        return true;
      },
      loadNounCatalogue: async () => ({
        schemaVersion: 1,
        entryKind: "noun",
        candidates: [
          catalogueCandidate("anchor", "common", "Made Objects"),
          catalogueCandidate("lantern", "common", "Made Objects"),
          catalogueCandidate("drum", "lessCommon", "Made Objects"),
          catalogueCandidate("eel", "rare", "Animals and Plants"),
        ],
      }),
      nounPlanningOptions: { limit: 1 },
    });
    resources.push({ server, root: fixture.projectRoot });
    const address = await server.listen();
    let state = await getJson(`${address.origin}/api/state`);
    state = await postJson(`${address.origin}/api/start-next`, {
      expectedIndexHash: state.hashes["register.json"],
    });

    for (const sequence of [1, 2]) {
      state = await postJson(`${address.origin}/api/save-next`, {
        trancheId: "noun-baseline",
        sequence,
        decision: acceptedNounDecision("Made Objects"),
        expectedTrancheHash: state.hashes["tranches/noun-baseline.json"],
      });
    }

    state = await postJson(`${address.origin}/api/complete`, {
      trancheId: "noun-baseline",
      confirmed: true,
      expectedIndexHash: state.hashes["register.json"],
      expectedTrancheHash: state.hashes["tranches/noun-baseline.json"],
    });

    assert.deepEqual(
      state.tranches.map(({ id, lifecycle }) => [id, lifecycle]),
      [
        ["noun-baseline", "complete"],
        ["noun-semantic-gap-001", "planned"],
      ],
    );

    state = await postJson(`${address.origin}/api/start-next`, {
      expectedIndexHash: state.hashes["register.json"],
    });
    assert.equal(state.tranches[1].lifecycle, "active");
    assert.deepEqual(
      checkpointPaths.map((candidate) => path.basename(candidate)).sort(),
      ["noun-baseline.json", "noun-semantic-gap-001.json", "register.json"],
    );
  });

  it("silently checkpoints an all-complete Register and prepares the next tranche", async () => {
    const fixture = await createCompletedSemanticGapFixture();
    const checkpoints = [];
    const server = await createReviewWorkbenchServer({
      projectRoot: fixture.projectRoot,
      reviewDataRoot: fixture.reviewDataRoot,
      port: 0,
      isGitCheckpointed: async () => true,
      createGitCheckpoint: async (checkpoint) => {
        checkpoints.push(checkpoint);
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { created: true };
      },
      loadNounCatalogue: async () => ({
        schemaVersion: 1,
        entryKind: "noun",
        candidates: [
          catalogueCandidate("anchor", "common", "Made Objects"),
          catalogueCandidate("lantern", "common", "Made Objects"),
          catalogueCandidate("drum", "lessCommon", "Made Objects"),
        ],
      }),
      nounPlanningOptions: { limit: 1 },
    });
    resources.push({ server, root: fixture.projectRoot });
    const address = await server.listen();
    let state = await getJson(`${address.origin}/api/state`);

    const preparationBody = {
      expectedIndexHash: state.hashes["register.json"],
      expectedTrancheHash:
        state.hashes["tranches/noun-semantic-gap-001.json"],
    };
    const [preparedState, duplicateState] = await Promise.all([
      postJson(`${address.origin}/api/prepare-next`, preparationBody),
      postJson(`${address.origin}/api/prepare-next`, preparationBody),
    ]);
    state = preparedState;

    assert.deepEqual(
      state.tranches.map(({ id, lifecycle }) => [id, lifecycle]),
      [
        ["noun-baseline", "complete"],
        ["noun-semantic-gap-001", "complete"],
        ["noun-semantic-gap-002", "planned"],
      ],
    );
    assert.equal(state.startNextReady, true);
    assert.deepEqual(duplicateState.tranches, state.tranches);
    assert.deepEqual(
      checkpoints.map(({ message, paths }) => ({
        message,
        paths: paths.map((candidate) => path.basename(candidate)).sort(),
      })),
      [
        {
          message: "Checkpoint completed noun semantic gap 001 review",
          paths: ["noun-semantic-gap-001.json", "register.json"],
        },
        {
          message: "Plan noun semantic gap 002 review tranche",
          paths: ["noun-semantic-gap-002.json", "register.json"],
        },
      ],
    );

    state = await postJson(`${address.origin}/api/start-next`, {
      expectedIndexHash: state.hashes["register.json"],
    });
    assert.equal(state.tranches.at(-1).lifecycle, "active");
  });

  it("creates an exact-path Git checkpoint without consuming unrelated staged work", async () => {
    const projectRoot = await mkdtemp(
      path.join(os.tmpdir(), "crazyphrases-exact-checkpoint-"),
    );
    resources.push({ root: projectRoot });
    const reviewRoot = path.join(projectRoot, "tools", "word-bank", "review-data");
    const trancheRoot = path.join(reviewRoot, "tranches");
    await mkdir(trancheRoot, { recursive: true });
    await writeFile(path.join(reviewRoot, "register.json"), "initial register\n");
    await writeFile(path.join(trancheRoot, "completed.json"), "initial tranche\n");
    await writeFile(path.join(projectRoot, "unrelated.txt"), "initial unrelated\n");
    await git(projectRoot, "init");
    await git(projectRoot, "config", "user.name", "Crazy Phrases Test");
    await git(projectRoot, "config", "user.email", "test@crazyphrases.invalid");
    await git(projectRoot, "add", ".");
    await git(projectRoot, "commit", "-m", "Initial fixture");

    const registerPath = path.join("tools", "word-bank", "review-data", "register.json");
    const completedPath = path.join(
      "tools",
      "word-bank",
      "review-data",
      "tranches",
      "completed.json",
    );
    const plannedPath = path.join(
      "tools",
      "word-bank",
      "review-data",
      "tranches",
      "planned.json",
    );
    await writeFile(path.join(projectRoot, registerPath), "completed register\n");
    await writeFile(path.join(projectRoot, completedPath), "completed tranche\n");
    await writeFile(path.join(projectRoot, plannedPath), "planned tranche\n");
    await writeFile(path.join(projectRoot, "unrelated.txt"), "staged unrelated\n");
    await git(projectRoot, "add", "unrelated.txt");

    const checkpoint = await createExactGitCheckpoint({
      projectRoot,
      paths: [registerPath, completedPath, plannedPath],
      message: "Checkpoint exact review paths",
    });

    assert.equal(checkpoint.created, true);
    assert.deepEqual(
      (await git(projectRoot, "show", "--pretty=format:", "--name-only", "HEAD"))
        .trim()
        .split(/\r?\n/)
        .sort(),
      [
        "tools/word-bank/review-data/register.json",
        "tools/word-bank/review-data/tranches/completed.json",
        "tools/word-bank/review-data/tranches/planned.json",
      ],
    );
    assert.equal(
      (await git(projectRoot, "diff", "--cached", "--name-only")).trim(),
      "unrelated.txt",
    );
    assert.equal(
      (
        await git(
          projectRoot,
          "status",
          "--porcelain",
          "--",
          registerPath,
          completedPath,
          plannedPath,
        )
      ).trim(),
      "",
    );
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

async function createCompletedSemanticGapFixture() {
  const fixture = await createFixture();
  const register = fixtureRegister();
  register.catalogue.candidateCount = 3;
  register.tranches[0].lifecycle = "complete";
  register.tranches.push({
    id: "noun-semantic-gap-001",
    entryKind: "noun",
    path: "tranches/noun-semantic-gap-001.json",
    purpose: "semanticGap",
    lifecycle: "complete",
  });
  const baselinePath = path.join(
    fixture.reviewDataRoot,
    "tranches",
    "noun-baseline.json",
  );
  const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  baseline.candidates = baseline.candidates.slice(0, 1);
  baseline.candidates[0].decision = acceptedNounDecision("Made Objects");
  await writeJson(baselinePath, baseline);
  await writeJson(path.join(fixture.reviewDataRoot, "register.json"), register);
  await writeJson(
    path.join(
      fixture.reviewDataRoot,
      "tranches",
      "noun-semantic-gap-001.json",
    ),
    {
      schemaVersion: 1,
      id: "noun-semantic-gap-001",
      entryKind: "noun",
      purpose: "semanticGap",
      candidates: [
        {
          sequence: 1,
          canonicalText: "lantern",
          evidence: { resolvedSize: 40 },
          suggestions: {
            commonnessGrade: "common",
            nounSemanticBand: "Made Objects",
          },
          decision: acceptedNounDecision("Made Objects"),
        },
      ],
    },
  );
  return fixture;
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

function catalogueCandidate(canonicalText, commonnessGrade, nounSemanticBand) {
  return {
    canonicalText,
    entryKind: "noun",
    baseline: false,
    sourceEvidence: null,
    suggestions: { commonnessGrade, nounSemanticBand },
  };
}

async function openActiveReviewPage({ viewport } = {}) {
  const fixture = await createFixture();
  const server = await createReviewWorkbenchServer({
    projectRoot: fixture.projectRoot,
    reviewDataRoot: fixture.reviewDataRoot,
    staticRoot: path.resolve("tools", "word-bank", "workbench"),
    port: 0,
    isGitCheckpointed: async () => true,
  });
  resources.push({ server, root: fixture.projectRoot });
  const address = await server.listen();
  const state = await getJson(`${address.origin}/api/state`);
  await postJson(`${address.origin}/api/start-next`, {
    expectedIndexHash: state.hashes["register.json"],
  });

  const browser = await chromium.launch();
  resources.push({ browser });
  const page = await browser.newPage(viewport ? { viewport } : undefined);
  await page.goto(address.origin);
  await page.getByRole("button", { name: "First pending" }).click();
  return page;
}

async function assertHelpRowsAligned(page) {
  const metrics = await page.locator(".help-row").evaluateAll((rows) =>
    rows.map((row) => {
      const label = row.firstElementChild.getBoundingClientRect();
      const help = row.querySelector("button.help").getBoundingClientRect();
      const container = row.getBoundingClientRect();
      return {
        rightInset: container.right - help.right,
        separation: help.left - label.right,
      };
    }),
  );

  assert.ok(metrics.length >= 10);
  for (const metric of metrics) {
    assert.ok(Math.abs(metric.rightInset) < 1);
    assert.ok(metric.separation >= 8);
  }
}

async function selectRadioByKeyboard(page, selector) {
  const radio = page.locator(selector);
  await radio.focus();
  await page.keyboard.press("Space");
  assert.equal(await radio.isChecked(), true);
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

async function git(projectRoot, ...args) {
  const { stdout } = await execFileAsync("git", args, {
    cwd: projectRoot,
    windowsHide: true,
  });
  return stdout;
}
