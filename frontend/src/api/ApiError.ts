import type { KnownErrorCode } from './types'

export class ApiError extends Error {
  // A plain string rather than KnownErrorCode: a newer server may send codes this client doesn't know yet.
  readonly code: string
  readonly status: number | undefined

  constructor(code: KnownErrorCode | (string & {}), message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}
