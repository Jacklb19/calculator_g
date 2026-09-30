# Prompts

I used Claude Code for this project. These are the main prompts I sent, in order. Shorter follow-ups like "committed, go on" are left out.

## 1. Design

```
I'm doing a take-home for a job, here are the requirements:

[assignment requirements]

Before coding anything I want to agree on the design. Backend in Go with only the standard library (no gin/echo), frontend in React + TS with Vite, both in the same repo. I'm thinking POST /api/v1/calculate/{operation} with {"operands": [...]}, and errors as {"error": {"code", "message"}}. 400 for bad requests, 404 unknown operation, 422 for stuff like division by zero. Percentage = a% of b. Give me the folder structure and the API contract, no code yet.
```

## 2. Design feedback

```
Agree with almost everything, good call on checking the operation before parsing the body and on the SPA fallback. A few changes:

- format to 15 significant digits, not 12. The user can type 15 digits so 12 would round their own numbers
- don't show the backend message directly to the user, map the error codes to friendly messages in the frontend and use the message only as a fallback
- keep the input state machine as a pure reducer in its own file so I can test it without React, the hook should only handle the API calls
- keep 415, I prefer being strict
- API examples also go in the README, it's part of the requirements

Something for all the code from now on: don't fill it with comments. Only comment when the why isn't obvious from the code. Use good practices: small functions with one responsibility, clear names, no duplicated logic, handle errors properly, and write idiomatic Go and React.

With that, go ahead with internal/calculator and its tests.
```

## 3. HTTP layer

```
committed. Now internal/httpapi following what we agreed. Use the go 1.22 ServeMux patterns and the Lookup/Apply split so unknown operations return 404 before reading the body. Be strict with the body: application/json only, MaxBytesReader, no unknown fields, nothing after the json. Careful with null operands, go decodes null as 0 so use pointers to catch that. All the error → status mapping in one function. Wrap the default 404/405 so /api always returns our json error shape. Table driven tests with httptest for every error in the table.
```

## 4. Server

```
committed. Agree on both gaps, just document them in the README later.

For main.go: don't embed the frontend, use an optional STATIC_DIR env var and pass an os.DirFS to NewHandler, that way the backend builds and runs without the frontend being built. PORT from env with validation, server timeouts and graceful shutdown with signal.NotifyContext. Keep main() tiny and put the logic in a run() func I can test. Tests for config parsing and for run() starting on a free port and shutting down cleanly.
```

## 5. Frontend setup and API client

```
now the frontend. clean up the vite template, set up vitest + testing library and a proxy /api → :8080. then the api client: injectable fetch, timeout, ApiError with code and status, and a function that maps error codes to friendly messages. network errors, timeouts and non-json responses shouldn't crash. tests with mocked fetch
```

## 6. Calculator logic

```
committed. yes, run the api and reducer tests in the node environment, keep jsdom only for component tests. now the input logic as a pure reducer. normal calculator rules (no leading zeros, one decimal point, max 15 digits, ±, backspace, AC), operations chain left to right, √ applies right away. the reducer saves the pending calculation in state and the hook sends it from a useEffect, don't read state in async handlers. ignore input while loading and keep the input after an error. lots of tests
```

## 7. UI

```
committed, all those choices are fine. go ahead with format.ts and the UI: display (expression, number, error with role alert) and a 4-column keypad with keyboard support, buttons and keys defined in one place. highlight the pending operator, disable while loading. dark body, green LCD display, orange operators, light/dark mode, works on 320px. pass the api as a prop to App so tests can use a fake one
```

## 8. Code review

```
review the whole repo like a PR from a teammate: bugs, edge cases, bad practices, useless comments. list them by severity first, don't change anything yet
```

```
fix 1 to 8, 10, 12, 13, and the comment nits (including doc comments on the exported go identifiers). skip the rest, 9 will be covered by docs/API.md. write a failing test before each fix when it makes sense. for 4 add p as an extra shortcut for power. commit-sized changes please: tell me when each group is done so I can commit it separately (frontend fixes, backend fixes, comments)
```

## 9. Docker and CI

```
committed. now the multi-stage Dockerfile (distroless, STATIC_DIR for the front), a github actions workflow with lint, tests, coverage and a docker build + curl smoke test, and a small Makefile
```

## 10. Docs

```
committed and CI is running. last thing: the README in english and docs/API.md. how to run it (docker and local, and how to run things without make on windows), node/go versions, tests and coverage, curl examples, error codes, design decisions with the why, assumptions, and the two go json gaps. also generate the coverage reports into docs/coverage. only what's actually implemented
```

## Notes

- I reviewed and tested each step before committing it, both with the test suites and by hand in the browser and with curl.
- The code review in step 8 found real bugs, among them `AbortSignal.any` not being supported on some browsers within the build target, and AltGr shortcuts not working on Spanish/LatAm keyboards. Each was fixed with a test written first.