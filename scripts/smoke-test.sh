#!/usr/bin/env bash
# End-to-end check of a running calculator (API and frontend).
# Usage: scripts/smoke-test.sh [base-url]   (default http://localhost:8080)
set -euo pipefail

base_url="${1:-http://localhost:8080}"
failures=0

wait_until_healthy() {
  for _ in $(seq 1 30); do
    if curl -fsS "$base_url/healthz" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "server at $base_url did not become healthy" >&2
  exit 1
}

# check NAME STATUS BODY_SUBSTRING CURL_ARGS...
check() {
  local name=$1 want_status=$2 want_body=$3
  shift 3
  local response status body
  response=$(curl -sS -w '\n%{http_code}' "$@")
  status=${response##*$'\n'}
  body=${response%$'\n'*}
  if [[ $status == "$want_status" && $body == *"$want_body"* ]]; then
    echo "ok   $name"
  else
    echo "FAIL $name: got $status $body" >&2
    failures=$((failures + 1))
  fi
}

# check_api NAME STATUS BODY_SUBSTRING OPERATION OPERANDS [CONTENT_TYPE]
check_api() {
  local name=$1 want_status=$2 want_body=$3 operation=$4 operands=$5 content_type=${6:-application/json}
  check "$name" "$want_status" "$want_body" -H "Content-Type: $content_type" \
    -d "{\"operands\":$operands}" "$base_url/api/v1/calculate/$operation"
}

wait_until_healthy

check_api "divide" 200 '"result":2.5' divide '[10,4]'
check_api "division by zero" 422 '"code":"DIVISION_BY_ZERO"' divide '[1,0]'
check_api "unknown operation" 404 '"code":"UNKNOWN_OPERATION"' modulo '[1,2]'
check_api "wrong content type" 415 '"code":"UNSUPPORTED_MEDIA_TYPE"' add '[1,2]' text/plain
check "frontend" 200 '<div id="root">' "$base_url/"
check "client-side route falls back to the frontend" 200 '<div id="root">' "$base_url/history"

if ((failures > 0)); then
  echo "$failures check(s) failed" >&2
  exit 1
fi
