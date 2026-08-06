import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  isExpectedWritableReviewService,
  isLockFromPreviousBoot,
} from "../tools/word-bank/review-workbench-autostart.mjs";

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
});
