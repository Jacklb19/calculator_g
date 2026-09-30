# Calculator

[![CI](https://github.com/Jacklb19/calculator_g/actions/workflows/ci.yml/badge.svg)](https://github.com/Jacklb19/calculator_g/actions/workflows/ci.yml)

A full-stack calculator. A Go REST API, written with the standard library only, does the arithmetic. A React + TypeScript frontend sends every calculation to that API and shows the result.

- Operations: addition, subtraction, multiplication, division, exponentiation, square root and percentage.
- REST API with strict input validation and JSON errors. The full contract is in [docs/API.md](docs/API.md).
- Keypad and keyboard input, light and dark themes following the system setting, usable from 320px wide.
- Unit tests on both layers, a CI pipeline with coverage, and a single Docker image that serves the API and the frontend together.

## Contents

- [Quick start with Docker](#quick-start-with-docker)
- [Running locally](#running-locally)
- [Commands without make (Windows)](#commands-without-make-windows)
- [Configuration](#configuration)
- [Using the calculator](#using-the-calculator)
- [API](#api)
- [Tests and coverage](#tests-and-coverage)
- [Project structure](#project-structure)
- [Design decisions](#design-decisions)
- [Assumptions](#assumptions)
- [Known limitations](#known-limitations)

## Quick start with Docker

```bash
docker build -t calculator .
docker run --rm -p 8080:8080 calculator
```

Open http://localhost:8080. The image holds only the server binary and the built frontend, on top of `gcr.io/distroless/static-debian13:nonroot`, and comes to about 17 MB.

To smoke-test a running container (from a Unix-style shell such as Git Bash):

```bash
bash scripts/smoke-test.sh http://localhost:8080
```

## Running locally

### Requirements

| Tool | Version | Notes |
|---|---|---|
| Go | 1.24 or newer | The minimum in `backend/go.mod`, checked in CI. The Docker image builds with 1.27. |
| Node.js | 22.22.2+ or 24.15+ | Required by Vitest and jsdom; Vite alone needs 20.19+. CI and Docker use Node 24. |
| npm | Comes with Node | Dependencies are pinned in `frontend/package-lock.json`. |
| Docker | Any recent version | Only for the image. |
| make | Optional | Wraps the commands below. On Windows, see [Commands without make](#commands-without-make-windows). |

### Development (two terminals)

```bash
# Terminal 1: API on http://localhost:8080
cd backend
go run ./cmd/server
```

```bash
# Terminal 2: frontend on http://localhost:5173
cd frontend
npm ci
npm run dev
```

The Vite dev server proxies `/api` to `localhost:8080`, so the browser only talks to one origin and the API needs no CORS.

### Single process, as in production

The server can also serve the built frontend. Point `STATIC_DIR` at the build output:

```bash
cd frontend && npm ci && npm run build && cd ..
cd backend && STATIC_DIR=../frontend/dist go run ./cmd/server
```

The frontend isn't embedded in the binary, so the backend builds and runs without it.

## Commands without make (Windows)

`make` isn't installed on Windows by default. Each target is a thin wrapper, so you can run its commands directly in PowerShell or Git Bash. Run them from the folder shown.

| Task | make | Command | Folder |
|---|---|---|---|
| Install frontend deps | `make install` | `npm ci` | `frontend` |
| Lint the backend | `make lint-backend` | `gofmt -l .` (should print nothing), then `go vet ./...` | `backend` |
| Lint the frontend | `make lint-frontend` | `npm run lint`, then `npx tsc -b` | `frontend` |
| Backend tests | `make test-backend` | `go test ./...` | `backend` |
| Frontend tests | `make test-frontend` | `npm test` | `frontend` |
| Backend coverage | `make coverage-backend` | `go test -coverprofile=coverage.out ./...`, then `go tool cover -func=coverage.out` | `backend` |
| Frontend coverage | `make coverage-frontend` | `npm run coverage` (report in `frontend/coverage/index.html`) | `frontend` |
| Run the API | `make run-backend` | `go run ./cmd/server` | `backend` |
| Run the dev server | `make run-frontend` | `npm run dev` | `frontend` |
| Build everything | `make build` | `npm run build` in `frontend`, then `go build -o bin/server ./cmd/server` in `backend` | both |
| Docker image | `make docker-build` | `docker build -t calculator .` | root |
| Smoke test | `make smoke` | `bash scripts/smoke-test.sh http://localhost:8080` (Git Bash) | root |

Notes for Windows:

- **Setting an environment variable for one command:** in PowerShell, `$env:STATIC_DIR = "../frontend/dist"; go run ./cmd/server`. In Git Bash, `STATIC_DIR=../frontend/dist go run ./cmd/server` works as shown above.
- **Chaining commands:** Windows PowerShell 5.1 has no `&&`; use `;` or separate lines.
- **Race detector:** `go test -race` needs cgo and a C compiler, which a default Windows Go install doesn't have. CI runs the tests with `-race` on Linux.
- **Firewall prompts:** with no `HOST` set, the server listens on all interfaces, which can trigger a Windows Firewall prompt. `HOST=127.0.0.1` avoids it for local use.

## Configuration

The server reads these environment variables:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8080` | Port to listen on. Must be an integer from 1 to 65535. |
| `HOST` | empty (all interfaces) | Address to bind to, for example `127.0.0.1`. |
| `STATIC_DIR` | empty (no frontend) | Directory holding the built frontend. It must contain `index.html`, or the server refuses to start. The Docker image sets it to `/static`. |

Invalid configuration stops the server at startup with a clear error and exit code 1.

The server logs JSON lines to stdout. It uses these HTTP timeouts: read header 5s, read 10s, write 10s, idle 60s. On `SIGINT` or `SIGTERM` it shuts down gracefully, waiting up to 10s for in-flight requests before closing them. A second signal forces it to exit.

## Using the calculator

Calculations run left to right, like a basic pocket calculator: `2 + 3 × 4 =` gives `20`. The display shows the pending expression (for example `12 +`), the number being typed or the result, and any error message. The operator waiting for its second operand is highlighted.

| Key | Button | Action |
|---|---|---|
| `0`–`9` | digits | Type a digit (15 digits at most, no leading zeros) |
| `.` or `,` | `.` | Decimal point (one per number) |
| `+` `-` `*` or `x` `/` | `+ − × ÷` | Arithmetic operators |
| `^` or `p` | `xʸ` | Power |
| `%` | `%` | Percent of: `50 % 200 =` gives `100` |
| `r` or `@` | `√` | Square root of the displayed number, applied right away |
| `n` or `F9` | `±` | Change sign |
| `Enter` or `=` | `=` | Calculate |
| `Backspace` | `⌫` | Delete the last typed character |
| `Escape` or `Delete` | `AC` | Clear everything |

Letter shortcuts work with Caps Lock on, and characters typed with AltGr (such as `@` on Spanish layouts) are accepted. Shortcuts with Ctrl, Alt or Cmd are left to the browser.

While a calculation is in flight, input is ignored and the keypad is marked unavailable. If a calculation fails, the input is kept, a friendly message appears, and pressing `=` again retries.

## API

A single endpoint does every calculation:

```
POST /api/v1/calculate/{operation}
Content-Type: application/json

{ "operands": [ ...numbers ] }
```

| `operation` | Operands | Result |
|---|---|---|
| `add` | `[a, b]` | a + b |
| `subtract` | `[a, b]` | a − b |
| `multiply` | `[a, b]` | a × b |
| `divide` | `[a, b]` | a ÷ b |
| `power` | `[a, b]` | a to the power of b |
| `sqrt` | `[a]` | √a |
| `percentage` | `[a, b]` | a% of b = a × b / 100 |

`GET /healthz` returns `{"status":"ok"}`.

### Examples (bash or Git Bash)

```bash
curl -s -H 'Content-Type: application/json' -d '{"operands":[10,4]}' http://localhost:8080/api/v1/calculate/divide
```

```json
{"operation":"divide","operands":[10,4],"result":2.5}
```

```bash
curl -s -H 'Content-Type: application/json' -d '{"operands":[15,80]}' http://localhost:8080/api/v1/calculate/percentage
```

```json
{"operation":"percentage","operands":[15,80],"result":12}
```

```bash
curl -s -H 'Content-Type: application/json' -d '{"operands":[16]}' http://localhost:8080/api/v1/calculate/sqrt
```

```json
{"operation":"sqrt","operands":[16],"result":4}
```

Errors always have the same shape:

```bash
curl -s -i -H 'Content-Type: application/json' -d '{"operands":[1,0]}' http://localhost:8080/api/v1/calculate/divide
```

```
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json

{"error":{"code":"DIVISION_BY_ZERO","message":"division by zero"}}
```

### Examples (PowerShell)

`Invoke-RestMethod` handles the quoting for you:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/v1/calculate/divide -ContentType 'application/json' -Body '{"operands":[10,4]}'
```

In Windows PowerShell 5.1, `curl` is an alias for `Invoke-WebRequest`, so use `curl.exe`. PowerShell 5.1 also strips the inner double quotes from arguments passed to native programs, so they have to be escaped:

```powershell
curl.exe -s -H "Content-Type: application/json" -d '{\"operands\":[10,4]}' http://localhost:8080/api/v1/calculate/divide
```

### Status codes

| Status | Codes | When |
|---|---|---|
| 200 | none | Success |
| 400 | `INVALID_JSON`, `INVALID_OPERANDS` | Malformed body, or operands missing, null, non-numeric or the wrong number of them |
| 404 | `UNKNOWN_OPERATION`, `NOT_FOUND` | Unsupported operation, or any other unknown `/api` path |
| 405 | `METHOD_NOT_ALLOWED` | Anything other than `POST` on the calculate endpoint (with an `Allow: POST` header) |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 1024 bytes |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Content-Type other than `application/json` |
| 422 | `DIVISION_BY_ZERO`, `DOMAIN_ERROR`, `RESULT_OUT_OF_RANGE` | The request is valid but the math is undefined |
| 500 | `INTERNAL_ERROR` | Unexpected server error, with a generic message |

Every code with an example response, the validation order and the exact number handling are in [docs/API.md](docs/API.md).

## Tests and coverage

```bash
make test       # both layers
make coverage   # both layers, with coverage
```

Without make: `go test ./...` in `backend`, and `npm test` in `frontend`.

**Backend.** Table-driven tests with the standard `testing` package:

- `internal/calculator`: every operation, including edge cases such as overflow, NaN and infinity inputs, and negative zero.
- `internal/httpapi`: uses `httptest` for every row of the error table, successful calculations, the SPA fallback and the middleware.
- `cmd/server`: config parsing, plus `run()` starting on a free port and shutting down cleanly, including closing connections when the graceful shutdown times out.

**Frontend.** Vitest runs two projects, chosen by file extension:

| Files | Environment | Covers |
|---|---|---|
| `*.test.ts` | Node | API client (with a mocked `fetch`), error messages, the input reducer, display text, number formatting, key definitions |
| `*.test.tsx` | jsdom | Anything that renders React: the `useCalculator` hook and the whole app, using Testing Library and a fake API |

Coverage when these docs were written:

| Layer | Coverage | HTML report |
|---|---|---|
| Backend | 93.0% of statements (`calculator` 100%, `httpapi` 98.6%, `cmd/server` 75.8%; the gap is mostly `main()` itself) | [docs/coverage/backend.html](docs/coverage/backend.html) |
| Frontend | 99.35% of lines, 97.03% of branches | [docs/coverage/frontend/index.html](docs/coverage/frontend/index.html) |

To regenerate the reports, run `make coverage-report`. Without make:

- in `backend`: `go test -coverprofile=coverage.out ./...`, then `go tool cover -html=coverage.out -o ../docs/coverage/backend.html`
- in `frontend`: `npx vitest run --coverage --coverage.reporter=html --coverage.reportsDirectory=../docs/coverage/frontend`

**CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs on pushes to `main` and on pull requests:

- The **backend** job checks formatting, runs `go vet`, and runs the tests with `-race` and coverage on the Go version in `go.mod`.
- The **frontend** job runs ESLint, the TypeScript check and the tests with coverage.
- Once both pass, the **docker** job builds the image, starts it and runs the curl smoke test against it.

Each run's summary page shows the coverage, and the reports are uploaded as artifacts.

## Project structure

```
.
├── backend/
│   ├── cmd/server/           # entry point: config from env, graceful shutdown
│   └── internal/
│       ├── calculator/       # operations, input and result validation (no HTTP)
│       └── httpapi/          # routing, request decoding, error mapping, middleware, SPA serving
├── frontend/
│   └── src/
│       ├── api/              # typed API client, ApiError, friendly error messages
│       ├── calculator/       # input reducer, useCalculator hook, key definitions, display text
│       ├── components/       # Display and Keypad
│       └── lib/format.ts     # 15-significant-digit number formatting
├── docs/
│   ├── API.md                # full API contract
│   └── coverage/             # generated HTML coverage reports
├── scripts/smoke-test.sh     # curl checks against a running server
├── Dockerfile                # multi-stage: Vite build + Go build, distroless runtime
├── Makefile
└── .github/workflows/ci.yml
```

## Design decisions

**Go standard library only.** Since Go 1.22, `http.ServeMux` supports method and wildcard patterns such as `POST /api/v1/calculate/{operation}`, which covers all the routing the API needs. The only thing a framework would add here is JSON responses for unmatched routes. That's about 30 lines in `withJSONFallback`: it lets the mux's built-in 404 and 405 handlers decide, and then writes our JSON error instead.

**Arithmetic separate from HTTP.** `internal/calculator` knows nothing about HTTP, so the math is tested with plain table tests. Its API is split into `Lookup(name)` and `op.Apply(operands...)`. The handler looks up the operation before reading the body, so an unknown operation is always a 404, whatever the body contains.

**One endpoint, operation in the path, operands as an array.** Every operation takes the same request shape, and the array covers both unary (`sqrt`) and binary operations. Each operation has a fixed number of operands rather than accepting any count. Variadic `add` would add ambiguity that a calculator UI never uses.

**400 versus 422.** 400 means the request is malformed for that operation, including the wrong number of operands. 422 means it's well-formed but the math has no answer: division by zero, the square root of a negative number, or overflow. Clients can then tell "fix your request" apart from "this has no answer".

**Strict input.**

- The only accepted Content-Type is `application/json` (charset parameters are allowed); anything else gets 415.
- Bodies are capped at 1 KiB.
- Unknown fields and trailing data after the JSON value are rejected.
- Operands are decoded into `*float64`, because `encoding/json` would silently turn `null` into `0`.

**Every error is mapped in one place.** Every layer returns plain Go errors that wrap a sentinel error. One function, `classify`, turns them into an HTTP status and error code, so the mapping lives in a single table.

**Results are always finite, and never `-0`.** JSON can't represent NaN or infinity. The calculator therefore checks every result: NaN becomes `DOMAIN_ERROR` and ±Inf becomes `RESULT_OUT_OF_RANGE`, whichever operation produced them. `-0` becomes `0` so the frontend never shows "-0". `percentage` computes `a × b / 100`, and falls back to `a / 100 × b` only when `a × b` would overflow. Dividing first costs precision for ordinary inputs such as 7% of 3.

**The frontend does no arithmetic.** Every `=`, operator chain and `√` goes to the API, so the backend is the single source of truth. The one exception is `±` on a result, which just flips the sign.

**Input logic is a pure reducer.** `src/calculator/reducer.ts` is plain TypeScript with no React, tested with more than 100 cases.

- A calculation is stored in state as a pending request, together with what to do with its result: show it, carry it into the next operator, or use it as the current operand.
- The `useCalculator` hook sends that request from a `useEffect` and aborts it on cleanup. Nothing reads state inside async code.
- Because creating a request changes nothing else, a failure only needs to record the error, and the input survives for a retry.

**Results are kept as numbers, not display strings.** The display formats results to 15 significant digits, because the user can type 15 digits and fewer would round their own input. Chaining uses the full-precision value, so `1 ÷ 3 × 3` isn't computed from a rounded string. Past 15 digits, the display switches to exponent notation instead of padding with made-up zeros.

**Friendly messages come from error codes.** The frontend maps each error code to its own message, so server wording never reaches the user directly. The server's message is shown only for a code the frontend doesn't know, which keeps an older frontend usable with a newer backend.

**Each key is defined once.** `src/calculator/keys.ts` lists each key's label, accessible name, action, keyboard shortcuts and style. The keypad buttons, the keyboard handler and the `aria-keyshortcuts` attributes are all built from that list, so they can't drift apart.

**Testable seams.**

- The API client takes an injectable `fetch` and timeout.
- `App` receives the client as a prop.
- `run()` in the server takes its context, environment lookup and logger as arguments.

Tests therefore use fakes, with no module mocking or global state.

**One origin, no CORS.** In development the Vite proxy forwards `/api`. In production the Go server serves the built frontend from `STATIC_DIR` and falls back to `index.html` for client-side routes. Serving from a directory rather than embedding the frontend means the backend builds and tests without a frontend build.

**Browser compatibility.**

- The client links the caller's abort signal by hand, because `AbortSignal.any` needs Safari 17.4, and Vite's default build target is Safari 16.4.
- The keypad uses `aria-disabled` rather than `disabled` while loading, so keyboard focus isn't lost.
- Fonts are bundled from npm packages, not loaded from a CDN.

**Docker.** The image is multi-stage, and the runtime stage is distroless `nonroot`: no shell and no package manager, running as UID 65532. The build stages run on the build machine's platform and Go cross-compiles, so ARM images don't need emulation.

## Assumptions

- **Percentage** means "a percent of b": `percentage(50, 200) = 100`.
- **No operator precedence.** Operations run strictly left to right, like a basic calculator: `2 + 3 × 4 = 20`.
- **Square root** applies immediately to the displayed number. After `9 +`, pressing `√` computes √9 and uses 3 as the second operand.
- **Incomplete input is ignored.** `=` with no pending operation, or right after an operator (`2 + =`), does nothing. Pressing `=` again doesn't repeat the last operation.
- **Changing an operator.** Pressing a second operator right after the first replaces it.
- **Numbers are IEEE 754 doubles** on both sides. The API returns the raw result (`0.1 + 0.2` gives `0.30000000000000004`) and the UI rounds it for display (`0.3`).
- **Operation names are case-sensitive**: `ADD` is a 404.
- **Single-user and stateless.** There's no authentication, rate limiting, history or persistence, and the UI is in English.

## Known limitations

- **Go's `encoding/json` v1 is lenient in two ways** that the strict validation can't catch:
  - Field names match case-insensitively, so `{"OPERANDS":[1,2]}` is accepted.
  - With duplicate keys the last one wins: `{"operands":[1,2],"operands":[5,5]}` adds 5 and 5.

  Closing these would mean parsing the body twice or moving to `encoding/json/v2` once it's stable.
- **Paths that aren't in canonical form** (for example `/api//v1/calculate/add`) are handled by the mux's path cleaning. A `POST` gets a `307` redirect to the clean path, and other methods get the JSON 404.
- **Operands are echoed as received**, so `-0` comes back as `-0` in `operands`. Results are normalized.
- **The image has no `HEALTHCHECK`**, because distroless has no shell or curl. Point the orchestrator's health probe at `GET /healthz`.
- **Without `STATIC_DIR`**, paths outside `/api` and `/healthz` get Go's default plain-text 404.
- **Input is blocked while a request is in flight**, AC included, for up to the client's 5-second timeout.
