import { ApiError } from './ApiError'
import type { CalculationResult, Operation } from './types'

export interface ApiClient {
  calculate(
    operation: Operation,
    operands: number[],
    options?: { signal?: AbortSignal },
  ): Promise<CalculationResult>
}

export interface ApiClientOptions {
  baseUrl?: string
  fetch?: typeof fetch
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 5000

export function createApiClient({
  baseUrl = '',
  // Wrapped so fetch is never invoked with a foreign `this`, which browsers reject.
  fetch: fetchFn = (input, init) => fetch(input, init),
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ApiClientOptions = {}): ApiClient {
  return {
    async calculate(operation, operands, { signal } = {}) {
      const timeout = startTimeout(timeoutMs, signal)
      try {
        const response = await fetchFn(`${baseUrl}/api/v1/calculate/${operation}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ operands }),
          signal: timeout.signal,
        })
        return await parseResponse(response)
      } catch (error) {
        throw normalizeError(error, timeout.timedOut(), signal)
      } finally {
        timeout.clear()
      }
    },
  }
}

// Links the caller's signal by hand: AbortSignal.any needs Safari 17.4, above the build's Safari 16.4 target.
function startTimeout(ms: number, parent?: AbortSignal) {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, ms)
  const abortFromParent = () => controller.abort(parent?.reason)

  if (parent?.aborted) abortFromParent()
  parent?.addEventListener('abort', abortFromParent)

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    clear: () => {
      clearTimeout(timer)
      parent?.removeEventListener('abort', abortFromParent)
    },
  }
}

async function parseResponse(response: Response): Promise<CalculationResult> {
  const body = await readJson(response)
  if (!response.ok) {
    throw toApiError(response.status, body)
  }
  if (!isCalculationResult(body)) {
    throw new ApiError('INVALID_RESPONSE', 'Malformed calculation result', response.status)
  }
  return body
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function toApiError(status: number, body: unknown): ApiError {
  if (!isErrorBody(body)) {
    return new ApiError('INVALID_RESPONSE', `Unexpected response with status ${status}`, status)
  }
  return new ApiError(body.error.code, body.error.message, status)
}

// Caller-initiated aborts are rethrown untouched so callers can tell cancellation apart from failure.
function normalizeError(error: unknown, timedOut: boolean, signal?: AbortSignal): unknown {
  if (error instanceof ApiError) return error
  if (timedOut) return new ApiError('TIMEOUT', 'The request timed out')
  if (signal?.aborted) return error
  return new ApiError('NETWORK_ERROR', 'The server could not be reached')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isErrorBody(value: unknown): value is { error: { code: string; message: string } } {
  return (
    isRecord(value) &&
    isRecord(value.error) &&
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string'
  )
}

function isCalculationResult(value: unknown): value is CalculationResult {
  return (
    isRecord(value) &&
    typeof value.operation === 'string' &&
    typeof value.result === 'number' &&
    Array.isArray(value.operands) &&
    value.operands.every((operand) => typeof operand === 'number')
  )
}
