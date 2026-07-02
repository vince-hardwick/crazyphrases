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
const LONG_TARGET_NOTIFICATION_MESSAGE =
  "Target notification with abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz.";
const LONG_STATIC_NOTIFICATION_MESSAGE =
  "Static notification with zyxwvutsrqponmlkjihgfedcbazyxwvutsrqponmlkjihgfedcbazyxwvutsrqponmlkjihgfedcba.";

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
    await assertAnonymousAccountIconVisible(page);
    await assertAnonymousSignInSurfaceClosed(page);
    assert.equal(await page.locator(".site-domain").count(), 0);
    await assertNoFavouriteDom(page);
    await assertNoProfileEditorDom(page);

    await signInWithLocalTestAccount(page);
    await assertTextVisible(page, "Account-backed mode");
    await assertTextVisible(page, "Player");
    await assertTextHidden(page, "@player-test-account");
    await assertProfileManagementSurfaceMounted(page);
    await assertNoFavouritesPanelDom(page);
    await openFavouritesRoute(page);
    await assertFavouriteSurfaceMounted(page);
    await openPlayRoute(page);
    assert.equal(await page.locator("[data-toggle-batch-favourite]").count(), 0);
    assert.equal(await page.locator("[data-toggle-phrase-favourite-index]").count(), 0);

    await page.getByRole("button", { name: "Sign out" }).click();
    await assertAnonymousAccountIconVisible(page);
    await assertAnonymousSignInSurfaceClosed(page);
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

  it("routes anonymous sign-in through the top-nav account icon", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await assertNoHorizontalOverflow(page);

    const accountSignIn = page.getByRole("button", { name: "Account sign in" });
    await expectFontAwesomeClass(accountSignIn, "fa-regular", "fa-circle-user");
    assert.equal(await page.locator("[data-test-sign-in-button]").isVisible(), false);
    assert.equal(await page.locator("[data-google-sign-in-button]").isVisible(), false);
    assert.equal(await page.locator("[data-email-sign-in-form]").isVisible(), false);

    await accountSignIn.click();

    assert.equal(await accountSignIn.getAttribute("aria-expanded"), "true");
    assert.equal(await page.locator("[data-test-sign-in-button]").isVisible(), true);
    await assertNoHorizontalOverflow(page);
    assertNoConsoleErrors();
  });

  it("renders hosted sign-in controls as icon-first actions", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await routeHostedAuthConfig(context);
    await context.addInitScript(() => {
      window.__hostedAuthCalls = [];
      window.supabase = {
        createClient: () => ({
          auth: {
            getUser: async () => ({
              data: { user: null },
              error: { name: "AuthSessionMissingError" },
            }),
            signInWithOAuth: async (request) => {
              window.__hostedAuthCalls.push({
                method: "signInWithOAuth",
                request,
              });
              return { data: {}, error: null };
            },
            signInWithOtp: async (request) => {
              window.__hostedAuthCalls.push({
                method: "signInWithOtp",
                request,
              });
              return { data: {}, error: null };
            },
            signOut: async () => ({ error: null }),
          },
          from: () => ({}),
          rpc: async () => ({ data: [], error: null }),
          storage: {
            from: () => ({}),
          },
        }),
      };
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await openAnonymousAccountSignIn(page);

    const googleSignIn = page.getByRole("button", { name: "Sign in with Google" });
    await expectFontAwesomeClass(googleSignIn, "fa-brands", "fa-google");
    assert.equal(await googleSignIn.getAttribute("data-tooltip"), "Sign in with Google");
    assert.equal(await visibleTextContent(googleSignIn), "");

    const emailFieldIcon = page.locator(".email-sign-in-field i");
    const emailFieldIconClass = await emailFieldIcon.getAttribute("class");
    assert.equal(emailFieldIconClass.includes("fa-at"), true);

    const sendLink = page.getByRole("button", { name: "Send link" });
    await expectFontAwesomeClass(sendLink, "fa-solid", "fa-paper-plane");
    assert.equal(await sendLink.getAttribute("data-tooltip"), "Send link");
    assert.equal(await visibleTextContent(sendLink), "");

    await page.locator("[data-email-sign-in-input]").fill("player@example.test");
    await sendLink.click();
    await googleSignIn.click();

    assert.deepEqual(await page.evaluate(() => window.__hostedAuthCalls), [
      {
        method: "signInWithOtp",
        request: {
          email: "player@example.test",
          options: {
            emailRedirectTo: `${staticServer.origin}/`,
          },
        },
      },
      {
        method: "signInWithOAuth",
        request: {
          provider: "google",
          options: {
            redirectTo: `${staticServer.origin}/`,
          },
        },
      },
    ]);
    await assertNoHorizontalOverflow(page);
    assertNoConsoleErrors();
  });

  it("shows a regular notification bell when there are no unread notifications", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);

    const notificationButton = page.getByRole("button", { name: "Notifications" });
    assert.equal(await notificationButton.isVisible(), true);
    await expectFontAwesomeClass(notificationButton, "fa-regular", "fa-bell");
    assert.equal((await notificationButton.innerText()).includes("!"), false);
    assert.equal(
      await notificationButton.evaluate((button) => button.dataset.unreadCount),
      "0",
    );

    await notificationButton.evaluate((button) => {
      const icon = button.querySelector("i");
      icon.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await assertTextVisible(
      page.locator("[data-notification-panel]"),
      "You have no notifications yet.",
    );

    assertNoConsoleErrors();
  });

  it("opens the notification panel without marking unread notifications read", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await routeSeededNotificationRepository(context);

    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);

    const notificationToggle = page.locator("[data-notification-toggle]");
    assert.equal(
      await page.getByRole("button", { name: "Notifications, 2 unread" }).isVisible(),
      true,
    );
    assert.equal(await notificationToggle.evaluate((button) => button.dataset.unreadCount), "2");

    await notificationToggle.click();

    await assertTextVisible(
      page.locator("[data-notification-panel]"),
      "Newest unread notification.",
    );
    assert.deepEqual(
      await page.evaluate(() => window.__notificationReadCalls),
      [],
    );
    assert.equal(await notificationToggle.evaluate((button) => button.dataset.unreadCount), "2");

    assertNoConsoleErrors();
  });

  it("renders mixed notifications in scan order without visible read-state labels", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await routeSeededNotificationRepository(context);

    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);
    await page.locator("[data-notification-toggle]").click();

    const notificationItems = page.locator("[data-notification-panel] .notification-item");
    assert.equal(await notificationItems.count(), 3);
    assert.deepEqual(await notificationItems.allInnerTexts(), [
      "Newest unread notification.",
      "Older unread notification.",
      "Already read notification.",
    ]);
    assert.equal(
      await notificationItems.nth(0).getAttribute("aria-label"),
      "Unread: Newest unread notification. Open Multiplayer",
    );
    assert.equal(
      await notificationItems.nth(1).getAttribute("aria-label"),
      "Unread: Older unread notification. Open Multiplayer",
    );
    assert.equal(
      await notificationItems.nth(2).getAttribute("aria-label"),
      "Read: Already read notification. Open Multiplayer",
    );
    const itemStyles = await notificationItems.evaluateAll((items) =>
      items.map((item) => ({
        status: item.getAttribute("data-notification-status"),
        fontWeight: Number.parseInt(window.getComputedStyle(item).fontWeight, 10),
      })),
    );
    assert.deepEqual(
      itemStyles.map(({ status }) => status),
      ["unread", "unread", "read"],
    );
    assert.ok(
      itemStyles[0].fontWeight > itemStyles[2].fontWeight,
      `Expected unread item to be visually distinct from read item, got ${JSON.stringify(
        itemStyles,
      )}`,
    );
    assert.ok(
      itemStyles[1].fontWeight > itemStyles[2].fontWeight,
      `Expected unread item to be visually distinct from read item, got ${JSON.stringify(
        itemStyles,
      )}`,
    );
    await assertNoHorizontalOverflow(page);

    assertNoConsoleErrors();
  });

  it("keeps several mixed notification rows usable on narrow mobile", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 360, height: 780 },
    });
    await routeSeededNotificationRepository(context, {
      includeLongNotificationMessages: true,
      includeStaticNotifications: true,
    });

    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);

    const notificationToggle = page.locator("[data-notification-toggle]");
    assert.equal(
      await page.getByRole("button", { name: "Notifications, 4 unread" }).isVisible(),
      true,
    );
    await expectFontAwesomeClass(notificationToggle, "fa-solid", "fa-bell");
    await notificationToggle.click();

    const notificationPanel = page.locator("[data-notification-panel]");
    const notificationItems = notificationPanel.locator(".notification-item");
    assert.equal(await notificationItems.count(), 7);
    assert.deepEqual(await notificationItems.allInnerTexts(), [
      LONG_TARGET_NOTIFICATION_MESSAGE,
      "Newest unread notification.",
      "Older unread notification.",
      "Static unread notification.",
      LONG_STATIC_NOTIFICATION_MESSAGE,
      "Already read notification.",
      "Static read notification.",
    ]);
    assert.deepEqual(
      await notificationItems.evaluateAll((items) =>
        items.map((item) => ({
          status: item.getAttribute("data-notification-status"),
          tagName: item.tagName,
        })),
      ),
      [
        { status: "unread", tagName: "BUTTON" },
        { status: "unread", tagName: "BUTTON" },
        { status: "unread", tagName: "BUTTON" },
        { status: "unread", tagName: "DIV" },
        { status: "read", tagName: "DIV" },
        { status: "read", tagName: "BUTTON" },
        { status: "read", tagName: "DIV" },
      ],
    );
    assert.equal(
      await notificationItems.nth(0).getAttribute("aria-label"),
      `Unread: ${LONG_TARGET_NOTIFICATION_MESSAGE} Open Multiplayer`,
    );
    assert.equal(
      await notificationItems.nth(4).getAttribute("aria-label"),
      `Read: ${LONG_STATIC_NOTIFICATION_MESSAGE} Notification`,
    );
    assert.equal(
      await notificationPanel
        .getByRole("button", { name: "Mark all as read" })
        .count(),
      1,
    );
    await expectFontAwesomeClass(
      notificationPanel.getByRole("button", { name: "Mark all as read" }),
      "fa-solid",
      "fa-list-check",
    );
    assert.equal(
      await notificationPanel.locator("[data-notification-mark-read] i.fa-solid.fa-circle-check").count(),
      4,
    );
    assert.equal(
      await notificationPanel.getByText("Unread", { exact: true }).count(),
      0,
    );
    assert.equal(
      await notificationPanel.getByText("Read", { exact: true }).count(),
      0,
    );
    await assertNoHorizontalOverflow(page);

    assertNoConsoleErrors();
  });

  it("marks an unread target notification read from its row action without routing", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await routeSeededNotificationRepository(context);

    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);
    await openFavouritesRoute(page);
    assert.equal(new URL(page.url()).hash, "#/favourites");

    const notificationToggle = page.locator("[data-notification-toggle]");
    const notificationPanel = page.locator("[data-notification-panel]");
    await notificationToggle.click();

    const notificationItems = page.locator("[data-notification-panel] .notification-item");
    assert.deepEqual(await notificationItems.allInnerTexts(), [
      "Newest unread notification.",
      "Older unread notification.",
      "Already read notification.",
    ]);

    const markReadButton = page.getByRole("button", {
      name: "Mark notification as read: Newest unread notification.",
    });
    assert.equal(await markReadButton.count(), 1);
    await expectFontAwesomeClass(markReadButton, "fa-solid", "fa-circle-check");

    await markReadButton.click();
    await page.waitForFunction(
      () =>
        document.querySelector("[data-notification-toggle]")?.dataset
          .unreadCount === "1",
    );

    assert.equal(new URL(page.url()).hash, "#/favourites");
    assert.equal(await notificationPanel.isVisible(), true);
    assert.deepEqual(await page.evaluate(() => window.__notificationReadCalls), [
      {
        accountId: "test-account",
        notificationId: "notification-unread-newest",
      },
    ]);
    assert.equal(await markReadButton.count(), 0);
    assert.deepEqual(await notificationItems.allInnerTexts(), [
      "Newest unread notification.",
      "Older unread notification.",
      "Already read notification.",
    ]);
    assert.equal(
      await notificationItems.nth(0).getAttribute("aria-label"),
      "Read: Newest unread notification. Open Multiplayer",
    );
    assert.equal(
      await notificationItems.nth(0).getAttribute("data-notification-status"),
      "read",
    );
    assert.equal(await notificationToggle.evaluate((button) => button.dataset.unreadCount), "1");
    await assertActiveElementMatches(page, {
      selector: "[data-notification-panel] .notification-item",
      accessibleName: "Read: Newest unread notification. Open Multiplayer",
    });

    assertNoConsoleErrors();
  });

  it("marks an unread non-target notification read from its static row action", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await routeSeededNotificationRepository(context, {
      includeStaticNotifications: true,
    });

    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);
    await openFavouritesRoute(page);
    assert.equal(new URL(page.url()).hash, "#/favourites");

    const notificationToggle = page.locator("[data-notification-toggle]");
    const notificationPanel = page.locator("[data-notification-panel]");
    await notificationToggle.click();

    const staticUnreadItem = page
      .locator("[data-notification-panel] .notification-item")
      .filter({ hasText: "Static unread notification." });
    const staticReadItem = page
      .locator("[data-notification-panel] .notification-item")
      .filter({ hasText: "Static read notification." });
    assert.equal(await staticUnreadItem.evaluate((item) => item.tagName), "DIV");
    assert.equal(await staticReadItem.evaluate((item) => item.tagName), "DIV");
    assert.equal(
      await page.getByRole("button", {
        name: "Unread: Static unread notification. Notification",
      }).count(),
      0,
    );
    assert.equal(
      await staticUnreadItem.getAttribute("aria-label"),
      "Unread: Static unread notification. Notification",
    );
    assert.equal(
      await staticReadItem.getAttribute("aria-label"),
      "Read: Static read notification. Notification",
    );
    assert.equal(
      await page.getByRole("button", {
        name: "Mark notification as read: Static read notification.",
      }).count(),
      0,
    );

    await staticUnreadItem.click();
    assert.equal(new URL(page.url()).hash, "#/favourites");
    assert.equal(await notificationPanel.isVisible(), true);
    assert.deepEqual(await page.evaluate(() => window.__notificationReadCalls), []);

    const markReadButton = page.getByRole("button", {
      name: "Mark notification as read: Static unread notification.",
    });
    assert.equal(await markReadButton.count(), 1);
    await expectFontAwesomeClass(markReadButton, "fa-solid", "fa-circle-check");

    await markReadButton.click();
    await page.waitForFunction(
      () =>
        document.querySelector("[data-notification-toggle]")?.dataset
          .unreadCount === "2",
    );

    assert.equal(new URL(page.url()).hash, "#/favourites");
    assert.equal(await notificationPanel.isVisible(), true);
    assert.deepEqual(await page.evaluate(() => window.__notificationReadCalls), [
      {
        accountId: "test-account",
        notificationId: "notification-unread-static",
      },
    ]);
    assert.equal(
      await staticUnreadItem.getAttribute("aria-label"),
      "Read: Static unread notification. Notification",
    );
    assert.equal(
      await staticUnreadItem.getAttribute("data-notification-status"),
      "read",
    );
    assert.equal(await markReadButton.count(), 0);
    await assertActiveElementMatches(page, {
      selector: "[data-notification-panel] .notification-item",
      accessibleName: "Read: Static unread notification. Notification",
    });

    assertNoConsoleErrors();
  });

  it("keeps row-level notification read failures in place with panel feedback", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await routeSeededNotificationRepository(context, {
      failingNotificationIds: ["notification-unread-oldest"],
    });

    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);
    await openFavouritesRoute(page);

    const notificationToggle = page.locator("[data-notification-toggle]");
    const notificationPanel = page.locator("[data-notification-panel]");
    await notificationToggle.click();

    const markReadButton = page.getByRole("button", {
      name: "Mark notification as read: Older unread notification.",
    });
    await markReadButton.click();

    const notificationFeedback = page.locator(
      "[data-notification-panel] [role='status']",
    );
    await notificationFeedback.waitFor({ state: "visible" });

    assert.equal(new URL(page.url()).hash, "#/favourites");
    assert.equal(await notificationPanel.isVisible(), true);
    assert.equal(
      await notificationFeedback.innerText(),
      "Notification could not be marked read. Try again.",
    );
    assert.deepEqual(await page.evaluate(() => window.__notificationReadCalls), [
      {
        accountId: "test-account",
        notificationId: "notification-unread-oldest",
      },
    ]);
    assert.equal(await notificationToggle.evaluate((button) => button.dataset.unreadCount), "2");
    assert.equal(await markReadButton.count(), 1);
    const failedItem = page
      .locator("[data-notification-panel] .notification-item")
      .filter({ hasText: "Older unread notification." });
    assert.equal(
      await failedItem.getAttribute("aria-label"),
      "Unread: Older unread notification. Open Multiplayer",
    );
    assert.equal(
      await failedItem.getAttribute("data-notification-status"),
      "unread",
    );

    assertNoConsoleErrors();
  });

  it("marks the loaded notification list read from the bulk panel action", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await routeSeededNotificationRepository(context);

    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);
    await openFavouritesRoute(page);

    const notificationToggle = page.locator("[data-notification-toggle]");
    const notificationPanel = page.locator("[data-notification-panel]");
    await notificationToggle.click();

    const bulkMarkReadButton = page.getByRole("button", {
      name: "Mark all as read",
    });
    assert.equal(await bulkMarkReadButton.count(), 1);
    await expectFontAwesomeClass(bulkMarkReadButton, "fa-solid", "fa-list-check");

    await bulkMarkReadButton.click();
    await page.waitForFunction(
      () =>
        document.querySelector("[data-notification-toggle]")?.dataset
          .unreadCount === "0",
    );

    assert.equal(new URL(page.url()).hash, "#/favourites");
    assert.equal(await notificationPanel.isVisible(), true);
    assert.deepEqual(await page.evaluate(() => window.__notificationReadCalls), [
      {
        accountId: "test-account",
        notificationId: "notification-unread-newest",
      },
      {
        accountId: "test-account",
        notificationId: "notification-unread-oldest",
      },
    ]);
    assert.equal(await notificationToggle.evaluate((button) => button.dataset.unreadCount), "0");
    assert.equal(await bulkMarkReadButton.count(), 0);
    assert.equal(
      await page
        .getByRole("button", {
          name: "Mark notification as read: Newest unread notification.",
        })
        .count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", {
          name: "Mark notification as read: Older unread notification.",
        })
        .count(),
      0,
    );
    const notificationItems = page.locator("[data-notification-panel] .notification-item");
    assert.deepEqual(await notificationItems.allInnerTexts(), [
      "Newest unread notification.",
      "Older unread notification.",
      "Already read notification.",
    ]);
    assert.equal(
      await notificationItems.nth(0).getAttribute("data-notification-status"),
      "read",
    );
    assert.equal(
      await notificationItems.nth(1).getAttribute("data-notification-status"),
      "read",
    );
    assert.equal(
      await page.evaluate(() => document.activeElement?.dataset?.notificationPanel),
      "",
    );

    assertNoConsoleErrors();
  });

  it("keeps failed notifications unread after a partial bulk read failure", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await routeSeededNotificationRepository(context, {
      failingNotificationIds: ["notification-unread-oldest"],
    });

    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);
    await openFavouritesRoute(page);

    const notificationToggle = page.locator("[data-notification-toggle]");
    const notificationPanel = page.locator("[data-notification-panel]");
    await notificationToggle.click();

    const bulkMarkReadButton = page.getByRole("button", {
      name: "Mark all as read",
    });
    await bulkMarkReadButton.click();

    const notificationFeedback = page.locator(
      "[data-notification-panel] [role='status']",
    );
    await notificationFeedback.waitFor({ state: "visible" });

    assert.equal(new URL(page.url()).hash, "#/favourites");
    assert.equal(await notificationPanel.isVisible(), true);
    assert.deepEqual(await page.evaluate(() => window.__notificationReadCalls), [
      {
        accountId: "test-account",
        notificationId: "notification-unread-newest",
      },
      {
        accountId: "test-account",
        notificationId: "notification-unread-oldest",
      },
    ]);
    assert.equal(
      await notificationFeedback.innerText(),
      "Some notifications could not be marked read. Try again.",
    );
    assert.equal(await notificationToggle.evaluate((button) => button.dataset.unreadCount), "1");
    assert.equal(await bulkMarkReadButton.count(), 1);
    await assertActiveElementMatches(page, {
      selector: "[data-notification-mark-all-read]",
      accessibleName: "Mark all as read",
    });

    const notificationItems = page.locator("[data-notification-panel] .notification-item");
    assert.equal(
      await notificationItems.nth(0).getAttribute("data-notification-status"),
      "read",
    );
    assert.equal(
      await notificationItems.nth(1).getAttribute("data-notification-status"),
      "unread",
    );
    assert.equal(
      await page
        .getByRole("button", {
          name: "Mark notification as read: Newest unread notification.",
        })
        .count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", {
          name: "Mark notification as read: Older unread notification.",
        })
        .count(),
      1,
    );

    assertNoConsoleErrors();
  });

  it("keeps a target notification unread when the Multiplayer target is missing", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await routeSeededNotificationRepository(context);
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);
    await openFavouritesRoute(page);
    assert.equal(new URL(page.url()).hash, "#/favourites");

    await page.getByRole("button", { name: "Notifications, 2 unread" }).click();
    const notificationItem = page
      .locator("[data-notification-panel] .notification-item")
      .filter({ hasText: "Newest unread notification." });
    assert.equal(await notificationItem.count(), 1);
    await notificationItem.click();

    await page.waitForFunction(
      () =>
        window.location.hash === "#/play/multiplayer" &&
        document.querySelectorAll("[data-pending-game-panel]").length === 1,
    );
    await page.waitForFunction(
      () =>
        window.__notificationReadCalls.length > 0 ||
        document
          .querySelector("[data-pending-game-status]")
          ?.textContent.includes("Notification target could not be found."),
    );

    assert.equal(new URL(page.url()).hash, "#/play/multiplayer");
    assert.deepEqual(await page.evaluate(() => window.__notificationReadCalls), []);
    assert.equal(
      await page.locator("[data-notification-panel]").isHidden(),
      true,
    );
    await assertTextVisible(
      page,
      "Notification target could not be found. It may no longer be available.",
    );
    await page.waitForFunction(
      () =>
        document.querySelector("[data-notification-toggle]")?.dataset
          .unreadCount === "2",
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Notifications, 2 unread" })
        .isVisible(),
      true,
    );

    assertNoConsoleErrors();
  });

  it("keeps a nudge notification unread when its assignment target is mismatched", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await routeSeededNotificationRepository(context, {
      includeMismatchedTargetNotification: true,
      includeTargetDashboard: true,
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);
    await openFavouritesRoute(page);
    await page.getByRole("button", { name: "Notifications, 3 unread" }).click();
    await page
      .locator("[data-notification-panel] .notification-item")
      .filter({ hasText: "Mismatched assignment notification." })
      .click();

    await page.waitForFunction(
      () =>
        window.location.hash === "#/play/multiplayer" &&
        document
          .querySelector("[data-pending-game-status]")
          ?.textContent.includes("Notification target could not be found."),
    );
    await assertTextVisible(page, "Awaiting your entries");
    assert.deepEqual(await page.evaluate(() => window.__notificationReadCalls), []);
    assert.equal(
      await page
        .getByRole("button", { name: "Notifications, 3 unread" })
        .isVisible(),
      true,
    );

    assertNoConsoleErrors();
  });

  it("keeps a target notification unread when read persistence fails after routing", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await routeSeededNotificationRepository(context, {
      failingNotificationIds: ["notification-unread-newest"],
      includeTargetDashboard: true,
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);
    await openFavouritesRoute(page);
    await page.getByRole("button", { name: "Notifications, 2 unread" }).click();
    await page
      .locator("[data-notification-panel] .notification-item")
      .filter({ hasText: "Newest unread notification." })
      .click();

    await page.waitForFunction(
      () =>
        window.location.hash === "#/play/multiplayer" &&
        document.querySelectorAll("[data-pending-game-panel]").length === 1,
    );
    await assertTextVisible(page, "Awaiting your entries");
    await assertTextVisible(page, "Notification could not be marked read. Try again.");
    assert.deepEqual(await page.evaluate(() => window.__notificationReadCalls), [
      {
        accountId: "test-account",
        notificationId: "notification-unread-newest",
      },
    ]);
    await page.waitForFunction(
      () =>
        document.querySelector("[data-notification-toggle]")?.dataset
          .unreadCount === "2",
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Notifications, 2 unread" })
        .isVisible(),
      true,
    );
    assert.equal(
      await page.locator("[data-notification-panel]").isHidden(),
      true,
    );

    assertNoConsoleErrors();
  });

  it("marks duplicate unread notifications for the exact rendered target together", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await routeSeededNotificationRepository(context, {
      includeDuplicateTargetNotifications: true,
      includeTargetDashboard: true,
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);
    await openFavouritesRoute(page);
    await page.getByRole("button", { name: "Notifications, 3 unread" }).click();
    await page
      .locator("[data-notification-panel] .notification-item")
      .filter({ hasText: "Newest unread notification." })
      .click();

    await page.waitForFunction(
      () =>
        window.location.hash === "#/play/multiplayer" &&
        document.querySelector("[data-notification-toggle]")?.dataset
          .unreadCount === "1",
    );
    assert.deepEqual(await page.evaluate(() => window.__notificationReadCalls), [
      {
        accountId: "test-account",
        notificationId: "notification-unread-newest",
      },
      {
        accountId: "test-account",
        notificationId: "notification-unread-nudge",
      },
    ]);
    await assertTextVisible(page, "Awaiting your entries");
    assert.equal(
      await page
        .getByRole("button", { name: "Notifications, 1 unread" })
        .isVisible(),
      true,
    );

    assertNoConsoleErrors();
  });

  it("marks a Pending Game target notification read after the invite is rendered", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await routeSeededNotificationRepository(context, {
      includePendingTargetInvite: true,
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);
    await openFavouritesRoute(page);
    await page.getByRole("button", { name: "Notifications, 2 unread" }).click();
    await page
      .locator("[data-notification-panel] .notification-item")
      .filter({ hasText: "Older unread notification." })
      .click();

    await page.waitForFunction(
      () =>
        window.location.hash === "#/play/multiplayer" &&
        document.querySelector("[data-notification-toggle]")?.dataset
          .unreadCount === "1",
    );
    assert.deepEqual(await page.evaluate(() => window.__notificationReadCalls), [
      {
        accountId: "test-account",
        notificationId: "notification-unread-oldest",
      },
    ]);
    await assertTextVisible(page, "Incoming invites");
    await assertTextVisible(page, "Waiting for responses");

    assertNoConsoleErrors();
  });

  it("marks a completed-batch target notification read after the batch is rendered", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await routeSeededNotificationRepository(context, {
      includeCompletedTargetNotification: true,
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);
    await openFavouritesRoute(page);
    await page.getByRole("button", { name: "Notifications, 3 unread" }).click();
    await page
      .locator("[data-notification-panel] .notification-item")
      .filter({ hasText: "Completed batch notification." })
      .click();

    await page.waitForFunction(
      () =>
        window.location.hash === "#/play/multiplayer" &&
        document.querySelector("[data-notification-toggle]")?.dataset
          .unreadCount === "2",
    );
    assert.deepEqual(await page.evaluate(() => window.__notificationReadCalls), [
      {
        accountId: "test-account",
        notificationId: "notification-unread-completed",
      },
    ]);
    await assertTextVisible(page, "Batches completed");
    await assertTextVisible(page, "Reveal phrases");

    assertNoConsoleErrors();
  });

  it("quietly marks matching notifications read when the target route is opened directly", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await routeSeededNotificationRepository(context, {
      includeTargetDashboard: true,
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);
    await openMultiplayerRoute(page);

    await page.waitForFunction(
      () =>
        document.querySelector("[data-notification-toggle]")?.dataset
          .unreadCount === "1",
    );
    assert.deepEqual(await page.evaluate(() => window.__notificationReadCalls), [
      {
        accountId: "test-account",
        notificationId: "notification-unread-newest",
      },
    ]);
    await assertTextVisible(page, "Awaiting your entries");
    assert.equal(await page.locator("[data-notification-panel]").isHidden(), true);
    assert.equal(
      await page.locator("[data-pending-game-status]").innerText(),
      "",
    );

    assertNoConsoleErrors();
  });

  it("closes the notification panel without marking notifications read", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await routeSeededNotificationRepository(context);

    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);

    const notificationToggle = page.locator("[data-notification-toggle]");
    const notificationPanel = page.locator("[data-notification-panel]");

    await notificationToggle.click();
    assert.equal(await notificationPanel.isVisible(), true);
    assert.equal(
      await page.evaluate(() => document.activeElement?.dataset?.notificationPanel),
      "",
    );

    await page.keyboard.press("Escape");
    assert.equal(await notificationPanel.isHidden(), true);
    assert.equal(
      await page.evaluate(() => document.activeElement?.dataset?.notificationToggle),
      "",
    );

    await notificationToggle.click();
    assert.equal(await notificationPanel.isVisible(), true);
    await page.locator("main").click({ position: { x: 5, y: 5 } });
    assert.equal(await notificationPanel.isHidden(), true);
    assert.equal(
      await page.evaluate(() => document.activeElement?.dataset?.notificationToggle),
      "",
    );
    assert.deepEqual(
      await page.evaluate(() => window.__notificationReadCalls),
      [],
    );
    assert.equal(await notificationToggle.evaluate((button) => button.dataset.unreadCount), "2");

    assertNoConsoleErrors();
  });

  it("removes populated notification DOM after sign-out", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await routeSeededNotificationRepository(context, {
      includeStaticNotifications: true,
    });

    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);
    await openFavouritesRoute(page);
    await page.getByRole("button", { name: "Notifications, 3 unread" }).click();
    assert.equal(await page.locator("[data-notification-panel]").isVisible(), true);
    assert.equal(await page.locator("[data-notification-row]").count(), 5);

    await page.getByRole("button", { name: "Sign out" }).focus();
    await page.keyboard.press("Enter");

    await assertAnonymousAccountIconVisible(page);
    assert.equal(new URL(page.url()).hash, "#/play/solo");
    await assertNoNotificationDom(page);
    await assertNoFavouriteDom(page);
    await assertNoPendingGameDom(page);
    await assertNoProfileEditorDom(page);

    assertNoConsoleErrors();
  });

  it("routes signed-in play modes from the Play menu", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);

    await page.getByRole("button", { name: "Play", exact: true }).click();
    const playMenu = page.getByRole("menu", { name: "Play Game Modes" });
    assert.equal(await playMenu.isVisible(), true);
    assert.equal(await playMenu.getByRole("menuitem", { name: "Solo play" }).count(), 1);
    assert.equal(await playMenu.getByRole("menuitem", { name: "Multiplayer" }).count(), 1);
    assert.equal(await playMenu.getByRole("menuitem", { name: /vs cpu/i }).count(), 0);
    await assertNoHorizontalOverflow(page);

    await playMenu.getByRole("menuitem", { name: "Multiplayer" }).click();
    await page.waitForFunction(
      () =>
        window.location.hash === "#/play/multiplayer" &&
        document.querySelectorAll("[data-pending-game-panel]").length === 1,
    );
    assert.equal(new URL(page.url()).hash, "#/play/multiplayer");

    assertNoConsoleErrors();
  });

  it("marks the current Game Mode inside the Play menu", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);

    await page.getByRole("button", { name: "Play", exact: true }).click();
    let playMenu = page.getByRole("menu", { name: "Play Game Modes" });
    assert.equal(
      await playMenu
        .getByRole("menuitem", { name: "Solo play" })
        .getAttribute("aria-current"),
      "page",
    );
    assert.equal(
      await playMenu
        .getByRole("menuitem", { name: "Multiplayer" })
        .getAttribute("aria-current"),
      null,
    );

    await playMenu.getByRole("menuitem", { name: "Multiplayer" }).click();
    await page.waitForFunction(() => window.location.hash === "#/play/multiplayer");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    playMenu = page.getByRole("menu", { name: "Play Game Modes" });
    assert.equal(
      await playMenu
        .getByRole("menuitem", { name: "Multiplayer" })
        .getAttribute("aria-current"),
      "page",
    );

    assertNoConsoleErrors();
  });

  it("keeps Solo and Multiplayer as exclusive Play destinations without discarding Solo progress", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);
    await page.getByRole("button", { name: "Start batch" }).click();
    await waitForDice(page);
    await page.locator("[data-row-index='0']").fill("brisk");

    assert.equal(await page.locator("[data-game-panel]").isVisible(), true);
    assert.equal(await page.locator("[data-pending-game-panel]").count(), 0);
    assert.equal(await page.locator("[data-pending-game-form]").count(), 0);
    assert.equal(await page.getByRole("button", { name: "Notifications" }).isVisible(), true);

    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page
      .getByRole("menu", { name: "Play Game Modes" })
      .getByRole("menuitem", { name: "Multiplayer" })
      .click();
    await page.waitForFunction(
      () =>
        window.location.hash === "#/play/multiplayer" &&
        document.querySelectorAll("[data-pending-game-panel]").length === 1,
    );
    assert.equal(await page.locator("[data-game-panel]").isHidden(), true);
    assert.equal(await page.locator("[data-pending-game-panel]").isVisible(), true);
    assert.equal(await page.locator("[data-row-index='0']").isHidden(), true);

    await openPlayRoute(page);
    assert.equal(await page.locator("[data-game-panel]").isVisible(), true);
    assert.equal(await page.locator("[data-pending-game-panel]").count(), 0);
    assert.equal(await page.locator("[data-row-index='0']").inputValue(), "brisk");
    assert.equal(await page.locator("[data-start-again-confirmation]").isHidden(), true);

    assertNoConsoleErrors();
  });

  it("preserves a revealed Solo batch when switching through Multiplayer", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);
    await page.getByRole("button", { name: "10" }).click();
    await page.getByRole("button", { name: "Start batch" }).click();
    const fillState = createFillState(10);
    await fillActiveSection(page, fillState);
    await fillActiveSection(page, fillState);
    await fillActiveSection(page, fillState);
    await assertTextVisible(page, "Your crazy phrases");
    const revealedPhrases = await page.locator("[data-phrase-list] li").allTextContents();
    assert.equal(revealedPhrases.length, 10);

    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page
      .getByRole("menu", { name: "Play Game Modes" })
      .getByRole("menuitem", { name: "Multiplayer" })
      .click();
    await page.waitForFunction(
      () =>
        window.location.hash === "#/play/multiplayer" &&
        document.querySelectorAll("[data-pending-game-panel]").length === 1,
    );
    assert.equal(await page.locator("[data-reveal-panel]").isHidden(), true);

    await openPlayRoute(page);
    await assertTextVisible(page, "Your crazy phrases");
    assert.deepEqual(
      await page.locator("[data-phrase-list] li").allTextContents(),
      revealedPhrases,
    );
    assert.equal(await page.locator("[data-pending-game-panel]").count(), 0);
    assert.equal(await page.locator("[data-start-again-confirmation]").isHidden(), true);

    assertNoConsoleErrors();
  });

  it("keeps signed-in Solo exclusive when pending Multiplayer creation finishes late", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await delayLocalTestPendingGameInviteCreation(context);
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page
      .getByRole("menu", { name: "Play Game Modes" })
      .getByRole("menuitem", { name: "Multiplayer" })
      .click();
    await page.waitForFunction(
      () =>
        window.location.hash === "#/play/multiplayer" &&
        document.querySelectorAll("[data-pending-game-panel]").length === 1,
    );

    await page.locator("[data-pending-game-lookup-key-input]").fill("INVITEE TWO");
    await page.locator("[data-pending-game-row-count]").selectOption("15");
    await page.locator("[data-pending-game-nudge-timeout]").selectOption("72");
    await page.getByRole("button", { name: "Create invite" }).click();
    await page.waitForFunction(() => window.__pendingGameCreateStarted === true);

    await openPlayRoute(page);
    assert.equal(await page.locator("[data-game-panel]").isVisible(), true);
    assert.equal(await page.locator("[data-pending-game-panel]").count(), 0);

    await releaseDelayedPendingGameInviteCreation(page);
    await page.waitForTimeout(100);
    assert.equal(new URL(page.url()).hash, "#/play/solo");
    assert.equal(await page.locator("[data-game-panel]").isVisible(), true);
    assert.equal(await page.locator("[data-pending-game-panel]").count(), 0);

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

    await signInWithLocalTestAccount(page);
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
    await assertAnonymousAccountIconVisible(page);
    await assertRowCountSelected(page, "15");

    await signInWithLocalTestAccount(page);
    await waitForDice(page);
    await assertTextVisible(page, "Account-backed mode");
    assert.equal(await page.locator("[data-section-title]").innerText(), signedInSectionTitle);
    assert.equal(await page.locator("[data-row-index]").count(), 10);
    await assertNoHorizontalOverflow(page);

    assertNoConsoleErrors();
  });

  it("updates a signed-in profile Gamer Tag in local test mode", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);
    await page.getByLabel("Gamer Tag").fill("Captain Spoon");
    await page.getByRole("button", { name: "Save profile" }).click();

    await assertTextVisible(page, "Profile saved.");
    assert.equal(
      await page.getByLabel("Gamer Tag").inputValue(),
      "Captain Spoon",
    );

    await page.getByRole("button", { name: "Sign out" }).click();
    await assertNoProfileEditorDom(page);
    await signInWithLocalTestAccount(page);

    assert.equal(
      await page.getByLabel("Gamer Tag").inputValue(),
      "Captain Spoon",
    );
    await assertNoHorizontalOverflow(page);

    assertNoConsoleErrors();
  });

  it("normalises blank or whitespace signed-in profile Gamer Tag input safely", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);
    const profileRegion = page.getByRole("region", { name: "Profile" });

    await profileRegion.getByLabel("Gamer Tag").fill("");
    await profileRegion.getByRole("button", { name: "Save profile" }).click();

    await assertTextVisible(profileRegion, "Profile saved.");
    assert.equal(
      await profileRegion.getByLabel("Gamer Tag").inputValue(),
      "Player",
    );

    await profileRegion.getByLabel("Gamer Tag").fill("   ");
    await profileRegion.getByRole("button", { name: "Save profile" }).click();

    await assertTextVisible(profileRegion, "Profile saved.");
    assert.equal(
      await profileRegion.getByLabel("Gamer Tag").inputValue(),
      "Player",
    );
    await assertNoHorizontalOverflow(page);

    assertNoConsoleErrors();
  });

  it("truncates overlong signed-in profile Gamer Tag input safely", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);
    const gamerTag =
      "Captain Spoon With A Surprisingly Long Profile Display Name";

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);
    const profileRegion = page.getByRole("region", { name: "Profile" });

    await profileRegion.getByLabel("Gamer Tag").fill(gamerTag);
    await profileRegion.getByRole("button", { name: "Save profile" }).click();

    await assertTextVisible(profileRegion, "Profile saved.");
    assert.equal(
      await profileRegion.getByLabel("Gamer Tag").inputValue(),
      gamerTag.slice(0, 40),
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
    await signInWithLocalTestAccount(page);
    const profileRegion = page.getByRole("region", { name: "Profile" });

    await profileRegion.getByLabel("Gamer Tag").fill("Captain Spoon");
    await profileRegion.getByRole("button", { name: "Save profile" }).click();

    await assertTextVisible(
      profileRegion,
      "Profile could not be saved. Try again.",
    );
    await assertTextHidden(profileRegion, "Profile saved.");
    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page);

    assert.equal(
      await page
        .getByRole("region", { name: "Profile" })
        .getByLabel("Gamer Tag")
        .inputValue(),
      "Player",
    );
    await assertTextVisible(page, "Player");
    await assertTextHidden(page, "@player-test-account");
    await assertNoHorizontalOverflow(page);

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
    await signInWithLocalTestAccount(page);
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
    await signInWithLocalTestAccount(page);

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
    await signInWithLocalTestAccount(page);
    let profileRegion = page.getByRole("region", { name: "Profile" });

    await profileRegion.getByLabel("Gamer Tag").fill("Captain Spoon");
    await profileRegion
      .locator("[data-account-profile-avatar]")
      .selectOption("yin-yang");
    await profileRegion.getByRole("button", { name: "Save profile" }).click();
    await assertTextVisible(profileRegion, "Profile saved.");

    await page.reload();
    await assertAnonymousAccountIconVisible(page);
    await signInWithLocalTestAccount(page);
    profileRegion = page.getByRole("region", { name: "Profile" });

    assert.equal(
      await profileRegion.getByLabel("Gamer Tag").inputValue(),
      "Captain Spoon",
    );
    assert.equal(
      await profileRegion.locator("[data-account-profile-avatar]").inputValue(),
      "yin-yang",
    );
    await assertTextVisible(page, "Captain Spoon");
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
    await signInWithLocalTestAccount(page);
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
    await signInWithLocalTestAccount(page);
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
    await signInWithLocalTestAccount(page);
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
    await signInWithLocalTestAccount(uploadFailurePage);
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
    await signInWithLocalTestAccount(uploadFailurePage);
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
    await signInWithLocalTestAccount(saveFailurePage);
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
    await signInWithLocalTestAccount(saveFailurePage);
    profileRegion = saveFailurePage.getByRole("region", { name: "Profile" });
    assert.equal(
      await profileRegion.locator("[data-account-profile-avatar]").inputValue(),
      "dice",
    );
    assertNoSaveFailureConsoleErrors();
    await saveFailureContext.close();
  });

  it("creates a signed-in Pending Game invite by lookup key in local test mode", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await assertNoPendingGameDom(page);

    await signInWithLocalTestAccount(page);
    await assertTextVisible(page, "Account-backed mode");
    await assertNoPendingGameDom(page);
    await openMultiplayerRoute(page);
    await assertPendingGameSurfaceMounted(page);
    await assertNoHorizontalOverflow(page);

    await page.locator("[data-pending-game-lookup-key-input]").fill("INVITEE TWO");
    await page.locator("[data-pending-game-row-count]").selectOption("15");
    await page.locator("[data-pending-game-nudge-timeout]").selectOption("72");
    await page.getByRole("button", { name: "Create invite" }).click();

    await assertTextVisible(
      page,
      "Game invite created. Waiting for Invitee Two to accept.",
    );
    await assertTextVisible(page, "Player");
    await assertTextVisible(page, "Accepted");
    await assertTextVisible(page, "Invitee Two");
    await assertTextHidden(page, "@invitee-two");
    await assertTextVisible(page, "Invited");
    await assertTextVisible(page, "15 phrases");
    await assertTextVisible(page, "Nudge after 3 days");
    await assertNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Sign out" }).click();
    await assertAnonymousAccountIconVisible(page);
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
    await signInWithLocalTestAccount(page);
    await openMultiplayerRoute(page);
    await page.locator("[data-pending-game-lookup-key-input]").fill("INVITEE TWO");
    await page.locator("[data-pending-game-row-count]").selectOption("15");
    await page.getByRole("button", { name: "Create invite" }).click();

    await assertTextVisible(
      page,
      "Game invite created. Waiting for Invitee Two to accept.",
    );
    await assertTextVisible(page, "Created invites");
    await assertTextVisible(page, "Expired");
    assert.equal(
      await page.getByRole("button", { name: "Start game with Invitee Two" }).count(),
      0,
    );
    assert.equal(
      await page.getByRole("button", { name: "Cancel game with Invitee Two" }).count(),
      0,
    );

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page, { invitee: true });
    await openMultiplayerRoute(page);
    await assertTextVisible(page, "Incoming invites");
    await assertTextVisible(page, "Expired");
    assert.equal(
      await page
        .getByRole("button", { name: "Accept invite from Player" })
        .count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Decline invite from Player" })
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
    await signInWithLocalTestAccount(page);
    await assertTextVisible(page, "Account-backed mode");
    await openMultiplayerRoute(page);
    await page.locator("[data-pending-game-lookup-key-input]").fill("INVITEE TWO");
    await page.locator("[data-pending-game-row-count]").selectOption("15");
    await page.getByRole("button", { name: "Create invite" }).click();
    await assertTextVisible(
      page,
      "Game invite created. Waiting for Invitee Two to accept.",
    );

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page, { invitee: true });
    await openMultiplayerRoute(page);
    await assertTextVisible(page, "Invitee Two");
    await assertTextHidden(page, "@invitee-two");
    await assertTextVisible(page, "Incoming invites");
    await assertTextVisible(page, "Player");
    await assertTextVisible(page, "15 phrases");
    await page
      .getByRole("button", { name: "Accept invite from Player" })
      .click();
    await assertTextVisible(page, "Game invite accepted.");
    await assertTextVisible(page, "Accepted");

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page);
    await openMultiplayerRoute(page);
    await assertTextVisible(page, "Player");
    await assertTextVisible(page, "Invitee Two");
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
    await signInWithLocalTestAccount(page);
    await openMultiplayerRoute(page);
    await page.locator("[data-pending-game-lookup-key-input]").fill("INVITEE TWO");
    await page.locator("[data-pending-game-row-count]").selectOption("15");
    await page.getByRole("button", { name: "Create invite" }).click();
    await assertTextVisible(
      page,
      "Game invite created. Waiting for Invitee Two to accept.",
    );

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page, { invitee: true });
    await openMultiplayerRoute(page);
    await page
      .getByRole("button", { name: "Decline invite from Player" })
      .click();
    await assertTextVisible(page, "Game invite declined.");

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page);
    await openMultiplayerRoute(page);
    await assertTextVisible(page, "Cancelled");
    await assertTextVisible(page, "Declined");
    assert.equal(
      await page.getByRole("button", { name: "Start game with Invitee Two" }).count(),
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
    await signInWithLocalTestAccount(page);
    await assertTextVisible(page, "Account-backed mode");
    await openMultiplayerRoute(page);
    await page.locator("[data-pending-game-lookup-key-input]").fill("INVITEE TWO");
    await page.locator("[data-pending-game-row-count]").selectOption("15");
    await page.getByRole("button", { name: "Create invite" }).click();
    await assertTextVisible(
      page,
      "Game invite created. Waiting for Invitee Two to accept.",
    );

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page, { invitee: true });
    await openMultiplayerRoute(page);
    await page
      .getByRole("button", { name: "Accept invite from Player" })
      .click();
    await assertTextVisible(page, "Game invite accepted.");

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page);
    await openMultiplayerRoute(page);
    await page.getByRole("button", { name: "Start game with Invitee Two" }).click();

    await assertTextVisible(page, "Game started. Your turn is ready.");
    await assertTextVisible(page, "Started");
    await assertTextVisible(page, "Awaiting your entries");
    assert.equal(await page.locator("[data-reveal-panel]").isHidden(), true);

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page, { invitee: true });
    await openMultiplayerRoute(page);
    await assertTextVisible(page, "Awaiting your entries");
    await submitMultiplayerSection(page, "teapot");
    await assertTextVisible(page, "Awaiting your entries");
    assert.equal(
      await page
        .getByText(
          "Batch with Player and Invitee Two is now complete and available to reveal.",
        )
        .count(),
      0,
    );
    await submitMultiplayerSection(page, "ladder");
    await assertTextVisible(page, "Awaiting other player entries");
    await assertNoHorizontalOverflow(page);
    assert.equal(
      await page.getByRole("button", { name: "Start game with Invitee Two" }).count(),
      0,
    );

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page);
    await openMultiplayerRoute(page);
    await submitMultiplayerSection(page, "brisk");
    await assertTextVisible(page, "Batches completed");
    await page.getByRole("button", { name: "Reveal phrases" }).click();
    await assertTextVisible(page, "Your crazy phrases");

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page, { invitee: true });
    await openFavouritesRoute(page);
    assert.equal(
      await page
        .getByRole("button", { name: "Notifications, 2 unread" })
        .isVisible(),
      true,
    );
    const notificationButton = page.getByRole("button", {
      name: "Notifications, 2 unread",
    });
    await expectFontAwesomeClass(notificationButton, "fa-solid", "fa-bell");
    assert.equal(
      await notificationButton.locator("[data-notification-badge]").innerText(),
      "2",
    );

    await page.getByRole("button", { name: "Notifications" }).click();
    await assertTextVisible(
      page,
      "Batch with Player and Invitee Two is now complete and available to reveal.",
    );
    await assertTextVisible(page, "Read");
    await openMultiplayerRoute(page);
    await page.getByRole("button", { name: "Reveal phrases" }).click();
    await assertTextVisible(page, "Your crazy phrases");

    assertNoConsoleErrors();
  });

  it("routes actionable notifications to the Multiplayer destination", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await signInWithLocalTestAccount(page);
    await openMultiplayerRoute(page);
    await page.locator("[data-pending-game-lookup-key-input]").fill("INVITEE TWO");
    await page.getByRole("button", { name: "Create invite" }).click();
    await assertTextVisible(
      page,
      "Game invite created. Waiting for Invitee Two to accept.",
    );

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page, { invitee: true });
    await openMultiplayerRoute(page);
    await page
      .getByRole("button", { name: "Accept invite from Player" })
      .click();
    await assertTextVisible(page, "Game invite accepted.");

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page);
    await openMultiplayerRoute(page);
    await page.getByRole("button", { name: "Start game with Invitee Two" }).click();
    await assertTextVisible(page, "Game started. Your turn is ready.");

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page, { invitee: true });
    await openFavouritesRoute(page);
    assert.equal(new URL(page.url()).hash, "#/favourites");
    assert.equal(
      await page
        .getByRole("button", { name: "Notifications, 1 unread" })
        .isVisible(),
      true,
    );

    await page.getByRole("button", { name: "Notifications" }).click();
    const notificationItem = page
      .locator("[data-notification-panel] .notification-item")
      .filter({
        hasText:
          "You can submit entries to a batch with Player and Invitee Two.",
      });
    assert.equal(await notificationItem.count(), 1);
    await notificationItem.click();

    await page.waitForFunction(
      () =>
        window.location.hash === "#/play/multiplayer" &&
        document.querySelectorAll("[data-pending-game-panel]").length === 1,
    );
    assert.equal(new URL(page.url()).hash, "#/play/multiplayer");
    assert.equal(await page.locator("[data-game-panel]").isHidden(), true);
    await assertPendingGameSurfaceMounted(page);
    await assertTextVisible(page, "Awaiting your entries");
    await assertNoFavouritesPanelDom(page);
    assert.equal(await page.locator("[data-notification-panel]").isHidden(), true);
    await page.waitForFunction(
      () =>
        document.querySelector("[data-notification-toggle]")?.dataset
          .unreadCount === "0",
    );
    assert.equal(
      await page.getByRole("button", { name: "Notifications" }).isVisible(),
      true,
    );

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

    await signInWithLocalTestAccount(page);
    await openMultiplayerRoute(page);
    await page.locator("[data-pending-game-lookup-key-input]").fill("INVITEE TWO");
    await page.locator("[data-pending-game-row-count]").selectOption("10");
    await page.getByRole("button", { name: "Create invite" }).click();

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page, { invitee: true });
    await openMultiplayerRoute(page);
    await page
      .getByRole("button", { name: "Accept invite from Player" })
      .click();

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page);
    await openMultiplayerRoute(page);
    await page.getByRole("button", { name: "Start game with Invitee Two" }).click();

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page, { invitee: true });
    await openMultiplayerRoute(page);
    await submitMultiplayerSection(page, "teapot");
    await submitMultiplayerSection(page, "ladder");

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page);
    await openMultiplayerRoute(page);
    await submitMultiplayerSection(page, "brisk");
    await assertTextVisible(page, "Batches completed");

    await page.getByRole("button", { name: "View all completed batches" }).click();

    await assertTextVisible(page, "Completed multiplayer history");
    await assertTextVisible(page, "Batch with Player and Invitee Two.");
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
    await signInWithLocalTestAccount(page);
    await openMultiplayerRoute(page);
    await page.getByRole("button", { name: "View all completed batches" }).click();

    await assertTextVisible(page, "Completed multiplayer history");
    const historyPanel = page.locator("[data-completed-multiplayer-history]");
    assert.equal(
      await historyPanel
        .getByText("Batch with Player and Invitee Two.")
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
        .getByText("Batch with Player and Invitee Two.")
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
    await signInWithLocalTestAccount(page);
    await openMultiplayerRoute(page);
    await page.getByRole("button", { name: "View all completed batches" }).click();

    const historyPanel = page.locator("[data-completed-multiplayer-history]");
    assert.equal(
      await historyPanel
        .getByText("Batch with Player and Invitee Two.")
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
        .getByText("Batch with Player and Invitee Two.")
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
    await signInWithLocalTestAccount(page);
    await openMultiplayerRoute(page);
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
    await signInWithLocalTestAccount(page);
    await openMultiplayerRoute(page);
    await page.locator("[data-pending-game-lookup-key-input]").fill("INVITEE TWO");
    await page.locator("[data-pending-game-row-count]").selectOption("10");
    await page.getByRole("button", { name: "Create invite" }).click();

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page, { invitee: true });
    await openMultiplayerRoute(page);
    await page
      .getByRole("button", { name: "Accept invite from Player" })
      .click();

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page);
    await openMultiplayerRoute(page);
    await page.getByRole("button", { name: "Start game with Invitee Two" }).click();

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page, { invitee: true });
    await openMultiplayerRoute(page);
    await submitMultiplayerSection(page, "teapot");
    await submitMultiplayerSection(page, "ladder");

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page);
    await openMultiplayerRoute(page);
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
    await signInWithLocalTestAccount(page);
    await openMultiplayerRoute(page);
    await page.locator("[data-pending-game-lookup-key-input]").fill("INVITEE TWO");
    await page.locator("[data-pending-game-row-count]").selectOption("10");
    await page.getByRole("button", { name: "Create invite" }).click();

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page, { invitee: true });
    await openMultiplayerRoute(page);
    await page
      .getByRole("button", { name: "Accept invite from Player" })
      .click();

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page);
    await openMultiplayerRoute(page);
    await page.getByRole("button", { name: "Start game with Invitee Two" }).click();
    await assertTextVisible(page, "Awaiting your entries");

    await page
      .getByRole("button", { name: "Cancel game with Invitee Two" })
      .click();

    await assertTextVisible(page, "Game cancelled.");
    await assertTextVisible(page, "Cancelled");
    assert.equal(
      await page.getByRole("button", { name: "Submit section" }).count(),
      0,
    );

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page, { invitee: true });
    await openMultiplayerRoute(page);
    assert.equal(
      await page.getByRole("button", { name: "Submit section" }).count(),
      0,
    );
    await page.getByRole("button", { name: "Notifications, 1 unread" }).click();
    await assertTextVisible(
      page,
      "Player cancelled a batch with Player and Invitee Two.",
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
    await signInWithLocalTestAccount(page);
    await openMultiplayerRoute(page);
    await page.locator("[data-pending-game-lookup-key-input]").fill("INVITEE TWO");
    await page.locator("[data-pending-game-row-count]").selectOption("10");
    await page.getByRole("button", { name: "Create invite" }).click();

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page, { invitee: true });
    await openMultiplayerRoute(page);
    await page
      .getByRole("button", { name: "Accept invite from Player" })
      .click();

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page);
    await openMultiplayerRoute(page);
    await page.getByRole("button", { name: "Start game with Invitee Two" }).click();

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page, { invitee: true });
    await openMultiplayerRoute(page);
    await submitMultiplayerSection(page, "teapot");
    await submitMultiplayerSection(page, "ladder");

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page);
    await openMultiplayerRoute(page);
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
    await assertNoNotificationDom(page);
    assert.equal(await page.locator("[data-favourites-route]").count(), 0);

    await signInWithLocalTestAccount(page);
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

    await openPlayRoute(page);
    await assertNoFavouritesPanelDom(page);

    await page.getByRole("link", { name: "Favourites" }).click();
    await page.waitForFunction(
      () => document.querySelectorAll("[data-favourites-panel]").length === 1,
    );
    assert.equal(new URL(page.url()).hash, "#/favourites");
    await assertFavouriteSurfaceMounted(page);
    await assertTextVisible(page, "No phrase favourites yet.");
    await assertTextVisible(page, "Favourite revealed phrases from Play Solo.");
    await page.evaluate(() => {
      window.localStorage.setItem(
        "crazyphrases.signedInRouteHandoff.v1",
        JSON.stringify({
          createdAt: Date.now(),
          route: "#/favourites",
        }),
      );
    });

    await page.getByRole("button", { name: "Sign out" }).click();
    await assertAnonymousAccountIconVisible(page);
    assert.equal(new URL(page.url()).hash, "#/play/solo");
    assert.equal(
      await page.evaluate(() =>
        window.localStorage.getItem("crazyphrases.signedInRouteHandoff.v1"),
      ),
      null,
    );
    await assertNoFavouriteDom(page);
    await assertNoNotificationDom(page);

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
    await signInWithLocalTestAccount(page);

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
    await signInWithLocalTestAccount(page);

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

    await signInWithLocalTestAccount(page);
    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithLocalTestAccount(page, { invitee: true });

    await assertTextVisible(page, "Invitee Two");
    await assertTextAbsent(page, "@invitee-two");
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
      window.localStorage.setItem(
        "crazyphrases.signedInRouteHandoff.v1",
        JSON.stringify({
          createdAt: Date.now(),
          route: "#/favourites",
        }),
      );
    });

    await page.evaluate(() => {
      window.location.hash = "#/play/solo";
    });
    await page.waitForFunction(() => window.location.hash === "#/play/solo");
    assert.equal(
      await page.evaluate(() =>
        window.localStorage.getItem("crazyphrases.signedInRouteHandoff.v1"),
      ),
      null,
    );

    await signInWithLocalTestAccount(page);
    await assertTextVisible(page, "Account-backed mode");
    assert.equal(new URL(page.url()).hash, "#/play/solo");
    await assertNoFavouritesPanelDom(page);
    assert.equal(await page.locator("[data-game-panel]").isHidden(), false);

    assertNoConsoleErrors();
  });

  it("consumes a hosted Auth route handoff only after sign-in", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await page.evaluate(() => {
      window.localStorage.setItem(
        "crazyphrases.signedInRouteHandoff.v1",
        JSON.stringify({
          createdAt: Date.now(),
          route: "#/favourites",
        }),
      );
    });
    await page.reload();

    assert.equal(new URL(page.url()).hash, "");
    await assertAnonymousAccountIconVisible(page);
    await assertNoFavouritesPanelDom(page);

    await signInWithLocalTestAccount(page);
    await assertTextVisible(page, "Account-backed mode");
    assert.equal(new URL(page.url()).hash, "#/favourites");
    await assertFavouriteSurfaceMounted(page);
    await assertTextVisible(page, "No phrase favourites yet.");
    assert.equal(
      await page.evaluate(() =>
        window.localStorage.getItem("crazyphrases.signedInRouteHandoff.v1"),
      ),
      null,
    );

    assertNoConsoleErrors();
  });

  it("preserves a hosted Auth route handoff through a Supabase callback hash", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await context.addInitScript(() => {
      window.localStorage.setItem(
        "crazyphrases.signedInRouteHandoff.v1",
        JSON.stringify({
          createdAt: Date.now(),
          route: "#/favourites",
        }),
      );
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(
      `${staticServer.origin}/#access_token=test-token&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=magiclink`,
    );
    await page.waitForFunction(() => window.location.hash === "#/play/solo");
    await assertAnonymousAccountIconVisible(page);
    await assertNoFavouritesPanelDom(page);
    const preservedHandoff = await page.evaluate(() =>
      JSON.parse(
        window.localStorage.getItem("crazyphrases.signedInRouteHandoff.v1"),
      ),
    );
    assert.equal(preservedHandoff.route, "#/favourites");
    assert.equal(Number.isFinite(preservedHandoff.createdAt), true);

    await signInWithLocalTestAccount(page);
    await assertTextVisible(page, "Account-backed mode");
    assert.equal(new URL(page.url()).hash, "#/favourites");
    await assertFavouriteSurfaceMounted(page);
    assert.equal(
      await page.evaluate(() =>
        window.localStorage.getItem("crazyphrases.signedInRouteHandoff.v1"),
      ),
      null,
    );

    assertNoConsoleErrors();
  });

  it("preserves a hosted Auth route handoff when callback cleanup runs before sign-in", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await context.route("**/assets/supabase-config.js*", async (route) => {
      await route.fulfill({
        contentType: "text/javascript; charset=utf-8",
        body: `
          export const SUPABASE_RUNTIME_CONFIG = Object.freeze({
            publishableKey: "sb_publishable_test",
            url: "https://example.supabase.co",
          });

          export function getSupabaseRuntimeConfig(config = SUPABASE_RUNTIME_CONFIG) {
            return {
              configured: true,
              publishableKey: config.publishableKey,
              url: config.url,
            };
          }
        `,
      });
    });
    await context.addInitScript(() => {
      window.supabase = {
        createClient: () => ({
          auth: {
            getUser: () => new Promise(() => {}),
            signInWithOAuth: async () => ({ data: {}, error: null }),
            signOut: async () => ({ error: null }),
          },
          from: () => ({}),
          rpc: async () => ({ data: [], error: null }),
          storage: {
            from: () => ({}),
          },
        }),
      };
      window.localStorage.setItem(
        "crazyphrases.signedInRouteHandoff.v1",
        JSON.stringify({
          createdAt: Date.now(),
          route: "#/play/multiplayer",
        }),
      );
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(
      `${staticServer.origin}/#access_token=test-token&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=magiclink`,
    );
    await assertAnonymousAccountIconVisible(page);
    await assertNoPendingGameDom(page);

    await page.evaluate(() => {
      window.location.hash = "";
    });
    await page.waitForFunction(() => window.location.hash === "");

    const preservedHandoff = await page.evaluate(() =>
      window.localStorage.getItem("crazyphrases.signedInRouteHandoff.v1"),
    );
    assert.notEqual(preservedHandoff, null);
    assert.equal(JSON.parse(preservedHandoff).route, "#/play/multiplayer");

    await signInWithLocalTestAccount(page);
    await assertTextVisible(page, "Account-backed mode");
    await page.waitForFunction(
      () =>
        window.location.hash === "#/play/multiplayer" &&
        document.querySelectorAll("[data-pending-game-panel]").length === 1,
    );
    assert.equal(await page.locator("[data-game-panel]").isHidden(), true);
    await assertPendingGameSurfaceMounted(page);

    assertNoConsoleErrors();
  });

  it("reasserts a consumed signed-in route after hosted Auth URL cleanup", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await page.evaluate(() => {
      window.localStorage.setItem(
        "crazyphrases.signedInRouteHandoff.v1",
        JSON.stringify({
          createdAt: Date.now(),
          route: "#/play/multiplayer",
        }),
      );
    });
    await page.reload();
    assert.equal(new URL(page.url()).hash, "");
    await assertAnonymousAccountIconVisible(page);
    await assertNoPendingGameDom(page);

    await page.evaluate(() => {
      window.__hostedAuthUrlCleanupApplied = false;
      window.addEventListener(
        "hashchange",
        () => {
          if (window.location.hash !== "#/play/multiplayer") {
            return;
          }

          window.history.replaceState(null, "", `${window.location.pathname}#`);
          window.__hostedAuthUrlCleanupApplied = true;
        },
        { once: true },
      );
    });

    await signInWithLocalTestAccount(page);
    await assertTextVisible(page, "Account-backed mode");
    await page.waitForFunction(
      () => window.__hostedAuthUrlCleanupApplied === true,
    );
    await page.waitForFunction(
      () =>
        window.location.hash === "#/play/multiplayer" &&
        document.querySelectorAll("[data-pending-game-panel]").length === 1,
      undefined,
      { timeout: 2_000 },
    );
    assert.equal(new URL(page.url()).hash, "#/play/multiplayer");
    assert.equal(await page.locator("[data-game-panel]").isHidden(), true);
    await assertPendingGameSurfaceMounted(page);
    await assertNoFavouritesPanelDom(page);
    assert.equal(
      await page.evaluate(() =>
        window.localStorage.getItem("crazyphrases.signedInRouteHandoff.v1"),
      ),
      null,
    );

    assertNoConsoleErrors();
  });

  it("reasserts a consumed signed-in route after delayed hosted Auth URL cleanup", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await page.evaluate(() => {
      window.localStorage.setItem(
        "crazyphrases.signedInRouteHandoff.v1",
        JSON.stringify({
          createdAt: Date.now(),
          route: "#/play/multiplayer",
        }),
      );
    });
    await page.reload();
    assert.equal(new URL(page.url()).hash, "");
    await assertAnonymousAccountIconVisible(page);
    await assertNoPendingGameDom(page);

    await page.evaluate(() => {
      window.__hostedAuthDelayedUrlCleanupApplied = false;
      window.addEventListener(
        "hashchange",
        () => {
          if (window.location.hash !== "#/play/multiplayer") {
            return;
          }

          window.setTimeout(() => {
            window.history.replaceState(null, "", `${window.location.pathname}#`);
            window.__hostedAuthDelayedUrlCleanupApplied = true;
          }, 1_000);
        },
        { once: true },
      );
    });

    await signInWithLocalTestAccount(page);
    await assertTextVisible(page, "Account-backed mode");
    await page.waitForFunction(
      () => window.__hostedAuthDelayedUrlCleanupApplied === true,
    );
    await page.waitForFunction(
      () =>
        window.location.hash === "#/play/multiplayer" &&
        document.querySelectorAll("[data-pending-game-panel]").length === 1,
      undefined,
      { timeout: 2_000 },
    );
    assert.equal(new URL(page.url()).hash, "#/play/multiplayer");
    assert.equal(await page.locator("[data-game-panel]").isHidden(), true);
    await assertPendingGameSurfaceMounted(page);
    await assertNoFavouritesPanelDom(page);

    assertNoConsoleErrors();
  });

  it("resolves unsupported hash routes to anonymous Solo play", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(staticServer.origin);
    await page.evaluate(() => {
      window.localStorage.setItem(
        "crazyphrases.signedInRouteHandoff.v1",
        JSON.stringify({
          createdAt: Date.now(),
          route: "#/favourites",
        }),
      );
    });
    await page.goto(`${staticServer.origin}/#/account/settings`);
    await page.waitForFunction(() => window.location.hash === "#/play/solo");
    await assertAnonymousAccountIconVisible(page);
    assert.equal(
      await page.evaluate(() =>
        window.localStorage.getItem("crazyphrases.signedInRouteHandoff.v1"),
      ),
      null,
    );
    assert.equal(await page.locator("[data-game-panel]").isHidden(), false);
    await assertNoFavouriteDom(page);
    await assertNoPendingGameDom(page);
    await assertNoProfileEditorDom(page);
    await assertNoNotificationDom(page);

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
    await assertNoNotificationDom(page);

    await signInWithLocalTestAccount(page);
    await assertTextVisible(page, "Account-backed mode");
    assert.equal(new URL(page.url()).hash, "#/play/multiplayer");
    assert.equal(await page.locator("[data-game-panel]").isHidden(), true);
    await assertPendingGameSurfaceMounted(page);
    await assertNoFavouritesPanelDom(page);

    await page.locator("[data-pending-game-lookup-key-input]").fill("INVITEE TWO");
    await page.locator("[data-pending-game-row-count]").selectOption("15");
    await page.locator("[data-pending-game-nudge-timeout]").selectOption("72");
    await page.getByRole("button", { name: "Create invite" }).click();

    await assertTextVisible(
      page,
      "Game invite created. Waiting for Invitee Two to accept.",
    );
    await assertTextVisible(page, "Invitee Two");
    await assertTextVisible(page, "15 phrases");

    await openFavouritesRoute(page);
    await assertFavouriteSurfaceMounted(page);
    await assertNoPendingGameDom(page);

    await openMultiplayerRoute(page);
    assert.equal(await page.locator("[data-game-panel]").isHidden(), true);
    assert.equal(await page.locator("[data-pending-game-panel]").count(), 1);
    assert.equal(await page.locator("[data-pending-game-lookup-key-input]").count(), 1);
    await assertNoFavouritesPanelDom(page);
    await assertTextVisible(page, "Invitee Two");
    await assertTextVisible(page, "15 phrases");
    await assertTextVisible(page, "Nudge after 3 days");

    assertNoConsoleErrors();
  });

  it("keeps signed-out Solo clean when Multiplayer invite creation finishes late", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await delayLocalTestPendingGameInviteCreation(context);
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(`${staticServer.origin}/#/play/multiplayer`);
    await signInWithLocalTestAccount(page);
    await assertTextVisible(page, "Account-backed mode");
    assert.equal(new URL(page.url()).hash, "#/play/multiplayer");
    await assertPendingGameSurfaceMounted(page);

    await page.getByRole("button", { name: "Notifications" }).click();
    assert.equal(await page.locator("[data-notification-panel]").isVisible(), true);
    await page.evaluate(() => {
      window.localStorage.setItem(
        "crazyphrases.signedInRouteHandoff.v1",
        JSON.stringify({
          createdAt: Date.now(),
          route: "#/play/multiplayer",
        }),
      );
    });

    await page.locator("[data-pending-game-lookup-key-input]").fill("INVITEE TWO");
    await page.locator("[data-pending-game-row-count]").selectOption("15");
    await page.locator("[data-pending-game-nudge-timeout]").selectOption("72");
    await page.getByRole("button", { name: "Create invite" }).click();
    await page.waitForFunction(() => window.__pendingGameCreateStarted === true);

    await page.getByRole("button", { name: "Sign out" }).focus();
    await page.keyboard.press("Enter");
    await assertAnonymousAccountIconVisible(page);
    await assertAnonymousSignInSurfaceClosed(page);
    assert.equal(new URL(page.url()).hash, "#/play/solo");
    assert.equal(
      await page.evaluate(() =>
        window.localStorage.getItem("crazyphrases.signedInRouteHandoff.v1"),
      ),
      null,
    );
    await assertNoPendingGameDom(page);
    await assertNoFavouriteDom(page);
    await assertNoProfileEditorDom(page);
    await assertNoNotificationDom(page);

    await releaseDelayedPendingGameInviteCreation(page);
    await page.waitForTimeout(100);
    assert.equal(new URL(page.url()).hash, "#/play/solo");
    await assertAnonymousAccountIconVisible(page);
    await assertNoPendingGameDom(page);
    await assertNoFavouriteDom(page);
    await assertNoProfileEditorDom(page);
    await assertNoNotificationDom(page);

    await signInWithLocalTestAccount(page);
    await assertTextVisible(page, "Account-backed mode");
    assert.equal(new URL(page.url()).hash, "#/play/solo");

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

    await signInWithLocalTestAccount(page);
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
    await page.getByRole("button", { name: "View phrases" }).click();
    const expandedBatch = page.locator("[data-expanded-batch-favourite]");
    assert.equal(await expandedBatch.isVisible(), true);
    assert.equal(await expandedBatch.locator("li").count(), 10);
    assert.equal(
      await expandedBatch.locator("li").first().innerText(),
      batchCopy.split("\n")[1],
    );
    assert.deepEqual(
      await expandedBatch.locator("li").allInnerTexts(),
      batchCopy.split("\n").slice(1),
    );
    assert.equal(
      await expandedBatch.locator("ul").evaluate((list) =>
        getComputedStyle(list).listStyleType,
      ),
      "none",
    );
    assert.equal(
      await page.getByRole("button", { name: "Hide phrases" }).isVisible(),
      true,
    );
    await page.getByRole("button", { name: "Copy batch" }).click();
    await waitForTextVisible(page, "Batch copied.");
    await assertActiveElementMatches(page, {
      selector: "[data-copy-batch-favourite-id]",
      accessibleName: "Copy batch",
    });
    assert.equal(normalizeLineEndings(await readClipboard(page)), batchCopy);
    await assertNoHorizontalOverflow(page);
    await page.setViewportSize({ width: 360, height: 780 });
    await assertNoHorizontalOverflow(page);
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
    await assertAnonymousAccountIconVisible(page);
    await assertRowCountSelected(page, "15");
    await assertNoFavouriteDom(page);
    await assertNoHorizontalOverflow(page);

    await signInWithLocalTestAccount(page);
    await assertTextVisible(page, "Account-backed mode");
    await assertTextVisible(page, "Your crazy phrases");
    assert.equal(await page.locator("[data-phrase-list] li").count(), 10);
    await assertNoHorizontalOverflow(page);

    await page.reload();
    await assertAnonymousAccountIconVisible(page);
    await assertRowCountSelected(page, "15");
    await signInWithLocalTestAccount(page);
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
    await page.getByRole("button", { name: "Remove phrase favourite" }).click();
    assert.equal(
      await page.getByRole("button", { name: "Cancel" }).evaluate(
        (node) => document.activeElement === node,
      ),
      true,
    );
    await assertTextVisible(page, "Remove phrase favourite?");
    await assertNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Remove" }).click();
    await assertTextVisible(page, "Phrase favourite removed.");
    await assertTextVisible(page, "No phrase favourites yet.");
    await page.waitForTimeout(2100);
    await assertTextHidden(page, "Phrase favourite removed.");
    await assertBatchFavouriteVisible(page, batchCopy);

    await page.getByRole("button", { name: "Remove batch favourite" }).click();
    await page.getByRole("button", { name: "Remove" }).click();
    await assertTextVisible(page, "Batch favourite removed.");
    await assertTextVisible(page, "No batch favourites yet.");
    await page.waitForTimeout(2100);
    await assertTextHidden(page, "Batch favourite removed.");

    await openPlayRoute(page);
    await page.reload();
    await assertAnonymousAccountIconVisible(page);
    await assertRowCountSelected(page, "15");
    await signInWithLocalTestAccount(page);
    await assertTextVisible(page, "Account-backed mode");
    assert.equal(await page.getByText("Your crazy phrases").isVisible(), false);
    assert.equal(await page.getByRole("button", { name: "Start batch" }).isVisible(), true);

    await page.getByRole("button", { name: "Sign out" }).click();
    await assertAnonymousAccountIconVisible(page);
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
    await signInWithLocalTestAccount(page);
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
    await signInWithLocalTestAccount(page);
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
    await signInWithLocalTestAccount(page);
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
    await signInWithLocalTestAccount(page);
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
    await signInWithLocalTestAccount(page);

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
    await signInWithLocalTestAccount(page);
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
    await signInWithLocalTestAccount(page);
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
    await page.getByRole("link", { name: "Favourites" }).click();
    await page.waitForFunction(
      () =>
        window.location.hash === "#/favourites" &&
        document.querySelectorAll("[data-favourites-panel]").length === 1,
    );
    await assertFavouriteSurfaceMounted(page);
    await assertFavouriteVisible(page, copiedPhrase);

    await page.getByRole("button", { name: "Remove phrase favourite" }).click();
    await page.getByRole("button", { name: "Remove" }).click();
    const failureStatus = page
      .locator("[data-favourite-kind=\"phrase\"]", { hasText: copiedPhrase })
      .locator(".favourite-remove-confirmation [data-favourite-row-status]");
    assert.equal(
      (await failureStatus.innerText()).trim(),
      "Could not remove phrase favourite.",
    );
    assert.equal(
      await page.getByRole("button", { name: "Cancel" }).evaluate(
        (node) => document.activeElement === node,
      ),
      true,
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

  it("does not restore stale route removal failure UI after leaving Favourites", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(
      `${staticServer.origin}/?testPrivateFavourites=remove-fails-after-delay`,
    );
    await signInWithLocalTestAccount(page);
    await assertTextVisible(page, "Account-backed mode");

    await page.getByRole("button", { name: "10" }).click();
    await page.getByRole("button", { name: "Start batch" }).click();

    const fillState = createFillState(10);
    await fillActiveSection(page, fillState);
    await fillActiveSection(page, fillState);
    await fillActiveSection(page, fillState);

    await page.getByRole("button", { name: "Save phrase 2 as favourite" }).click();
    await waitForTextVisible(page, "Phrase favourite saved.");
    await assertNoFavouritesPanelDom(page);
    await openFavouritesRoute(page);

    await page.getByRole("button", { name: "Remove phrase favourite" }).click();
    await page.getByRole("button", { name: "Remove" }).click();
    await assertTextVisible(page, "Removing phrase favourite...");

    await openPlayRoute(page);
    await page.waitForTimeout(700);

    await assertTextHidden(page, "Remove phrase favourite?");
    await assertTextHidden(page, "Could not remove phrase favourite.");
    await assertNoFavouritesPanelDom(page);
    assert.equal(await page.getByRole("button", { name: "Cancel" }).count(), 0);

    assertNoConsoleErrors();
  });

  it("does not mutate local favourites for stale route removal success", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(`${staticServer.origin}/?testPrivateFavourites=mutation-delays`);
    await signInWithLocalTestAccount(page);
    await assertTextVisible(page, "Account-backed mode");

    await page.getByRole("button", { name: "10" }).click();
    await page.getByRole("button", { name: "Start batch" }).click();

    const fillState = createFillState(10);
    await fillActiveSection(page, fillState);
    await fillActiveSection(page, fillState);
    await fillActiveSection(page, fillState);

    await page.getByRole("button", { name: "Save phrase 2 as favourite" }).click();
    await waitForTextVisible(page, "Phrase favourite saved.");
    await assertNoFavouritesPanelDom(page);
    await openFavouritesRoute(page);

    await page.getByRole("button", { name: "Remove phrase favourite" }).click();
    await page.getByRole("button", { name: "Remove" }).click();
    await assertTextVisible(page, "Removing phrase favourite...");

    await openPlayRoute(page);
    await page.waitForTimeout(700);

    await assertTextHidden(page, "Remove phrase favourite?");
    await assertTextHidden(page, "Phrase favourite removed.");
    await assertNoFavouritesPanelDom(page);
    assert.equal(
      await page
        .getByRole("button", { name: "Remove phrase 2 from favourites" })
        .isEnabled(),
      true,
    );

    assertNoConsoleErrors();
  });

  it("updates inactive Favourites tabs after pending route removal success", async () => {
    staticServer ??= await startStaticServer();
    browser ??= await chromium.launch();

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoConsoleErrors = trackConsoleErrors(page);

    await page.goto(`${staticServer.origin}/?testPrivateFavourites=mutation-delays`);
    await signInWithLocalTestAccount(page);
    await assertTextVisible(page, "Account-backed mode");

    await page.getByRole("button", { name: "10" }).click();
    await page.getByRole("button", { name: "Start batch" }).click();

    const fillState = createFillState(10);
    await fillActiveSection(page, fillState);
    await fillActiveSection(page, fillState);
    await fillActiveSection(page, fillState);

    await page.getByRole("button", { name: "Save phrase 2 as favourite" }).click();
    await waitForTextVisible(page, "Phrase favourite saved.");
    await assertNoFavouritesPanelDom(page);
    await openFavouritesRoute(page);

    await page.getByRole("button", { name: "Remove phrase favourite" }).click();
    await page.getByRole("button", { name: "Remove" }).click();
    await assertTextVisible(page, "Removing phrase favourite...");

    await page.getByRole("tab", { name: "Batches" }).click();
    await page.waitForTimeout(700);

    await assertTextHidden(page, "Remove phrase favourite?");
    await assertTextHidden(page, "Phrase favourite removed.");
    assert.equal(await page.getByRole("button", { name: "Cancel" }).count(), 0);

    await openPlayRoute(page);
    assert.equal(
      await page
        .getByRole("button", { name: "Save phrase 2 as favourite" })
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

async function routeHostedAuthConfig(context) {
  await context.route("**/assets/supabase-config.js*", async (route) => {
    await route.fulfill({
      contentType: "text/javascript; charset=utf-8",
      body: `
        export const SUPABASE_RUNTIME_CONFIG = Object.freeze({
          publishableKey: "sb_publishable_test",
          url: "https://example.supabase.co",
        });

        export function getSupabaseRuntimeConfig(config = SUPABASE_RUNTIME_CONFIG) {
          return {
            configured: true,
            publishableKey: config.publishableKey,
            url: config.url,
          };
        }
      `,
    });
  });
}

async function visibleTextContent(locator) {
  return locator.evaluate((element) =>
    Array.from(element.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join("")
      .trim(),
  );
}

async function assertAnonymousAccountIconVisible(page) {
  const accountSignIn = page.getByRole("button", { name: "Account sign in" });
  await expectFontAwesomeClass(accountSignIn, "fa-regular", "fa-circle-user");
  assert.equal(await accountSignIn.isVisible(), true);
}

async function assertAnonymousSignInSurfaceClosed(page) {
  assert.equal(await page.locator("[data-test-sign-in-button]").isVisible(), false);
  assert.equal(
    await page.locator("[data-test-invitee-sign-in-button]").isVisible(),
    false,
  );
  assert.equal(await page.locator("[data-google-sign-in-button]").isVisible(), false);
  assert.equal(await page.locator("[data-email-sign-in-form]").isVisible(), false);
}

async function openAnonymousAccountSignIn(page) {
  const accountSignIn = page.getByRole("button", { name: "Account sign in" });
  assert.equal(await accountSignIn.isVisible(), true);

  if ((await accountSignIn.getAttribute("aria-expanded")) !== "true") {
    await accountSignIn.click();
  }
}

async function signInWithLocalTestAccount(page, { invitee = false } = {}) {
  await openAnonymousAccountSignIn(page);
  await page
    .getByRole("button", {
      name: invitee ? "Test invitee sign in" : "Test sign in",
    })
    .click();
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

async function routeSeededNotificationRepository(
  context,
  {
    includeCompletedTargetNotification = false,
    includeDuplicateTargetNotifications = false,
    includeLongNotificationMessages = false,
    includeMismatchedTargetNotification = false,
    includePendingTargetInvite = false,
    includeStaticNotifications = false,
    includeTargetDashboard = false,
    failingNotificationIds = [],
  } = {},
) {
  await context.addInitScript((notificationFailures) => {
    window.__notificationReadCalls = [];
    window.__notificationReadFailures = notificationFailures;
  }, failingNotificationIds);
  const staticNotificationSeed = includeStaticNotifications
    ? `
    {
      id: "notification-unread-static",
      type: "game_cancelled",
      status: "unread",
      message: "Static unread notification.",
      accountId: "test-account",
      createdAt: "2026-06-30T09:30:00.000Z",
    },
    {
      id: "notification-read-static",
      type: "batch_complete",
      status: "read",
      message: "Static read notification.",
      accountId: "test-account",
      createdAt: "2026-06-30T08:30:00.000Z",
    },`
    : "";
  const longNotificationSeed = includeLongNotificationMessages
    ? `
    {
      id: "notification-unread-long-target",
      type: "entries_needed",
      status: "unread",
      message: ${JSON.stringify(LONG_TARGET_NOTIFICATION_MESSAGE)},
      accountId: "test-account",
      createdAt: "2026-06-30T12:30:00.000Z",
      targetGameId: "started-game-newest",
    },
    {
      id: "notification-read-long-static",
      type: "game_cancelled",
      status: "read",
      message: ${JSON.stringify(LONG_STATIC_NOTIFICATION_MESSAGE)},
      accountId: "test-account",
      createdAt: "2026-06-30T12:15:00.000Z",
    },`
    : "";
  const duplicateTargetNotificationSeed = includeDuplicateTargetNotifications
    ? `
    {
      id: "notification-unread-nudge",
      type: "nudge",
      status: "unread",
      message: "Duplicate target nudge notification.",
      accountId: "test-account",
      createdAt: "2026-06-30T11:30:00.000Z",
      targetGameId: "started-game-newest",
      targetAssignmentId: "started-game-newest-section",
    },`
    : "";
  const completedTargetNotificationSeed = includeCompletedTargetNotification
    ? `
    {
      id: "notification-unread-completed",
      type: "batch_complete",
      status: "unread",
      message: "Completed batch notification.",
      accountId: "test-account",
      createdAt: "2026-06-30T11:45:00.000Z",
      targetGameId: "started-game-completed",
    },`
    : "";
  const mismatchedTargetNotificationSeed = includeMismatchedTargetNotification
    ? `
    {
      id: "notification-unread-mismatched-assignment",
      type: "nudge",
      status: "unread",
      message: "Mismatched assignment notification.",
      accountId: "test-account",
      createdAt: "2026-06-30T11:30:00.000Z",
      targetGameId: "started-game-newest",
      targetAssignmentId: "started-game-other-section",
    },`
    : "";
  const awaitingEntryBatchSeed = includeTargetDashboard
    ? `
          {
            id: "started-game-newest",
            pendingGameId: "pending-game-newest",
            rowCount: 10,
            participants: [
              { gamerTag: "Player" },
              { gamerTag: "Invitee Two" },
            ],
            currentSection: {
              id: "started-game-newest-section",
              entryKind: "noun",
              sectionIndex: 0,
              sectionCount: 2,
              rows: Array.from({ length: 10 }, (_, rowIndex) => ({
                rowIndex,
                value: "",
              })),
            },
          },`
    : "";
  const completedBatchSeed = includeCompletedTargetNotification
    ? `
          {
            id: "started-game-completed",
            pendingGameId: "pending-game-completed",
            rowCount: 10,
            participants: [
              { gamerTag: "Player" },
              { gamerTag: "Invitee Two" },
            ],
            revealed: false,
          },`
    : "";
  const targetDashboardOverride =
    includeTargetDashboard || includeCompletedTargetNotification
      ? `
    async listMultiplayerDashboard({ accountId }) {
      return {
        awaitingYourEntries: [
${awaitingEntryBatchSeed}
        ],
        awaitingOtherPlayerEntries: [],
        completedBatches: [
${completedBatchSeed}
        ],
      };
    },`
      : "";
  const pendingInviteOverride = includePendingTargetInvite
    ? `
    async listIncomingPendingGameInvites({ accountId }) {
      return [
        {
          id: "pending-game-oldest",
          rowCount: 10,
          status: "pending",
          nudgeTimeoutHours: 48,
          participants: [
            {
              gamerTag: "Player",
              inviteStatus: "accepted",
              role: "creator",
            },
            {
              gamerTag: "Invitee Two",
              inviteStatus: "pending",
              role: "invitee",
            },
          ],
        },
      ];
    },`
    : "";
  await context.route("**/assets/pending-game.js*", async (route) => {
    const pendingGameSource = await readFile(
      resolve(workspaceRoot, "assets/pending-game.js"),
      "utf8",
    );
    const seededNotificationSource = pendingGameSource.replace(
      /export function createLocalTestPendingGameRepository\(options = \{\}\) \{\r?\n  return createTestPendingGameRepository\(options\);\r?\n\}/,
      `export function createLocalTestPendingGameRepository(options = {}) {
  const repository = createTestPendingGameRepository(options);
  const notifications = [
${longNotificationSeed}
    {
      id: "notification-unread-newest",
      type: "entries_needed",
      status: "unread",
      message: "Newest unread notification.",
      accountId: "test-account",
      createdAt: "2026-06-30T12:00:00.000Z",
      targetGameId: "started-game-newest",
    },
    {
      id: "notification-read",
      type: "batch_complete",
      status: "read",
      message: "Already read notification.",
      accountId: "test-account",
      createdAt: "2026-06-30T11:00:00.000Z",
      targetGameId: "started-game-read",
    },
${duplicateTargetNotificationSeed}
${completedTargetNotificationSeed}
${mismatchedTargetNotificationSeed}
    {
      id: "notification-unread-oldest",
      type: "game_cancelled",
      status: "unread",
      message: "Older unread notification.",
      accountId: "test-account",
      createdAt: "2026-06-30T10:00:00.000Z",
      targetPendingGameId: "pending-game-oldest",
    },
${staticNotificationSeed}
  ];

  return {
    ...repository,
${pendingInviteOverride}
${targetDashboardOverride}
    async listInAppNotifications({ accountId }) {
      return notifications
        .filter((notification) => notification.accountId === accountId)
        .map((notification) => ({ ...notification }));
    },
    async markInAppNotificationRead({ accountId, notificationId }) {
      globalThis.__notificationReadCalls.push({ accountId, notificationId });
      const notification = notifications.find(
        (candidate) =>
          candidate.accountId === accountId && candidate.id === notificationId,
      );
      if (!notification) {
        throw new Error("Notification not found.");
      }
      if (globalThis.__notificationReadFailures?.includes(notificationId)) {
        throw new Error("Notification update failed.");
      }
      notification.status = "read";
      return { ...notification };
    },
  };
}`,
    );

    assert.notEqual(seededNotificationSource, pendingGameSource);
    await route.fulfill({
      body: seededNotificationSource,
      contentType: "text/javascript; charset=utf-8",
    });
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
  const accountOnlyFavouriteDom = page.locator(
    [
      "[data-favourites-panel]",
      "[data-favourites-route]",
      "[data-favourites-tab-panel]",
      "[data-phrase-favourites-list]",
      "[data-favourite-row]",
      "[data-favourite-kind]",
      "[data-favourite-phrase-text]",
      "[data-copy-phrase-favourite-id]",
      "[data-copy-batch-favourite-id]",
      "[data-confirm-remove-phrase-favourite-id]",
      "[data-confirm-remove-batch-favourite-id]",
      "[data-remove-confirmed-favourite-id]",
      "[data-cancel-favourite-remove]",
      "[data-toggle-batch-favourite]",
      "[data-toggle-batch-favourite-phrases]",
      "[data-toggle-phrase-favourite-index]",
      "[data-expanded-batch-favourite]",
    ].join(", "),
  );

  assert.equal(await accountOnlyFavouriteDom.count(), 0);
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
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page
    .getByRole("menu", { name: "Play Game Modes" })
    .getByRole("menuitem", { name: "Solo play" })
    .click();
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

async function delayLocalTestPendingGameInviteCreation(context) {
  await context.addInitScript(() => {
    window.__pendingGameCreateStarted = false;
    window.__releasePendingGameCreate = null;
    window.__delayPendingGameCreate = () => {
      window.__pendingGameCreateStarted = true;
      return new Promise((resolve) => {
        window.__releasePendingGameCreate = resolve;
      });
    };
  });

  await context.route("**/assets/pending-game.js*", async (route) => {
    const pendingGameSource = await readFile(
      resolve(workspaceRoot, "assets/pending-game.js"),
      "utf8",
    );
    const delayedPendingGameSource = pendingGameSource.replace(
      /export function createLocalTestPendingGameRepository\(options = \{\}\) \{\r?\n  return createTestPendingGameRepository\(options\);\r?\n\}/,
      `export function createLocalTestPendingGameRepository(options = {}) {
  const repository = createTestPendingGameRepository(options);
  if (typeof globalThis.__delayPendingGameCreate !== "function") {
    return repository;
  }

  return {
    ...repository,
    async createPendingGameFromLookupKey(args) {
      await globalThis.__delayPendingGameCreate();
      return repository.createPendingGameFromLookupKey(args);
    },
  };
}`,
    );

    assert.notEqual(delayedPendingGameSource, pendingGameSource);
    await route.fulfill({
      body: delayedPendingGameSource,
      contentType: "text/javascript; charset=utf-8",
    });
  });
}

async function releaseDelayedPendingGameInviteCreation(page) {
  await page.evaluate(() => {
    window.__releasePendingGameCreate?.();
  });
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
  assert.equal(await page.locator("[data-account-profile-gamer-tag]").count(), 0);
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

async function assertNoNotificationDom(page) {
  assert.equal(
    await page
      .locator(
        [
          "[data-notification-shell]",
          "[data-notification-toggle]",
          "[data-notification-panel]",
          "[data-notification-badge]",
        ].join(", "),
      )
      .count(),
    0,
  );
}

async function assertProfileManagementSurfaceMounted(page) {
  assert.equal(await page.locator("[data-account-profile-panel]").count(), 1);
  const profileRegion = page.getByRole("region", { name: "Profile" });
  await assertTextVisible(profileRegion, "Profile");
  await assertTextVisible(profileRegion, "Gamer Tag");
  assert.equal(
    await profileRegion.getByLabel("Gamer Tag").inputValue(),
    "Player",
  );
  assert.equal(
    await profileRegion.locator("[data-account-profile-handle]").count(),
    0,
  );
  await assertTextHidden(profileRegion, "Gamer Name");
  await assertTextHidden(profileRegion, "Handle");
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
  assert.equal(await page.locator("[data-pending-game-lookup-key-input]").count(), 0);
  assert.equal(await page.locator("[data-pending-game-nudge-timeout]").count(), 0);
  assert.equal(await page.locator("[data-pending-game-summary]").count(), 0);
}

async function assertPendingGameSurfaceMounted(page) {
  assert.equal(await page.locator("[data-pending-game-panel]").count(), 1);
  assert.equal(await page.locator("[data-pending-game-lookup-key-input]").count(), 1);
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
