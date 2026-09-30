import { formatNumber } from '../lib/format'
import { OPERATOR_SYMBOLS } from './keys'
import { displayedNumber, type CalculatorState } from './reducer'

export function displayText(state: CalculatorState): string {
  if (state.entry?.kind === 'typing') return state.entry.text
  return formatNumber(displayedNumber(state))
}

export function expressionText(state: CalculatorState): string {
  if (state.accumulator === null || state.operator === null) return ''
  return `${formatNumber(state.accumulator)} ${OPERATOR_SYMBOLS[state.operator]}`
}
