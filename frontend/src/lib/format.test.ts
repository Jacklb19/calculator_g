import { describe, expect, it } from 'vitest'
import { formatNumber } from './format'

describe('formatNumber', () => {
  it.each([
    [0, '0'],
    [-0, '0'],
    [5, '5'],
    [-42, '-42'],
    [2.5, '2.5'],
    [1024, '1024'],
    [0.1 + 0.2, '0.3'],
    [1 / 3, '0.333333333333333'],
    [2 / 3, '0.666666666666667'],
    [-1 / 3, '-0.333333333333333'],
    [Math.SQRT2, '1.4142135623731'],
    [1.1 * 1.1, '1.21'],
  ])('rounds %d to 15 significant digits as %s', (value, expected) => {
    expect(formatNumber(value)).toBe(expected)
  })

  it.each([
    [123456789012345, '123456789012345'],
    [-123456789012345, '-123456789012345'],
    [999999999999999, '999999999999999'],
  ])('keeps a typed 15-digit number intact: %d', (value, expected) => {
    expect(formatNumber(value)).toBe(expected)
  })

  it.each([
    [0.000001, '0.000001'],
    [0.0000001, '1e-7'],
    [1e15, '1e+15'],
    [1234567890123456, '1.23456789012346e+15'],
    [-9.87654321e20, '-9.87654321e+20'],
    [Number.MAX_VALUE, '1.79769313486232e+308'],
    [Number.MIN_VALUE, '4.94065645841247e-324'],
  ])('uses exponential notation where plain digits would mislead: %d', (value, expected) => {
    expect(formatNumber(value)).toBe(expected)
  })

  it('switches to exponential form when rounding carries past 15 digits', () => {
    expect(formatNumber(999999999999999.9)).toBe('1e+15')
  })

  it.each([
    [Infinity, 'Infinity'],
    [NaN, 'NaN'],
  ])('does not throw on %d', (value, expected) => {
    expect(formatNumber(value)).toBe(expected)
  })
})
