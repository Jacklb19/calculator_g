# API reference

The calculator API is a small JSON-over-HTTP API served by the Go backend. Every example below is a real response from the server. The `Date` and `Content-Length` headers are left out.

- [Conventions](#conventions)
- [POST /api/v1/calculate/{operation}](#post-apiv1calculateoperation)
- [GET /healthz](#get-healthz)
- [Errors](#errors)
- [Validation order](#validation-order)
- [Numbers](#numbers)
- [Other paths](#other-paths)
- [Known quirks](#known-quirks)
- [How the frontend uses the API](#how-the-frontend-uses-the-api)

## Conventions

- **Base URL:** wherever the server runs, `http://localhost:8080` by default. In development the Vite dev server proxies `/api` from `http://localhost:5173`.
- **Format:** requests and responses are JSON (`Content-Type: application/json`), and every response body ends with a newline.
- **Versioning:** the API is under `/api/v1`. A breaking change would get a new prefix.
- **Authentication:** none, and there are no cookies, sessions or CORS headers. The frontend is served from the same origin.

## POST /api/v1/calculate/{operation}

Runs one operation.

### Request

```
POST /api/v1/calculate/{operation}
Content-Type: application/json

{ "operands": [ number, ... ] }
```

| Part | Rules |
|---|---|
| `{operation}` | One of the operations below. Case-sensitive. |
| `Content-Type` | Must be `application/json`. Parameters such as `; charset=utf-8` are accepted. |
| Body | A single JSON object of at most 1024 bytes, with no other fields and nothing after it except whitespace. |
| `operands` | Required. An array of JSON numbers whose length matches the operation. `null` elements, strings and numbers outside the float64 range (such as `1e400`) are rejected. |

### Operations

| `operation` | Operands | Result | Can fail with |
|---|---|---|---|
| `add` | `[a, b]` | a + b | `RESULT_OUT_OF_RANGE` |
| `subtract` | `[a, b]` | a − b | `RESULT_OUT_OF_RANGE` |
| `multiply` | `[a, b]` | a × b | `RESULT_OUT_OF_RANGE` |
| `divide` | `[a, b]` | a ÷ b | `DIVISION_BY_ZERO` when b = 0, `RESULT_OUT_OF_RANGE` |
| `power` | `[a, b]` | a to the power of b | `DIVISION_BY_ZERO` when a = 0 and b < 0; `DOMAIN_ERROR` when the result isn't a real number (a negative base with a fractional exponent); `RESULT_OUT_OF_RANGE` |
| `sqrt` | `[a]` | √a | `DOMAIN_ERROR` when a < 0 |
| `percentage` | `[a, b]` | a% of b, which is a × b / 100 | `RESULT_OUT_OF_RANGE` |

Every operation can also fail with `INVALID_OPERANDS` when the number of operands is wrong.

### Success response

`200 OK`. The response echoes the operation and the operands it received:

```bash
curl -s -H 'Content-Type: application/json' -d '{"operands":[10,4]}' http://localhost:8080/api/v1/calculate/divide
```

```json
{"operation":"divide","operands":[10,4],"result":2.5}
```

| Field | Type | Meaning |
|---|---|---|
| `operation` | string | The operation that ran. |
| `operands` | number[] | The operands as received. |
| `result` | number | Always a finite number, and never `-0`. |

More examples:

| Request | Response |
|---|---|
| `add` `[2,3]` | `{"operation":"add","operands":[2,3],"result":5}` |
| `subtract` `[3,5]` | `{"operation":"subtract","operands":[3,5],"result":-2}` |
| `multiply` `[1.5,4]` | `{"operation":"multiply","operands":[1.5,4],"result":6}` |
| `power` `[2,10]` | `{"operation":"power","operands":[2,10],"result":1024}` |
| `sqrt` `[16]` | `{"operation":"sqrt","operands":[16],"result":4}` |
| `percentage` `[15,80]` | `{"operation":"percentage","operands":[15,80],"result":12}` |
| `add` `[0.1,0.2]` | `{"operation":"add","operands":[0.1,0.2],"result":0.30000000000000004}` |

## GET /healthz

Liveness check for containers and load balancers. It isn't under `/api`, and isn't versioned.

```bash
curl -s http://localhost:8080/healthz
```

```json
{"status":"ok"}
```

## Errors

Every error from `/api` has the same shape, whatever the status:

```json
{ "error": { "code": "DIVISION_BY_ZERO", "message": "division by zero" } }
```

- `code` is stable and meant for programs to act on. The frontend maps it to the message it shows.
- `message` is for developers. It adds detail, such as which operand failed, and its wording may change.

| Status | `code` | When | Example `message` |
|---|---|---|---|
| 400 | `INVALID_JSON` | The body is empty, isn't valid JSON, has unknown fields, isn't a JSON object, or has data after the JSON value. | `invalid JSON: body is empty`<br>`invalid JSON: unexpected EOF`<br>`invalid JSON: json: unknown field "x"`<br>`invalid JSON: unexpected data after JSON body` |
| 400 | `INVALID_OPERANDS` | `operands` is missing or `null`, isn't an array of numbers, contains `null` or a number outside the float64 range, or has the wrong length. | `invalid operands: operands is required`<br>`invalid operands: operand 2 is null`<br>`invalid operands: operands must be an array of numbers, found string`<br>`invalid operands: operands must be an array of numbers, found number 1e400`<br>`invalid operands: add expects 2 operand(s), got 1` |
| 404 | `UNKNOWN_OPERATION` | `{operation}` isn't one of the supported operations. | `unknown operation: "modulo"` |
| 404 | `NOT_FOUND` | Any other path under `/api`. | `not found: /api/v1/nope` |
| 405 | `METHOD_NOT_ALLOWED` | A method other than `POST` on the calculate endpoint. The response includes `Allow: POST`. | `method not allowed: GET` |
| 413 | `PAYLOAD_TOO_LARGE` | The body is over 1024 bytes. | `request body too large: limit is 1024 bytes` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Content-Type is missing or isn't `application/json`. | `unsupported media type: Content-Type must be application/json` |
| 422 | `DIVISION_BY_ZERO` | Division by zero, or zero raised to a negative power. | `division by zero`<br>`division by zero: zero raised to a negative power` |
| 422 | `DOMAIN_ERROR` | The result isn't a real number. | `undefined result: square root of a negative number`<br>`undefined result` (for example `power` `[-8, 0.5]`) |
| 422 | `RESULT_OUT_OF_RANGE` | The result is too large in magnitude for a float64. | `result out of range` |
| 500 | `INTERNAL_ERROR` | An unexpected server error, such as a recovered panic. The details are only logged. | `internal server error` |

In short, 400 means "fix the request" and 422 means "the request is fine, but the math has no answer".

### Error examples

```bash
curl -s -i -H 'Content-Type: application/json' -d '{"operands":[1,0]}' http://localhost:8080/api/v1/calculate/divide
```

```
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json

{"error":{"code":"DIVISION_BY_ZERO","message":"division by zero"}}
```

```bash
curl -s -i -H 'Content-Type: application/json' -d '{"operands":[1,null]}' http://localhost:8080/api/v1/calculate/add
```

```
HTTP/1.1 400 Bad Request
Content-Type: application/json

{"error":{"code":"INVALID_OPERANDS","message":"invalid operands: operand 2 is null"}}
```

```bash
curl -s -i http://localhost:8080/api/v1/calculate/add
```

```
HTTP/1.1 405 Method Not Allowed
Allow: POST
Content-Type: application/json

{"error":{"code":"METHOD_NOT_ALLOWED","message":"method not allowed: GET"}}
```

```bash
curl -s -i -H 'Content-Type: text/plain' -d '{"operands":[1,2]}' http://localhost:8080/api/v1/calculate/add
```

```
HTTP/1.1 415 Unsupported Media Type
Content-Type: application/json

{"error":{"code":"UNSUPPORTED_MEDIA_TYPE","message":"unsupported media type: Content-Type must be application/json"}}
```

## Validation order

The checks run in this order, and the first failure decides the response:

1. **Route and method.** An unknown `/api` path returns 404 `NOT_FOUND`; the wrong method returns 405 `METHOD_NOT_ALLOWED`.
2. **Operation.** An unknown operation returns 404 `UNKNOWN_OPERATION`. The body isn't read yet, so `POST /api/v1/calculate/modulo` with any body at all gets this 404.
3. **Content-Type.** 415 `UNSUPPORTED_MEDIA_TYPE`.
4. **Body.** In order: size (413), JSON syntax, unknown fields and trailing data (400 `INVALID_JSON`), then operand types (400 `INVALID_OPERANDS`).
5. **Operands.** Count and finiteness: 400 `INVALID_OPERANDS`.
6. **Calculation.** 422, with the code for the failure.

## Numbers

- Numbers are IEEE 754 double-precision on both sides (Go `float64`, JavaScript `number`). The API returns the exact float result, such as `0.30000000000000004` for 0.1 + 0.2. Rounding for display is the client's job.
- JSON can't represent NaN or infinity, so no request can contain them and no response ever does. A result that would be NaN returns `DOMAIN_ERROR`, and one that would be ±Inf returns `RESULT_OUT_OF_RANGE`.
- A negative-zero result is returned as `0`.
- `percentage` computes a × b / 100. If a × b overflows but the final result fits, it computes a / 100 × b instead, so `percentage` `[1e308, 10]` returns `1e307` rather than an error.
- Numbers too large for a float64, such as `1e400`, are rejected as `INVALID_OPERANDS`.

## Other paths

| Path | Behaviour |
|---|---|
| Unknown path under `/api/` | 404 JSON `NOT_FOUND`, never the frontend. |
| `/healthz` | See [GET /healthz](#get-healthz). |
| Anything else, with `STATIC_DIR` set | Serves the file if it exists, otherwise `index.html` (so client-side routes survive a reload). Directories are never listed. Methods other than `GET` and `HEAD` return a plain-text 405. |
| Anything else, without `STATIC_DIR` | Go's default plain-text `404 page not found`. |

## Known quirks

These come from Go's `encoding/json` (v1) and `http.ServeMux`, and are documented rather than worked around:

- **Field names match case-insensitively.** `{"OPERANDS":[1,2]}` is accepted and returns `{"operation":"add","operands":[1,2],"result":3}`.
- **With duplicate keys, the last one wins.** `{"operands":[1,2],"operands":[5,5]}` returns `{"operation":"add","operands":[5,5],"result":10}`.
- **Paths that aren't in canonical form get cleaned.** A `POST` to `/api//v1/calculate/add` returns `307 Temporary Redirect` with `Location: /api/v1/calculate/add`, while other methods on such a path get the JSON 404.
- **Operands are echoed as received.** `multiply` `[-0,5]` returns `"operands":[-0,5]`, with `"result":0`.

## How the frontend uses the API

This is how the bundled client (`frontend/src/api`) behaves. Other clients are free to do otherwise:

- It sends every calculation to this endpoint and computes nothing itself; `±` only flips the sign locally.
- It times out after 5 seconds and reports that as `TIMEOUT`. A failed connection is `NETWORK_ERROR`, and a response that isn't the documented JSON shape is `INVALID_RESPONSE`. These three codes exist only in the client.
- It shows its own message for each known code, for example "Can't divide by zero.". Codes the user can't act on, such as `INVALID_JSON` and `UNSUPPORTED_MEDIA_TYPE`, get a generic "Something went wrong. Please try again.". The server's `message` is shown only for a code the client doesn't know.
