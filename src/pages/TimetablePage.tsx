import { useTimetable } from '../hooks/useTimetable.ts'
import { ErrorState, LoadingState, PageHeader, SyncWarning } from '../components/common.tsx'
import { TimetableEditor } from '../components/TimetableEditor.tsx'

export function TimetablePage() {
  const { data: doc, isPending, error, refetch } = useTimetable()

  const header = (
    <PageHeader
      title="Regulärer Stundenplan"
      subtitle="Unterrichtszeiten und Blöcke pro Wochentag, jeweils mit Gültigkeit nach Kalenderwoche."
    />
  )

  if (isPending) return <>{header}<LoadingState /></>
  if (!doc) return <>{header}<ErrorState error={error} onRetry={() => void refetch()} /></>

  return (
    <>
      {header}
      <SyncWarning error={error} />
      <TimetableEditor doc={doc} />
    </>
  )
}
