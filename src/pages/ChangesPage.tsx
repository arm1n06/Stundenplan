import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import {
  addChangeUpdater,
  deleteChangeUpdater,
  updateChangeUpdater,
  useDocMutation,
  useTimetable,
} from '../hooks/useTimetable.ts'
import { useToday } from '../hooks/useToday.ts'
import { formatShort, type IsoDate } from '../lib/dates.ts'
import { periodLabel, type Change } from '../lib/schema.ts'
import { ChangeForm, type ChangeFormInitial } from '../components/ChangeForm.tsx'
import { ChangeList } from '../components/ChangeList.tsx'
import { ErrorState, LoadingState, PageHeader, SyncWarning } from '../components/common.tsx'
import { SubjectList } from '../components/SubjectList.tsx'
import ui from '../components/ui.module.css'
import styles from './pages.module.css'

const route = getRouteApi('/aenderungen')

export function ChangesPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const today = useToday()
  const { data: doc, isPending, error, refetch } = useTimetable()
  const save = useDocMutation('Änderung gespeichert.')
  const remove = useDocMutation('Änderung gelöscht.')
  const [formKey, setFormKey] = useState(0)
  const [lastDate, setLastDate] = useState<IsoDate | null>(null)

  const header = (
    <PageHeader
      title="Änderungen"
      subtitle="Vertretungen, Ausfälle, Verlegungen und Zusatzstunden – für beliebige Tage in der Zukunft."
    />
  )

  if (isPending) return <>{header}<LoadingState /></>
  if (!doc) return <>{header}<ErrorState error={error} onRetry={() => void refetch()} /></>

  const editing = search.edit ? doc.c.find((c) => c.id === search.edit) : undefined
  const missingEdit = Boolean(search.edit && !editing)
  const initial: ChangeFormInitial = editing ?? { d: search.date ?? lastDate ?? today, p: search.p, n: search.n }

  const resetForm = () => {
    setFormKey((k) => k + 1)
    if (search.edit || search.date || search.p) void navigate({ search: {} })
  }

  const handleSubmit = (change: Change) => {
    save.mutate(editing ? updateChangeUpdater(change) : addChangeUpdater(change), {
      onSuccess: () => {
        setLastDate(change.d)
        resetForm()
      },
    })
  }

  const handleDelete = (change: Change) => {
    const label = `${formatShort(change.d)}, ${periodLabel(change.p, change.n)} Std.`
    if (!window.confirm(`Änderung am ${label} wirklich löschen?`)) return
    remove.mutate(deleteChangeUpdater(change.id), {
      onSuccess: () => {
        if (search.edit === change.id) resetForm()
      },
    })
  }

  return (
    <>
      {header}
      <SyncWarning error={error} />
      <div className={styles.split}>
        <section className={`${ui.card} ${styles.formCard}`}>
          <h2 className={styles.sectionTitle}>{editing ? 'Änderung bearbeiten' : 'Neue Änderung'}</h2>
          {missingEdit && <p className={`${ui.notice} ${styles.spaced}`}>Dieser Eintrag existiert nicht mehr.</p>}
          <ChangeForm
            key={`${editing?.id ?? 'new'}-${search.date ?? ''}-${search.p ?? ''}-${formKey}`}
            doc={doc}
            initial={initial}
            today={today}
            isEdit={Boolean(editing)}
            pending={save.isPending}
            onSubmit={handleSubmit}
            onCancel={editing || search.date ? resetForm : undefined}
          />
          <SubjectList doc={doc} />
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Eingetragen</h2>
          <ChangeList
            doc={doc}
            today={today}
            activeId={editing?.id}
            onEdit={(change) => void navigate({ search: { edit: change.id } })}
            onDelete={handleDelete}
          />
        </section>
      </div>
    </>
  )
}
