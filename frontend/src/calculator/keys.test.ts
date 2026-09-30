import { describe, expect, it } from 'vitest'
import { findKeyByKeyboard, KEYS } from './keys'

describe('KEYS', () => {
  it('fills the 4-column grid with no gaps', () => {
    const cells = KEYS.reduce((total, key) => total + (key.span ? 2 : 1), 0)
    expect(cells % 4).toBe(0)
  })

  it('gives every key a unique accessible name', () => {
    const names = KEYS.map((key) => key.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('never binds one keyboard key to two buttons', () => {
    const bindings = KEYS.flatMap((key) => key.keyboard)
    expect(new Set(bindings).size).toBe(bindings.length)
  })

  it('has a button for every digit', () => {
    const digits = KEYS.flatMap((key) => (key.action.type === 'digit' ? [key.action.digit] : []))
    expect(digits.sort()).toEqual([...'0123456789'])
  })
})

describe('findKeyByKeyboard', () => {
  it.each([
    ['7', { type: 'digit', digit: '7' }],
    ['.', { type: 'decimal' }],
    [',', { type: 'decimal' }],
    ['+', { type: 'operator', operator: 'add' }],
    ['-', { type: 'operator', operator: 'subtract' }],
    ['*', { type: 'operator', operator: 'multiply' }],
    ['x', { type: 'operator', operator: 'multiply' }],
    ['/', { type: 'operator', operator: 'divide' }],
    ['^', { type: 'operator', operator: 'power' }],
    ['%', { type: 'operator', operator: 'percentage' }],
    ['Enter', { type: 'equals' }],
    ['=', { type: 'equals' }],
    ['r', { type: 'sqrt' }],
    ['n', { type: 'negate' }],
    ['Backspace', { type: 'backspace' }],
    ['Escape', { type: 'clear' }],
    ['Delete', { type: 'clear' }],
  ])('maps %s', (keyboardKey, action) => {
    expect(findKeyByKeyboard(keyboardKey)?.action).toEqual(action)
  })

  it.each(['a', 'Tab', ' ', 'ArrowUp', 'F5'])('ignores %j', (keyboardKey) => {
    expect(findKeyByKeyboard(keyboardKey)).toBeUndefined()
  })
})
