import type { ApiError } from './ApiError'
import type { KnownErrorCode } from './types'

const GENERIC_MESSAGE = 'Something went wrong. Please try again.'

const FRIENDLY_MESSAGES: Record<KnownErrorCode, string> = {
  DIVISION_BY_ZERO: "Can't divide by zero.",
  DOMAIN_ERROR: 'No real result for that input.',
  RESULT_OUT_OF_RANGE: 'The result is too large.',
  INVALID_OPERANDS: 'Please enter a valid number.',
  UNKNOWN_OPERATION: "That operation isn't supported.",
  NETWORK_ERROR: "Can't reach the server. Check your connection.",
  TIMEOUT: 'The server took too long to respond. Please try again.',
  INVALID_RESPONSE: 'The server sent an unexpected response.',
  INTERNAL_ERROR: 'The server ran into a problem. Please try again.',
  INVALID_JSON: GENERIC_MESSAGE,
  NOT_FOUND: GENERIC_MESSAGE,
  METHOD_NOT_ALLOWED: GENERIC_MESSAGE,
  PAYLOAD_TOO_LARGE: GENERIC_MESSAGE,
  UNSUPPORTED_MEDIA_TYPE: GENERIC_MESSAGE,
}

export function friendlyMessage(error: ApiError): string {
  if (isKnownCode(error.code)) return FRIENDLY_MESSAGES[error.code]
  return error.message || GENERIC_MESSAGE
}

function isKnownCode(code: string): code is KnownErrorCode {
  return Object.hasOwn(FRIENDLY_MESSAGES, code)
}
