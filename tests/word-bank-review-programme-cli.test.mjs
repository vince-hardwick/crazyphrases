import { execFile } from "node:child_process";
import { test } from "node:test";
import assert from "node:assert/strict";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("review check validates every tranche referenced by the Register", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["tools/word-bank/build-review-programme.mjs", "--check"],
    { cwd: projectRoot },
  );

  assert.match(stdout, /Validated the review programme/);
});
