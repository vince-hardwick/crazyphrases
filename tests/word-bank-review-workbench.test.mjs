import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { chromium } from "playwright";

import { createReviewWorkbenchServer } from "../tools/word-bank/review-workbench-server.js";

const resources = [];

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
