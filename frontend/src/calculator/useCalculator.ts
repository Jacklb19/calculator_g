import { useEffect, useReducer, type Dispatch } from 'react'
import { ApiError } from '../api/ApiError'
import type { ApiClient } from '../api/client'
import { calculatorReducer, initialState, type CalculatorState, type InputAction } from './reducer'

interface Calculator {
  state: CalculatorState
  dispatch: Dispatch<InputAction>
}

// client must be referentially stable: a new instance per render would abort and resend the request.
export function useCalculator(client: ApiClient): Calculator {
  const [state, dispatch] = useReducer(calculatorReducer, initialState)
  const { request } = state

  useEffect(() => {
    if (!request) return

    const controller = new AbortController()
    const send = async () => {
      try {
        const { result } = await client.calculate(request.operation, request.operands, {
          signal: controller.signal,
        })
        if (!controller.signal.aborted) dispatch({ type: 'succeeded', result })
      } catch (error) {
        if (!controller.signal.aborted) dispatch({ type: 'failed', error: toApiError(error) })
      }
    }
    void send()

    return () => controller.abort()
  }, [client, request])

  return { state, dispatch }
}

function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError('UNEXPECTED_ERROR', 'Unexpected error')
}
