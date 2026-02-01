#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

bash "$ROOT_DIR/scripts/run_all_local.sh"

wait_for_url() {
  local url="$1"
  local retries=30
  for ((i=1; i<=retries; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

if ! wait_for_url "http://localhost:5173"; then
  echo "UI did not become reachable at http://localhost:5173"
  exit 1
fi

echo "Running UI verification..."
if (cd "$ROOT_DIR/ui" && npm run test:ui); then
  echo "UI VERIFIED OK"
else
  echo "UI verification failed. See artifacts in $ROOT_DIR/ui/test-artifacts"
  exit 1
fi

if command -v open >/dev/null 2>&1; then
  open http://localhost:5173
else
  echo "Open http://localhost:5173 in your browser."
fi

cat <<'EOF_MSG'

Demo checklist:
- Confirm health bar shows green for members + chairman
- Run a query and watch Stage 1 -> 2 -> 3 progression
- Click through Stage 1 tabs (A/B/C)
- Review Stage 2 rankings + critiques + aggregated table
- Confirm Stage 3 final answer + rationale + used signals
EOF_MSG
