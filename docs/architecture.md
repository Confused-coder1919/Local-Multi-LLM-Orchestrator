# Architecture (Local + Distributed)

## Current architecture
This system runs fully local with optional multi-machine deployment over LAN. Services:
- **Council member** (`src/server.ts`): `/answer`, `/review`, `/health` using local Ollama.
- **Orchestrator** (`orchestrator/src/server.ts`): `/stage1`, `/stage2`, `/stage3`, `/request/:id`, `/runs`, `/health`.
- **Chairman** (`chairman/src/server.ts`): `/synthesize`, `/health` using local Ollama.
- **UI** (`ui/src/App.tsx`, `ui/src/api.ts`): drives the pipeline via orchestrator.

## Request flow
1) UI sends `POST /stage1` to orchestrator with a query.
2) Orchestrator fans out `POST /answer` to each council member.
3) Orchestrator anonymizes answers (A/B/C...) and calls `POST /review` on each member with peer answers.
4) Orchestrator aggregates rankings and calls `POST /synthesize` on the chairman.
5) Orchestrator returns final answer and stores full request state.

## Local inference call sites (no cloud)
- **Council member**: `src/ollamaClient.ts` → `OllamaClient.chat` invoked in `src/server.ts` for `/answer` and `/review`.
- **Chairman**: `chairman/src/ollamaClient.ts` → `OllamaClient.chat` invoked in `chairman/src/server.ts` for `/synthesize`.
- **Orchestrator**: no model calls; coordination only.

## Persistence and run history
- In-memory store: `orchestrator/src/store.ts` keeps active request state.
- SQLite persistence: `orchestrator/src/persistence.ts` persists full `RequestState` for run history.
- Defaults: `PERSISTENCE_ENABLED=true`, `PERSISTENCE_DB=./data/orchestrator.db`.

## REST endpoints (current)
### Orchestrator
- `GET /health`
- `GET /heartbeat`
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
- Member and chairman responses include optional `token_usage` fields with heuristic prompt/completion/total counts.

## Stage 2 anonymization
- Orchestrator assigns anon IDs (A/B/C) per request.
- Reviewers see only anon IDs + answer text.
- Reviewer’s own answer is excluded from its peer set.
