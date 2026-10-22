#!/usr/bin/env bash
set -euo pipefail

# This exception is only for explicitly requested manual recovery runs. It is
# scoped to the repository owner as both original and triggering actor, plus
# the approved workflow/ref pairs; automatic events must execute full checks.
if [[ "${ALLOW_UNPATCHED_RUNNER:-false}" == "true" ]]; then
  if [[ "${GITHUB_EVENT_NAME:-}" != "workflow_dispatch" ||
        "${GITHUB_ACTOR:-}" != "vince-hardwick" ||
        "${GITHUB_TRIGGERING_ACTOR:-}" != "vince-hardwick" ]]; then
    echo "::error::The runner guard override requires the owner to initiate and run the manual dispatch."
    exit 1
  fi
  case "${GITHUB_WORKFLOW:-}:${GITHUB_REF:-}" in
    "CI:refs/heads/codex/runner-security-checks"|\
    "CI:refs/heads/codex/hosting-security-hardening"|\
    "CI:refs/heads/main"|\
    "Deploy dev:refs/heads/codex/hosting-security-hardening"|\
    "Promote website:refs/heads/main"|\
    "FTPS preflight:refs/heads/main")
      echo "::warning::Owner-approved temporary runner guard override is active for ${GITHUB_WORKFLOW} on ${GITHUB_REF}."
      exit 0
      ;;
    *)
      echo "::error::The runner guard override is not enabled for ${GITHUB_REF:-an unknown ref}."
      exit 1
      ;;
  esac
fi

# JavaScript actions use the runner's executable, not the Node selected on PATH.
pid="$PPID"
runner_node=""
while [[ "$pid" -gt 1 ]]; do
  executable="$(readlink -f "/proc/$pid/exe" 2>/dev/null || true)"
  if [[ "${executable##*/}" == "Runner.Worker" ]]; then
    runner_node="$(dirname "$(dirname "$executable")")/externals/node24/bin/node"
    break
  fi
  pid="$(ps -o ppid= -p "$pid" | tr -d ' ')"
  [[ "$pid" =~ ^[0-9]+$ ]] || break
done
if [[ ! -x "$runner_node" ]]; then
  echo "::error::Cannot locate the active runner's Node 24 executable."
  exit 1
fi

version="$("$runner_node" --version)"
printf 'Runner Node: %s (%s)\n' "$version" "$runner_node"
if [[ ! "$version" =~ ^v24\.([0-9]+)\.([0-9]+)$ ]] ||
   (( BASH_REMATCH[1] < 22 || (BASH_REMATCH[1] == 22 && BASH_REMATCH[2] < 1) )); then
  echo "::error::JavaScript actions require Node 24.22.1 or later within 24.x."
  exit 1
fi

# An HTTP success from these incident test hosts means distrust is missing.
# Only curl's certificate-validation error counts; DNS/timeouts do not.
for host in dv-g3b-emudhra.we-have-a-problem.com dv-g3b-aaa-emudhra.we-have-a-problem.com; do
  result=0
  curl -q --head --silent --show-error --output /dev/null --connect-timeout 10 --max-time 20 "https://$host/" || result=$?
  printf 'curl certificate probe: %s exit=%s\n' "$host" "$result"
  if [[ "$result" != 60 ]]; then
    echo "::error::curl did not reject $host for a certificate-validation reason."
    exit 1
  fi
done
if ! curl -q --head --silent --show-error --output /dev/null --connect-timeout 10 --max-time 20 https://nodejs.org/; then
  echo "::error::curl could not validate the valid HTTPS control."
  exit 1
fi


"$runner_node" --input-type=module <<'NODE'
import https from 'node:https';
const revoked = new Set(['CERT_REVOKED', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_UNTRUSTED']);
const hosts = ['dv-g3b-emudhra.we-have-a-problem.com', 'dv-g3b-aaa-emudhra.we-have-a-problem.com', 'nodejs.org'];
let failed = false;
for (const host of hosts) {
  const result = await new Promise(resolve => {
    const request = https.get({ hostname: host, method: 'HEAD', timeout: 20000 }, response => {
      response.resume();
      resolve('accepted');
    });
    request.on('timeout', () => request.destroy(new Error('timeout')));
    request.on('error', error => resolve(error.code || error.message));
  });
  console.log(`Runner Node certificate probe: ${host} ${result}`);
  if (host === 'nodejs.org' ? result !== 'accepted' : !revoked.has(result)) failed = true;
}
if (failed) {
  console.error('::error::Runner Node certificate validation failed the security probes.');
  process.exitCode = 1;
}
NODE
