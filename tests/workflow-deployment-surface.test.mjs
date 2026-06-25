import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ciWorkflowPath = new URL("../.github/workflows/ci.yml", import.meta.url);
const deploymentWorkflowPaths = [
  new URL("../.github/workflows/deploy-dev.yml", import.meta.url),
  new URL("../.github/workflows/promote.yml", import.meta.url),
];
const ftpsPreflightWorkflowPath = new URL(
  "../.github/workflows/ftps-preflight.yml",
  import.meta.url,
);
const allWorkflowPaths = [ciWorkflowPath, ...deploymentWorkflowPaths, ftpsPreflightWorkflowPath];

const ftpsPreflightActionPath = new URL(
  "../.github/actions/verify-ftps-deploy-target/action.yml",
  import.meta.url,
);
const supabaseConfigActionPath = new URL(
  "../.github/actions/render-supabase-runtime-config/action.yml",
  import.meta.url,
);

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

const automaticDevDeploymentPaths = [".htaccess", "index.html", "assets/**"];

function getDeployDevPushPaths() {
  const workflow = readFileSync(deploymentWorkflowPaths[0], "utf8");
  const match = workflow.match(
    /\n  push:\r?\n(?:.*\r?\n)*?    paths:\r?\n((?:      - .+(?:\r?\n|$))+)/,
  );

  assert.ok(match, `${deploymentWorkflowPaths[0].pathname} must declare push path filters`);

  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^- /, "").replace(/^"|"$/g, ""));
}

function getPromotePushPathsIgnore() {
  const workflow = readFileSync(deploymentWorkflowPaths[1], "utf8");
  const match = workflow.match(
    /\n  push:\r?\n(?:.*\r?\n)*?    paths-ignore:\r?\n((?:      - .+(?:\r?\n|$))+)/,
  );

  assert.ok(match, `${deploymentWorkflowPaths[1].pathname} must declare push paths-ignore filters`);

  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^- /, "").replace(/^"|"$/g, ""));
}

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

function getWorkflowJobNames(workflowUrl) {
  const workflow = readFileSync(workflowUrl, "utf8");
  return [...workflow.matchAll(/^ {4}name: (.+)$/gm)].map((match) => match[1].trim());
}

describe("workflow deployment surface", () => {
  it("keeps GitHub Actions job names unique for branch protection", () => {
    const jobNames = allWorkflowPaths.flatMap(getWorkflowJobNames);
    const verifyJobNames = jobNames
      .filter((name) => name.includes("Verify static site"))
      .sort();

    assert.deepEqual(verifyJobNames, [
      "CI / Verify static site",
      "Deploy dev / Verify static site",
      "Promote website / Verify static site",
    ]);
    assert.equal(new Set(jobNames).size, jobNames.length);
  });

  it("only requests automatic dev deployments for hosted static runtime changes", () => {
    const deployDevWorkflow = readFileSync(deploymentWorkflowPaths[0], "utf8");
    const pushPaths = getDeployDevPushPaths();

    assert.deepEqual(pushPaths, automaticDevDeploymentPaths);

    for (const sourceOnlyPath of requiredSourceOnlyExcludes) {
      assert.ok(
        !pushPaths.includes(sourceOnlyPath),
        `${deploymentWorkflowPaths[0].pathname} automatic dev push paths must not include ${sourceOnlyPath}`,
      );
    }

    assert.match(deployDevWorkflow, /detect-deployment-surface:/);
    assert.match(deployDevWorkflow, /should_deploy/);
    assert.match(deployDevWorkflow, /needs: detect-deployment-surface/);
    assert.match(
      deployDevWorkflow,
      /needs\.detect-deployment-surface\.outputs\.should_deploy == 'true'/,
    );
  });

  it("does not request automatic main promotion for source-only pushes", () => {
    const promoteWorkflow = readFileSync(deploymentWorkflowPaths[1], "utf8");
    const ignoredPaths = getPromotePushPathsIgnore();

    assert.deepEqual(ignoredPaths, requiredSourceOnlyExcludes);
    assert.match(promoteWorkflow, /promote_production/);
    assert.doesNotMatch(promoteWorkflow, /ftps_preflight_target/);
  });

  for (const workflowPath of deploymentWorkflowPaths) {
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

  it("preflights each FTPS upload with strict certificate verification", () => {
    const preflightAction = readFileSync(ftpsPreflightActionPath, "utf8");

    assert.match(preflightAction, /curl/);
    assert.match(preflightAction, /--ssl-reqd/);
    assert.doesNotMatch(preflightAction, /--insecure/);
    assert.match(preflightAction, /FTP_SERVER_DIR must end with/);
    assert.match(preflightAction, /--quote "CWD \$\{server_dir\}"/);
    assert.match(preflightAction, /--list-only/);

    for (const workflowPath of deploymentWorkflowPaths) {
      const workflow = readFileSync(workflowPath, "utf8");
      const ftpDeployCount = workflow.split("uses: SamKirkland/FTP-Deploy-Action@v4.4.0").length - 1;
      const preflightCount =
        workflow.match(/uses: \.\/\.github\/actions\/verify-ftps-deploy-target/g)?.length ?? 0;

      assert.ok(
        preflightCount >= ftpDeployCount,
        `${workflowPath.pathname} must run strict FTPS preflight before each FTPS upload`,
      );
    }
  });

  it("provides read-only strict FTPS preflight modes for environment secrets", () => {
    const deployDevWorkflow = readFileSync(deploymentWorkflowPaths[0], "utf8");
    const promoteWorkflow = readFileSync(deploymentWorkflowPaths[1], "utf8");
    const ftpsPreflightWorkflow = readFileSync(ftpsPreflightWorkflowPath, "utf8");

    assert.match(deployDevWorkflow, /ftps_preflight_only/);
    assert.match(deployDevWorkflow, /name: Verify dev FTPS target/);
    assert.doesNotMatch(promoteWorkflow, /ftps_preflight_target/);
    assert.doesNotMatch(promoteWorkflow, /name: Verify test FTPS target/);
    assert.doesNotMatch(promoteWorkflow, /name: Verify production FTPS target/);

    assert.match(ftpsPreflightWorkflow, /workflow_dispatch/);
    assert.match(ftpsPreflightWorkflow, /target:/);
    assert.match(ftpsPreflightWorkflow, /name: Verify test FTPS target/);
    assert.match(ftpsPreflightWorkflow, /name: Verify production FTPS target/);
    assert.match(ftpsPreflightWorkflow, /uses: \.\/\.github\/actions\/verify-ftps-deploy-target/);
  });

  it("renders Supabase runtime config from environment variables before each upload", () => {
    const configAction = readFileSync(supabaseConfigActionPath, "utf8");

    assert.match(configAction, /SUPABASE_URL/);
    assert.match(configAction, /SUPABASE_PUBLISHABLE_KEY/);
    assert.match(configAction, /assets\/supabase-config\.js/);
    assert.match(configAction, /sb_publishable_/);
    assert.match(configAction, /getSupabaseRuntimeConfig/);
    assert.match(configAction, /read_text/);
    assert.doesNotMatch(configAction, /sb_secret_/);

    for (const workflowPath of deploymentWorkflowPaths) {
      const workflow = readFileSync(workflowPath, "utf8");
      const ftpDeployIndexes = matchIndexes(
        workflow,
        /uses: SamKirkland\/FTP-Deploy-Action@v4\.4\.0/g,
      );
      const configRenderIndexes = matchIndexes(
        workflow,
        /uses: \.\/\.github\/actions\/render-supabase-runtime-config/g,
      );

      assert.equal(
        configRenderIndexes.length,
        ftpDeployIndexes.length,
        `${workflowPath.pathname} must render Supabase runtime config before each FTPS upload`,
      );

      for (const [index, ftpDeployIndex] of ftpDeployIndexes.entries()) {
        assert.ok(
          configRenderIndexes[index] < ftpDeployIndex,
          `${workflowPath.pathname} must render Supabase runtime config before FTPS upload ${index + 1}`,
        );
      }
    }
  });
});

function matchIndexes(value, pattern) {
  return [...value.matchAll(pattern)].map((match) => match.index);
}
