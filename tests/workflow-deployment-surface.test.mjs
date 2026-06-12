import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflowPaths = [
  new URL("../.github/workflows/deploy-dev.yml", import.meta.url),
  new URL("../.github/workflows/promote.yml", import.meta.url),
];

const requiredSourceOnlyExcludes = [
  ".github/**",
  "AGENTS.md",
  "CONTEXT.md",
  "README.md",
  "docs/**",
  "output/**",
  "package.json",
  "package-lock.json",
  "supabase/**",
  "tests/**",
];

function getFtpDeployExcludeLists(workflowUrl) {
  const workflow = readFileSync(workflowUrl, "utf8");
  const actionBlocks = workflow
    .split("uses: SamKirkland/FTP-Deploy-Action@v4.4.0")
    .slice(1);

  assert.ok(actionBlocks.length > 0, `${workflowUrl.pathname} must deploy with FTP-Deploy-Action`);

  return actionBlocks.map((block) => {
    const match = block.match(/exclude:\s*\|\r?\n((?:\s{12}.+(?:\r?\n|$))+)/);
    assert.ok(match, `${workflowUrl.pathname} FTPS deploy step must declare an exclude list`);

    return match[1]
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  });
}

describe("workflow deployment surface", () => {
  for (const workflowPath of workflowPaths) {
    it(`${workflowPath.pathname} excludes source-only paths from each FTPS upload`, () => {
      const excludeLists = getFtpDeployExcludeLists(workflowPath);

      for (const excludeList of excludeLists) {
        for (const requiredExclude of requiredSourceOnlyExcludes) {
          assert.ok(
            excludeList.includes(requiredExclude),
            `${workflowPath.pathname} FTPS exclude list must include ${requiredExclude}`,
          );
        }
      }
    });
  }
});
