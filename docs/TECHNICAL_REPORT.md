# Technical Report: LLM Council System

## Solo contribution statement
This project is a solo effort by Syed Mohammad Shah Mostafa. I designed the architecture, implemented the services, built the UI, and validated the system with automated tests and local deployment scripts.

## Overview
The LLM Council system implements a local-first, distributed inference pipeline composed of three service types: council members (answer + review), an orchestrator (stage1/2/3 coordination + state), and a chairman (synthesis only). All inference uses local Ollama models via HTTP APIs. The UI drives the system by calling the orchestrator endpoints and visualizing each stage.

## Design decisions
- **Local inference only**: Ollama is the sole inference backend to avoid cloud dependencies and reduce latency and cost.
- **Three-stage pipeline**:
  - **Stage 1** collects independent answers from N council members.
  - **Stage 2** anonymizes answers and gathers peer rankings + critiques.
  - **Stage 3** synthesizes a final response using the chairman, informed by aggregated rankings and critiques.
- **Anonymization**: The orchestrator maps member URLs to anon IDs (A/B/C…) and excludes a reviewer’s own answer in stage 2.
- **In-memory state + SQLite**: The orchestrator keeps hot request state in memory and persists full state to SQLite for run history and reloads.
- **Partial failure tolerance**: Stage 1 accepts partial member failures; stage 2 proceeds only when at least two answers are available.

### Architecture decisions
- **Why REST**: Simple, language-agnostic interfaces for multi-machine deployment and easy inspection with curl.
- **Why anonymization**: Prevents reviewer bias and discourages model identity leakage during peer review.
- **Why strict JSON schemas**: Guarantees reliable parsing across services and UI; failures are caught early.
- **Why chairman separation**: Enforces role specialization—synthesis only—so no new opinions are generated.

## Models
- Default: `mistral:7b-instruct` via Ollama.
- Optional: additional Ollama models per member using per-service env files.

## Observability
- Health endpoints for each service.
- Orchestrator `/health` aggregates member and chairman status.
- UI shows per-model latency and stage progression.

## Persistence and run history
- Full request state is persisted to SQLite after each stage (success or error).
- The UI can load prior runs without re-executing the pipeline.

## Demo stability mode
- Orchestrator accepts `options.temperature` for stage1/2/3 requests.
- UI exposes a toggle to force temperature=0 for deterministic demos.

## Improvements considered
- Rate limiting and request queueing for large councils.
- Weighted ranking using confidence scores.
- Automatic retries for transient member failures.
- Optional distributed tracing headers for end-to-end latency tracking.

## Limitations
- In-memory state is volatile and not shared across orchestrator instances (SQLite stores history, not live state).
- No authentication or access control (intended for local demo use).
- Model outputs may be inconsistent and require human verification.
- UI tests depend on services being available locally.

## Deployment
- Local demo uses `scripts/run_all_local.sh` and `scripts/stop_all_local.sh` with PID tracking.
- Distributed deployment uses explicit REST URLs configured via environment variables and the deploy kit (`deploy/README.md`).

## Operational demo plan
- **Local mode**: `./scripts/run_all_local.sh` -> open UI -> run query -> confirm stage1/2/3.
- **Distributed mode**: configure LAN IPs in `deploy/cluster.env`, run `deploy/scripts/check_health.sh`, then `deploy/scripts/ping_cluster.sh`.
