# LLM Council Chairman

A local chairman service that synthesizes a final answer from anonymized council answers and reviews. It does not generate first opinions.

## Prerequisites
- Node.js 18+
- Ollama installed and running

## Setup
```bash
npm install
cp .env.example .env
npm run dev
```

## Environment
- `PORT` (default: `9100`)
- `MODEL_NAME` (required)
- `OLLAMA_BASE_URL` (default: `http://localhost:11434`)
- `CHAIRMAN_ID` (default: `chairman-1`)
- `TIMEOUT_MS` (default: `90000`)

## Endpoints
- `GET /health`
- `POST /synthesize`

## Example requests
```bash
curl -s http://localhost:9100/health
```

```bash
curl -s http://localhost:9100/synthesize \
  -H 'content-type: application/json' \
  -d '{"request_id":"demo-1","query":"What is the capital of Japan?","answers":[{"anon_id":"A","answer_text":"Tokyo."},{"anon_id":"B","answer_text":"The capital is Tokyo."}],"reviews":[{"rankings":["A","B"],"critiques":{"A":"Concise","B":"Ok"},"confidence":0.8}],"aggregated_ranking":[{"anon_id":"A","score":2},{"anon_id":"B","score":1}],"options":{"temperature":0}}'
```
