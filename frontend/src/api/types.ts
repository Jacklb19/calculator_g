export type Operation =
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'power'
  | 'sqrt'
  | 'percentage'

export interface CalculationResult {
  operation: Operation
  operands: number[]
  result: number
}

export type ServerErrorCode =
  | 'INVALID_JSON'
  | 'INVALID_OPERANDS'
  | 'UNKNOWN_OPERATION'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'DIVISION_BY_ZERO'
  | 'DOMAIN_ERROR'
  | 'RESULT_OUT_OF_RANGE'
  | 'INTERNAL_ERROR'

export type ClientErrorCode = 'NETWORK_ERROR' | 'TIMEOUT' | 'INVALID_RESPONSE'

export type KnownErrorCode = ServerErrorCode | ClientErrorCode
