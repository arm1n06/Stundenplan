import { formatMonth, formatShort, parseIso, type IsoDate } from '../lib/dates.ts'
import { lessonAt, periodLabel, type Change, type Lesson, type TimetableDoc } from '../lib/schema.ts'
import { Badge } from './Badge.tsx'
import ui from './ui.module.css'
import styles from './ChangeList.module.css'

function detailText(change: Change, lesson: Lesson | null) {
  const parts: string[] = []
  if (change.k === 'v' && change.f && lesson && change.f !== lesson.f) parts.push(`statt ${lesson.f}`)
  if (change.l) parts.push(`bei ${change.l}`)
  if (change.r) parts.push(`Raum ${change.r}`)
  if (change.k === 'x') {
    const target = [change.nd && change.nd !== change.d && formatShort(change.nd), change.nt && `${change.nt} Uhr`]
      .filter(Boolean)
      .join(', ')
    if (target) parts.push(`→ ${target}`)
  } else if (change.nt) {
    parts.push(`ab ${change.nt} Uhr`)
  }
  if (change.i) parts.push(change.i)
  return parts.join(' · ')
}

function groupByMonth(changes: Change[]) {
  const groups = new Map<string, Change[]>()
  for (const change of changes) {
    const key = change.d.slice(0, 7)
    groups.set(key, [...(groups.get(key) ?? []), change])
  }
  return [...groups.entries()]
}

interface Props {
  doc: TimetableDoc
  today: IsoDate
  activeId?: string
  onEdit: (change: Change) => void
  onDelete: (change: Change) => void
}

export function ChangeList({ doc, today, activeId, onEdit, onDelete }: Props) {
  if (doc.c.length === 0) {
    return <p className={styles.empty}>Noch keine Änderungen eingetragen.</p>
  }

  return (
    <div className={styles.groups}>
      {groupByMonth(doc.c).map(([key, changes]) => {
        const { y, m } = parseIso(`${key}-01`)
        return (
          <section key={key}>
            <h3 className={styles.month}>{formatMonth(y, m)}</h3>
            <ul className={styles.list}>
              {changes.map((change) => {
                const lesson = change.k === 'z' ? null : lessonAt(doc, change.d, change.p)
                const subject = change.f || lesson?.f
                const detail = detailText(change, lesson)
                return (
                  <li
                    key={change.id}
                    className={`${styles.item} ${change.d < today ? styles.past : ''} ${
                      change.id === activeId ? styles.active : ''
                    }`}
                  >
                    <div className={styles.main}>
                      <div className={styles.line}>
                        <Badge kind={change.k} />
                        <span className={styles.date}>{formatShort(change.d)}</span>
                        <span className={styles.period}>{periodLabel(change.p, change.n)} Std.</span>
                        {subject && <span className={styles.subject}>{subject}</span>}
                      </div>
                      {detail && <p className={styles.detail}>{detail}</p>}
                    </div>
                    <div className={styles.actions}>
                      <button type="button" className={ui.ghost} onClick={() => onEdit(change)}>
                        Bearbeiten
                      </button>
                      <button type="button" className={ui.danger} onClick={() => onDelete(change)}>
                        Löschen
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
