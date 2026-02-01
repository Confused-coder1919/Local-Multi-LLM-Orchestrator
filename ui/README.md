# LLM Council UI

## Prerequisites
- Node 18+
- Orchestrator running on `http://localhost:9000` (or set `VITE_ORCH_URL`)

## Setup
```bash
npm install
cp .env.example .env
npm run dev
```

## UI test (Playwright)
```bash
npm run test:ui:install
npm run test:ui
```

## Environment
- `VITE_ORCH_URL`: Base URL for the orchestrator API.

## What it does
- Runs stage1 -> stage2 -> stage3 via the orchestrator
- Displays council answers (A/B/C), reviews, aggregated ranking, and chairman synthesis
- Shows service health and per-model latency
- Run history with reload + delete (persisted via SQLite)
- Export JSON for a completed run
- Demo stability mode (temperature=0)
