import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
const shellPath = (path) => path.replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`);

function runGuard({ version = 'v24.22.1', affectedCurl = 60, validCurl = 0, nodeTls = 0, affectedNode = 'CERT_REVOKED', validNode = 'accepted', override = false, event = 'push', actor = 'vince-hardwick', triggeringActor = 'vince-hardwick', ref = 'refs/heads/codex/runner-security-checks', headRef = '', workflow = 'CI' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'runner-security-'));
  mkdirSync(join(root, 'bin'));
  mkdirSync(join(root, 'externals/node24/bin'), { recursive: true });
  writeFileSync(join(root, 'externals/node24/bin/node'), '#!/usr/bin/env bash\nif [[ "$1" == "--version" ]]; then printf "%s\\n" "$FAKE_NODE_VERSION"; elif [[ "$FAKE_NODE_TLS" != 0 ]]; then exit "$FAKE_NODE_TLS"; else exec "$REAL_NODE" --require "$FAKE_HTTPS" "$@"; fi\n', { mode: 0o755 });
  writeFileSync(join(root, 'https.cjs'), `const { EventEmitter } = require('node:events');
require('node:https').get = (options, callback) => {
  const request = new EventEmitter();
  const result = options.hostname === 'nodejs.org' ? process.env.FAKE_VALID_NODE : process.env.FAKE_AFFECTED_NODE;
  queueMicrotask(() => {
    if (result === 'accepted') callback({ resume() {} });
    else request.emit('error', Object.assign(new Error(result), { code: result }));
  });
  return request;
};
require('node:module').syncBuiltinESMExports();
`);
  writeFileSync(join(root, 'environment.sh'), `readlink() { printf '%s/bin/Runner.Worker\\n' "$FAKE_RUNNER_ROOT"; }
curl() { if [[ "\${*: -1}" == 'https://nodejs.org/' ]]; then return "$FAKE_VALID_CURL"; else return "$FAKE_AFFECTED_CURL"; fi; }
`);
  try {
    return spawnSync(bash, ['-c', 'bash "$1"; exit "$?"', 'guard-test', shellPath(resolve('.github/scripts/check-runner-security.sh'))], {
      encoding: 'utf8',
      env: { ...process.env, BASH_ENV: shellPath(join(root, 'environment.sh')), FAKE_RUNNER_ROOT: shellPath(root), REAL_NODE: shellPath(process.execPath), FAKE_HTTPS: join(root, 'https.cjs'),
        FAKE_NODE_VERSION: version, FAKE_AFFECTED_CURL: String(affectedCurl), FAKE_VALID_CURL: String(validCurl), FAKE_NODE_TLS: String(nodeTls), FAKE_AFFECTED_NODE: affectedNode, FAKE_VALID_NODE: validNode,
        ALLOW_UNPATCHED_RUNNER: String(override), GITHUB_EVENT_NAME: event, GITHUB_ACTOR: actor, GITHUB_TRIGGERING_ACTOR: triggeringActor, GITHUB_REF: ref, GITHUB_HEAD_REF: headRef, GITHUB_WORKFLOW: workflow },
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('blocks an affected runner Node before it can make TLS requests', () => {
  const result = runGuard({ version: 'v24.21.0' });
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /require Node 24\.22\.1/);
});

test('blocks a trust store that accepts a compromised chain', () => {
  const result = runGuard({ affectedCurl: 0 });
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /curl did not reject/);
});

test('blocks when the runner Node certificate probe fails', () => {
  const result = runGuard({ nodeTls: 1 });
  assert.equal(result.status, 1);
});

test('requires both certificate rejection and working valid HTTPS', () => {
  for (const options of [{ affectedCurl: 6 }, { affectedCurl: 28 }, { validCurl: 60 }, { version: 'v24.22.0' }, { version: 'v24.22.1-rc.1' }, { version: 'v26.12.1' }]) {
    assert.equal(runGuard(options).status, 1, JSON.stringify(options));
  }
  assert.equal(runGuard().status, 0);
  assert.equal(runGuard({ version: 'v24.23.0' }).status, 0);
});

test('Node probes distinguish certificate rejection from acceptance and network errors', () => {
  for (const affectedNode of ['accepted', 'ENOTFOUND', 'ETIMEDOUT', 'CERT_HAS_EXPIRED']) {
    assert.equal(runGuard({ affectedNode }).status, 1, affectedNode);
  }
  assert.equal(runGuard({ validNode: 'CERT_REVOKED' }).status, 1);
  for (const affectedNode of ['CERT_REVOKED', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY']) {
    assert.equal(runGuard({ affectedNode }).status, 0, affectedNode);
  }
});

test('owner can explicitly skip the guard only on the approved manual workflow/ref pairs', () => {
  const approvedRuns = [
    { workflow: 'CI', ref: 'refs/heads/codex/runner-security-checks' },
    { workflow: 'CI', ref: 'refs/heads/codex/hosting-security-hardening' },
    { workflow: 'CI', ref: 'refs/heads/main' },
    { workflow: 'Deploy dev', ref: 'refs/heads/codex/hosting-security-hardening' },
    { workflow: 'Promote website', ref: 'refs/heads/main' },
    { workflow: 'FTPS preflight', ref: 'refs/heads/main' },
  ];
  for (const { workflow, ref } of approvedRuns) {
    const result = runGuard({ version: 'v24.21.0', override: true, event: 'workflow_dispatch', workflow, ref });
    assert.equal(result.status, 0, ref);
    assert.match(result.stdout + result.stderr, /temporary runner guard override is active/);
  }
});

test('owner-triggered PR checks can skip the guard only for PRs 255, 256 and 257 on their approved head branches', () => {
  for (const options of [
    { ref: 'refs/pull/255/merge', headRef: 'codex/runner-security-checks' },
    { ref: 'refs/pull/256/merge', headRef: 'codex/hosting-security-hardening' },
    { ref: 'refs/pull/257/merge', headRef: 'codex/recovered-stash-publication-20261023' },
  ]) {
    const result = runGuard({ override: true, event: 'pull_request', workflow: 'CI', ...options });
    assert.equal(result.status, 0, JSON.stringify(options));
    assert.match(result.stdout + result.stderr, /temporary runner guard override is active/);
  }
});

test('runner guard override rejects automatic events, other actors and unapproved branches', () => {
  for (const options of [
    { event: 'push' },
    { actor: 'someone-else', event: 'workflow_dispatch' },
    { triggeringActor: 'someone-else', event: 'workflow_dispatch' },
    { event: 'pull_request', ref: 'refs/pull/255/merge', headRef: 'codex/runner-security-checks', actor: 'someone-else' },
    { event: 'pull_request', ref: 'refs/pull/256/merge', headRef: 'codex/hosting-security-hardening', triggeringActor: 'someone-else' },
    { event: 'pull_request', ref: 'refs/pull/257/merge', headRef: 'codex/runner-security-checks' },
    { event: 'pull_request', ref: 'refs/pull/257/merge', headRef: 'codex/other-branch' },
    { event: 'pull_request', ref: 'refs/pull/256/merge', headRef: 'codex/recovered-stash-publication-20261023' },
    { event: 'pull_request', ref: 'refs/pull/255/merge', headRef: 'codex/other-branch' },
    { event: 'pull_request', workflow: 'Deploy dev', ref: 'refs/pull/255/merge', headRef: 'codex/runner-security-checks' },
    { workflow: 'CI', ref: 'refs/heads/codex/issue245-review-ui-refinements', event: 'workflow_dispatch' },
    { workflow: 'Deploy dev', ref: 'refs/heads/codex/runner-security-checks', event: 'workflow_dispatch' },
    { workflow: 'Promote website', ref: 'refs/heads/codex/hosting-security-hardening', event: 'workflow_dispatch' },
    { workflow: 'FTPS preflight', ref: 'refs/heads/codex/hosting-security-hardening', event: 'workflow_dispatch' },
  ]) {
    const result = runGuard({ override: true, ...options });
    assert.equal(result.status, 1, JSON.stringify(options));
    assert.match(result.stdout + result.stderr, /runner guard override/);
  }
});

test('every workflow job checks its own runner before any JavaScript action', () => {
  const script = readFileSync('.github/scripts/check-runner-security.sh', 'utf8').replaceAll('\r\n', '\n').trimEnd();
  const inline = script.split('\n').map(line => line ? `          ${line}` : '').join('\n');
  for (const name of ['ci', 'deploy-dev', 'promote', 'ftps-preflight']) {
    const workflow = readFileSync(`.github/workflows/${name}.yml`, 'utf8').replaceAll('\r\n', '\n');
    const jobs = workflow.split('    steps:\n').slice(1);
    assert.ok(jobs.length > 0);
    assert.ok(jobs[0].startsWith('      - &runner-security\n'), `${name}: first job must define the security check before checkout`);
    const stepPrefix = [
      '      - &runner-security',
      '        name: Verify runner security before JavaScript actions',
      '        shell: bash',
      '        env:',
      '          ALLOW_UNPATCHED_RUNNER: $' + (name === 'ci'
        ? "{{ inputs.allow_unpatched_runner || (github.event_name == 'pull_request' && github.actor == 'vince-hardwick' && github.triggering_actor == 'vince-hardwick') }}"
        : '{{ inputs.allow_unpatched_runner }}'),
      '        run: |',
    ].join('\n');
    assert.ok(jobs[0].startsWith(`${stepPrefix}\n${inline}\n`), `${name}: embedded check must match the tested script`);
    for (const job of jobs.slice(1)) assert.ok(job.startsWith('      - *runner-security\n'), `${name}: every job must start with the check`);
  }
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.match(ci, /workflow_dispatch:/);
  const pushTrigger = ci.match(/(?:^|\r?\n)  push:\r?\n([\s\S]*?)(?=\r?\n\S)/)?.[1] ?? '';
  assert.match(pushTrigger, /!codex\/runner-security-checks/);
  assert.match(pushTrigger, /!codex\/hosting-security-hardening/);
  assert.ok(pushTrigger.indexOf('"codex/**"') < pushTrigger.indexOf('!codex/runner-security-checks'));
  assert.ok(pushTrigger.indexOf('"codex/**"') < pushTrigger.indexOf('!codex/hosting-security-hardening'));
  for (const name of ['ci', 'deploy-dev', 'promote', 'ftps-preflight']) {
    const workflow = readFileSync(`.github/workflows/${name}.yml`, 'utf8').replaceAll('\r\n', '\n');
    assert.match(workflow, /allow_unpatched_runner:\n\s+description: Skip runner checks for the owner-approved/i);
    assert.match(workflow, /allow_unpatched_runner:\n(?:(?!\n\S).)*?type: boolean/s);
  }
  assert.doesNotMatch(ci, /secrets\.|FTP-Deploy|environment:/);
});
