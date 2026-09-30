import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/ApiError'
import {
  calculatorReducer,
  displayedNumber,
  initialState,
  isLoading,
  MAX_DIGITS,
  type CalculatorState,
  type Digit,
  type InputAction,
} from './reducer'

// Key legend: digits, '.', + - * / ^ %, '=' equals, 'r' square root, 'n' negate, '<' backspace, 'c' clear.
const KEYS: Record<string, InputAction> = {
  '.': { type: 'decimal' },
  '+': { type: 'operator', operator: 'add' },
  '-': { type: 'operator', operator: 'subtract' },
  '*': { type: 'operator', operator: 'multiply' },
  '/': { type: 'operator', operator: 'divide' },
  '^': { type: 'operator', operator: 'power' },
  '%': { type: 'operator', operator: 'percentage' },
  '=': { type: 'equals' },
  r: { type: 'sqrt' },
  n: { type: 'negate' },
  '<': { type: 'backspace' },
  c: { type: 'clear' },
}

function toAction(key: string): InputAction {
  if (/^\d$/.test(key)) return { type: 'digit', digit: key as Digit }
  const action = KEYS[key]
  if (!action) throw new Error(`unknown key ${key}`)
  return action
}

function press(keys: string, state: CalculatorState = initialState): CalculatorState {
  return [...keys].map(toAction).reduce(calculatorReducer, state)
}

function succeed(state: CalculatorState, result: number): CalculatorState {
  return calculatorReducer(state, { type: 'succeeded', result })
}

const divisionByZero = new ApiError('DIVISION_BY_ZERO', 'division by zero', 422)

function fail(state: CalculatorState, error: ApiError = divisionByZero): CalculatorState {
  return calculatorReducer(state, { type: 'failed', error })
}

function typing(text: string) {
  return { kind: 'typing', text }
}

function value(v: number) {
  return { kind: 'value', value: v }
}

describe('initial state', () => {
  it('shows 0 and has nothing pending', () => {
    expect(initialState.entry).toEqual(typing('0'))
    expect(initialState.accumulator).toBeNull()
    expect(initialState.operator).toBeNull()
    expect(isLoading(initialState)).toBe(false)
    expect(initialState.error).toBeNull()
  })
})

describe('digits', () => {
  it.each([
    ['5', '5'],
    ['123', '123'],
    ['000', '0'],
    ['007', '7'],
    ['0.00', '0.00'],
    ['10', '10'],
    ['1.05', '1.05'],
  ])('%s is shown as %s', (keys, expected) => {
    expect(press(keys).entry).toEqual(typing(expected))
  })

  it(`accepts at most ${MAX_DIGITS} digits`, () => {
    expect(press('1234567890123456789').entry).toEqual(typing('123456789012345'))
  })

  it('counts digits on both sides of the decimal point', () => {
    expect(press('0.123456789012345').entry).toEqual(typing('0.12345678901234'))
  })

  it('does not count the minus sign as a digit', () => {
    expect(press('n123456789012345').entry).toEqual(typing('-123456789012345'))
  })
})

describe('decimal point', () => {
  it.each([
    ['.', '0.'],
    ['.5', '0.5'],
    ['1.', '1.'],
    ['1.2.3', '1.23'],
    ['1..', '1.'],
  ])('%s is shown as %s', (keys, expected) => {
    expect(press(keys).entry).toEqual(typing(expected))
  })

  it('is ignored once the digit limit is reached', () => {
    expect(press('123456789012345.').entry).toEqual(typing('123456789012345'))
  })

  it('starts a new entry after an operator', () => {
    expect(press('12+.').entry).toEqual(typing('0.'))
  })

  it('starts a new entry after a result', () => {
    expect(press('.', succeed(press('2+3='), 5)).entry).toEqual(typing('0.'))
  })
})

describe('negate', () => {
  it.each([
    ['n', '-0'],
    ['n5', '-5'],
    ['5n', '-5'],
    ['5nn', '5'],
    ['1.5n', '-1.5'],
    ['n.5', '-0.5'],
    ['n0', '-0'],
  ])('%s is shown as %s', (keys, expected) => {
    expect(press(keys).entry).toEqual(typing(expected))
  })

  it('flips the sign of a result', () => {
    expect(press('n', succeed(press('2+3='), 5)).entry).toEqual(value(-5))
  })

  it('never produces negative zero from a zero result', () => {
    const entry = press('n', succeed(press('2*0='), 0)).entry
    expect(entry).toEqual(value(0))
    expect(entry?.kind === 'value' && Object.is(entry.value, -0)).toBe(false)
  })

  it('starts a negative second operand after an operator', () => {
    const state = press('5*n3=')
    expect(state.request?.operands).toEqual([5, -3])
  })
})

describe('backspace', () => {
  it.each([
    ['123<', '12'],
    ['5<', '0'],
    ['0<', '0'],
    ['n5<', '0'],
    ['1.<', '1'],
    ['1.5<<', '1'],
    ['12<<<', '0'],
  ])('%s is shown as %s', (keys, expected) => {
    expect(press(keys).entry).toEqual(typing(expected))
  })

  it('does not edit a result', () => {
    const result = succeed(press('2+3='), 5)
    expect(press('<', result)).toEqual(result)
  })

  it('does nothing right after an operator', () => {
    const afterOperator = press('12+')
    expect(press('<', afterOperator)).toEqual(afterOperator)
  })
})

describe('clear', () => {
  it('resets everything', () => {
    expect(press('12+3c')).toEqual(initialState)
  })

  it('resets after a result', () => {
    expect(press('c', succeed(press('2+3='), 5))).toEqual(initialState)
  })

  it('clears an error', () => {
    expect(press('c', fail(press('1/0='))).error).toBeNull()
  })
})

describe('operators', () => {
  it('stores the first operand and waits for the second', () => {
    const state = press('12+')
    expect(state).toMatchObject({ accumulator: 12, operator: 'add', entry: null, request: null })
  })

  it('parses a trailing decimal point as a whole number', () => {
    expect(press('12.+').accumulator).toBe(12)
  })

  it('replaces the operator when pressed twice in a row', () => {
    const state = press('12+*')
    expect(state).toMatchObject({ accumulator: 12, operator: 'multiply', request: null })
  })

  it('starts the second operand on the next digit', () => {
    expect(press('12+3')).toMatchObject({ accumulator: 12, operator: 'add', entry: typing('3') })
  })

  it.each([
    ['+', 'add'],
    ['-', 'subtract'],
    ['*', 'multiply'],
    ['/', 'divide'],
    ['^', 'power'],
    ['%', 'percentage'],
  ])('%s sends %s', (key, operation) => {
    expect(press(`6${key}2=`).request).toEqual({
      operation,
      operands: [6, 2],
      then: { kind: 'equals' },
    })
  })

  it('sends the pending operation when another operator is pressed', () => {
    expect(press('2+3*').request).toEqual({
      operation: 'add',
      operands: [2, 3],
      then: { kind: 'chain', operator: 'multiply' },
    })
  })

  it('carries a chained result forward as the next first operand', () => {
    const state = succeed(press('2+3*'), 5)
    expect(state).toMatchObject({ accumulator: 5, operator: 'multiply', entry: null, request: null })
  })

  it('evaluates strictly left to right', () => {
    const afterAdd = succeed(press('2+3*'), 5)
    const multiply = press('4=', afterAdd)
    expect(multiply.request).toEqual({
      operation: 'multiply',
      operands: [5, 4],
      then: { kind: 'equals' },
    })
    expect(succeed(multiply, 20)).toMatchObject({ entry: value(20), accumulator: null, operator: null })
  })

  it('lets the operator be changed after a chained result', () => {
    const state = press('-', succeed(press('2+3*'), 5))
    expect(state).toMatchObject({ accumulator: 5, operator: 'subtract', request: null })
  })

  it('continues from a result', () => {
    const state = press('*2=', succeed(press('2+3='), 5))
    expect(state.request?.operands).toEqual([5, 2])
  })

  it('treats percentage as a percent of the second operand', () => {
    expect(press('50%200=').request).toMatchObject({ operation: 'percentage', operands: [50, 200] })
  })
})

describe('equals', () => {
  it('does nothing without an operator', () => {
    expect(press('12=')).toEqual(press('12'))
  })

  it('does nothing right after an operator', () => {
    expect(press('12+=')).toEqual(press('12+'))
  })

  it('shows the result and clears the pending operation', () => {
    const state = succeed(press('12+3='), 15)
    expect(state).toMatchObject({ entry: value(15), accumulator: null, operator: null, request: null })
  })

  it('starts a fresh calculation when a digit follows a result', () => {
    const state = press('7', succeed(press('12+3='), 15))
    expect(state).toMatchObject({ entry: typing('7'), accumulator: null, operator: null })
  })
})

describe('square root', () => {
  it('applies to the typed number immediately', () => {
    expect(press('16r').request).toEqual({ operation: 'sqrt', operands: [16], then: { kind: 'sqrt' } })
  })

  it('applies to the initial zero', () => {
    expect(press('r').request?.operands).toEqual([0])
  })

  it('shows the result as the current entry', () => {
    expect(succeed(press('16r'), 4).entry).toEqual(value(4))
  })

  it('keeps a pending operation and uses the root as its second operand', () => {
    const rooted = succeed(press('9+16r'), 4)
    expect(rooted).toMatchObject({ accumulator: 9, operator: 'add', entry: value(4) })
    expect(press('=', rooted).request?.operands).toEqual([9, 4])
  })

  it('applies to the displayed first operand right after an operator', () => {
    const state = press('9+r')
    expect(state.request?.operands).toEqual([9])
    expect(succeed(state, 3)).toMatchObject({ accumulator: 9, operator: 'add', entry: value(3) })
  })

  it('applies to a result', () => {
    expect(press('r', succeed(press('2*8='), 16)).request?.operands).toEqual([16])
  })

  it('sends a negative number and leaves validation to the server', () => {
    expect(press('4nr').request?.operands).toEqual([-4])
  })
})

describe('while a request is in flight', () => {
  const loading = press('12+3=')

  it('reports loading', () => {
    expect(isLoading(loading)).toBe(true)
  })

  it.each([...'0123456789.+-*/^%=rn<c'])('ignores %s', (key) => {
    expect(press(key, loading)).toBe(loading)
  })
})

describe('responses', () => {
  it('ignores a success with no request in flight', () => {
    expect(succeed(initialState, 42)).toBe(initialState)
  })

  it('ignores a failure with no request in flight', () => {
    expect(fail(initialState)).toBe(initialState)
  })
})

describe('errors', () => {
  it('keeps the input and pending operation', () => {
    const state = fail(press('1/0='))
    expect(state).toMatchObject({
      entry: typing('0'),
      accumulator: 1,
      operator: 'divide',
      request: null,
      error: divisionByZero,
    })
  })

  it('allows retrying the same calculation', () => {
    const retried = press('=', fail(press('12+3=')))
    expect(retried.request).toEqual({ operation: 'add', operands: [12, 3], then: { kind: 'equals' } })
  })

  it('clears the error on the next input and keeps editing', () => {
    const state = press('<5', fail(press('1/0=')))
    expect(state).toMatchObject({ entry: typing('5'), error: null, accumulator: 1, operator: 'divide' })
  })

  it('does not apply the new operator when a chained request fails', () => {
    const state = fail(press('2+3*'))
    expect(state).toMatchObject({ accumulator: 2, operator: 'add', entry: typing('3') })
  })

  it('keeps the entry when a square root fails', () => {
    const domainError = new ApiError('DOMAIN_ERROR', 'undefined result', 422)
    expect(fail(press('4nr'), domainError)).toMatchObject({ entry: typing('-4'), error: domainError })
  })
})

describe('displayedNumber', () => {
  it.each<[string, CalculatorState, number]>([
    ['initial zero', initialState, 0],
    ['typed text', press('12.5'), 12.5],
    ['trailing decimal point', press('7.'), 7],
    ['first operand after an operator', press('12+'), 12],
    ['result', succeed(press('2+3='), 5), 5],
  ])('shows the %s', (_name, state, expected) => {
    expect(displayedNumber(state)).toBe(expected)
  })
})
