import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const workspaceRoot = fileURLToPath(new URL("../", import.meta.url));
const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
]);

describe("anonymous solo browser smoke", () => {
  let staticServer;
  let browser;

  after(async () => {
    await browser?.close();
    await staticServer?.close();
  });

  it("completes the full flow in a mobile-constrained viewport", async () => {
    staticServer = await startStaticServer();
    browser = await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: staticServer.origin,
    });

    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await assertNoHorizontalOverflow(page);
    await assertTextVisible(page, "Crazy Phrases");
    await assertTextVisible(page, "Anonymous solo");
    await assertTextVisible(page, "Local play in this browser");

    await page.getByRole("button", { name: "Test sign in" }).click();
    await assertTextVisible(page, "Account-backed mode");
    await assertTextVisible(page, "@player-test-account");

    await page.getByRole("button", { name: "Sign out" }).click();
    await assertTextVisible(page, "Anonymous solo");
    await assertTextVisible(page, "Local play in this browser");

    await page.getByRole("button", { name: "How to play" }).click();
    assert.equal(await page.locator("#help-panel").isVisible(), true);
    await page.getByRole("button", { name: "How to play" }).click();
    assert.equal(await page.locator("#help-panel").isHidden(), true);

    await page.getByRole("button", { name: "10" }).click();
    await assertTextVisible(page, "10 phrases selected");
    assert.equal(await page.locator("[data-entry-form]").isHidden(), true);

    await page.getByRole("button", { name: "Start batch" }).click();
    await waitForDice(page);
    assert.equal(await page.getByRole("button", { name: "15" }).isDisabled(), true);
    await assertNoHorizontalOverflow(page);

    const fillState = createFillState(10);
    await fillActiveSection(page, fillState);
    await fillActiveSection(page, fillState, { verifyRefreshRecovery: true });
    await fillActiveSection(page, fillState);

    await assertTextVisible(page, "Your crazy phrases");
    assert.equal(await page.locator("[data-phrase-list] li").count(), 10);
    await assertNoHorizontalOverflow(page);

    const copiedPhraseItem = page.locator("[data-phrase-list] li").nth(1);
    const copiedPhrase = await copiedPhraseItem.locator("span").innerText();
    assertDefaultTemplatePhrase(copiedPhrase);
    assert.doesNotMatch(copiedPhrase, /^\d+[\s.)-]/);

    await page.getByRole("button", { name: "Copy phrase 2" }).click();
    assert.equal(await readClipboard(page), copiedPhrase);

    await page.getByRole("button", { name: "Copy all" }).click();
    const batchCopy = normalizeLineEndings(await readClipboard(page));
    const batchLines = batchCopy.split("\n");
    assert.equal(batchLines[0], "Crazy Phrases");
    assert.equal(batchLines.length, 11);
    assert.equal(batchLines.slice(1).every((line) => !/^\d+[\s.)-]/.test(line)), true);

    await page.getByText("Show entries").click();
    await assertTextVisible(page, "Section 1:");

    await page.getByRole("button", { name: "Start again" }).click();
    await assertTextVisible(
      page,
      "Start a new batch? Your revealed phrases will be cleared from this browser.",
    );
    await page.getByRole("button", { name: "Start new batch" }).click();
    await assertTextVisible(page, "10 phrases selected");
    assert.equal(await page.getByRole("button", { name: "Start batch" }).isVisible(), true);

    assertNoConsoleErrors();
  });

  it("keeps desktop controls within the viewport and follows standard tab order", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 1024, height: 768 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await assertNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Start batch" }).click();
    await waitForDice(page);
    await assertNoHorizontalOverflow(page);

    await page.locator("[data-row-index='0']").focus();
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement?.dataset?.diceRowIndex),
      "0",
    );

    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement?.dataset?.rowIndex),
      "0",
    );

    assertNoConsoleErrors();
  });
});

async function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, "http://127.0.0.1");
      const relativePath =
        requestUrl.pathname === "/"
          ? "index.html"
          : decodeURIComponent(requestUrl.pathname).replace(/^\//, "");
      const filePath = resolve(workspaceRoot, relativePath);

      if (!filePath.startsWith(resolve(workspaceRoot))) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }

      const bytes = await readFile(filePath);
      response.writeHead(200, {
        "Content-Type":
          mimeTypes.get(extname(filePath)) ?? "application/octet-stream",
      });
      response.end(bytes);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });

  const { port } = server.address();

  return {
    origin: `http://127.0.0.1:${port}`,
    close() {
      return new Promise((resolveClose, rejectClose) => {
        server.close((error) => (error ? rejectClose(error) : resolveClose()));
      });
    },
  };
}

function createFillState(rowCount) {
  return {
    rowCount,
    adjectiveEntries: [
      "dice",
      "brisk",
      "curious",
      "dapper",
      "eager",
      "fizzy",
      "gentle",
      "jaunty",
      "merry",
      "zippy",
    ],
    nounEntrySets: [
      [
        "dice",
        "teapot",
        "biscuit",
        "cabinet",
        "drum",
        "engine",
        "feather",
        "garden",
        "helmet",
        "island",
      ],
      [
        "dice",
        "ladder",
        "moon",
        "notebook",
        "ocean",
        "pancake",
        "quilt",
        "rocket",
        "saddle",
        "tunnel",
      ],
    ],
    nextNounSetIndex: 0,
  };
}

async function fillActiveSection(
  page,
  fillState,
  { verifyRefreshRecovery = false } = {},
) {
  await waitForDice(page);

  const title = await page.locator("[data-section-title]").innerText();
  const entries = /adjectives/i.test(title)
    ? fillState.adjectiveEntries
    : fillState.nounEntrySets[fillState.nextNounSetIndex++];

  await page.locator("[data-dice-row-index='0']").click();

  for (let rowIndex = 1; rowIndex < fillState.rowCount; rowIndex += 1) {
    await page.locator(`[data-row-index='${rowIndex}']`).fill(entries[rowIndex]);

    if (verifyRefreshRecovery && rowIndex === 1) {
      await page.reload();
      await waitForDice(page);
      assert.equal(await page.locator("[data-section-title]").innerText(), title);
      assert.equal(
        await page.locator("[data-row-index='1']").inputValue(),
        entries[1],
      );
    }
  }

  await page.getByRole("button", { name: /Next section|Reveal phrases/ }).click();
}

async function waitForDice(page) {
  await page.locator("[data-dice-row-index='0']").waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.querySelector("[data-dice-row-index='0']")?.disabled === false,
  );
}

function trackConsoleErrors(page) {
  const messages = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      messages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    messages.push(`pageerror: ${error.message}`);
  });

  return () => assert.deepEqual(messages, []);
}

async function assertNoHorizontalOverflow(page) {
  const widths = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  assert.ok(
    widths.scrollWidth <= widths.clientWidth + 1,
    `Expected no horizontal overflow, got ${JSON.stringify(widths)}`,
  );
}

async function assertTextVisible(page, text) {
  assert.equal(await page.getByText(text).first().isVisible(), true);
}

function assertDefaultTemplatePhrase(phrase) {
  const parts = phrase.split(" ");

  assert.equal(parts[0], "Brisk");
  assert.deepEqual(new Set(parts.slice(1)), new Set(["teapot", "ladder"]));
}

async function readClipboard(page) {
  return page.evaluate(() => navigator.clipboard.readText());
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n/g, "\n");
}
