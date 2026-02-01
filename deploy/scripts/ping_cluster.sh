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

if [[ -z "${ORCH_URL:-}" ]]; then
  echo "Config must set ORCH_URL"
  exit 1
fi

QUERY=${QUERY:-"Explain the difference between symmetric and asymmetric encryption, and when to use each."}

stage1=$(curl -s "$ORCH_URL/stage1" \
  -H 'content-type: application/json' \
  -d "{\"query\":\"$QUERY\"}")

request_id=$(printf '%s' "$stage1" | node -e '
let data = "";
process.stdin.on("data", d => data += d);
process.stdin.on("end", () => {
  try {
    const parsed = JSON.parse(data);
    if (!parsed.request_id) {
      process.exit(1);
    }
    process.stdout.write(parsed.request_id);
  } catch {
    process.exit(1);
  }
});
')

if [[ -z "$request_id" ]]; then
  echo "Stage1 failed: $stage1"
  exit 1
fi

echo "Request ID: $request_id"

stage2=$(curl -s "$ORCH_URL/stage2" \
  -H 'content-type: application/json' \
  -d "{\"request_id\":\"$request_id\"}")

stage3=$(curl -s "$ORCH_URL/stage3" \
  -H 'content-type: application/json' \
  -d "{\"request_id\":\"$request_id\"}")

status=$(printf '%s' "$stage3" | node -e '
let data = "";
process.stdin.on("data", d => data += d);
process.stdin.on("end", () => {
  try {
    const parsed = JSON.parse(data);
    process.stdout.write(parsed.status || "");
  } catch {
    process.exit(1);
  }
});
')

final_answer=$(printf '%s' "$stage3" | node -e '
let data = "";
process.stdin.on("data", d => data += d);
process.stdin.on("end", () => {
  try {
    const parsed = JSON.parse(data);
    if (parsed.final_answer) {
      process.stdout.write(parsed.final_answer);
    }
  } catch {
    process.exit(1);
  }
});
')

if [[ "$status" != "ok" ]]; then
  echo "Stage3 failed: $stage3"
  exit 1
fi

echo "Final answer excerpt:"
printf '%s\n' "$final_answer" | head -c 240
printf '\n'
