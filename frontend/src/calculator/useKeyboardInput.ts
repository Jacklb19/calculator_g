import { useEffect, type Dispatch } from 'react'
import { findKeyByKeyboard } from './keys'
import type { InputAction } from './reducer'

export function useKeyboardInput(dispatch: Dispatch<InputAction>) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isBrowserShortcut(event)) return
      const key = findKeyByKeyboard(event.key)
      if (!key) return
      // Also stops Enter from clicking whichever keypad button has focus.
      event.preventDefault()
      dispatch(key.action)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dispatch])
}

// Windows reports AltGr as Ctrl+Alt, and many layouts type characters like @ with AltGr.
function isBrowserShortcut(event: KeyboardEvent): boolean {
  if (event.getModifierState('AltGraph')) return false
  return event.ctrlKey || event.metaKey || event.altKey
}
