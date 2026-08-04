import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  openReviewStore,
  recoverStaleReviewLock,
} from "../tools/word-bank/review-store.js";

const temporaryRoots = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe("Word Bank review persistence", () => {
  it("allows one writable process and opens additional instances read-only", async () => {
    const root = await createReviewRoot();
    const writer = await openReviewStore({ root });
    const reader = await openReviewStore({ root });

    assert.equal(writer.mode, "writable");
    assert.equal(reader.mode, "readOnly");
    await assert.rejects(
      () =>
        reader.save("register.json", { schemaVersion: 1, value: "blocked" }, {
          expectedHash: "unused",
          validate: () => {},
        }),
      /read-only/i,
    );

    await reader.close();
    await writer.close();
  });

  it("detects external edits and validates complete replacements before atomic save", async () => {
    const root = await createReviewRoot();
    const store = await openReviewStore({ root });
    const loaded = await store.load("register.json");

    await writeFile(
      path.join(root, "register.json"),
      `${JSON.stringify({ schemaVersion: 1, value: "external" }, null, 2)}\n`,
      "utf8",
    );

    await assert.rejects(
      () =>
        store.save(
          "register.json",
          { schemaVersion: 1, value: "ours" },
          { expectedHash: loaded.hash, validate: () => {} },
        ),
      /changed outside the workbench/i,
    );

    const externallyEdited = await store.load("register.json");
    await assert.rejects(
      () =>
        store.save(
          "register.json",
          { schemaVersion: 1, value: "invalid" },
          {
            expectedHash: externallyEdited.hash,
            validate: () => {
              throw new Error("replacement is incomplete");
            },
          },
        ),
      /replacement is incomplete/i,
    );
    assert.match(await readFile(path.join(root, "register.json"), "utf8"), /external/);

    const saved = await store.save(
      "register.json",
      { schemaVersion: 1, value: "saved" },
      { expectedHash: externallyEdited.hash, validate: () => {} },
    );
    assert.match(await readFile(path.join(root, "register.json"), "utf8"), /saved/);
    assert.notEqual(saved.hash, externallyEdited.hash);
    await store.close();
  });

  it("requires explicit stale-lock recovery and refuses to recover a live writer", async () => {
    const root = await createReviewRoot();
    const lockPath = path.join(root, ".review.lock");
    await writeFile(
      lockPath,
      `${JSON.stringify({ ownerToken: "stale", pid: 999999, startedAt: "2026-08-04T00:00:00Z" })}\n`,
      "utf8",
    );

    await assert.rejects(
      () => recoverStaleReviewLock({ root, confirmed: false, isProcessRunning: () => false }),
      /explicit confirmation/i,
    );
    await assert.rejects(
      () => recoverStaleReviewLock({ root, confirmed: true, isProcessRunning: () => true }),
      /still running/i,
    );
    await recoverStaleReviewLock({
      root,
      confirmed: true,
      isProcessRunning: () => false,
    });

    const store = await openReviewStore({ root });
    assert.equal(store.mode, "writable");
    await store.close();
  });

  it("refuses paths outside the designated review-data root", async () => {
    const root = await createReviewRoot();
    const store = await openReviewStore({ root });

    await assert.rejects(() => store.load("../manifest.json"), /outside review-data/i);
    await store.close();
  });
});

async function createReviewRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "crazyphrases-review-store-"));
  temporaryRoots.push(root);
  await writeFile(
    path.join(root, "register.json"),
    `${JSON.stringify({ schemaVersion: 1, value: "initial" }, null, 2)}\n`,
    "utf8",
  );
  return root;
}
