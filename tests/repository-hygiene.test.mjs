import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const projectRoot = new URL("..", import.meta.url);

function gitAttribute(path, attribute) {
  const output = execFileSync("git", ["check-attr", attribute, "--", path], {
    cwd: projectRoot,
    encoding: "utf8",
  }).trim();
  const [, , value] = output.split(": ");

  return value;
}

function sourceLines(path) {
  return readFileSync(new URL(path, projectRoot), "utf8").split(/\r?\n/);
}

function assertSourceDoesNotMatch(path, ruleName, pattern) {
  sourceLines(path).forEach((line, index) => {
    assert.equal(
      pattern.test(line),
      false,
      `${path}:${index + 1} uses ${ruleName}: ${line.trim()}`,
    );
  });
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

  it("keeps first-party production UI styling out of inline style APIs", () => {
    const productionUiFiles = [
      "index.html",
      "assets/app.js",
      "assets/clipboard.js",
    ];
    const inlineStyleRules = [
      { name: "style tag", pattern: /<style\b/i },
      { name: "style attribute", pattern: /<[^>]*\sstyle\s*=/i },
      {
        name: "direct element.style mutation",
        pattern: /\.style\.(?!setProperty\b)|\.style\[/,
      },
      {
        name: "style attribute mutation",
        pattern: /\.setAttribute\(\s*["']style["']/,
      },
      {
        name: "runtime style element creation",
        pattern: /\.createElement\(\s*["']style["']/,
      },
    ];

    for (const filePath of productionUiFiles) {
      for (const rule of inlineStyleRules) {
        assertSourceDoesNotMatch(filePath, rule.name, rule.pattern);
      }
    }
  });
});
