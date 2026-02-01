#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG_PATH="${1:-$ROOT_DIR/deploy/env/cluster.env}"

if [[ ! -f "$CONFIG_PATH" ]]; then
  echo "Config not found: $CONFIG_PATH"
  echo "Create it from deploy/env/cluster.env.example"
  exit 1
fi

set -a
source "$CONFIG_PATH"
set +a

if [[ -z "${ORCH_URL:-}" || -z "${CHAIRMAN_URL:-}" || -z "${MEMBERS:-}" ]]; then
  echo "Config must set ORCH_URL, CHAIRMAN_URL, MEMBERS"
  exit 1
fi

IFS=',' read -r -a member_array <<< "$MEMBERS"

check_ok_field() {
  local file_path="$1"
  RESP="$file_path" node -e '
    const fs = require("fs");
    try {
      const data = JSON.parse(fs.readFileSync(process.env.RESP, "utf8"));
      process.stdout.write(String(data.ok));
    } catch {
      process.stdout.write("false");
    }
  '
}

check_url() {
  local name="$1"
  local base_url="$2"
  local tmp
  tmp=$(mktemp)
  local code
  code=$(curl -s -o "$tmp" -w "%{http_code}" "$base_url/health" || true)

  local status="FAIL"
  if [[ "$code" == "200" ]]; then
    local ok
    ok=$(check_ok_field "$tmp")
    if [[ "$ok" == "true" ]]; then
      status="OK"
    fi
  fi

  rm -f "$tmp"
  printf "%-14s %-45s %s\n" "$name" "$base_url" "$status"

  if [[ "$status" != "OK" ]]; then
    return 1
  fi
  return 0
}

echo "Service health:"
printf "%-14s %-45s %s\n" "SERVICE" "URL" "STATUS"

overall=0
if ! check_url "orchestrator" "$ORCH_URL"; then
  overall=1
fi
if ! check_url "chairman" "$CHAIRMAN_URL"; then
  overall=1
fi

index=1
for member in "${member_array[@]}"; do
  if [[ -n "$member" ]]; then
    if ! check_url "member-$index" "$member"; then
      overall=1
    fi
    index=$((index + 1))
  fi
done

if [[ "$overall" -ne 0 ]]; then
  exit 1
fi
