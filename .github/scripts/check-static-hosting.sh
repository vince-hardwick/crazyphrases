#!/usr/bin/env bash
# Read-only HTTP checks. An optional origin IP bypasses the CDN, not TLS validation.
set -euo pipefail

base_url="${1:-}"
if [[ ! "$base_url" =~ ^https://[a-zA-Z0-9.-]+/?$ ]]; then
  echo 'Usage: check-static-hosting.sh https://hostname [origin-ip]' >&2
  exit 2
fi
base_url="${base_url%/}"
curl_options=()
if [[ -n "${2:-}" ]]; then
  curl_options=(--resolve "${base_url#https://}:443:$2")
fi
failures=0

check_path() {
  local path="$1" expected="$2" status
  if ! status=$(curl -q --silent --show-error --max-time 20 \
    "${curl_options[@]}" --output /dev/null --write-out '%{http_code}' "$base_url$path"); then
    echo "FAIL $path: transport or certificate error"
    failures=$((failures + 1))
    return
  fi
  if [[ "$expected" == denied && ( "$status" == 403 || "$status" == 404 ) ]] ||
     [[ "$expected" == available && "$status" == 200 ]]; then
    echo "PASS $path $status"
  else
    echo "FAIL $path $status (expected $expected; redirects are not proof)"
    failures=$((failures + 1))
  fi
}

for path in /assets/ /assets/word-bank/ /AGENTS.md /CONTEXT.md /.font-awesome.md \
  /.ftp-deploy-sync-state.json /.ftpquota /tools/word-bank/word-bank-pipeline.js \
  /package.json /README.md; do
  check_path "$path" denied
done
for path in / /assets/app.js /assets/site.css /assets/supabase-config.js \
  /assets/word-bank/manifest.json /assets/img/favicon.ico; do
  check_path "$path" available
done
echo "Hosting verification failures: $failures"
[[ "$failures" == 0 ]]
