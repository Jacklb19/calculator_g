import { KEYS, type KeyDefinition } from '../calculator/keys'
import type { BinaryOperation, InputAction } from '../calculator/reducer'
import styles from './Keypad.module.css'

interface KeypadProps {
  onKey: (action: InputAction) => void
  disabled: boolean
  activeOperator: BinaryOperation | null
}

export function Keypad({ onKey, disabled, activeOperator }: KeypadProps) {
  return (
    <div className={styles.keypad} role="group" aria-label="Keypad">
      {KEYS.map((key) => (
        <button
          key={key.name}
          type="button"
          className={styles.key}
          data-variant={key.variant}
          data-span={key.span}
          aria-label={key.name}
          aria-keyshortcuts={key.keyboard.map(toShortcutName).join(' ')}
          aria-pressed={pressedState(key, activeOperator)}
          aria-disabled={disabled}
          onClick={() => onKey(key.action)}
        >
          {key.label}
        </button>
      ))}
    </div>
  )
}

function pressedState(key: KeyDefinition, activeOperator: BinaryOperation | null) {
  return key.action.type === 'operator' ? key.action.operator === activeOperator : undefined
}

// aria-keyshortcuts reserves "+" as the modifier separator.
function toShortcutName(key: string): string {
  return key === '+' ? 'Plus' : key
}
