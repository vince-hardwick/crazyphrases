import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

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
    await assertNoProfileEditorDom(page);

    await page.getByRole("button", { name: "Test sign in" }).click();
    await assertTextVisible(page, "Account-backed mode");
    await assertTextVisible(page, "@player-test-account");
    await assertProfileManagementSurfaceMounted(page);
    await assertNoFavouritesPanelDom(page);
    await openFavouritesRoute(page);
    await assertFavouriteSurfaceMounted(page);
    await openPlayRoute(page);
    assert.equal(await page.locator("[data-toggle-batch-favourite]").count(), 0);
    assert.equal(await page.locator("[data-toggle-phrase-favourite-index]").count(), 0);

    await page.getByRole("button", { name: "Sign out" }).click();
    await assertTextVisible(page, "Anonymous solo");
    await assertTextVisible(page, "Local play in this browser");
    await assertNoFavouriteDom(page);
    await assertNoProfileEditorDom(page);

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
    const copiedPhrase = await copiedPhraseItem.locator("span").first().innerText();
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

  it("updates a signed-in profile Gamer Name in local test mode", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await page.getByRole("button", { name: "Test sign in" }).click();
    await page.getByLabel("Gamer Name").fill("Captain Spoon");
    await page.getByRole("button", { name: "Save profile" }).click();

    await assertTextVisible(page, "Profile saved.");
    assert.equal(
      await page.getByLabel("Gamer Name").inputValue(),
      "Captain Spoon",
    );

    await page.getByRole("button", { name: "Sign out" }).click();
    await assertNoProfileEditorDom(page);
    await page.getByRole("button", { name: "Test sign in" }).click();

    assert.equal(
      await page.getByLabel("Gamer Name").inputValue(),
      "Captain Spoon",
    );
    await assertNoHorizontalOverflow(page);

    assertNoConsoleErrors();
  });

  it("normalises blank or whitespace signed-in profile Gamer Name input safely", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await page.getByRole("button", { name: "Test sign in" }).click();
    const profileRegion = page.getByRole("region", { name: "Profile" });

    await profileRegion.getByLabel("Gamer Name").fill("");
    await profileRegion.getByRole("button", { name: "Save profile" }).click();

    await assertTextVisible(profileRegion, "Profile saved.");
    assert.equal(
      await profileRegion.getByLabel("Gamer Name").inputValue(),
      "Player",
    );

    await profileRegion.getByLabel("Gamer Name").fill("   ");
    await profileRegion.getByRole("button", { name: "Save profile" }).click();

    await assertTextVisible(profileRegion, "Profile saved.");
    assert.equal(
      await profileRegion.getByLabel("Gamer Name").inputValue(),
      "Player",
    );
    await assertNoHorizontalOverflow(page);

    assertNoConsoleErrors();
  });

  it("truncates overlong signed-in profile Gamer Name input safely", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);
    const gamerName =
      "Captain Spoon With A Surprisingly Long Profile Display Name";

    await page.goto(staticServer.origin);
    await page.getByRole("button", { name: "Test sign in" }).click();
    const profileRegion = page.getByRole("region", { name: "Profile" });

    await profileRegion.getByLabel("Gamer Name").fill(gamerName);
    await profileRegion.getByRole("button", { name: "Save profile" }).click();

    await assertTextVisible(profileRegion, "Profile saved.");
    assert.equal(
      await profileRegion.getByLabel("Gamer Name").inputValue(),
      gamerName.slice(0, 40),
    );
    await assertNoHorizontalOverflow(page);

    assertNoConsoleErrors();
  });

  it("shows a profile save failure without changing saved profile state", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(`${staticServer.origin}/?testAccountProfile=save-fails`);
    await page.getByRole("button", { name: "Test sign in" }).click();
    const profileRegion = page.getByRole("region", { name: "Profile" });

    await profileRegion.getByLabel("Gamer Name").fill("Captain Spoon");
    await profileRegion.getByRole("button", { name: "Save profile" }).click();

    await assertTextVisible(
      profileRegion,
      "Profile could not be saved. Try again.",
    );
    await assertTextHidden(profileRegion, "Profile saved.");
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Test sign in" }).click();

    assert.equal(
      await page
        .getByRole("region", { name: "Profile" })
        .getByLabel("Gamer Name")
        .inputValue(),
      "Player",
    );
    await assertTextVisible(page, "@player-test-account");
    await assertNoHorizontalOverflow(page);

    assertNoConsoleErrors();
  });

  it("updates a signed-in profile Handle in local test mode", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await page.getByRole("button", { name: "Test sign in" }).click();
    const profileRegion = page.getByRole("region", { name: "Profile" });

    await profileRegion.getByLabel("Handle").fill("Captain Spoon");
    await profileRegion.getByRole("button", { name: "Save profile" }).click();

    await assertTextVisible(profileRegion, "Profile saved.");
    assert.equal(
      await profileRegion.getByLabel("Handle").inputValue(),
      "captain-spoon",
    );
    await assertTextVisible(page, "@captain-spoon");

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Test sign in" }).click();

    assert.equal(
      await page
        .getByRole("region", { name: "Profile" })
        .getByLabel("Handle")
        .inputValue(),
      "captain-spoon",
    );
    await assertTextVisible(page, "@captain-spoon");
    await assertNoHorizontalOverflow(page);

    assertNoConsoleErrors();
  });

  it("shows a duplicate Handle error without changing the saved profile", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await page.getByRole("button", { name: "Test sign in" }).click();
    const profileRegion = page.getByRole("region", { name: "Profile" });

    await profileRegion.getByLabel("Handle").fill("invitee-two");
    await profileRegion.getByRole("button", { name: "Save profile" }).click();

    await assertTextVisible(profileRegion, "Handle is already in use.");
    await assertTextHidden(page, "Profile saved.");
    await assertTextVisible(page, "@player-test-account");

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Test sign in" }).click();

    assert.equal(
      await page
        .getByRole("region", { name: "Profile" })
        .getByLabel("Handle")
        .inputValue(),
      "player-test-account",
    );
    await assertNoHorizontalOverflow(page);

    assertNoConsoleErrors();
  });

  it("shows an invalid Handle error without changing the saved profile", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await page.getByRole("button", { name: "Test sign in" }).click();
    const profileRegion = page.getByRole("region", { name: "Profile" });

    await profileRegion.getByLabel("Handle").fill("x");
    await profileRegion.getByRole("button", { name: "Save profile" }).click();

    await assertTextVisible(profileRegion, "Handle must be at least 3 characters.");
    await assertTextVisible(page, "@player-test-account");

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Test sign in" }).click();

    assert.equal(
      await page
        .getByRole("region", { name: "Profile" })
        .getByLabel("Handle")
        .inputValue(),
      "player-test-account",
    );

    assertNoConsoleErrors();
  });

  it("updates a signed-in profile Avatar in local test mode", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await page.getByRole("button", { name: "Test sign in" }).click();
    const profileRegion = page.getByRole("region", { name: "Profile" });

    await profileRegion.locator("[data-account-profile-avatar]").selectOption("dragon");
    await profileRegion.getByRole("button", { name: "Save profile" }).click();

    await assertTextVisible(profileRegion, "Profile saved.");
    assert.equal(
      await profileRegion.locator("[data-account-profile-avatar]").inputValue(),
      "dragon",
    );
    assert.equal(
      await profileRegion
        .locator("[data-account-profile-built-in-avatar-icon]")
        .getAttribute("data-avatar-key"),
      "dragon",
    );

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Test sign in" }).click();

    assert.equal(
      await page
        .getByRole("region", { name: "Profile" })
        .locator("[data-account-profile-avatar]")
        .inputValue(),
      "dragon",
    );
    await assertNoHorizontalOverflow(page);

    assertNoConsoleErrors();
  });

  it("restores signed-in profile changes after local test reload", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await page.getByRole("button", { name: "Test sign in" }).click();
    let profileRegion = page.getByRole("region", { name: "Profile" });

    await profileRegion.getByLabel("Gamer Name").fill("Captain Spoon");
    await profileRegion.getByLabel("Handle").fill("Captain Spoon");
    await profileRegion
      .locator("[data-account-profile-avatar]")
      .selectOption("yin-yang");
    await profileRegion.getByRole("button", { name: "Save profile" }).click();
    await assertTextVisible(profileRegion, "Profile saved.");

    await page.reload();
    await assertTextVisible(page, "Anonymous solo");
    await page.getByRole("button", { name: "Test sign in" }).click();
    profileRegion = page.getByRole("region", { name: "Profile" });

    assert.equal(
      await profileRegion.getByLabel("Gamer Name").inputValue(),
      "Captain Spoon",
    );
    assert.equal(
      await profileRegion.getByLabel("Handle").inputValue(),
      "captain-spoon",
    );
    assert.equal(
      await profileRegion.locator("[data-account-profile-avatar]").inputValue(),
      "yin-yang",
    );
    await assertTextVisible(page, "@captain-spoon");
    await assertNoHorizontalOverflow(page);

    assertNoConsoleErrors();
  });

  it("previews, crops, saves, reloads, and removes an Uploaded Avatar in local test mode", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);
    await page.addInitScript(() => {
      const created = [];
      const revoked = [];
      const createObjectURL = URL.createObjectURL.bind(URL);
      const revokeObjectURL = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (value) => {
        const url = createObjectURL(value);
        created.push(url);
        return url;
      };
      URL.revokeObjectURL = (url) => {
        revoked.push(url);
        return revokeObjectURL(url);
      };
      window.__avatarObjectUrlLedger = { created, revoked };
    });

    await page.goto(staticServer.origin);
    await page.getByRole("button", { name: "Test sign in" }).click();
    let profileRegion = page.getByRole("region", { name: "Profile" });

    await profileRegion
      .locator("[data-account-profile-uploaded-avatar-input]")
      .setInputFiles(createPngFilePayload({ height: 180, width: 300 }));

    await profileRegion
      .locator("[data-account-profile-uploaded-avatar-image]")
      .waitFor({ state: "visible" });
    await profileRegion
      .locator("[data-account-profile-crop-editor]")
      .waitFor({ state: "visible" });
    assert.equal(
      await profileRegion.locator("[data-account-profile-crop-box]").count(),
      1,
    );
    assert.equal(
      await profileRegion.locator("[data-account-profile-crop-marker]").count(),
      8,
    );
    assert.match(
      await profileRegion
        .locator("[data-account-profile-crop-editor-image]")
        .getAttribute("src"),
      /^blob:/,
    );
    const cropGuide = profileRegion.locator("[data-account-profile-crop-guide]");
    assert.equal(
      await cropGuide.evaluate((element) => element.classList.contains("is-active")),
      false,
    );
    assert.equal(
      await profileRegion.getByRole("button", { name: "Zoom in" }).count(),
      1,
    );
    assert.equal(
      await profileRegion.getByRole("button", { name: "Reset crop" }).count(),
      1,
    );
    assert.equal(await profileRegion.locator("[data-account-profile-crop-scale]").count(), 0);
    assert.equal(await profileRegion.locator("[data-account-profile-crop-x]").count(), 0);
    assert.equal(await profileRegion.locator("[data-account-profile-crop-y]").count(), 0);
    const initialDraftStyle = await profileRegion
      .locator("[data-account-profile-uploaded-avatar-image]")
      .getAttribute("style");
    const cropEditorBox = await profileRegion
      .locator("[data-account-profile-crop-editor]")
      .boundingBox();
    await page.mouse.move(
      cropEditorBox.x + cropEditorBox.width / 2,
      cropEditorBox.y + cropEditorBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      cropEditorBox.x + cropEditorBox.width / 2 + 30,
      cropEditorBox.y + cropEditorBox.height / 2,
    );
    await page.mouse.up();
    assert.notEqual(
      await profileRegion
        .locator("[data-account-profile-uploaded-avatar-image]")
        .getAttribute("style"),
      initialDraftStyle,
    );
    assert.equal(
      await cropGuide.evaluate((element) => element.classList.contains("is-active")),
      true,
    );
    await profileRegion.getByRole("button", { name: "Reset crop" }).click();
    assert.match(
      await profileRegion
        .locator("[data-account-profile-uploaded-avatar-image]")
        .getAttribute("style"),
      /translate\(0%, 0%\) scale\(1\)/,
    );
    const draftPreviewUrl = await profileRegion
      .locator("[data-account-profile-uploaded-avatar-image]")
      .getAttribute("src");
    assert.match(draftPreviewUrl, /^blob:/);

    await profileRegion
      .locator("[data-account-profile-avatar]")
      .selectOption("gamepad");
    assert.equal(
      await profileRegion
        .locator("[data-account-profile-built-in-avatar-icon]")
        .getAttribute("data-avatar-key"),
      "gamepad",
    );
    assert.equal(
      await page.evaluate(
        (url) => window.__avatarObjectUrlLedger.revoked.includes(url),
        draftPreviewUrl,
      ),
      true,
    );

    await profileRegion
      .locator("[data-account-profile-uploaded-avatar-input]")
      .setInputFiles(createPngFilePayload({ height: 180, width: 300 }));

    await profileRegion
      .locator("[data-account-profile-uploaded-avatar-image]")
      .waitFor({ state: "visible" });
    assert.equal(await profileRegion.locator("[data-account-profile-crop-scale]").count(), 0);
    assert.equal(await profileRegion.locator("[data-account-profile-crop-x]").count(), 0);
    assert.equal(await profileRegion.locator("[data-account-profile-crop-y]").count(), 0);
    await profileRegion.getByRole("button", { name: "Zoom in" }).click();
    assert.match(
      await profileRegion
        .locator("[data-account-profile-uploaded-avatar-image]")
        .getAttribute("style"),
      /scale\(1\.1\)/,
    );
    await profileRegion.locator("[data-account-profile-crop-editor]").focus();
    await page.keyboard.press("ArrowRight");
    assert.match(
      await profileRegion
        .locator("[data-account-profile-uploaded-avatar-image]")
        .getAttribute("style"),
      /translate\(5%, 0%\) scale\(1\.1\)/,
    );
    assert.match(
      await profileRegion
        .locator("[data-account-profile-uploaded-avatar-image]")
        .getAttribute("src"),
      /^blob:/,
    );

    await profileRegion.getByRole("button", { name: "Save profile" }).click();
    await profileRegion.getByText("Profile saved.").waitFor({ state: "visible" });
    assert.match(
      await profileRegion
        .locator("[data-account-profile-uploaded-avatar-image]")
        .getAttribute("src"),
      /^data:image\/png;base64,/,
    );
    assert.deepEqual(
      await profileRegion
        .locator("[data-account-profile-uploaded-avatar-image]")
        .evaluate((image) => ({
          naturalHeight: image.naturalHeight,
          naturalWidth: image.naturalWidth,
        })),
      {
        naturalHeight: 256,
        naturalWidth: 256,
      },
    );
    const uploadedMetadata = await page.evaluate(() => {
      const uploads = JSON.parse(
        localStorage.getItem("crazyphrases.localTest.uploadedAvatars.v1"),
      );
      const uploaded = Object.values(uploads).find(
        (entry) => entry?.metadata?.lifecycleStatus === "pending",
      );

      return {
        contentType: uploaded?.metadata?.contentType,
        height: uploaded?.metadata?.height,
        objectPath: uploaded?.metadata?.objectPath,
        width: uploaded?.metadata?.width,
      };
    });
    assert.deepEqual(
      {
        contentType: uploadedMetadata.contentType,
        height: uploadedMetadata.height,
        width: uploadedMetadata.width,
      },
      {
        contentType: "image/png",
        height: 256,
        width: 256,
      },
    );
    assert.match(
      uploadedMetadata.objectPath,
      /^uploaded\/[0-9a-f-]{36}\.png$/,
    );

    await page.reload();
    await page.getByRole("button", { name: "Test sign in" }).click();
    profileRegion = page.getByRole("region", { name: "Profile" });
    assert.match(
      await profileRegion
        .locator("[data-account-profile-uploaded-avatar-image]")
        .getAttribute("src"),
      /^data:image\/png;base64,/,
    );
    assert.deepEqual(
      await profileRegion
        .locator("[data-account-profile-uploaded-avatar-image]")
        .evaluate((image) => ({
          naturalHeight: image.naturalHeight,
          naturalWidth: image.naturalWidth,
        })),
      {
        naturalHeight: 256,
        naturalWidth: 256,
      },
    );

    await profileRegion.locator("[data-account-profile-avatar]").selectOption("dice");
    await profileRegion.getByRole("button", { name: "Save profile" }).click();
    await profileRegion.getByText("Profile saved.").waitFor({ state: "visible" });
    assert.equal(
      await profileRegion.locator("[data-account-profile-uploaded-avatar-image]").count(),
      0,
    );
    assert.equal(
      await profileRegion.locator("[data-account-profile-avatar]").inputValue(),
      "dice",
    );
    await assertNoHorizontalOverflow(page);

    assertNoConsoleErrors();
  });

  it("rejects invalid Uploaded Avatar files before profile save", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await page.getByRole("button", { name: "Test sign in" }).click();
    const profileRegion = page.getByRole("region", { name: "Profile" });
    const uploadInput = profileRegion.locator(
      "[data-account-profile-uploaded-avatar-input]",
    );

    await uploadInput.setInputFiles({
      buffer: Buffer.from("plain text"),
      mimeType: "text/plain",
      name: "avatar.txt",
    });
    await profileRegion
      .getByText("Choose a JPEG, PNG, or WebP image.")
      .waitFor({ state: "visible" });

    await uploadInput.setInputFiles({
      buffer: Buffer.alloc(1024 * 1024 + 1),
      mimeType: "image/png",
      name: "large.png",
    });
    await profileRegion
      .getByText("Choose an image smaller than 1 MB.")
      .waitFor({ state: "visible" });

    await uploadInput.setInputFiles(createPngFilePayload({ height: 128, width: 64 }));
    await profileRegion
      .getByText("Choose an image at least 128 by 128 pixels.")
      .waitFor({ state: "visible" });

    await uploadInput.setInputFiles(createPngFilePayload({ height: 128, width: 1025 }));
    await profileRegion
      .getByText("Choose an image no larger than 1024 by 1024 pixels.")
      .waitFor({ state: "visible" });

    await uploadInput.setInputFiles({
      buffer: Buffer.from("not a png"),
      mimeType: "image/png",
      name: "corrupt.png",
    });
    await profileRegion
      .getByText("This image could not be read. Choose another file.")
      .waitFor({ state: "visible" });
    assert.equal(
      await profileRegion.locator("[data-account-profile-uploaded-avatar-image]").count(),
      0,
    );

    assertNoConsoleErrors();
  });

  it("keeps the previous Avatar active when upload or post-upload save fails", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const uploadFailureContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const uploadFailurePage = await uploadFailureContext.newPage();
    const assertNoUploadFailureConsoleErrors =
      trackConsoleErrors(uploadFailurePage);

    await uploadFailurePage.goto(`${staticServer.origin}/?testAvatarStorage=upload-fails`);
    await uploadFailurePage.getByRole("button", { name: "Test sign in" }).click();
    let profileRegion = uploadFailurePage.getByRole("region", { name: "Profile" });
    await profileRegion
      .locator("[data-account-profile-uploaded-avatar-input]")
      .setInputFiles(createPngFilePayload({ height: 128, width: 128 }));
    await profileRegion.getByRole("button", { name: "Save profile" }).click();

    await profileRegion
      .getByText("Avatar could not be uploaded. Try again.")
      .waitFor({ state: "visible" });
    await assertTextHidden(profileRegion, "Profile saved.");
    await uploadFailurePage.getByRole("button", { name: "Sign out" }).click();
    await uploadFailurePage.getByRole("button", { name: "Test sign in" }).click();
    profileRegion = uploadFailurePage.getByRole("region", { name: "Profile" });
    assert.equal(
      await profileRegion.locator("[data-account-profile-avatar]").inputValue(),
      "dice",
    );
    assertNoUploadFailureConsoleErrors();
    await uploadFailureContext.close();

    const saveFailureContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const saveFailurePage = await saveFailureContext.newPage();
    const assertNoSaveFailureConsoleErrors = trackConsoleErrors(saveFailurePage);

    await saveFailurePage.goto(
      `${staticServer.origin}/?testAccountProfile=save-fails`,
    );
    await saveFailurePage.getByRole("button", { name: "Test sign in" }).click();
    profileRegion = saveFailurePage.getByRole("region", { name: "Profile" });
    await profileRegion
      .locator("[data-account-profile-uploaded-avatar-input]")
      .setInputFiles(createPngFilePayload({ height: 128, width: 128 }));
    await profileRegion.getByRole("button", { name: "Save profile" }).click();

    await profileRegion
      .getByText("Profile could not be saved. Your previous avatar is still active.")
      .waitFor({ state: "visible" });
    await assertTextHidden(profileRegion, "Profile saved.");
    await saveFailurePage.getByRole("button", { name: "Sign out" }).click();
    await saveFailurePage.getByRole("button", { name: "Test sign in" }).click();
    profileRegion = saveFailurePage.getByRole("region", { name: "Profile" });
    assert.equal(
      await profileRegion.locator("[data-account-profile-avatar]").inputValue(),
      "dice",
    );
    assertNoSaveFailureConsoleErrors();
    await saveFailureContext.close();
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
    await page.locator("[data-pending-game-nudge-timeout]").selectOption("72");
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
    await assertTextVisible(page, "Nudge after 3 days");
    await assertNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Sign out" }).click();
    await assertTextVisible(page, "Anonymous solo");
    await assertNoPendingGameDom(page);

    assertNoConsoleErrors();
  });

  it("shows expired Pending Game invites without creator or invitee actions", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(`${staticServer.origin}/?testPendingGame=expire-immediately`);
    await page.getByRole("button", { name: "Test sign in" }).click();
    await page.locator("[data-pending-game-handle-input]").fill("INVITEE TWO");
    await page.locator("[data-pending-game-row-count]").selectOption("15");
    await page.getByRole("button", { name: "Create invite" }).click();

    await assertTextVisible(
      page,
      "Game invite created. Waiting for @invitee-two to accept.",
    );
    await assertTextVisible(page, "Created invites");
    await assertTextVisible(page, "Expired");
    assert.equal(
      await page.getByRole("button", { name: "Start game with @invitee-two" }).count(),
      0,
    );
    assert.equal(
      await page.getByRole("button", { name: "Cancel game with @invitee-two" }).count(),
      0,
    );

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Test invitee sign in" }).click();
    await assertTextVisible(page, "Incoming invites");
    await assertTextVisible(page, "Expired");
    assert.equal(
      await page
        .getByRole("button", { name: "Accept invite from @player-test-account" })
        .count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Decline invite from @player-test-account" })
        .count(),
      0,
    );
    await assertNoHorizontalOverflow(page);

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
    await openFavouritesRoute(page);
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
    await openMultiplayerRoute(page);
    await page.getByRole("button", { name: "Reveal phrases" }).click();
    await assertTextVisible(page, "Your crazy phrases");

    assertNoConsoleErrors();
  });

  it("opens completed multiplayer history from the dashboard", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    assert.equal(
      await page.getByRole("button", { name: "View all completed batches" }).count(),
      0,
    );

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
    await assertTextVisible(page, "Batches completed");

    await page.getByRole("button", { name: "View all completed batches" }).click();

    await assertTextVisible(page, "Completed multiplayer history");
    await assertTextVisible(page, "Batch with @player-test-account and @invitee-two.");
    await assertTextVisible(page, "Not revealed yet.");
    await assertTextAbsent(page, "Brisk-0 teapot-0 ladder-0");
    await page.getByRole("button", { name: "Reveal phrases" }).click();
    await assertTextVisible(page, "Brisk-0 teapot-0 ladder-0");
    await assertTextVisible(page, "Brisk-9 teapot-9 ladder-9");
    await page.getByRole("button", { name: "Back to dashboard" }).click();
    await assertTextVisible(page, "Batches completed");
    await assertNoHorizontalOverflow(page);

    assertNoConsoleErrors();
  });

  it("loads another completed multiplayer history page without replacing the first page", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(`${staticServer.origin}/?testPendingGame=history-pages`);
    await page.getByRole("button", { name: "Test sign in" }).click();
    await page.getByRole("button", { name: "View all completed batches" }).click();

    await assertTextVisible(page, "Completed multiplayer history");
    const historyPanel = page.locator("[data-completed-multiplayer-history]");
    assert.equal(
      await historyPanel
        .getByText("Batch with @player-test-account and @invitee-two.")
        .count(),
      20,
    );
    assert.equal(
      await page.getByRole("button", { name: "Load more" }).isVisible(),
      true,
    );

    await page.getByRole("button", { name: "Load more" }).click();

    assert.equal(
      await historyPanel
        .getByText("Batch with @player-test-account and @invitee-two.")
        .count(),
      21,
    );
    assert.equal(await page.getByRole("button", { name: "Load more" }).count(), 0);
    await assertNoHorizontalOverflow(page);

    assertNoConsoleErrors();
  });

  it("keeps completed multiplayer history visible when loading another page fails", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(
      `${staticServer.origin}/?testPendingGame=history-load-more-fails`,
    );
    await page.getByRole("button", { name: "Test sign in" }).click();
    await page.getByRole("button", { name: "View all completed batches" }).click();

    const historyPanel = page.locator("[data-completed-multiplayer-history]");
    assert.equal(
      await historyPanel
        .getByText("Batch with @player-test-account and @invitee-two.")
        .count(),
      20,
    );

    await page.getByRole("button", { name: "Load more" }).click();

    await assertTextVisible(
      page,
      "More completed batches could not be loaded. Try again.",
    );
    assert.equal(
      await historyPanel
        .getByText("Batch with @player-test-account and @invitee-two.")
        .count(),
      20,
    );
    assert.equal(
      await page.getByRole("button", { name: "Load more" }).isVisible(),
      true,
    );
    await page.getByRole("button", { name: "Back to dashboard" }).click();
    await assertTextVisible(page, "Batches completed");

    assertNoConsoleErrors();
  });

  it("shows a recoverable error when completed multiplayer history cannot be loaded", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(`${staticServer.origin}/?testPendingGame=history-fails`);
    await page.getByRole("button", { name: "Test sign in" }).click();
    await assertTextVisible(page, "Batches completed");

    await page.getByRole("button", { name: "View all completed batches" }).click();

    await assertTextVisible(
      page,
      "Completed batches could not be loaded. Try again.",
    );
    assert.equal(await page.getByRole("button", { name: "Retry" }).isVisible(), true);
    await page.getByRole("button", { name: "Back to dashboard" }).click();
    await assertTextVisible(page, "Batches completed");
    await assertNoHorizontalOverflow(page);

    assertNoConsoleErrors();
  });

  it("keeps completed multiplayer history retryable when Reveal fails", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(`${staticServer.origin}/?testPendingGame=reveal-fails-once`);
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
    await page.getByRole("button", { name: "View all completed batches" }).click();

    await page.getByRole("button", { name: "Reveal phrases" }).click();
    await assertTextVisible(page, "Phrases could not be revealed. Try again.");
    await assertTextVisible(page, "Completed multiplayer history");
    await assertTextVisible(page, "Not revealed yet.");
    await assertTextAbsent(page, "Brisk-0 teapot-0 ladder-0");

    await page.getByRole("button", { name: "Reveal phrases" }).click();
    await assertTextVisible(page, "Brisk-0 teapot-0 ladder-0");
    await page.getByRole("button", { name: "Back to dashboard" }).click();
    await assertTextVisible(page, "Batches completed");
    await assertNoHorizontalOverflow(page);

    assertNoConsoleErrors();
  });

  it("lets the creator cancel a started multiplayer game before reveal", async () => {
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
    await assertTextVisible(page, "Awaiting your entries");

    await page
      .getByRole("button", { name: "Cancel game with @invitee-two" })
      .click();

    await assertTextVisible(page, "Game cancelled.");
    await assertTextVisible(page, "Cancelled");
    assert.equal(
      await page.getByRole("button", { name: "Submit section" }).count(),
      0,
    );

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Test invitee sign in" }).click();
    assert.equal(
      await page.getByRole("button", { name: "Submit section" }).count(),
      0,
    );
    await page.getByRole("button", { name: "Notifications, 1 unread" }).click();
    await assertTextVisible(
      page,
      "@player-test-account cancelled a batch with @player-test-account and @invitee-two.",
    );
    await assertNoHorizontalOverflow(page);

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

  it("gates the signed-in Favourites route and restores it after sign-in", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(`${staticServer.origin}/#/favourites`);
    await assertTextVisible(page, "Sign in to view Favourites");
    await assertNoFavouriteDom(page);
    assert.equal(await page.locator("[data-favourites-route]").count(), 0);

    await page.getByRole("button", { name: "Test sign in" }).click();
    await assertTextVisible(page, "Account-backed mode");
    assert.equal(new URL(page.url()).hash, "#/favourites");
    await assertTextVisible(page, "Favourites");
    await assertFavouriteSurfaceMounted(page);
    await assertTextVisible(page, "No phrase favourites yet.");
    await assertTextVisible(page, "Favourite revealed phrases from Play Solo.");
    await page.getByRole("tab", { name: "Batches" }).click();
    await assertTextVisible(page, "No batch favourites yet.");
    await assertTextVisible(page, "Favourite a revealed batch from Play Solo.");
    assert.equal(new URL(page.url()).hash, "#/favourites");
    await assertNoHorizontalOverflow(page);

    await page.getByRole("link", { name: "Play", exact: true }).click();
    await page.waitForFunction(() => window.location.hash === "#/play/solo");
    assert.equal(new URL(page.url()).hash, "#/play/solo");
    await assertNoFavouritesPanelDom(page);

    await page.getByRole("link", { name: "Favourites" }).click();
    await page.waitForFunction(
      () => document.querySelectorAll("[data-favourites-panel]").length === 1,
    );
    assert.equal(new URL(page.url()).hash, "#/favourites");
    await assertFavouriteSurfaceMounted(page);
    await assertTextVisible(page, "No phrase favourites yet.");
    await assertTextVisible(page, "Favourite revealed phrases from Play Solo.");

    await page.getByRole("button", { name: "Sign out" }).click();
    await assertTextVisible(page, "Anonymous solo");
    assert.equal(new URL(page.url()).hash, "#/play/solo");
    await assertNoFavouriteDom(page);

    assertNoConsoleErrors();
  });

  it("shows independent Favourites list errors with list-specific retry", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(`${staticServer.origin}/?testPrivateFavourites=load-fails#/favourites`);
    await page.getByRole("button", { name: "Test sign in" }).click();

    await assertTextVisible(page, "Could not load phrase favourites.");
    assert.equal(
      await page.getByRole("button", { name: "Try loading phrase favourites again" }).isVisible(),
      true,
    );

    await page.getByRole("tab", { name: "Batches" }).click();
    await assertTextVisible(page, "Could not load batch favourites.");
    assert.equal(
      await page.getByRole("button", { name: "Try loading batch favourites again" }).isVisible(),
      true,
    );

    assertNoConsoleErrors();
  });

  it("retries one failed Favourites list without refreshing the other list", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(`${staticServer.origin}/?testPrivateFavourites=load-fails-once#/favourites`);
    await page.getByRole("button", { name: "Test sign in" }).click();

    await assertTextVisible(page, "Could not load phrase favourites.");
    assert.equal(
      await page.getByRole("button", { name: "Try loading phrase favourites again" }).isVisible(),
      true,
    );

    await page
      .getByRole("button", { name: "Try loading phrase favourites again" })
      .click();
    await assertTextVisible(page, "No phrase favourites yet.");
    await assertTextVisible(page, "Favourite revealed phrases from Play Solo.");
    await assertTextHidden(page, "Could not load phrase favourites.");

    await page.getByRole("tab", { name: "Batches" }).click();
    await assertTextVisible(page, "Could not load batch favourites.");
    assert.equal(
      await page.getByRole("button", { name: "Try loading batch favourites again" }).isVisible(),
      true,
    );

    assertNoConsoleErrors();
  });

  it("ignores stale Favourites list loads after account changes", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);
    const stalePhrase = "Primary account stale favourite";

    await page.goto(`${staticServer.origin}/?testPrivateFavourites=load-race#/favourites`);
    await seedLocalTestPhraseFavourite(page, {
      accountId: "test-account",
      favouriteId: "primary-stale-phrase",
      phraseText: stalePhrase,
    });

    await page.getByRole("button", { name: "Test sign in" }).click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Test invitee sign in" }).click();

    await assertTextVisible(page, "@invitee-two");
    await openFavouritesRoute(page);
    assert.equal(new URL(page.url()).hash, "#/favourites");
    await assertFavouriteSurfaceMounted(page);
    await assertTextVisible(page, "No phrase favourites yet.");

    await page.waitForTimeout(700);
    await assertTextVisible(page, "No phrase favourites yet.");
    await assertTextAbsent(page, stalePhrase);

    assertNoConsoleErrors();
  });

  it("does not restore a stale signed-in route after anonymous route changes", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(`${staticServer.origin}/#/favourites`);
    await assertTextVisible(page, "Sign in to view Favourites");

    await page.evaluate(() => {
      window.location.hash = "#/play/solo";
    });
    await page.waitForFunction(() => window.location.hash === "#/play/solo");

    await page.getByRole("button", { name: "Test sign in" }).click();
    await assertTextVisible(page, "Account-backed mode");
    assert.equal(new URL(page.url()).hash, "#/play/solo");
    await assertNoFavouritesPanelDom(page);
    assert.equal(await page.locator("[data-game-panel]").isHidden(), false);

    assertNoConsoleErrors();
  });

  it("gates and restores the Multiplayer route without dropping pending state", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(`${staticServer.origin}/#/play/multiplayer`);
    await assertTextVisible(page, "Sign in to play Multiplayer");
    await assertNoPendingGameDom(page);
    await assertNoFavouriteDom(page);

    await page.getByRole("button", { name: "Test sign in" }).click();
    await assertTextVisible(page, "Account-backed mode");
    assert.equal(new URL(page.url()).hash, "#/play/multiplayer");
    assert.equal(await page.locator("[data-game-panel]").isHidden(), true);
    await assertPendingGameSurfaceMounted(page);
    await assertNoFavouritesPanelDom(page);

    await page.locator("[data-pending-game-handle-input]").fill("INVITEE TWO");
    await page.locator("[data-pending-game-row-count]").selectOption("15");
    await page.locator("[data-pending-game-nudge-timeout]").selectOption("72");
    await page.getByRole("button", { name: "Create invite" }).click();

    await assertTextVisible(
      page,
      "Game invite created. Waiting for @invitee-two to accept.",
    );
    await assertTextVisible(page, "@invitee-two");
    await assertTextVisible(page, "15 phrases");

    await openFavouritesRoute(page);
    await assertFavouriteSurfaceMounted(page);
    await assertNoPendingGameDom(page);

    await openMultiplayerRoute(page);
    assert.equal(await page.locator("[data-game-panel]").isHidden(), true);
    assert.equal(await page.locator("[data-pending-game-panel]").count(), 1);
    assert.equal(await page.locator("[data-pending-game-handle-input]").count(), 1);
    await assertNoFavouritesPanelDom(page);
    await assertTextVisible(page, "@invitee-two");
    await assertTextVisible(page, "15 phrases");
    await assertTextVisible(page, "Nudge after 3 days");

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
    assert.equal(
      await page
        .getByRole("button", { name: "Save batch as favourite" })
        .isVisible(),
      false,
    );

    const fillState = createFillState(10);
    await fillActiveSection(page, fillState);
    await fillActiveSection(page, fillState);
    await fillActiveSection(page, fillState);

    await assertTextVisible(page, "Your crazy phrases");
    assert.equal(await page.locator("[data-phrase-list] li").count(), 10);
    await assertNoHorizontalOverflow(page);

    const copiedPhraseItem = page.locator("[data-phrase-list] li").nth(1);
    const copiedPhrase = await copiedPhraseItem.locator("span").first().innerText();
    assertDefaultTemplatePhrase(copiedPhrase);

    await page.getByRole("button", { name: "Copy phrase 2" }).click();
    assert.equal(await readClipboard(page), copiedPhrase);

    await page.getByRole("button", { name: "Copy all" }).click();
    const batchCopy = normalizeLineEndings(await readClipboard(page));
    assert.equal(batchCopy.split("\n")[0], "Crazy Phrases");
    assert.equal(batchCopy.split("\n").length, 11);

    const phraseFavouriteButton = page.getByRole("button", {
      name: "Save phrase 2 as favourite",
    });
    await expectFavouriteToggleState(phraseFavouriteButton, {
      pressed: false,
      style: "regular",
    });
    await phraseFavouriteButton.click();
    await waitForTextVisible(page, "Phrase favourite saved.");
    const removePhraseFavouriteButton = page.getByRole("button", {
      name: "Remove phrase 2 from favourites",
    });
    await expectFavouriteToggleState(removePhraseFavouriteButton, {
      pressed: true,
      style: "solid",
    });
    assert.equal(await removePhraseFavouriteButton.isEnabled(), true);
    await removePhraseFavouriteButton.click();
    await assertTextVisible(page, "Phrase favourite removed.");
    const savePhraseFavouriteButton = page.getByRole("button", {
      name: "Save phrase 2 as favourite",
    });
    await expectFavouriteToggleState(savePhraseFavouriteButton, {
      pressed: false,
      style: "regular",
    });
    assert.equal(
      await savePhraseFavouriteButton.isEnabled(),
      true,
    );

    await page.getByRole("button", { name: "Save phrase 2 as favourite" }).click();
    await waitForTextVisible(page, "Phrase favourite saved.");
    await assertNoFavouritesPanelDom(page);
    await openFavouritesRoute(page);
    await assertFavouriteSurfaceMounted(page);
    await assertFavouriteVisible(page, copiedPhrase);

    await openPlayRoute(page);
    assert.equal(
      await page
        .getByRole("button", { name: "Remove phrase 2 from favourites" })
        .isEnabled(),
      true,
    );

    const batchFavouriteButton = page.getByRole("button", {
      name: "Save batch as favourite",
    });
    await expectFavouriteToggleState(batchFavouriteButton, {
      pressed: false,
      style: "regular",
    });
    await batchFavouriteButton.click();
    await assertTextVisible(page, "Batch favourite saved.");
    await assertNoFavouritesPanelDom(page);
    const removeBatchFavouriteButton = page.getByRole("button", {
      name: "Remove batch from favourites",
    });
    await expectFavouriteToggleState(removeBatchFavouriteButton, {
      pressed: true,
      style: "solid",
    });
    assert.equal(
      await removeBatchFavouriteButton.isEnabled(),
      true,
    );
    await removeBatchFavouriteButton.click();
    await assertTextVisible(page, "Batch favourite removed.");
    const saveBatchFavouriteButton = page.getByRole("button", {
      name: "Save batch as favourite",
    });
    await expectFavouriteToggleState(saveBatchFavouriteButton, {
      pressed: false,
      style: "regular",
    });
    assert.equal(
      await saveBatchFavouriteButton.isEnabled(),
      true,
    );

    await page.getByRole("button", { name: "Save batch as favourite" }).click();
    await assertTextVisible(page, "Batch favourite saved.");
    await assertNoFavouritesPanelDom(page);
    await openFavouritesRoute(page);
    const phraseFavouriteRow = await assertFavouriteVisible(page, copiedPhrase);
    await assertFavouriteRowParticipantVisible(phraseFavouriteRow, "Solo");
    await page.getByRole("button", { name: "Copy phrase" }).click();
    await waitForTextVisible(page, "Phrase copied.");
    await assertActiveElementMatches(page, {
      selector: "[data-copy-phrase-favourite-id]",
      accessibleName: "Copy phrase",
    });
    assert.equal(await readClipboard(page), copiedPhrase);
    const batchFavouriteRow = await assertBatchFavouriteVisible(page, batchCopy);
    await assertFavouriteRowParticipantVisible(batchFavouriteRow, "Solo");
    await page.getByRole("button", { name: "Copy batch" }).click();
    await waitForTextVisible(page, "Batch copied.");
    await assertActiveElementMatches(page, {
      selector: "[data-copy-batch-favourite-id]",
      accessibleName: "Copy batch",
    });
    assert.equal(normalizeLineEndings(await readClipboard(page)), batchCopy);
    await page.waitForTimeout(2100);
    await assertTextHidden(page, "Batch copied.");

    await page.getByRole("tab", { name: "Phrases" }).click();
    await installFallbackClipboardWrite(page);
    await page.getByRole("button", { name: "Copy phrase" }).click();
    await waitForTextVisible(page, "Phrase copied.");
    await assertActiveElementMatches(page, {
      selector: "[data-copy-phrase-favourite-id]",
      accessibleName: "Copy phrase",
    });
    await restoreClipboardWrite(page);

    await installDelayedClipboardWrite(page);
    await page.getByRole("button", { name: "Copy phrase" }).click();
    await waitForRouteCopyButtonsDisabled(page);
    await page.getByRole("tab", { name: "Batches" }).click();
    assert.equal(
      await page.getByRole("button", { name: "Copy batch" }).isDisabled(),
      true,
    );
    assert.deepEqual(await getClipboardWriteTexts(page), [copiedPhrase]);
    await releaseDelayedClipboardWrite(page);
    await waitForRouteCopyButtonsEnabled(page);
    await restoreClipboardWrite(page);

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
    await assertNoFavouritesPanelDom(page);
    await openFavouritesRoute(page);
    await assertFavouriteSurfaceMounted(page);
    await assertFavouriteVisible(page, copiedPhrase);
    await assertBatchFavouriteVisible(page, batchCopy);
    await assertNoHorizontalOverflow(page);

    await page.getByRole("tab", { name: "Phrases" }).click();
    await page.getByRole("button", { name: /Remove phrase favourite/ }).click();
    await assertTextVisible(page, "Phrase favourite removed.");
    await assertBatchFavouriteVisible(page, batchCopy);

    await page.getByRole("button", { name: /Remove batch favourite/ }).click();
    await assertTextVisible(page, "No batch favourites yet.");
    await assertTextHidden(page, "Batch favourite removed.");

    await openPlayRoute(page);
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

  it("keeps current-output favourite hearts stable while mutations are pending", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(`${staticServer.origin}/?testPrivateFavourites=mutation-delays`);
    await page.getByRole("button", { name: "Test sign in" }).click();
    await assertTextVisible(page, "Account-backed mode");

    await page.getByRole("button", { name: "10" }).click();
    await page.getByRole("button", { name: "Start batch" }).click();

    const fillState = createFillState(10);
    await fillActiveSection(page, fillState);
    await fillActiveSection(page, fillState);
    await fillActiveSection(page, fillState);

    const copiedPhraseItem = page.locator("[data-phrase-list] li").nth(1);
    const copiedPhrase = await copiedPhraseItem.locator("span").first().innerText();

    const phraseFavouriteButton = page.getByRole("button", {
      name: "Save phrase 2 as favourite",
    });
    await expectFavouriteToggleState(phraseFavouriteButton, {
      pressed: false,
      style: "regular",
    });
    await phraseFavouriteButton.click();
    await expectFavouriteToggleState(phraseFavouriteButton, {
      pressed: false,
      style: "regular",
    });
    assert.equal(await phraseFavouriteButton.isDisabled(), true);

    await waitForTextVisible(page, "Phrase favourite saved.");
    const removePhraseFavouriteButton = page.getByRole("button", {
      name: "Remove phrase 2 from favourites",
    });
    await expectFavouriteToggleState(removePhraseFavouriteButton, {
      pressed: true,
      style: "solid",
    });

    await removePhraseFavouriteButton.click();
    await expectFavouriteToggleState(removePhraseFavouriteButton, {
      pressed: true,
      style: "solid",
    });
    assert.equal(await removePhraseFavouriteButton.isDisabled(), true);
    await openFavouritesRoute(page);
    await waitForTextVisible(page, "No phrase favourites yet.");

    assertNoConsoleErrors();
  });

  it("shows delayed favourite saves in Favourites after the reveal is replaced", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(`${staticServer.origin}/?testPrivateFavourites=mutation-delays`);
    await page.getByRole("button", { name: "Test sign in" }).click();
    await assertTextVisible(page, "Account-backed mode");

    await page.getByRole("button", { name: "10" }).click();
    await page.getByRole("button", { name: "Start batch" }).click();

    const fillState = createFillState(10);
    await fillActiveSection(page, fillState);
    await fillActiveSection(page, fillState);
    await fillActiveSection(page, fillState);

    const copiedPhraseItem = page.locator("[data-phrase-list] li").nth(1);
    const copiedPhrase = await copiedPhraseItem.locator("span").first().innerText();
    const phraseFavouriteButton = page.getByRole("button", {
      name: "Save phrase 2 as favourite",
    });

    await phraseFavouriteButton.click();
    assert.equal(await phraseFavouriteButton.isDisabled(), true);

    await page.getByRole("button", { name: "Start again" }).click();
    await assertTextVisible(
      page,
      "Start a new batch? Your revealed phrases will be cleared from this browser.",
    );
    await page.getByRole("button", { name: "Start new batch" }).click();
    await assertRowCountSelected(page, "10");
    await page.waitForTimeout(700);
    await assertTextHidden(page, "Phrase favourite saved.");

    await openFavouritesRoute(page);
    await waitForFavouriteVisible(page, copiedPhrase);

    assertNoConsoleErrors();
  });

  it("keeps current-output favourite hearts regular when save fails", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(`${staticServer.origin}/?testPrivateFavourites=save-fails`);
    await page.getByRole("button", { name: "Test sign in" }).click();
    await assertTextVisible(page, "Account-backed mode");

    await page.getByRole("button", { name: "10" }).click();
    await page.getByRole("button", { name: "Start batch" }).click();

    const fillState = createFillState(10);
    await fillActiveSection(page, fillState);
    await fillActiveSection(page, fillState);
    await fillActiveSection(page, fillState);

    const phraseFavouriteButton = page.getByRole("button", {
      name: "Save phrase 2 as favourite",
    });
    await phraseFavouriteButton.click();
    await assertTextVisible(page, "Could not update phrase favourite.");
    await expectFavouriteToggleState(phraseFavouriteButton, {
      pressed: false,
      style: "regular",
    });
    assert.equal(await phraseFavouriteButton.isEnabled(), true);

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
    const copiedPhrase = await copiedPhraseItem.locator("span").first().innerText();
    await page.getByRole("button", { name: "Save phrase 2 as favourite" }).click();
    await assertTextVisible(page, "Phrase favourite saved.");
    await assertNoFavouritesPanelDom(page);
    await openFavouritesRoute(page);
    await assertFavouriteVisible(page, copiedPhrase);

    await page.getByRole("button", { name: /Remove phrase favourite/ }).click();
    await assertTextVisible(
      page,
      "Phrase favourite could not be removed. Try again.",
    );
    await assertFavouriteVisible(page, copiedPhrase);

    await openPlayRoute(page);
    await assertNoFavouritesPanelDom(page);
    assert.equal(
      await page
        .getByRole("button", { name: "Remove phrase 2 from favourites" })
        .isEnabled(),
      true,
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

function createPngFilePayload({ height, width }) {
  return {
    buffer: createPngBuffer({ height, width }),
    mimeType: "image/png",
    name: `avatar-${width}x${height}.png`,
  };
}

function createPngBuffer({ height, width }) {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const rowLength = 1 + width * 4;
  const pixels = Buffer.alloc(rowLength * height);
  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const rowOffset = rowIndex * rowLength;
    pixels[rowOffset] = 0;
    for (let columnIndex = 0; columnIndex < width; columnIndex += 1) {
      const pixelOffset = rowOffset + 1 + columnIndex * 4;
      pixels[pixelOffset] = 0x23;
      pixels[pixelOffset + 1] = 0x7a;
      pixels[pixelOffset + 2] = 0x5d;
      pixels[pixelOffset + 3] = 0xff;
    }
  }

  return Buffer.concat([
    signature,
    createPngChunk("IHDR", header),
    createPngChunk("IDAT", deflateSync(pixels)),
    createPngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function createPngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
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

async function waitForTextVisible(page, text) {
  await page.getByText(text).first().waitFor({ state: "visible" });
}

async function expectFontAwesomeClass(locator, ...classNames) {
  const icon = locator.locator("i").first();
  const className = await icon.getAttribute("class");
  for (const expectedClass of classNames) {
    assert.equal(className.includes(expectedClass), true);
  }
}

async function expectFavouriteToggleState(locator, { pressed, style }) {
  assert.equal(await locator.getAttribute("aria-pressed"), String(pressed));
  await expectFontAwesomeClass(locator, `fa-${style}`, "fa-heart");
}

async function assertTextHidden(page, text) {
  assert.equal(await page.getByText(text).first().isVisible(), false);
}

async function assertTextAbsent(page, text) {
  assert.equal(await page.getByText(text).count(), 0);
}

async function assertActiveElementMatches(page, { selector, accessibleName }) {
  const activeElement = await page.evaluate((expectedSelector) => {
    const active = document.activeElement;

    return {
      accessibleName:
        active?.getAttribute("aria-label") ?? active?.textContent?.trim() ?? "",
      matches: Boolean(active?.matches(expectedSelector)),
      tagName: active?.tagName ?? "",
    };
  }, selector);

  assert.equal(
    activeElement.matches,
    true,
    `Expected active element to match ${selector}, got ${activeElement.tagName} ${activeElement.accessibleName}`,
  );
  assert.equal(activeElement.accessibleName, accessibleName);
}

async function installFallbackClipboardWrite(page) {
  await page.evaluate(() => {
    const clipboard = navigator.clipboard;
    window.__testClipboardWriteOriginal = clipboard.writeText.bind(clipboard);
    window.__testClipboardExecCommandOriginal = document.execCommand?.bind(document);
    Object.defineProperty(clipboard, "writeText", {
      configurable: true,
      value: async () => {
        throw new Error("Forced clipboard fallback");
      },
    });
    document.execCommand = () => true;
  });
}

async function installDelayedClipboardWrite(page) {
  await page.evaluate(() => {
    const clipboard = navigator.clipboard;
    window.__testClipboardWriteOriginal = clipboard.writeText.bind(clipboard);
    let releaseFirstWrite;
    const firstWrite = new Promise((resolve) => {
      releaseFirstWrite = resolve;
    });
    window.__testClipboardWriteState = {
      releaseFirstWrite,
      texts: [],
    };
    Object.defineProperty(clipboard, "writeText", {
      configurable: true,
      value: async (text) => {
        window.__testClipboardWriteState.texts.push(text);
        if (window.__testClipboardWriteState.texts.length === 1) {
          await firstWrite;
        }
      },
    });
  });
}

async function restoreClipboardWrite(page) {
  await page.evaluate(() => {
    const clipboard = navigator.clipboard;
    if (window.__testClipboardWriteOriginal) {
      Object.defineProperty(clipboard, "writeText", {
        configurable: true,
        value: window.__testClipboardWriteOriginal,
      });
    }
    if (window.__testClipboardExecCommandOriginal) {
      document.execCommand = window.__testClipboardExecCommandOriginal;
    }
    delete window.__testClipboardWriteOriginal;
    delete window.__testClipboardExecCommandOriginal;
    delete window.__testClipboardWriteState;
  });
}

async function releaseDelayedClipboardWrite(page) {
  await page.evaluate(() => {
    window.__testClipboardWriteState?.releaseFirstWrite();
  });
}

async function getClipboardWriteTexts(page) {
  return page.evaluate(() => window.__testClipboardWriteState?.texts ?? []);
}

async function waitForRouteCopyButtonsDisabled(page) {
  await page.waitForFunction(() => {
    const buttons = [...document.querySelectorAll(
      "[data-copy-phrase-favourite-id], [data-copy-batch-favourite-id]",
    )];
    return buttons.length > 0 && buttons.every((button) => button.disabled);
  });
}

async function waitForRouteCopyButtonsEnabled(page) {
  await page.waitForFunction(() => {
    const buttons = [...document.querySelectorAll(
      "[data-copy-phrase-favourite-id], [data-copy-batch-favourite-id]",
    )];
    return buttons.length > 0 && buttons.every((button) => !button.disabled);
  });
}

async function assertNoFavouriteDom(page) {
  assert.equal(await page.locator("[data-favourites-panel]").count(), 0);
  assert.equal(await page.locator("[data-favourites-route]").count(), 0);
  assert.equal(await page.locator("[data-favourites-tab-panel]").count(), 0);
  assert.equal(await page.locator("[data-phrase-favourites-list]").count(), 0);
  assert.equal(await page.locator("[data-toggle-batch-favourite]").count(), 0);
  assert.equal(await page.locator("[data-toggle-phrase-favourite-index]").count(), 0);
}

async function assertNoFavouritesPanelDom(page) {
  assert.equal(await page.locator("[data-favourites-panel]").count(), 0);
  assert.equal(await page.locator("[data-favourites-status]").count(), 0);
  assert.equal(await page.locator("[data-phrase-favourites-list]").count(), 0);
}

async function openFavouritesRoute(page) {
  await page.getByRole("link", { name: "Favourites" }).click();
  await page.waitForFunction(
    () =>
      window.location.hash === "#/favourites" &&
      document.querySelectorAll("[data-favourites-panel]").length === 1,
  );
  assert.equal(new URL(page.url()).hash, "#/favourites");
}

async function openPlayRoute(page) {
  await page.getByRole("link", { name: "Play", exact: true }).click();
  await page.waitForFunction(
    () =>
      window.location.hash === "#/play/solo" &&
      document.querySelector("[data-game-panel]")?.hidden === false,
  );
  assert.equal(new URL(page.url()).hash, "#/play/solo");
}

async function openMultiplayerRoute(page) {
  await page.evaluate(() => {
    window.location.hash = "#/play/multiplayer";
  });
  await page.waitForFunction(
    () =>
      window.location.hash === "#/play/multiplayer" &&
      document.querySelectorAll("[data-pending-game-panel]").length === 1,
  );
  assert.equal(new URL(page.url()).hash, "#/play/multiplayer");
}

async function assertFavouriteSurfaceMounted(page) {
  assert.equal(await page.locator("[data-favourites-panel]").count(), 1);
  assert.equal(await page.locator("[data-favourites-route]").count(), 1);
  assert.equal(await page.getByRole("tab", { name: "Phrases" }).count(), 1);
  assert.equal(await page.getByRole("tab", { name: "Batches" }).count(), 1);
}

async function seedLocalTestPhraseFavourite(
  page,
  { accountId, favouriteId, phraseText },
) {
  await page.evaluate(
    ({ accountId: seedAccountId, favouriteId: seedFavouriteId, phraseText: seedPhraseText }) => {
      const favourite = {
        type: "phrase",
        sourceMode: "signed-in-solo",
        templateId: "default-adjective-noun-noun",
        rowIndex: 0,
        phraseText: seedPhraseText,
        entries: [
          {
            entryKind: "adjective",
            value: seedPhraseText,
            displayValue: seedPhraseText,
          },
        ],
      };
      const record = {
        id: seedFavouriteId,
        accountId: seedAccountId,
        favourite,
        createdAt: "2026-06-26T00:00:00.000Z",
      };
      const payload = {
        schemaVersion: 1,
        accountId: seedAccountId,
        favourites: [
          {
            fingerprint: JSON.stringify(favourite),
            record,
          },
        ],
      };
      window.localStorage.setItem(
        `crazyphrases.localTest.privatePhraseFavourites.v1.${encodeURIComponent(
          seedAccountId,
        )}`,
        JSON.stringify(payload),
      );
    },
    { accountId, favouriteId, phraseText },
  );
}

async function assertNoProfileEditorDom(page) {
  assert.equal(await page.locator("[data-account-profile-panel]").count(), 0);
  assert.equal(await page.locator("[data-account-profile-gamer-name]").count(), 0);
  assert.equal(await page.locator("[data-account-profile-handle]").count(), 0);
  assert.equal(await page.locator("[data-account-profile-avatar]").count(), 0);
  assert.equal(
    await page.locator("[data-account-profile-uploaded-avatar-input]").count(),
    0,
  );
  assert.equal(
    await page.locator("[data-account-profile-avatar-preview]").count(),
    0,
  );
  assert.equal(await page.locator("[data-account-profile-crop-controls]").count(), 0);
  assert.equal(await page.locator("[data-account-profile-crop-editor]").count(), 0);
  assert.equal(await page.locator("[data-account-profile-crop-box]").count(), 0);
  assert.equal(await page.locator("[data-account-profile-crop-editor-image]").count(), 0);
  assert.equal(await page.locator("[data-account-profile-crop-guide]").count(), 0);
  assert.equal(await page.locator("[data-account-profile-crop-marker]").count(), 0);
  assert.equal(await page.locator("[data-account-profile-crop-scale]").count(), 0);
  assert.equal(await page.locator("[data-account-profile-crop-x]").count(), 0);
  assert.equal(await page.locator("[data-account-profile-crop-y]").count(), 0);
}

async function assertProfileManagementSurfaceMounted(page) {
  assert.equal(await page.locator("[data-account-profile-panel]").count(), 1);
  const profileRegion = page.getByRole("region", { name: "Profile" });
  await assertTextVisible(profileRegion, "Profile");
  await assertTextVisible(profileRegion, "Gamer Name");
  assert.equal(
    await profileRegion.getByLabel("Gamer Name").inputValue(),
    "Player",
  );
  await assertTextVisible(profileRegion, "Handle");
  assert.equal(
    await profileRegion.getByLabel("Handle").inputValue(),
    "player-test-account",
  );
  await assertTextVisible(profileRegion, "Avatar");
  assert.equal(
    await profileRegion.locator("[data-account-profile-avatar]").inputValue(),
    "dice",
  );
  assert.equal(
    await profileRegion
      .locator("[data-account-profile-built-in-avatar-icon]")
      .getAttribute("data-avatar-key"),
    "dice",
  );
  assert.equal(
    await profileRegion.locator("[data-account-profile-uploaded-avatar-input]").count(),
    1,
  );
}

async function assertNoPendingGameDom(page) {
  assert.equal(await page.locator("[data-pending-game-panel]").count(), 0);
  assert.equal(await page.locator("[data-pending-game-handle-input]").count(), 0);
  assert.equal(await page.locator("[data-pending-game-nudge-timeout]").count(), 0);
  assert.equal(await page.locator("[data-pending-game-summary]").count(), 0);
}

async function assertPendingGameSurfaceMounted(page) {
  assert.equal(await page.locator("[data-pending-game-panel]").count(), 1);
  assert.equal(await page.locator("[data-pending-game-handle-input]").count(), 1);
  assert.equal(await page.locator("[data-pending-game-row-count]").count(), 1);
  assert.equal(await page.locator("[data-pending-game-nudge-timeout]").count(), 1);
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
  const phraseRows = page.locator(
    "[data-phrase-favourites-list] [data-favourite-kind=\"phrase\"]",
  );
  const phraseRowCount = await phraseRows.count();

  for (let index = 0; index < phraseRowCount; index += 1) {
    const row = phraseRows.nth(index);
    const phraseText = row.locator("[data-favourite-phrase-text]");
    if (
      (await phraseText.innerText()).trim() === phrase &&
      (await phraseText.isVisible())
    ) {
      return row;
    }
  }

  assert.equal(
    false,
    true,
    `Expected visible phrase favourite: ${phrase}`,
  );
}

async function assertFavouriteRowParticipantVisible(row, participantText) {
  const participant = row.locator(".favourite-row-participants");
  assert.equal(await participant.isVisible(), true);
  assert.equal(await participant.innerText(), participantText);
}

async function waitForFavouriteVisible(page, phrase) {
  await page.waitForFunction(
    (expectedPhrase) =>
      [...document.querySelectorAll("[data-phrase-favourites-list] > li")].some(
        (item) =>
          item.querySelector("[data-favourite-phrase-text]")?.textContent?.trim() ===
          expectedPhrase,
      ),
    phrase,
  );
}

async function assertBatchFavouriteVisible(page, batchCopy) {
  const batchLines = batchCopy.split("\n").slice(1);
  await page.getByRole("tab", { name: "Batches" }).click();
  const favouritesList = page.locator("[data-phrase-favourites-list]");
  const batchRow = favouritesList.locator("[data-favourite-kind=\"batch\"]").first();
  const batchTitle = batchRow.locator(".favourite-row-title");
  const batchDetail = batchRow.locator(".favourite-row-detail");
  const disclosureButton = batchRow.locator(
    "[data-toggle-batch-favourite-phrases]",
  );

  assert.equal(await batchRow.isVisible(), true);
  assert.equal(await batchTitle.isVisible(), true);

  assert.equal(
    await batchTitle.innerText(),
    "Batch favourite",
  );
  assert.equal(await batchDetail.isVisible(), true);
  assert.equal(
    await batchDetail.innerText(),
    `${batchLines.length} phrases`,
  );
  assert.equal(await disclosureButton.count(), 1);
  assert.equal(await disclosureButton.isVisible(), true);
  assert.equal(await disclosureButton.innerText(), "View phrases");
  return batchRow;
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
