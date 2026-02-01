# LLM Council Orchestrator

A local orchestrator service that coordinates multiple council_member instances. It runs Stage 1 answer collection, Stage 2 anonymized review aggregation, and Stage 3 chairman synthesis. Request state is stored in memory and persisted to SQLite for run history.

## Prerequisites
- Node.js 18+
- Council_member services running locally or on the LAN
- Chairman service running locally or on the LAN

## Setup
```bash
npm install
cp .env.example .env
npm run dev
```

## Environment
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

## Endpoints
- `GET /health` - pings all council members and chairman
- `GET /heartbeat` - returns last heartbeat status for members + chairman
- `POST /stage1` - collects answers (`{ query, options? }`)
- `POST /stage2` - collects reviews + aggregates ranking (`{ request_id, options? }`)
- `POST /stage3` - synthesizes final answer via chairman (`{ request_id, options? }`)
- `GET /request/:id` - returns stored request state
- `GET /runs?limit=20` - list persisted runs
- `GET /runs/:id` - load a run from memory or SQLite
- `DELETE /runs/:id` - remove a run from memory + SQLite

`options.temperature` can be provided for deterministic demo runs (e.g., `0`).

## Example requests
```bash
curl -s http://localhost:9000/health
```

```bash
curl -s http://localhost:9000/stage1 \
  -H 'content-type: application/json' \
  -d '{"query":"What is the capital of Japan?","options":{"temperature":0}}'
```

```bash
curl -s http://localhost:9000/stage2 \
  -H 'content-type: application/json' \
  -d '{"request_id":"<request_id>","options":{"temperature":0}}'
```

```bash
curl -s http://localhost:9000/stage3 \
  -H 'content-type: application/json' \
  -d '{"request_id":"<request_id>","options":{"temperature":0}}'
```

```bash
curl -s http://localhost:9000/runs?limit=10
```

```bash
curl -s http://localhost:9000/request/<request_id>
```
