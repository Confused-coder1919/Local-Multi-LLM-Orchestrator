# Future Improvements

1. Consolidate inference clients (share a single Ollama client or connect services to `packages/inference`).
2. Add lint + format scripts (ESLint/Prettier) and CI checks.
3. Add orchestrator tests for anonymization, aggregation, and stage workflows.
4. Add retry/backoff policies for transient member failures.
5. Add auth or rate limiting for non-local deployments.
