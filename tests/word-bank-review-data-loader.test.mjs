import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

import { loadRegisteredReviewTranches } from "../tools/word-bank/build-review-programme.mjs";

test("loads every tranche referenced by the Review Register", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "crazyphrases-review-loader-"));
  context.after(() => rm(root, { force: true, recursive: true }));
  await mkdir(path.join(root, "tranches"), { recursive: true });
  const references = [
    "noun-baseline",
    "adjective-baseline",
    "noun-semantic-gap-001",
  ].map((id) => ({ id, path: `tranches/${id}.json` }));

  await Promise.all(
    references.map(({ id, path: relativePath }) =>
      writeFile(
        path.join(root, ...relativePath.split("/")),
        `${JSON.stringify({ id })}\n`,
        "utf8",
      ),
    ),
  );

  const tranches = await loadRegisteredReviewTranches(root, {
    tranches: references,
  });

  assert.deepEqual(
    tranches.map(({ id }) => id),
    references.map(({ id }) => id),
  );
});
