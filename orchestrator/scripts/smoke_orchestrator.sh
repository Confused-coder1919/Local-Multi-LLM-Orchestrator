#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:9000}"

echo "Health:"
curl -s "$BASE_URL/health"
echo

echo "Stage1:"
STAGE1_RESPONSE=$(curl -s "$BASE_URL/stage1" \
  -H 'content-type: application/json' \
  -d '{"query":"Summarize the key causes of the French Revolution."}')

echo "$STAGE1_RESPONSE"

echo "Stage2:"
REQUEST_ID=$(printf '%s' "$STAGE1_RESPONSE" | node -e '
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

STAGE2_RESPONSE=$(curl -s "$BASE_URL/stage2" \
  -H 'content-type: application/json' \
  -d "{\"request_id\":\"$REQUEST_ID\"}")
echo "$STAGE2_RESPONSE"
echo

echo "Stage3:"
STAGE3_RESPONSE=$(curl -s "$BASE_URL/stage3" \
  -H 'content-type: application/json' \
  -d "{\"request_id\":\"$REQUEST_ID\"}")
echo "$STAGE3_RESPONSE"
echo

FINAL_ANSWER=$(printf '%s' "$STAGE3_RESPONSE" | node -e '
let data = "";
process.stdin.on("data", d => data += d);
process.stdin.on("end", () => {
  try {
    const parsed = JSON.parse(data);
    if (parsed.final_answer) {
      process.stdout.write(parsed.final_answer);
    }
  } catch {}
});
')

if [[ -n "$FINAL_ANSWER" ]]; then
  echo "Final answer:"
  echo "$FINAL_ANSWER"
  echo
fi

echo "Request state:"
curl -s "$BASE_URL/request/$REQUEST_ID"
echo
