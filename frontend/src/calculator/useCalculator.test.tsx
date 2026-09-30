import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { ApiError } from '../api/ApiError'
import type { ApiClient } from '../api/client'
import type { CalculationResult } from '../api/types'
import type { InputAction } from './reducer'
import { useCalculator } from './useCalculator'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function fakeClient() {
  const pending = deferred<CalculationResult>()
  const calculate = vi.fn<ApiClient['calculate']>(() => pending.promise)
  return { client: { calculate }, calculate, pending }
}

const addTwoAndThree: InputAction[] = [
  { type: 'digit', digit: '2' },
  { type: 'operator', operator: 'add' },
  { type: 'digit', digit: '3' },
  { type: 'equals' },
]

function renderCalculator(client: ApiClient) {
  const hook = renderHook(() => useCalculator(client))
  const dispatchAll = (actions: InputAction[]) =>
    act(() => actions.forEach((action) => hook.result.current.dispatch(action)))
  return { ...hook, dispatchAll }
}

describe('useCalculator', () => {
  it('sends the pending calculation and shows the result', async () => {
    const { client, calculate, pending } = fakeClient()
    const { result, dispatchAll } = renderCalculator(client)

    dispatchAll(addTwoAndThree)

    expect(calculate).toHaveBeenCalledWith('add', [2, 3], { signal: expect.any(AbortSignal) })
    pending.resolve({ operation: 'add', operands: [2, 3], result: 5 })
    await waitFor(() => expect(result.current.state.entry).toEqual({ kind: 'value', value: 5 }))
    expect(result.current.state.request).toBeNull()
  })

  it('only lets callers dispatch input actions', () => {
    const { result } = renderCalculator(fakeClient().client)

    expectTypeOf(result.current.dispatch).parameter(0).toEqualTypeOf<InputAction>()
  })

  it('does not send anything until a calculation is requested', () => {
    const { client, calculate } = fakeClient()
    const { dispatchAll } = renderCalculator(client)

    dispatchAll(addTwoAndThree.slice(0, 3))

    expect(calculate).not.toHaveBeenCalled()
  })

  it('ignores input while the request is in flight', () => {
    const { client, calculate } = fakeClient()
    const { result, dispatchAll } = renderCalculator(client)

    dispatchAll(addTwoAndThree)
    const loadingState = result.current.state
    dispatchAll([{ type: 'digit', digit: '9' }, { type: 'clear' }])

    expect(result.current.state).toBe(loadingState)
    expect(calculate).toHaveBeenCalledOnce()
  })

  it('keeps the input and stores the error when the request fails', async () => {
    const { client, pending } = fakeClient()
    const { result, dispatchAll } = renderCalculator(client)
    const error = new ApiError('DIVISION_BY_ZERO', 'division by zero', 422)

    dispatchAll(addTwoAndThree)
    pending.reject(error)

    await waitFor(() => expect(result.current.state.error).toBe(error))
    expect(result.current.state).toMatchObject({
      entry: { kind: 'typing', text: '3' },
      accumulator: 2,
      operator: 'add',
      request: null,
    })
  })

  it('wraps unexpected rejections in an ApiError', async () => {
    const { client, pending } = fakeClient()
    const { result, dispatchAll } = renderCalculator(client)

    dispatchAll(addTwoAndThree)
    pending.reject(new Error('boom'))

    await waitFor(() => expect(result.current.state.error).toBeInstanceOf(ApiError))
  })

  it('aborts the request on unmount and ignores its outcome', async () => {
    const { client, calculate, pending } = fakeClient()
    const { result, dispatchAll, unmount } = renderCalculator(client)

    dispatchAll(addTwoAndThree)
    const loadingState = result.current.state
    unmount()
    pending.resolve({ operation: 'add', operands: [2, 3], result: 5 })
    await pending.promise

    expect(calculate.mock.calls[0][2]?.signal?.aborted).toBe(true)
    expect(result.current.state).toBe(loadingState)
  })
})
