import { Link } from '@tanstack/react-router'
import { formatShort, type IsoDate } from '../lib/dates.ts'
import { CHANGE_TYPES, periodLabel, type ChangeKind } from '../lib/schema.ts'
import type { DayRow } from '../lib/schedule.ts'
import { Badge } from './Badge.tsx'
import styles from './LessonRow.module.css'

/** Übersetzt eine Zeile aus buildDay() in Anzeigetext. */
function describe(row: DayRow) {
  const primary = row.status === 'in' ? row.incoming : row.changes.find((c) => c.k === row.status)
  const lesson = row.lesson
  let title = row.subject || primary?.f || 'Unterricht'
  let struck = false
  let time = row.start && row.end ? `${row.start}–${row.end}` : row.start
  const details: string[] = []
  let showPeople = true

  switch (row.status) {
    case 'a':
      struck = true
      showPeople = false
      break
    case 'x': {
      struck = true
      showPeople = false
      const target = [primary?.nd && primary.nd !== primary.d && formatShort(primary.nd), primary?.nt && `${primary.nt} Uhr`]
        .filter(Boolean)
        .join(', ')
      details.push(`verlegt auf ${target || 'neuen Termin'}`)
      break
    }
    case 'v':
      if (primary?.f) {
        title = primary.f
        if (row.subject && primary.f !== row.subject) details.push(`statt ${row.subject}`)
      }
      break
    case 'z':
      title = primary?.f || 'Zusatzstunde'
      break
    case 'in':
      if (!time) time = 'Uhrzeit offen'
      if (primary) details.push(`verlegt von ${formatShort(primary.d)}, ${periodLabel(primary.p, row.n)} Std.`)
      break
    default:
  }

  if (row.status !== 'in' && row.status !== 'a' && row.status !== 'x') {
    const shifted = row.changes.find((c) => c.nt)
    if (shifted) {
      if (row.start) details.push(`statt ${row.start}`)
      time = `ab ${shifted.nt}`
    }
  }

  if (showPeople) {
    const teacherChange = row.changes.find((c) => c.l && c.k !== 'x')
    const roomChange = row.changes.find((c) => c.r)
    const teacher = teacherChange?.l ?? lesson?.l
    if (teacher) details.push(teacherChange && lesson?.l && teacher !== lesson.l ? `bei ${teacher}` : teacher)
    if (roomChange) details.push(`Raum ${roomChange.r}`)
    else if (lesson?.r) details.push(lesson.r)
  }

  for (const change of row.changes) if (change.i) details.push(change.i)

  const kinds: ChangeKind[] = row.status === 'in' ? ['x'] : [...new Set(row.changes.map((c) => c.k))]
  return { title, struck, time, details, kinds, primary }
}

export function LessonRow({ row, iso }: { row: DayRow; iso: IsoDate }) {
  const view = describe(row)
  const tone = row.status ? CHANGE_TYPES[row.status === 'in' ? 'x' : row.status].tone : null
  const search = view.primary ? { edit: view.primary.id } : { date: iso, p: row.p ?? undefined, n: row.n }
  const meta = [view.time, ...view.details].filter(Boolean)
  const number = row.p == null ? '↳' : row.n > 1 ? `${row.p}–${row.p + row.n - 1}` : row.p

  return (
    <Link
      to="/aenderungen"
      search={search}
      className={`${styles.row} ${tone ? styles[tone] : ''}`}
      title={view.primary ? 'Änderung bearbeiten' : 'Änderung für diese Stunde eintragen'}
    >
      <span className={styles.period}>{number}</span>
      <span className={styles.body}>
        <span className={view.struck ? styles.struck : styles.subject}>{view.title}</span>
        {meta.length > 0 && <span className={styles.meta}>{meta.join(' · ')}</span>}
      </span>
      {view.kinds.length > 0 && (
        <span className={styles.badges}>
          {view.kinds.map((kind) => (
            <Badge key={kind} kind={kind} />
          ))}
        </span>
      )}
    </Link>
  )
}
