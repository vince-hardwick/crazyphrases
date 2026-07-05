import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const projectRoot = new URL("..", import.meta.url);

function gitAttribute(path, attribute) {
  const output = execFileSync("git", ["check-attr", attribute, "--", path], {
    cwd: projectRoot,
    encoding: "utf8",
  }).trim();
  const [, , value] = output.split(": ");

  return value;
}

describe("repository hygiene", () => {
  it("keeps generated Word Bank JSON assets on LF line endings", () => {
    const generatedWordBankJsonAssets = [
      "assets/word-bank/manifest.json",
      "assets/word-bank/shards/adjective.2026-07-05-esdb-v2-1e5b7d3-tracer.json",
      "assets/word-bank/shards/noun.2026-07-05-esdb-v2-1e5b7d3-noun-tracer.json",
    ];

    for (const assetPath of generatedWordBankJsonAssets) {
      assert.equal(gitAttribute(assetPath, "text"), "set");
      assert.equal(gitAttribute(assetPath, "eol"), "lf");
    }
  });
});
