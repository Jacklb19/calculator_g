import { describe, expect, it } from 'vitest'
import { displayText, expressionText } from './display'
import { initialState, type CalculatorState } from './reducer'

function stateWith(overrides: Partial<CalculatorState>): CalculatorState {
  return { ...initialState, ...overrides }
}

describe('displayText', () => {
  it.each<[string, Partial<CalculatorState>, string]>([
    ['initial zero', {}, '0'],
    ['typed text verbatim', { entry: { kind: 'typing', text: '0.00' } }, '0.00'],
    ['a trailing decimal point', { entry: { kind: 'typing', text: '12.' } }, '12.'],
    ['a negative zero being typed', { entry: { kind: 'typing', text: '-0' } }, '-0'],
    ['a formatted result', { entry: { kind: 'value', value: 0.1 + 0.2 } }, '0.3'],
    ['a huge result in exponential form', { entry: { kind: 'value', value: 1e20 } }, '1e+20'],
    ['the first operand after an operator', { entry: null, accumulator: 1 / 3, operator: 'add' }, '0.333333333333333'],
  ])('shows %s', (_name, overrides, expected) => {
    expect(displayText(stateWith(overrides))).toBe(expected)
  })
})

describe('expressionText', () => {
  it('is empty with no pending operation', () => {
    expect(expressionText(initialState)).toBe('')
  })

  it.each<[CalculatorState['operator'], string]>([
    ['add', '12 +'],
    ['subtract', '12 −'],
    ['multiply', '12 ×'],
    ['divide', '12 ÷'],
    ['power', '12 ^'],
    ['percentage', '12 % of'],
  ])('shows the first operand and %s', (operator, expected) => {
    expect(expressionText(stateWith({ accumulator: 12, operator, entry: null }))).toBe(expected)
  })

  it('formats the first operand', () => {
    expect(expressionText(stateWith({ accumulator: 2 / 3, operator: 'multiply' }))).toBe(
      '0.666666666666667 ×',
    )
  })
})
