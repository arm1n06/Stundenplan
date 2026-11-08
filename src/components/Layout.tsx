import { useEffect, useRef } from 'react'
import { Link, Outlet } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useToday } from '../hooks/useToday.ts'
import { DOC_KEY } from '../hooks/useTimetable.ts'
import styles from './Layout.module.css'

const NAV = [
  { to: '/', label: 'Übersicht', exact: true },
  { to: '/aenderungen', label: 'Änderungen', exact: false },
  { to: '/plan', label: 'Regulärer Plan', exact: false },
] as const

export function Layout() {
  useRefetchOnNewDay()
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.inner}>
          <Link to="/" className={styles.brand}>
            <span className={styles.logo} aria-hidden="true" />
            Stundenplan
          </Link>
          <nav className={styles.nav} aria-label="Hauptnavigation">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={styles.link}
                activeOptions={{ exact: item.exact, includeSearch: false }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

/** Beim Datumswechsel neu laden, damit Ansicht und Bereinigung zum neuen Tag passen. */
function useRefetchOnNewDay() {
  const today = useToday()
  const queryClient = useQueryClient()
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    void queryClient.invalidateQueries({ queryKey: DOC_KEY })
  }, [today, queryClient])
}

export function NotFound() {
  return (
    <div className={styles.notFound}>
      <p>Diese Seite gibt es nicht.</p>
      <Link to="/">Zur Übersicht</Link>
    </div>
  )
}
