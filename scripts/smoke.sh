#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8001}"

echo "Health:"
curl -s "$BASE_URL/health"
echo

echo "Answer:"
curl -s "$BASE_URL/answer" \
  -H 'content-type: application/json' \
  -d '{"request_id":"smoke-1","query":"What is the capital of France?"}'
echo

echo "Review:"
curl -s "$BASE_URL/review" \
  -H 'content-type: application/json' \
  -d '{"request_id":"smoke-2","query":"Explain photosynthesis.","peer_answers":[{"anon_id":"a1","answer_text":"Photosynthesis converts light into chemical energy."},{"anon_id":"a2","answer_text":"Plants use sunlight to make glucose and oxygen."}]}'
echo
