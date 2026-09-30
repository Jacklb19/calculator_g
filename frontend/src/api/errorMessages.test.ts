import { describe, expect, it } from 'vitest'
import { ApiError } from './ApiError'
import { friendlyMessage } from './errorMessages'

describe('friendlyMessage', () => {
  it.each([
    ['DIVISION_BY_ZERO', "Can't divide by zero."],
    ['DOMAIN_ERROR', 'No real result for that input.'],
    ['RESULT_OUT_OF_RANGE', 'The result is too large.'],
    ['NETWORK_ERROR', "Can't reach the server. Check your connection."],
    ['TIMEOUT', 'The server took too long to respond. Please try again.'],
  ])('maps %s to a friendly message', (code, expected) => {
    expect(friendlyMessage(new ApiError(code, 'raw server message'))).toBe(expected)
  })

  it('hides raw messages for errors the user cannot act on', () => {
    const error = new ApiError('UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json', 415)

    expect(friendlyMessage(error)).toBe('Something went wrong. Please try again.')
  })

  it('falls back to the server message for unknown codes', () => {
    const error = new ApiError('SOME_FUTURE_CODE', 'Something specific happened', 422)

    expect(friendlyMessage(error)).toBe('Something specific happened')
  })

  it('falls back to a generic message when an unknown code has no message', () => {
    expect(friendlyMessage(new ApiError('SOME_FUTURE_CODE', ''))).toBe(
      'Something went wrong. Please try again.',
    )
  })

  it('does not treat Object prototype keys as known codes', () => {
    expect(friendlyMessage(new ApiError('toString', 'raw'))).toBe('raw')
  })
})
