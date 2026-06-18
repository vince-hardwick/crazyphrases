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

describe("solo browser smoke", () => {
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
    assert.equal(await page.locator(".site-domain").count(), 0);
    await assertNoFavouriteDom(page);

    await page.getByRole("button", { name: "Test sign in" }).click();
    await assertTextVisible(page, "Account-backed mode");
    await assertTextVisible(page, "@player-test-account");
    await assertFavouriteSurfaceMounted(page);
    assert.equal(await page.locator("[data-save-batch-button]").count(), 0);
    assert.equal(await page.locator("[data-save-phrase-index]").count(), 0);

    await page.getByRole("button", { name: "Sign out" }).click();
    await assertTextVisible(page, "Anonymous solo");
    await assertTextVisible(page, "Local play in this browser");
    await assertNoFavouriteDom(page);

    await page.getByRole("button", { name: "How to play" }).click();
    assert.equal(await page.locator("#help-panel").isVisible(), true);
    await page.getByRole("button", { name: "How to play" }).click();
    assert.equal(await page.locator("#help-panel").isHidden(), true);

    await page.getByRole("button", { name: "10" }).click();
    await assertRowCountSelected(page, "10");
    await assertTextHidden(page, "10 phrases selected");
    assert.equal(await page.locator("[data-entry-form]").isHidden(), true);

    await page.getByRole("button", { name: "Start batch" }).click();
    await waitForDice(page);
    await assertProgressEmpty(page);
    assert.equal(await page.getByRole("button", { name: "15" }).isDisabled(), true);
    await assertNoHorizontalOverflow(page);

    const fillState = createFillState(10);
    await fillActiveSection(page, fillState);
    await fillActiveSection(page, fillState, { verifyRefreshRecovery: true });
    await fillActiveSection(page, fillState);

    await assertTextVisible(page, "Your crazy phrases");
    assert.equal(await page.locator("[data-phrase-list] li").count(), 10);
    await assertNoFavouriteDom(page);
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
    await assertRowCountSelected(page, "10");
    await assertTextHidden(page, "10 phrases selected");
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

  it("resumes local test signed-in setup without importing anonymous local play", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await page.getByRole("button", { name: "15" }).click();
    await page.getByRole("button", { name: "Start batch" }).click();
    await waitForDice(page);
    await assertRowCountSelected(page, "15");

    await page.getByRole("button", { name: "Test sign in" }).click();
    await assertTextVisible(page, "Account-backed mode");
    await assertRowCountSelected(page, "20");
    await assertTextHidden(page, "20 phrases selected");
    assert.equal(await page.locator("[data-entry-form]").isHidden(), true);

    await page.getByRole("button", { name: "10" }).click();
    await page.getByRole("button", { name: "Start batch" }).click();
    await waitForDice(page);
    const signedInSectionTitle = await page.locator("[data-section-title]").innerText();
    assert.equal(await page.locator("[data-row-index]").count(), 10);

    await page.reload();
    await assertTextVisible(page, "Anonymous solo");
    await assertRowCountSelected(page, "15");

    await page.getByRole("button", { name: "Test sign in" }).click();
    await waitForDice(page);
    await assertTextVisible(page, "Account-backed mode");
    assert.equal(await page.locator("[data-section-title]").innerText(), signedInSectionTitle);
    assert.equal(await page.locator("[data-row-index]").count(), 10);
    await assertNoHorizontalOverflow(page);

    assertNoConsoleErrors();
  });

  it("creates a signed-in Pending Game invite by Handle in local test mode", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await assertNoPendingGameDom(page);

    await page.getByRole("button", { name: "Test sign in" }).click();
    await assertTextVisible(page, "Account-backed mode");
    await assertPendingGameSurfaceMounted(page);
    await assertNoHorizontalOverflow(page);

    await page.locator("[data-pending-game-handle-input]").fill("INVITEE TWO");
    await page.locator("[data-pending-game-row-count]").selectOption("15");
    await page.getByRole("button", { name: "Create invite" }).click();

    await assertTextVisible(
      page,
      "Game invite created. Waiting for @invitee-two to accept.",
    );
    await assertTextVisible(page, "@player-test-account");
    await assertTextVisible(page, "Accepted");
    await assertTextVisible(page, "@invitee-two");
    await assertTextVisible(page, "Invited");
    await assertTextVisible(page, "15 phrases");
    await assertNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Sign out" }).click();
    await assertTextVisible(page, "Anonymous solo");
    await assertNoPendingGameDom(page);

    assertNoConsoleErrors();
  });

  it("lets an invitee accept a Pending Game invite and shows the response to the creator", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await page.getByRole("button", { name: "Test sign in" }).click();
    await assertTextVisible(page, "Account-backed mode");
    await page.locator("[data-pending-game-handle-input]").fill("INVITEE TWO");
    await page.locator("[data-pending-game-row-count]").selectOption("15");
    await page.getByRole("button", { name: "Create invite" }).click();
    await assertTextVisible(
      page,
      "Game invite created. Waiting for @invitee-two to accept.",
    );

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Test invitee sign in" }).click();
    await assertTextVisible(page, "@invitee-two");
    await assertTextVisible(page, "Incoming invites");
    await assertTextVisible(page, "@player-test-account");
    await assertTextVisible(page, "15 phrases");
    await page
      .getByRole("button", { name: "Accept invite from @player-test-account" })
      .click();
    await assertTextVisible(page, "Game invite accepted.");
    await assertTextVisible(page, "Accepted");

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Test sign in" }).click();
    await assertTextVisible(page, "@player-test-account");
    await assertTextVisible(page, "@invitee-two");
    await assertTextVisible(page, "Accepted");
    await assertNoHorizontalOverflow(page);

    assertNoConsoleErrors();
  });

  it("shows a cancelled Pending Game when an invitee declines", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await page.getByRole("button", { name: "Test sign in" }).click();
    await page.locator("[data-pending-game-handle-input]").fill("INVITEE TWO");
    await page.locator("[data-pending-game-row-count]").selectOption("15");
    await page.getByRole("button", { name: "Create invite" }).click();
    await assertTextVisible(
      page,
      "Game invite created. Waiting for @invitee-two to accept.",
    );

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Test invitee sign in" }).click();
    await page
      .getByRole("button", { name: "Decline invite from @player-test-account" })
      .click();
    await assertTextVisible(page, "Game invite declined.");

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Test sign in" }).click();
    await assertTextVisible(page, "Cancelled");
    await assertTextVisible(page, "Declined");
    assert.equal(
      await page.getByRole("button", { name: "Start game with @invitee-two" }).count(),
      0,
    );
    await assertNoHorizontalOverflow(page);
    assertNoConsoleErrors();
  });

  it("lets multiplayer participants submit sections and reveal independently", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await page.getByRole("button", { name: "Test sign in" }).click();
    await assertTextVisible(page, "Account-backed mode");
    await page.locator("[data-pending-game-handle-input]").fill("INVITEE TWO");
    await page.locator("[data-pending-game-row-count]").selectOption("15");
    await page.getByRole("button", { name: "Create invite" }).click();
    await assertTextVisible(
      page,
      "Game invite created. Waiting for @invitee-two to accept.",
    );

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Test invitee sign in" }).click();
    await page
      .getByRole("button", { name: "Accept invite from @player-test-account" })
      .click();
    await assertTextVisible(page, "Game invite accepted.");

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Test sign in" }).click();
    await page.getByRole("button", { name: "Start game with @invitee-two" }).click();

    await assertTextVisible(page, "Game started. Your turn is ready.");
    await assertTextVisible(page, "Started");
    await assertTextVisible(page, "Awaiting your entries");
    assert.equal(await page.locator("[data-reveal-panel]").isHidden(), true);

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Test invitee sign in" }).click();
    await assertTextVisible(page, "Awaiting your entries");
    await submitMultiplayerSection(page, "teapot");
    await assertTextVisible(page, "Awaiting your entries");
    assert.equal(
      await page
        .getByText(
          "Batch with @player-test-account and @invitee-two is now complete and available to reveal.",
        )
        .count(),
      0,
    );
    await submitMultiplayerSection(page, "ladder");
    await assertTextVisible(page, "Awaiting other player entries");
    await assertNoHorizontalOverflow(page);
    assert.equal(
      await page.getByRole("button", { name: "Start game with @invitee-two" }).count(),
      0,
    );

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Test sign in" }).click();
    await submitMultiplayerSection(page, "brisk");
    await assertTextVisible(page, "Batches completed");
    await page.getByRole("button", { name: "Reveal phrases" }).click();
    await assertTextVisible(page, "Your crazy phrases");

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Test invitee sign in" }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "Notifications, 2 unread" })
        .isVisible(),
      true,
    );
    await page.getByRole("button", { name: "Notifications" }).click();
    await assertTextVisible(
      page,
      "Batch with @player-test-account and @invitee-two is now complete and available to reveal.",
    );
    await assertTextVisible(page, "Read");
    await page.getByRole("button", { name: "Reveal phrases" }).click();
    await assertTextVisible(page, "Your crazy phrases");

    assertNoConsoleErrors();
  });

  it("shows a recoverable error when multiplayer reveal fails", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(`${staticServer.origin}/?testPendingGame=reveal-fails`);
    await page.getByRole("button", { name: "Test sign in" }).click();
    await page.locator("[data-pending-game-handle-input]").fill("INVITEE TWO");
    await page.locator("[data-pending-game-row-count]").selectOption("10");
    await page.getByRole("button", { name: "Create invite" }).click();

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Test invitee sign in" }).click();
    await page
      .getByRole("button", { name: "Accept invite from @player-test-account" })
      .click();

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Test sign in" }).click();
    await page.getByRole("button", { name: "Start game with @invitee-two" }).click();

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Test invitee sign in" }).click();
    await submitMultiplayerSection(page, "teapot");
    await submitMultiplayerSection(page, "ladder");

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Test sign in" }).click();
    await submitMultiplayerSection(page, "brisk");
    await page.getByRole("button", { name: "Reveal phrases" }).click();

    await assertTextVisible(page, "Phrases could not be revealed. Try again.");
    assert.equal(
      await page.getByRole("button", { name: "Reveal phrases" }).isVisible(),
      true,
    );
    assertNoConsoleErrors();
  });

  it("restores signed-in reveal after sign out and sign back in until Start again replaces it", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

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
    await page.getByRole("button", { name: "15" }).click();
    await page.getByRole("button", { name: "Start batch" }).click();
    await waitForDice(page);
    await assertRowCountSelected(page, "15");

    await page.getByRole("button", { name: "Test sign in" }).click();
    await assertTextVisible(page, "Account-backed mode");
    await assertNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "10" }).click();
    await page.getByRole("button", { name: "Start batch" }).click();
    await assertNoHorizontalOverflow(page);
    assert.equal(await page.getByRole("button", { name: "Save batch" }).isVisible(), false);

    const fillState = createFillState(10);
    await fillActiveSection(page, fillState);
    await fillActiveSection(page, fillState);
    await fillActiveSection(page, fillState);

    await assertTextVisible(page, "Your crazy phrases");
    assert.equal(await page.locator("[data-phrase-list] li").count(), 10);
    await assertNoHorizontalOverflow(page);

    const copiedPhraseItem = page.locator("[data-phrase-list] li").nth(1);
    const copiedPhrase = await copiedPhraseItem.locator("span").innerText();
    assertDefaultTemplatePhrase(copiedPhrase);

    await page.getByRole("button", { name: "Copy phrase 2" }).click();
    assert.equal(await readClipboard(page), copiedPhrase);

    await page.getByRole("button", { name: "Copy all" }).click();
    const batchCopy = normalizeLineEndings(await readClipboard(page));
    assert.equal(batchCopy.split("\n")[0], "Crazy Phrases");
    assert.equal(batchCopy.split("\n").length, 11);

    await page.getByRole("button", { name: "Save phrase 2" }).click();
    await assertTextVisible(page, "Phrase favourite saved.");
    await assertTextVisible(page, "Saved favourites");
    await assertFavouriteVisible(page, copiedPhrase);
    assert.equal(await page.getByRole("button", { name: "Phrase 2 saved" }).isDisabled(), true);

    await page.getByRole("button", { name: /Remove phrase favourite/ }).click();
    await assertTextVisible(page, "No favourites yet.");
    await assertTextHidden(page, "Phrase favourite removed.");
    assert.equal(await page.getByRole("button", { name: "Save phrase 2" }).isEnabled(), true);

    await page.getByRole("button", { name: "Save phrase 2" }).click();
    await assertTextVisible(page, "Phrase favourite saved.");
    await assertFavouriteVisible(page, copiedPhrase);

    await page.getByRole("button", { name: "Save batch" }).click();
    await assertTextVisible(page, "Batch favourite saved.");
    await assertBatchFavouriteVisible(page, batchCopy);
    assert.equal(await page.locator("[data-save-batch-button]").isDisabled(), true);

    await page.getByRole("button", { name: /Remove batch favourite/ }).click();
    await assertTextVisible(page, "Batch favourite removed.");
    assert.equal(await page.getByRole("button", { name: "Save batch" }).isEnabled(), true);

    await page.getByRole("button", { name: "Save batch" }).click();
    await assertTextVisible(page, "Batch favourite saved.");
    await assertBatchFavouriteVisible(page, batchCopy);

    await page.getByRole("button", { name: "Sign out" }).click();
    await assertTextVisible(page, "Anonymous solo");
    await assertRowCountSelected(page, "15");
    await assertNoFavouriteDom(page);
    await assertNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Test sign in" }).click();
    await assertTextVisible(page, "Account-backed mode");
    await assertTextVisible(page, "Your crazy phrases");
    assert.equal(await page.locator("[data-phrase-list] li").count(), 10);
    await assertNoHorizontalOverflow(page);

    await page.reload();
    await assertTextVisible(page, "Anonymous solo");
    await assertRowCountSelected(page, "15");
    await page.getByRole("button", { name: "Test sign in" }).click();
    await assertTextVisible(page, "Account-backed mode");
    await assertTextVisible(page, "Your crazy phrases");
    assert.equal(await page.locator("[data-phrase-list] li").count(), 10);
    await assertNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Start again" }).click();
    await assertTextVisible(
      page,
      "Start a new batch? Your revealed phrases will be cleared from this browser.",
    );
    await page.getByRole("button", { name: "Start new batch" }).click();
    await assertRowCountSelected(page, "10");
    await assertTextHidden(page, "10 phrases selected");
    await assertTextVisible(page, "Saved favourites");
    await assertFavouriteVisible(page, copiedPhrase);
    await assertBatchFavouriteVisible(page, batchCopy);
    await assertNoHorizontalOverflow(page);

    await page.getByRole("button", { name: /Remove phrase favourite/ }).click();
    await assertTextVisible(page, "Phrase favourite removed.");
    await assertBatchFavouriteVisible(page, batchCopy);

    await page.getByRole("button", { name: /Remove batch favourite/ }).click();
    await assertTextVisible(page, "No favourites yet.");
    await assertTextHidden(page, "Batch favourite removed.");

    await page.reload();
    await assertTextVisible(page, "Anonymous solo");
    await assertRowCountSelected(page, "15");
    await page.getByRole("button", { name: "Test sign in" }).click();
    await assertTextVisible(page, "Account-backed mode");
    assert.equal(await page.getByText("Your crazy phrases").isVisible(), false);
    assert.equal(await page.getByRole("button", { name: "Start batch" }).isVisible(), true);

    await page.getByRole("button", { name: "Sign out" }).click();
    await assertTextVisible(page, "Anonymous solo");
    await assertRowCountSelected(page, "15");

    assertNoConsoleErrors();
  });

  it("warns signed-in players when account-backed saves fail", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(`${staticServer.origin}/?testSignedInPersistence=save-fails`);
    await page.getByRole("button", { name: "Test sign in" }).click();
    await assertTextVisible(page, "Account-backed mode");

    await page.getByRole("button", { name: "10" }).click();
    await page.getByRole("button", { name: "Start batch" }).click();

    await assertTextVisible(
      page,
      "Account-backed progress could not be saved. Keep this tab open and try again.",
    );

    assertNoConsoleErrors();
  });

  it("offers safe recovery when account-backed progress cannot be loaded", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(`${staticServer.origin}/?testSignedInPersistence=load-fails`);
    await page.getByRole("button", { name: "Test sign in" }).click();

    await assertTextVisible(page, "Account-backed mode");
    await assertTextVisible(
      page,
      "Account-backed progress could not be loaded. Retry, or start a new batch without deleting saved progress.",
    );
    assert.equal(await page.getByRole("button", { name: "Retry" }).isVisible(), true);

    await page.getByRole("button", { name: "Retry" }).click();
    await assertTextVisible(
      page,
      "Account-backed progress could not be loaded. Retry, or start a new batch without deleting saved progress.",
    );

    await page.getByRole("button", { name: "Start new batch" }).click();
    await assertRowCountSelected(page, "20");
    await assertTextHidden(page, "20 phrases selected");
    assert.equal(await page.getByRole("button", { name: "Start batch" }).isVisible(), true);
    assert.equal(await page.getByText("could not be loaded").isVisible(), false);

    assertNoConsoleErrors();
  });

  it("warns signed-in players when account-backed progress changed elsewhere", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(`${staticServer.origin}/?testSignedInPersistence=conflict-save`);
    await page.getByRole("button", { name: "Test sign in" }).click();
    await assertTextVisible(page, "Account-backed mode");

    await page.getByRole("button", { name: "10" }).click();
    await page.getByRole("button", { name: "Start batch" }).click();

    await assertTextVisible(
      page,
      "Account-backed progress changed in another tab. Reload to see the latest saved game before continuing.",
    );

    assertNoConsoleErrors();
  });

  it("warns signed-in players when private favourite removal fails", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(`${staticServer.origin}/?testPrivateFavourites=remove-fails`);
    await page.getByRole("button", { name: "Test sign in" }).click();
    await assertTextVisible(page, "Account-backed mode");

    await page.getByRole("button", { name: "10" }).click();
    await page.getByRole("button", { name: "Start batch" }).click();

    const fillState = createFillState(10);
    await fillActiveSection(page, fillState);
    await fillActiveSection(page, fillState);
    await fillActiveSection(page, fillState);

    const copiedPhraseItem = page.locator("[data-phrase-list] li").nth(1);
    const copiedPhrase = await copiedPhraseItem.locator("span").innerText();
    await page.getByRole("button", { name: "Save phrase 2" }).click();
    await assertTextVisible(page, "Phrase favourite saved.");
    await assertFavouriteVisible(page, copiedPhrase);

    await page.getByRole("button", { name: /Remove phrase favourite/ }).click();
    await assertTextVisible(
      page,
      "Phrase favourite could not be removed. Try again.",
    );
    await assertFavouriteVisible(page, copiedPhrase);
    assert.equal(await page.getByRole("button", { name: "Phrase 2 saved" }).isDisabled(), true);

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

async function submitMultiplayerSection(page, word) {
  await page.locator("[data-multiplayer-section-input='0']").waitFor({
    state: "visible",
  });

  const inputCount = await page.locator("[data-multiplayer-section-input]").count();
  for (let rowIndex = 0; rowIndex < inputCount; rowIndex += 1) {
    await page
      .locator(`[data-multiplayer-section-input="${rowIndex}"]`)
      .fill(`${word}-${rowIndex}`);
  }

  await page.getByRole("button", { name: "Submit section" }).click();
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
  const matches = page.getByText(text);
  const count = await matches.count();
  for (let index = 0; index < count; index += 1) {
    if (await matches.nth(index).isVisible()) {
      return;
    }
  }

  assert.fail(`Expected visible text: ${text}`);
}

async function assertTextHidden(page, text) {
  assert.equal(await page.getByText(text).first().isVisible(), false);
}

async function assertNoFavouriteDom(page) {
  assert.equal(await page.locator("[data-favourites-panel]").count(), 0);
  assert.equal(await page.locator("[data-favourites-status]").count(), 0);
  assert.equal(await page.locator("[data-phrase-favourites-list]").count(), 0);
  assert.equal(await page.locator("[data-save-batch-button]").count(), 0);
  assert.equal(await page.locator("[data-save-phrase-index]").count(), 0);
}

async function assertFavouriteSurfaceMounted(page) {
  assert.equal(await page.locator("[data-favourites-panel]").count(), 1);
  assert.equal(await page.locator("[data-favourites-status]").count(), 1);
  assert.equal(await page.locator("[data-phrase-favourites-list]").count(), 1);
}

async function assertNoPendingGameDom(page) {
  assert.equal(await page.locator("[data-pending-game-panel]").count(), 0);
  assert.equal(await page.locator("[data-pending-game-handle-input]").count(), 0);
  assert.equal(await page.locator("[data-pending-game-summary]").count(), 0);
}

async function assertPendingGameSurfaceMounted(page) {
  assert.equal(await page.locator("[data-pending-game-panel]").count(), 1);
  assert.equal(await page.locator("[data-pending-game-handle-input]").count(), 1);
  assert.equal(await page.locator("[data-pending-game-row-count]").count(), 1);
  assert.equal(await page.locator("[data-pending-game-summary]").isHidden(), true);
}

async function assertRowCountSelected(page, rowCount) {
  assert.equal(
    await page.locator(`[data-row-count="${rowCount}"]`).getAttribute("aria-pressed"),
    "true",
  );
}

async function assertProgressEmpty(page) {
  assert.equal(await page.locator("[data-progress]").innerText(), "");
}

async function assertFavouriteVisible(page, phrase) {
  assert.equal(
    await page.locator("[data-phrase-favourites-list] > li").evaluateAll(
      (items, expectedPhrase) =>
        items.some(
          (item) =>
            item.querySelector("[data-favourite-phrase-text]")?.textContent?.trim() ===
            expectedPhrase,
        ),
      phrase,
    ),
    true,
  );
}

async function assertBatchFavouriteVisible(page, batchCopy) {
  const batchLines = batchCopy.split("\n").slice(1);
  const favouritesList = page.locator("[data-phrase-favourites-list]");

  assert.equal(await favouritesList.getByText("Batch Favourite").isVisible(), true);

  for (const phrase of batchLines) {
    assert.equal(await favouritesList.getByText(phrase).first().isVisible(), true);
  }
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
