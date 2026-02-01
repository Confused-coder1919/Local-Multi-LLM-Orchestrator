# Environment Variable Audit (Local Services)

This project uses only local Ollama services; no cloud provider keys are required.

## Council member service (root)
- `MODEL_NAME` (required)
- `MEMBER_ID` (default: `member-1`)
- `OLLAMA_BASE_URL` (default: `http://localhost:11434`)
- `PORT` (default: `8001`)
- `ROLE_PROFILE` (optional: influences answer/review tone)

## Orchestrator
- `PORT` (default: `9000`)
- `COUNCIL_MEMBERS` (comma-separated URLs)
- `ORCH_TIMEOUT_MS` (default: `60000`)
- `CHAIRMAN_URL` (default: `http://localhost:9100`)
- `CORS_ORIGINS` (allowed UI origins)
- `PERSISTENCE_ENABLED` (`true|false`)
- `PERSISTENCE_DB` (default: `./data/orchestrator.db`)
- `PERSISTENCE_BOOTSTRAP_LIMIT` (default: `20`)
- `HEARTBEAT_INTERVAL_MS` (default: `15000`)
- `HEARTBEAT_TIMEOUT_MS` (default: `5000`)

## Chairman
- `MODEL_NAME` (required)
- `CHAIRMAN_ID` (default: `chairman-1`)
- `OLLAMA_BASE_URL` (default: `http://localhost:11434`)
- `PORT` (default: `9100`)
- `TIMEOUT_MS` (default: `90000`)

## UI
- `VITE_ORCH_URL` (default: `http://localhost:9000`)

## Cloud provider variables
- None used. No OpenAI/OpenRouter/Anthropic/Mistral cloud keys are required.
