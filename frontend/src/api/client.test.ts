import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './ApiError'
import { createApiClient } from './client'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function mockFetch(response: Response | Error) {
  return vi.fn<typeof fetch>(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
}

function hangingFetch() {
  return vi.fn<typeof fetch>(
    (_input, init) =>
      new Promise((_resolve, reject) => {
        if (init?.signal?.aborted) reject(init.signal.reason)
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      }),
  )
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('expected promise to reject')
}

describe('calculate', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('posts the operands as JSON to the operation endpoint', async () => {
    const fetch = mockFetch(jsonResponse({ operation: 'divide', operands: [10, 4], result: 2.5 }))
    const client = createApiClient({ fetch, baseUrl: 'http://api.test' })

    await client.calculate('divide', [10, 4])

    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('http://api.test/api/v1/calculate/divide')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(init?.body).toBe('{"operands":[10,4]}')
  })

  it('returns the parsed result', async () => {
    const body = { operation: 'add', operands: [2, 3], result: 5 }
    const client = createApiClient({ fetch: mockFetch(jsonResponse(body)) })

    await expect(client.calculate('add', [2, 3])).resolves.toEqual(body)
  })

  it.each([
    [422, 'DIVISION_BY_ZERO', 'division by zero'],
    [422, 'DOMAIN_ERROR', 'undefined result: square root of a negative number'],
    [400, 'INVALID_OPERANDS', 'invalid operands: add expects 2 operand(s), got 1'],
    [404, 'UNKNOWN_OPERATION', 'unknown operation: "modulo"'],
    [500, 'INTERNAL_ERROR', 'internal server error'],
    [418, 'SOME_FUTURE_CODE', 'a code this client does not know'],
  ])('turns a %i %s error body into an ApiError', async (status, code, message) => {
    const client = createApiClient({
      fetch: mockFetch(jsonResponse({ error: { code, message } }, status)),
    })

    const error = await captureError(client.calculate('add', [1, 2]))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code, message, status })
  })

  it.each([
    ['HTML error page', new Response('<html>Bad Gateway</html>', { status: 502 }), 502],
    ['empty error body', new Response(null, { status: 503 }), 503],
    ['JSON error without the error shape', jsonResponse({ message: 'nope' }, 400), 400],
    ['non-JSON success body', new Response('ok', { status: 200 }), 200],
    ['success body missing result', jsonResponse({ operation: 'add', operands: [1, 2] }), 200],
    ['success body with string result', jsonResponse({ operation: 'add', operands: [1, 2], result: '3' }), 200],
  ])('reports INVALID_RESPONSE for %s', async (_name, response, status) => {
    const client = createApiClient({ fetch: mockFetch(response) })

    const error = await captureError(client.calculate('add', [1, 2]))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'INVALID_RESPONSE', status })
  })

  it('reports NETWORK_ERROR when fetch rejects', async () => {
    const client = createApiClient({ fetch: mockFetch(new TypeError('Failed to fetch')) })

    const error = await captureError(client.calculate('add', [1, 2]))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'NETWORK_ERROR', status: undefined })
  })

  it('reports TIMEOUT when the server does not answer in time', async () => {
    vi.useFakeTimers()
    const client = createApiClient({ fetch: hangingFetch(), timeoutMs: 1000 })

    const pending = captureError(client.calculate('add', [1, 2]))
    await vi.advanceTimersByTimeAsync(1000)

    const error = await pending
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'TIMEOUT', status: undefined })
  })

  it('does not time out before the deadline', async () => {
    vi.useFakeTimers()
    const fetch = hangingFetch()
    const client = createApiClient({ fetch, timeoutMs: 1000 })

    void client.calculate('add', [1, 2]).catch(() => {})
    await vi.advanceTimersByTimeAsync(999)

    expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(false)
  })

  it('clears the timeout once the request settles', async () => {
    vi.useFakeTimers()
    const client = createApiClient({
      fetch: mockFetch(jsonResponse({ operation: 'add', operands: [1, 2], result: 3 })),
    })

    await client.calculate('add', [1, 2])

    expect(vi.getTimerCount()).toBe(0)
  })

  it('rethrows caller aborts untouched instead of wrapping them', async () => {
    const controller = new AbortController()
    const client = createApiClient({ fetch: hangingFetch() })

    const pending = captureError(client.calculate('add', [1, 2], { signal: controller.signal }))
    controller.abort()

    const error = await pending
    expect(error).not.toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ name: 'AbortError' })
  })

  it('works in browsers without AbortSignal.any', async () => {
    vi.spyOn(AbortSignal, 'any').mockImplementation(() => {
      throw new TypeError('AbortSignal.any is not a function')
    })
    const body = { operation: 'add', operands: [2, 3], result: 5 }
    const client = createApiClient({ fetch: mockFetch(jsonResponse(body)) })

    await expect(
      client.calculate('add', [2, 3], { signal: new AbortController().signal }),
    ).resolves.toEqual(body)
  })

  it('rejects with the abort when the caller signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const client = createApiClient({ fetch: hangingFetch() })

    const error = await captureError(client.calculate('add', [1, 2], { signal: controller.signal }))

    expect(error).not.toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ name: 'AbortError' })
  })

  it('stops listening to the caller signal once the request settles', async () => {
    const controller = new AbortController()
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener')
    const client = createApiClient({
      fetch: mockFetch(jsonResponse({ operation: 'add', operands: [1, 2], result: 3 })),
    })

    await client.calculate('add', [1, 2], { signal: controller.signal })

    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function))
  })
})
