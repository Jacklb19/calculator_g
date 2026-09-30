import type { ApiClient } from './api/client'
import { friendlyMessage } from './api/errorMessages'
import styles from './App.module.css'
import { displayText, expressionText } from './calculator/display'
import { isLoading } from './calculator/reducer'
import { useCalculator } from './calculator/useCalculator'
import { useKeyboardInput } from './calculator/useKeyboardInput'
import { Display } from './components/Display'
import { Keypad } from './components/Keypad'

interface AppProps {
  api: ApiClient
}

export function App({ api }: AppProps) {
  const { state, dispatch } = useCalculator(api)
  useKeyboardInput(dispatch)
  const busy = isLoading(state)

  return (
    <main className={styles.page}>
      <h1 className="visually-hidden">Calculator</h1>
      <section className={styles.calculator} aria-label="Calculator" aria-busy={busy}>
        <Display
          expression={expressionText(state)}
          value={displayText(state)}
          error={state.error && friendlyMessage(state.error)}
          busy={busy}
        />
        <Keypad onKey={dispatch} disabled={busy} activeOperator={state.operator} />
      </section>
    </main>
  )
}
