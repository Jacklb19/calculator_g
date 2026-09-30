import type { BinaryOperation, Digit, InputAction } from './reducer'

export type KeyVariant = 'digit' | 'function' | 'operator'

export interface KeyDefinition {
  label: string
  name: string
  action: InputAction
  keyboard: readonly string[]
  variant: KeyVariant
  span?: 'wide' | 'tall'
}

export const OPERATOR_SYMBOLS: Record<BinaryOperation, string> = {
  add: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
  power: '^',
  percentage: '% of',
}

function digit(value: Digit, span?: KeyDefinition['span']): KeyDefinition {
  return {
    label: value,
    name: value,
    action: { type: 'digit', digit: value },
    keyboard: [value],
    variant: 'digit',
    span,
  }
}

function operator(
  value: BinaryOperation,
  label: string,
  name: string,
  keyboard: readonly string[],
  variant: KeyVariant = 'operator',
): KeyDefinition {
  return { label, name, action: { type: 'operator', operator: value }, keyboard, variant }
}

// In visual order: the keypad is a 4-column grid filled row by row.
export const KEYS: readonly KeyDefinition[] = [
  { label: 'AC', name: 'All clear', action: { type: 'clear' }, keyboard: ['Escape', 'Delete'], variant: 'function' },
  { label: '⌫', name: 'Backspace', action: { type: 'backspace' }, keyboard: ['Backspace'], variant: 'function' },
  { label: '±', name: 'Change sign', action: { type: 'negate' }, keyboard: ['n', 'F9'], variant: 'function' },
  operator('divide', '÷', 'Divide', ['/']),

  { label: '√', name: 'Square root', action: { type: 'sqrt' }, keyboard: ['r', '@'], variant: 'function' },
  operator('power', 'xʸ', 'Power', ['^'], 'function'),
  operator('percentage', '%', 'Percent of', ['%'], 'function'),
  operator('multiply', '×', 'Multiply', ['*', 'x']),

  digit('7'),
  digit('8'),
  digit('9'),
  operator('subtract', '−', 'Subtract', ['-']),

  digit('4'),
  digit('5'),
  digit('6'),
  operator('add', '+', 'Add', ['+']),

  digit('1'),
  digit('2'),
  digit('3'),
  { label: '=', name: 'Equals', action: { type: 'equals' }, keyboard: ['Enter', '='], variant: 'operator', span: 'tall' },

  digit('0', 'wide'),
  { label: '.', name: 'Decimal point', action: { type: 'decimal' }, keyboard: ['.', ','], variant: 'digit' },
]

const KEYS_BY_KEYBOARD = new Map(KEYS.flatMap((key) => key.keyboard.map((k) => [k, key] as const)))

export function findKeyByKeyboard(key: string): KeyDefinition | undefined {
  return KEYS_BY_KEYBOARD.get(key)
}
