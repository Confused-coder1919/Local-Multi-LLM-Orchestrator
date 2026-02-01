# Project Context (LLM Council)

## What this project is
Local-first, multi-service LLM council that collects answers from multiple model "members", asks them to review each other, and synthesizes a final response via a chairman model. All inference runs locally via Ollama; no cloud model providers are used.

## Where the LLMs are hosted
- All models are hosted locally by Ollama on each machine.
- Default Ollama base URL is `http://localhost:11434`.
- In multi-machine setups, each host runs its own Ollama instance and services point to that host's Ollama base URL.

## Services and roles
- Council member service (root `src/server.ts`)
  - Responsibilities: answer generation (`/answer`), peer review (`/review`), health (`/health`).
  - Calls Ollama locally using `src/ollamaClient.ts`.
  - Uses prompts in `src/prompts.ts` and schemas in `src/schemas.ts`.
- Orchestrator (`orchestrator/src/server.ts`)
  - Responsibilities: stage 1/2/3 coordination, anonymization, aggregation, run state, health aggregation, heartbeat monitoring.
  - No LLM calls. Only HTTP calls to member services and chairman service.
  - Persistence: in-memory + SQLite (optional).
- Chairman (`chairman/src/server.ts`)
  - Responsibilities: synthesis only (`/synthesize`), health (`/health`).
  - Calls Ollama locally using `chairman/src/ollamaClient.ts`.
  - Uses prompts in `chairman/src/prompts.ts` and schemas in `chairman/src/schemas.ts`.
- UI (`ui/`)
  - React UI that drives the pipeline via orchestrator.
  - Dashboard, stage workflow, per-model status, and run history.

## High-level flow (Stage 1 -> Stage 3)
1) UI sends `POST /stage1` to orchestrator with the user query.
2) Orchestrator sends `POST /answer` to each member.
3) Orchestrator anonymizes answers (A/B/C...) and sends `POST /review` to each member with peer answers.
4) Orchestrator aggregates rankings and sends `POST /synthesize` to chairman.
5) Orchestrator returns final response and stores state.

## Endpoints (current)
### Orchestrator
- `GET /health` (includes heartbeat snapshot)
- `GET /heartbeat` (last heartbeat per service)
- `POST /stage1` `{ query, options?: { temperature?: number } }`
- `POST /stage2` `{ request_id, options?: { temperature?: number } }`
- `POST /stage3` `{ request_id, options?: { temperature?: number } }`
- `GET /request/:id`
- `GET /runs?limit=20`
- `GET /runs/:id`
- `DELETE /runs/:id`

### Council member
- `GET /health`
- `POST /answer` `{ request_id, query, options?: { temperature?: number } }`
- `POST /review` `{ request_id, query, peer_answers, options?: { temperature?: number } }`

### Chairman
- `GET /health`
- `POST /synthesize` `{ request_id, query, answers, reviews, aggregated_ranking, options?: { temperature?: number } }`

## Token usage estimation
- Member and chairman responses include optional `token_usage` with heuristic counts.
- This is an estimate based on characters (not tokenizer-accurate).

## Deployment modes
### Local single-machine (default)
- Run all services on one machine with local Ollama.
- Recommended script: `./scripts/run_all_local.sh`.

### Multi-machine (LAN)
- Orchestrator + UI on one machine.
- Members and chairman on separate machines if needed.
- Configure URLs in `deploy/env/orchestrator.env.example` and `deploy/env/cluster.env.example`.

## Configuration (env)
### Council member (root)
- `MODEL_NAME` (required)
- `MEMBER_ID` (default: `member-1`)
- `OLLAMA_BASE_URL` (default: `http://localhost:11434`)
- `PORT` (default: `8001`)
- `ROLE_PROFILE` (optional: influences answer/review tone)

### Orchestrator
- `PORT` (default: `9000`)
- `COUNCIL_MEMBERS` (comma-separated URLs)
- `ORCH_TIMEOUT_MS` (default: `60000`)
- `CHAIRMAN_URL` (default: `http://localhost:9100`)
- `CORS_ORIGINS` (allowed UI origins)
- `PERSISTENCE_ENABLED` (`true|false`, default: `true`)
- `PERSISTENCE_DB` (default: `./data/orchestrator.db`)
- `PERSISTENCE_BOOTSTRAP_LIMIT` (default: `20`)
- `HEARTBEAT_INTERVAL_MS` (default: `15000`)
- `HEARTBEAT_TIMEOUT_MS` (default: `5000`)

### Chairman
- `MODEL_NAME` (required)
- `CHAIRMAN_ID` (default: `chairman-1`)
- `OLLAMA_BASE_URL` (default: `http://localhost:11434`)
- `PORT` (default: `9100`)
- `TIMEOUT_MS` (default: `90000`)

### UI
- `VITE_ORCH_URL` (default: `http://localhost:9000`)

## Ports
- UI: `5173`
- Orchestrator: `9000`
- Chairman: `9100`
- Members: `8001-8003`
- Ollama: `11434`

## Persistence and run history
- Orchestrator stores active request state in memory.
- Full request state can be persisted to SQLite (`orchestrator/data/orchestrator.db`).
- UI can load, delete, and export persisted runs.

## Health and heartbeat
- Orchestrator `/health` checks member + chairman health.
- Heartbeat monitor polls services in the background and exposes `/heartbeat`.
- UI displays summary status and optional per-model details.

## Scripts (local)
- `./scripts/run_all_local.sh` starts Ollama (if needed), members, orchestrator, chairman, UI.
- `./scripts/run_members_local.sh` starts the three member services.
- `./scripts/stop_all_local.sh` stops everything (by PID).
- `./scripts/demo.sh` runs an end-to-end demo.
- `./orchestrator/scripts/smoke_orchestrator.sh` smoke test.

## Project layout (key files)
- `src/server.ts` (member service)
- `orchestrator/src/server.ts` (orchestrator)
- `chairman/src/server.ts` (chairman)
- `ui/src/App.tsx` (UI entry)
- `docs/architecture.md` (detailed architecture)
- `docs/env-audit.md` (env summary)
- `docs/TECHNICAL_REPORT.md` (design rationale)

## Operational notes
- All model outputs are local. No cloud calls.
- No auth/rate limiting (intended for local demos).
- Stage 2 requires at least two successful answers.
- Stage 3 requires stage 2 aggregated ranking.
