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

if ! command -v ollama >/dev/null 2>&1; then
  echo "ollama is required but not found in PATH."
  exit 1
fi

read_env_value() {
  local file="$1"
  local key="$2"
  local line
  if [[ ! -f "$file" ]]; then
    return 0
  fi
  line=$(grep -E "^${key}=" "$file" | tail -n1 || true)
  echo "${line#*=}"
}

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

OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"
if ! curl -fsS "$OLLAMA_BASE_URL/api/tags" >/dev/null 2>&1; then
  echo "Starting ollama..."
  if [[ "${OLLAMA_FORCE_CPU:-}" == "1" ]]; then
    start_process "ollama" "$LOG_DIR/ollama.log" "$PID_DIR/ollama.pid" \
      env OLLAMA_LLM_LIBRARY=cpu GGML_METAL_TENSOR_DISABLE=1 GGML_METAL_BF16_DISABLE=1 ollama serve
  else
    start_process "ollama" "$LOG_DIR/ollama.log" "$PID_DIR/ollama.pid" \
      ollama serve
  fi
else
  echo "Ollama already running at $OLLAMA_BASE_URL"
fi

FALLBACK_MODEL="mistral:7b-instruct"
CHAIRMAN_ENV_FILE="$ROOT_DIR/chairman/.env"
CHAIRMAN_MODEL=$(read_env_value "$CHAIRMAN_ENV_FILE" "MODEL_NAME")
if [[ -z "${CHAIRMAN_MODEL:-}" ]]; then
  CHAIRMAN_MODEL="$FALLBACK_MODEL"
fi

echo "Chairman model: $CHAIRMAN_MODEL"

start_process "council_members" "$LOG_DIR/council_members.log" "$PID_DIR/council_members.pid" \
  bash "$ROOT_DIR/scripts/run_members_local.sh"

start_process "orchestrator" "$LOG_DIR/orchestrator.log" "$PID_DIR/orchestrator.pid" \
  bash -lc "cd \"$ROOT_DIR/orchestrator\" && npm run dev"

start_process "chairman" "$LOG_DIR/chairman.log" "$PID_DIR/chairman.pid" \
  env MODEL_NAME="$CHAIRMAN_MODEL" bash -lc "cd \"$ROOT_DIR/chairman\" && npm run dev"

if [[ -f "$ROOT_DIR/ui/package.json" ]]; then
  if [[ ! -d "$ROOT_DIR/ui/node_modules" ]]; then
    echo "Installing UI dependencies..."
    (cd "$ROOT_DIR/ui" && npm install)
  fi

  start_process "ui" "$LOG_DIR/ui.log" "$PID_DIR/ui.pid" \
    bash -lc "cd \"$ROOT_DIR/ui\" && npm run dev"
else
  echo "UI package not found, skipping UI startup."
fi

cat <<EOF_MSG

Services started.
Logs:
  $LOG_DIR/ollama.log
  $LOG_DIR/council_members.log
  $LOG_DIR/orchestrator.log
  $LOG_DIR/chairman.log
  $LOG_DIR/ui.log

PIDs:
  $PID_DIR/ollama.pid
  $PID_DIR/council_members.pid
  $PID_DIR/orchestrator.pid
  $PID_DIR/chairman.pid
  $PID_DIR/ui.pid
EOF_MSG
