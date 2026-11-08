import type { ReactNode } from 'react'
import ui from './ui.module.css'

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className={ui.pageHeader}>
      <div>
        <h1 className={ui.pageTitle}>{title}</h1>
        {subtitle && <p className={ui.pageSubtitle}>{subtitle}</p>}
      </div>
      {actions}
    </header>
  )
}

export function LoadingState({ label = 'Stundenplan wird geladen …' }: { label?: string }) {
  return (
    <div className={ui.state} aria-busy="true">
      {label}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: Error | null; onRetry?: () => void }) {
  return (
    <div className={ui.state} role="alert">
      <p className={ui.stateTitle}>Daten konnten nicht geladen werden</p>
      <p>{error?.message ?? 'Unbekannter Fehler.'}</p>
      {onRetry && (
        <div className={ui.stateActions}>
          <button type="button" className={ui.secondary} onClick={onRetry}>
            Erneut versuchen
          </button>
        </div>
      )}
    </div>
  )
}

/** Hinweis, wenn Daten aus dem Cache angezeigt werden, die Synchronisierung aber fehlschlägt. */
export function SyncWarning({ error }: { error: Error | null }) {
  if (!error) return null
  return (
    <p className={ui.notice} role="alert" style={{ marginBottom: 20 }}>
      Synchronisierung fehlgeschlagen – angezeigt wird der zuletzt geladene Stand. {error.message}
    </p>
  )
}
