import { Link } from '@tanstack/react-router'
import { useTimetable } from '../hooks/useTimetable.ts'
import { useToday } from '../hooks/useToday.ts'
import { addMonths, formatLong, isoWeek, parseIso } from '../lib/dates.ts'
import { Legend } from '../components/Badge.tsx'
import { ErrorState, LoadingState, PageHeader, SyncWarning } from '../components/common.tsx'
import { MonthSection } from '../components/MonthSection.tsx'
import ui from '../components/ui.module.css'
import styles from './pages.module.css'

export function OverviewPage() {
  const today = useToday()
  const { data: doc, isPending, error, refetch } = useTimetable()
  const { y, m } = parseIso(today)
  const next = addMonths(y, m, 1)

  const header = (
    <PageHeader
      title="Übersicht"
      subtitle={`${formatLong(today)} · KW ${isoWeek(today)}`}
      actions={
        <Link to="/aenderungen" className={ui.primary}>
          Änderung eintragen
        </Link>
      }
    />
  )

  if (isPending) return <>{header}<LoadingState /></>
  if (!doc) return <>{header}<ErrorState error={error} onRetry={() => void refetch()} /></>

  const hasPlan = doc.w.some((day) => day.length > 0)

  return (
    <>
      {header}
      <SyncWarning error={error} />
      {!hasPlan && (
        <p className={`${ui.notice} ${styles.spaced}`}>
          Es ist noch kein regulärer Stundenplan hinterlegt. <Link to="/plan">Jetzt einrichten</Link>
        </p>
      )}
      <div className={styles.spaced}>
        <Legend />
      </div>
      <MonthSection y={y} m={m} doc={doc} today={today} />
      <MonthSection y={next.y} m={next.m} doc={doc} today={today} />
    </>
  )
}
