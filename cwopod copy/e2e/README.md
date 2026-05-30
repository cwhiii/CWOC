# C.W.'s O-POD E2E Tests

End-to-end tests for C.W.'s O-POD using [Playwright](https://playwright.dev/).

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Playwright browsers (installed via `npx playwright install`)

## Setup

```bash
cd e2e
npm install
npx playwright install chromium
```

## Running Tests

### Against Docker Compose Test Stack (recommended)

Start the test stack with mocked external APIs:

```bash
# From the project root
docker compose -f docker-compose.yml -f docker-compose.test.yml up --build -d

# Wait for services to be healthy
docker compose -f docker-compose.yml -f docker-compose.test.yml ps

# Run tests
cd e2e
npm test
```

### Against a local dev environment

```bash
# Start backend and frontend locally, then:
E2E_BASE_URL=http://localhost:5173 E2E_API_URL=http://localhost:8000 npm test
```

### With UI mode (for debugging)

```bash
npm run test:ui
```

### View test report

```bash
npm run test:report
```

## Test Structure

| File | Description | Requirements |
|------|-------------|--------------|
| `happy-path.spec.ts` | Full workflow: register → search → select → typeset → cover → order | 13.1, 14.1, 14.6 |
| `user-isolation.spec.ts` | User A cannot see user B's projects | 13.1, 13.5 |
| `session-expiry.spec.ts` | Session expiry and re-authentication flow | 13.6 |
| `error-recovery.spec.ts` | Failed AI generation → retry → success | 14.1, 14.6 |
| `batch-ordering.spec.ts` | Batch ordering from bookshelf | 13.1, 14.1 |

## Mock API Server

The `mock-api/` directory contains a FastAPI server that simulates:

- **Ollama** — Local LLM text generation
- **ComfyUI** — Local image generation
- **Lulu xPress** — Print provider (orders, pricing, ISBN)
- **BookVault** — Print provider (orders, pricing)
- **Project Gutenberg** — Book search and download
- **Standard Ebooks** — Book search

### Configurable Behavior

Set `FAIL_FIRST_AI_CALL=true` in the mock-api environment to make the first AI call fail (for retry testing). Subsequent calls succeed.

### Reset State

POST to `/reset` on the mock server to clear call counters between tests.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `E2E_BASE_URL` | `http://localhost:8080` | Frontend URL for browser tests |
| `E2E_API_URL` | `http://localhost:8000` | Backend API URL for API-level tests |

## Teardown

```bash
# Stop the test stack
docker compose -f docker-compose.yml -f docker-compose.test.yml down -v
```
