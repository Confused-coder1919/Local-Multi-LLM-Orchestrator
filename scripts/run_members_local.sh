#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v ollama >/dev/null 2>&1; then
  echo "ollama is required but not found in PATH."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but not found in PATH."
  exit 1
fi

read_env_value() {
  local file="$1"
  local key="$2"
  local line
  line=$(grep -E "^${key}=" "$file" | tail -n1 || true)
  echo "${line#*=}"
}

M1_MODEL=$(read_env_value ".env.member1" "MODEL_NAME")
M2_MODEL=$(read_env_value ".env.member2" "MODEL_NAME")
M3_MODEL=$(read_env_value ".env.member3" "MODEL_NAME")
M1_ROLE=$(read_env_value ".env.member1" "ROLE_PROFILE")
M2_ROLE=$(read_env_value ".env.member2" "ROLE_PROFILE")
M3_ROLE=$(read_env_value ".env.member3" "ROLE_PROFILE")
FALLBACK_MODEL="mistral:7b-instruct"

INSTALLED_MODELS=$(ollama list | awk 'NR>1 {print $1}')

model_exists() {
  echo "$INSTALLED_MODELS" | grep -Fxq "$1"
}

missing_models=()
for model in "$M1_MODEL" "$M2_MODEL" "$M3_MODEL"; do
  if [[ -n "$model" ]] && ! model_exists "$model"; then
    missing_models+=("$model")
  fi
done

echo "Member models:"
echo "  member-1 -> ${M1_MODEL:-$FALLBACK_MODEL}"
echo "  member-2 -> ${M2_MODEL:-$FALLBACK_MODEL}"
echo "  member-3 -> ${M3_MODEL:-$FALLBACK_MODEL}"
echo "Member role profiles:"
echo "  member-1 -> ${M1_ROLE:-default}"
echo "  member-2 -> ${M2_ROLE:-default}"
echo "  member-3 -> ${M3_ROLE:-default}"

if (( ${#missing_models[@]} > 0 )); then
  if [[ "${PULL_MISSING_MODELS:-}" == "1" ]]; then
    for model in "${missing_models[@]}"; do
      echo "Pulling missing model: $model"
      ollama pull "$model"
    done
  else
    if ! model_exists "$FALLBACK_MODEL"; then
      echo "Fallback model $FALLBACK_MODEL is not installed."
      echo "Set PULL_MISSING_MODELS=1 to pull missing models."
      exit 1
    fi
    echo "Missing models detected: ${missing_models[*]}"
    echo "Falling back to $FALLBACK_MODEL for all members."
    export OVERRIDE_MODEL="$FALLBACK_MODEL"
  fi
fi

pids=()

start_member() {
  local env_file="$1"
  (
    set -a
    source "$env_file"
    set +a
    if [[ -n "${OVERRIDE_MODEL:-}" ]]; then
      export MODEL_NAME="$OVERRIDE_MODEL"
    fi
    npm run dev
  ) &
  pids+=("$!")
}

trap 'echo "Stopping members..."; kill "${pids[@]}" 2>/dev/null || true' INT TERM EXIT

start_member ".env.member1"
start_member ".env.member2"
start_member ".env.member3"

echo "Council members running (PIDs: ${pids[*]}). Press Ctrl+C to stop."
wait
