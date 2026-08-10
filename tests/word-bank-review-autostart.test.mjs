import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  ensureReviewWorkbench,
  isExpectedWritableReviewService,
  isLockFromPreviousBoot,
} from "../tools/word-bank/review-workbench-autostart.mjs";

const temporaryRoots = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe("Word Bank review workbench automatic startup", () => {
  it("accepts only a writable server holding the expected worktree lock", () => {
    const projectRoot = path.resolve("expected-worktree");
    const reviewDataRoot = path.join(projectRoot, "tools", "word-bank", "review-data");
    const lock = { pid: 1234 };
    const health = {
      service: "crazyphrases-word-bank-review",
      pid: 1234,
      mode: "writable",
      projectRoot,
      reviewDataRoot,
    };

    assert.equal(
      isExpectedWritableReviewService({ health, lock, projectRoot, reviewDataRoot }),
      true,
    );
    assert.equal(
      isExpectedWritableReviewService({
        health: { ...health, projectRoot: path.resolve("older-worktree") },
        lock,
        projectRoot,
        reviewDataRoot,
      }),
      false,
    );
    assert.equal(
      isExpectedWritableReviewService({
        health: { ...health, mode: "readOnly" },
        lock,
        projectRoot,
        reviewDataRoot,
      }),
      false,
    );
    assert.equal(
      isExpectedWritableReviewService({ health, lock: { pid: 4321 }, projectRoot, reviewDataRoot }),
      false,
    );
  });

  it("permits unattended recovery only for a lock predating the current boot", () => {
    const bootStartedAt = new Date("2026-08-06T08:00:00.000Z");

    assert.equal(
      isLockFromPreviousBoot(
        { pid: 1234, startedAt: "2026-08-05T17:38:50.119Z" },
        bootStartedAt,
      ),
      true,
    );
    assert.equal(
      isLockFromPreviousBoot(
        { pid: 1234, startedAt: "2026-08-06T09:00:00.000Z" },
        bootStartedAt,
      ),
      false,
    );
    assert.equal(isLockFromPreviousBoot({ pid: 1234, startedAt: "invalid" }, bootStartedAt), false);
  });

  it("recovers a same-boot lock when its recorded writer is definitely absent", async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), "word-bank-autostart-"));
    temporaryRoots.push(projectRoot);
    const reviewDataRoot = path.join(projectRoot, "tools", "word-bank", "review-data");
    const lockPath = path.join(reviewDataRoot, ".review.lock");
    await mkdir(reviewDataRoot, { recursive: true });
    await writeFile(
      lockPath,
      `${JSON.stringify({
        ownerToken: "dead-writer",
        pid: 998_877,
        startedAt: "2026-08-06T09:00:00.000Z",
      })}\n`,
      "utf8",
    );

    let portProbeCount = 0;
    const result = await ensureReviewWorkbench({
      projectRoot,
      reviewDataRoot,
      bootStartedAt: new Date("2026-08-06T08:00:00.000Z"),
      isProcessRunning: () => false,
      probePort: async () => {
        portProbeCount += 1;
        return portProbeCount > 1;
      },
      requestHealth: async () => ({
        service: "crazyphrases-word-bank-review",
        pid: 5678,
        mode: "writable",
        projectRoot,
        reviewDataRoot,
      }),
      launchServer: async ({ recoverStaleLock }) => {
        assert.equal(recoverStaleLock, true);
        await writeFile(
          lockPath,
          `${JSON.stringify({
            ownerToken: "new-writer",
            pid: 5678,
            startedAt: "2026-08-06T10:00:00.000Z",
          })}\n`,
          "utf8",
        );
        return { exitCode: null };
      },
      wait: async () => {},
    });

    assert.deepEqual(result, {
      status: "started",
      origin: "http://127.0.0.1:4177",
      pid: 5678,
    });
  });

  it("fails closed for malformed same-boot lock metadata even when its PID is absent", async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), "word-bank-autostart-"));
    temporaryRoots.push(projectRoot);
    const reviewDataRoot = path.join(projectRoot, "tools", "word-bank", "review-data");
    await mkdir(reviewDataRoot, { recursive: true });
    await writeFile(
      path.join(reviewDataRoot, ".review.lock"),
      `${JSON.stringify({ ownerToken: "incomplete-lock", pid: 998_877 })}\n`,
      "utf8",
    );

    let launchCalled = false;
    await assert.rejects(
      () =>
        ensureReviewWorkbench({
          projectRoot,
          reviewDataRoot,
          bootStartedAt: new Date("2026-08-06T08:00:00.000Z"),
          startupTimeoutMs: 0,
          isProcessRunning: () => false,
          probePort: async () => false,
          launchServer: async () => {
            launchCalled = true;
            return { exitCode: null };
          },
        }),
      /invalid metadata/i,
    );
    assert.equal(launchCalled, false);
  });

  it("does not recover a same-boot lock while its recorded PID is running", async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), "word-bank-autostart-"));
    temporaryRoots.push(projectRoot);
    const reviewDataRoot = path.join(projectRoot, "tools", "word-bank", "review-data");
    await mkdir(reviewDataRoot, { recursive: true });
    await writeFile(
      path.join(reviewDataRoot, ".review.lock"),
      `${JSON.stringify({
        ownerToken: "live-writer",
        pid: 4321,
        startedAt: "2026-08-06T09:00:00.000Z",
      })}\n`,
      "utf8",
    );

    let launchCalled = false;
    await assert.rejects(
      () =>
        ensureReviewWorkbench({
          projectRoot,
          reviewDataRoot,
          bootStartedAt: new Date("2026-08-06T08:00:00.000Z"),
          isProcessRunning: () => true,
          probePort: async () => false,
          launchServer: async () => {
            launchCalled = true;
            return { exitCode: null };
          },
        }),
      /running process/i,
    );
    assert.equal(launchCalled, false);
  });
});
