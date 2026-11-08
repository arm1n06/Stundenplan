import type { ReactNode } from 'react'
import { CHANGE_KINDS, CHANGE_TYPES, type ChangeKind } from '../lib/schema.ts'
import styles from './Badge.module.css'

export function Badge({ kind, children }: { kind: ChangeKind; children?: ReactNode }) {
  const type = CHANGE_TYPES[kind]
  return <span className={`${styles.badge} ${styles[type.tone]}`}>{children ?? type.label}</span>
}

export function Legend() {
  return (
    <ul className={styles.legend} aria-label="Legende">
      {CHANGE_KINDS.map((kind) => (
        <li key={kind} className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles[CHANGE_TYPES[kind].tone]}`} aria-hidden="true" />
          {CHANGE_TYPES[kind].label}
        </li>
      ))}
    </ul>
  )
}
