# Verbose Logging Everywhere

Every piece of code in this project must log extensively. This is non-negotiable.

## Rules

- Every function, method, route handler, and service call must log on entry and exit.
- Log all input parameters (sanitize secrets/passwords but log everything else).
- Log all return values or response summaries.
- Log all errors with full stack traces.
- Log all external HTTP requests (URL, method, status code, response time).
- Log all database queries and their execution time.
- Log all conditional branches taken (e.g., "cache hit", "cache miss", "provider X selected").
- Log all configuration values loaded at startup.
- Use structured logging where possible (key=value pairs or JSON).
- Use appropriate log levels: DEBUG for detailed flow, INFO for operations, WARNING for recoverable issues, ERROR for failures.
- Never write a function without logging. If you're writing code, it logs.

## Backend (Python)

- Use Python's `logging` module with `logger = logging.getLogger(__name__)` at the top of every file.
- Log at DEBUG level for entry/exit, INFO for operations, ERROR for failures.
- Include context: user ID, request ID, project ID, provider name, whatever is relevant.

## Frontend (TypeScript/Svelte)

- Use `console.log`, `console.warn`, `console.error` as appropriate.
- Log all API calls (URL, params, response status).
- Log all user actions (button clicks, form submissions, navigation).
- Log all state changes.
- **API error responses must log the FULL response body to the browser console.** The user should never have to SSH into the server to read backend logs. If the backend returns an error, the full error detail (including tracebacks if the backend sends them) must appear in the browser console.
- When an API call fails, the frontend must attempt to parse and log the full error response body, including any `detail`, `traceback`, or `message` fields.

## Docker / Infrastructure

- All services must log to stdout/stderr.
- Never suppress output with `-q` or `--quiet` flags in scripts or Dockerfiles.
- Install scripts must show all command output.

## When modifying existing code

- If you touch a file that lacks logging, add logging to the functions you're working in.
- Do not skip logging because "it's a simple function." Simple functions still log.
