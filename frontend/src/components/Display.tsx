import type { CSSProperties } from 'react'
import styles from './Display.module.css'

interface DisplayProps {
  expression: string
  value: string
  error: string | null
  busy: boolean
}

export function Display({ expression, value, error, busy }: DisplayProps) {
  return (
    <div className={styles.display}>
      <div className={styles.status}>
        <span className={styles.expression}>{expression}</span>
        <span className={styles.flags} aria-hidden="true">
          <span className={styles.flag} data-on={busy}>
            BUSY
          </span>
          <span className={styles.flag} data-on={error !== null}>
            ERR
          </span>
        </span>
      </div>
      <output className={styles.value} style={{ '--chars': value.length } as CSSProperties}>
        {value}
      </output>
      <p className={styles.error} role="alert">
        {error}
      </p>
    </div>
  )
}
