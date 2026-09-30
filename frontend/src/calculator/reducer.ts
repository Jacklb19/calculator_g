import type { ApiError } from '../api/ApiError'
import type { Operation } from '../api/types'

export const MAX_DIGITS = 15

export type BinaryOperation = Exclude<Operation, 'sqrt'>
export type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

export type Entry =
  | { kind: 'typing'; text: string }
  | { kind: 'value'; value: number }

export type Continuation =
  | { kind: 'equals' }
  | { kind: 'chain'; operator: BinaryOperation }
  | { kind: 'sqrt' }

export interface CalculationRequest {
  operation: Operation
  operands: number[]
  then: Continuation
}

export interface CalculatorState {
  // null right after an operator: the display shows the accumulator until the next operand starts.
  entry: Entry | null
  accumulator: number | null
  operator: BinaryOperation | null
  request: CalculationRequest | null
  error: ApiError | null
}

export type InputAction =
  | { type: 'digit'; digit: Digit }
  | { type: 'decimal' }
  | { type: 'negate' }
  | { type: 'backspace' }
  | { type: 'clear' }
  | { type: 'operator'; operator: BinaryOperation }
  | { type: 'equals' }
  | { type: 'sqrt' }

export type ResponseAction =
  | { type: 'succeeded'; result: number }
  | { type: 'failed'; error: ApiError }

export type CalculatorAction = InputAction | ResponseAction

export const initialState: CalculatorState = {
  entry: { kind: 'typing', text: '0' },
  accumulator: null,
  operator: null,
  request: null,
  error: null,
}

export function calculatorReducer(state: CalculatorState, action: CalculatorAction): CalculatorState {
  switch (action.type) {
    case 'succeeded':
      return state.request ? applyResult(state, state.request.then, action.result) : state
    case 'failed':
      return state.request ? { ...state, request: null, error: action.error } : state
    default:
      return state.request ? state : handleInput({ ...state, error: null }, action)
  }
}

export function isLoading(state: CalculatorState): boolean {
  return state.request !== null
}

export function displayedNumber(state: CalculatorState): number {
  if (state.entry) return entryValue(state.entry)
  return state.accumulator ?? 0
}

function handleInput(state: CalculatorState, action: InputAction): CalculatorState {
  switch (action.type) {
    case 'digit':
      return withTyping(state, (text) => appendDigit(text, action.digit))
    case 'decimal':
      return withTyping(state, appendDecimal)
    case 'negate':
      return negate(state)
    case 'backspace':
      return state.entry?.kind === 'typing'
        ? { ...state, entry: typing(removeLastChar(state.entry.text)) }
        : state
    case 'clear':
      return initialState
    case 'operator':
      return chooseOperator(state, action.operator)
    case 'equals':
      return equals(state)
    case 'sqrt':
      return { ...state, request: sqrtRequest(state) }
  }
}

function withTyping(state: CalculatorState, edit: (text: string) => string): CalculatorState {
  const text = state.entry?.kind === 'typing' ? state.entry.text : '0'
  return { ...state, entry: typing(edit(text)) }
}

function appendDigit(text: string, digit: Digit): string {
  if (countDigits(text) >= MAX_DIGITS) return text
  if (text === '0') return digit
  if (text === '-0') return `-${digit}`
  return text + digit
}

function appendDecimal(text: string): string {
  if (text.includes('.') || countDigits(text) >= MAX_DIGITS) return text
  return `${text}.`
}

function negate(state: CalculatorState): CalculatorState {
  const { entry } = state
  if (entry?.kind === 'value') {
    return { ...state, entry: { kind: 'value', value: entry.value === 0 ? 0 : -entry.value } }
  }
  return withTyping(state, toggleSign)
}

function toggleSign(text: string): string {
  return text.startsWith('-') ? text.slice(1) : `-${text}`
}

function removeLastChar(text: string): string {
  const shortened = text.slice(0, -1)
  return shortened === '' || shortened === '-' ? '0' : shortened
}

function chooseOperator(state: CalculatorState, operator: BinaryOperation): CalculatorState {
  if (state.entry === null) {
    return { ...state, operator }
  }
  if (state.accumulator === null || state.operator === null) {
    return { ...state, accumulator: entryValue(state.entry), operator, entry: null }
  }
  return {
    ...state,
    request: binaryRequest(state.operator, state.accumulator, state.entry, { kind: 'chain', operator }),
  }
}

function equals(state: CalculatorState): CalculatorState {
  if (state.entry === null || state.accumulator === null || state.operator === null) {
    return state
  }
  return {
    ...state,
    request: binaryRequest(state.operator, state.accumulator, state.entry, { kind: 'equals' }),
  }
}

function binaryRequest(
  operation: BinaryOperation,
  accumulator: number,
  entry: Entry,
  then: Continuation,
): CalculationRequest {
  return { operation, operands: [accumulator, entryValue(entry)], then }
}

function sqrtRequest(state: CalculatorState): CalculationRequest {
  return { operation: 'sqrt', operands: [displayedNumber(state)], then: { kind: 'sqrt' } }
}

function applyResult(state: CalculatorState, then: Continuation, result: number): CalculatorState {
  const settled = { ...state, request: null }
  switch (then.kind) {
    case 'equals':
      return { ...settled, entry: resultEntry(result), accumulator: null, operator: null }
    case 'chain':
      return { ...settled, entry: null, accumulator: result, operator: then.operator }
    case 'sqrt':
      return { ...settled, entry: resultEntry(result) }
  }
}

function entryValue(entry: Entry): number {
  return entry.kind === 'typing' ? Number(entry.text) : entry.value
}

function typing(text: string): Entry {
  return { kind: 'typing', text }
}

function resultEntry(value: number): Entry {
  return { kind: 'value', value }
}

function countDigits(text: string): number {
  return text.replace(/\D/g, '').length
}
