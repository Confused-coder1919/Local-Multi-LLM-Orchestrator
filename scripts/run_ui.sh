#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
PID_DIR="$ROOT_DIR/pids"

mkdir -p "$LOG_DIR" "$PID_DIR"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but not found in PATH."
  exit 1
fi

if [[ ! -f "$ROOT_DIR/ui/package.json" ]]; then
  echo "UI package not found at $ROOT_DIR/ui"
  exit 1
fi

if [[ ! -d "$ROOT_DIR/ui/node_modules" ]]; then
  echo "Installing UI dependencies..."
  (cd "$ROOT_DIR/ui" && npm install)
fi

start_process() {
  local name="$1"
  local log_file="$2"
  local pid_file="$3"
  shift 3

  if [[ -f "$pid_file" ]]; then
    local existing_pid
    existing_pid=$(cat "$pid_file")
    if kill -0 "$existing_pid" 2>/dev/null; then
      echo "$name already running (pid $existing_pid)"
      return 0
    fi
  fi

  "$@" > "$log_file" 2>&1 &
  local pid=$!
  echo "$pid" > "$pid_file"
  echo "$name started (pid $pid)"
}

start_process "ui" "$LOG_DIR/ui.log" "$PID_DIR/ui.pid" \
  bash -lc "cd \"$ROOT_DIR/ui\" && npm run dev"

cat <<EOF_MSG

UI started.
Log:
  $LOG_DIR/ui.log
PID:
  $PID_DIR/ui.pid
EOF_MSG
