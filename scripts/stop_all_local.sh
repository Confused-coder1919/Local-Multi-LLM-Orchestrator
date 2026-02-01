#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$ROOT_DIR/pids"

stop_pid() {
  local name="$1"
  local pid_file="$2"

  if [[ ! -f "$pid_file" ]]; then
    echo "$name pid file not found: $pid_file"
    return 0
  fi

  local pid
  pid=$(cat "$pid_file")
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" || true
    echo "Stopped $name (pid $pid)"
  else
    echo "$name not running (pid $pid)"
  fi

  rm -f "$pid_file"
}

stop_pid "chairman" "$PID_DIR/chairman.pid"
stop_pid "orchestrator" "$PID_DIR/orchestrator.pid"
stop_pid "ui" "$PID_DIR/ui.pid"
stop_pid "council_members" "$PID_DIR/council_members.pid"
stop_pid "ollama" "$PID_DIR/ollama.pid"
