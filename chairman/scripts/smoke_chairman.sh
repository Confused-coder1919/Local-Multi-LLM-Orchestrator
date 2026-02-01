#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:9100}"

echo "Health:"
curl -s "$BASE_URL/health"
echo

echo "Synthesize:"
curl -s "$BASE_URL/synthesize" \
  -H 'content-type: application/json' \
  -d '{"request_id":"smoke-1","query":"What is the capital of Japan?","answers":[{"anon_id":"A","answer_text":"Tokyo is the capital of Japan."},{"anon_id":"B","answer_text":"The capital is Tokyo."}],"reviews":[{"rankings":["A","B"],"critiques":{"A":"Clear","B":"Brief"},"confidence":0.9}],"aggregated_ranking":[{"anon_id":"A","score":2},{"anon_id":"B","score":1}]}'
echo
