import { useMemo, useState } from 'react'
import {
  formatDayMonth,
  formatMonth,
  formatWeekday,
  isoWeek,
  monthDays,
  toIso,
  weekdayOf,
  type IsoDate,
} from '../lib/dates.ts'
import type { TimetableDoc } from '../lib/schema.ts'
import { buildDay, type DayRow } from '../lib/schedule.ts'
import { LessonRow } from './LessonRow.tsx'
import ui from './ui.module.css'
import styles from './MonthSection.module.css'

interface Props {
  y: number
  m: number
  doc: TimetableDoc
  today: IsoDate
}

export function MonthSection({ y, m, doc, today }: Props) {
  const [showPast, setShowPast] = useState(false)

  const days = useMemo(
    () =>
      monthDays(y, m)
        .map((iso) => ({ iso, rows: buildDay(doc, iso) }))
        // Wochenenden nur anzeigen, wenn dort etwas stattfindet (z. B. eine Verlegung)
        .filter(({ iso, rows }) => weekdayOf(iso) <= 5 || rows.length > 0),
    [y, m, doc],
  )

  const prefix = toIso(y, m, 1).slice(0, 7)
  const changeCount = doc.c.filter((c) => c.d.startsWith(prefix)).length
  const past = days.filter((d) => d.iso < today)
  const visible = showPast ? days : days.filter((d) => d.iso >= today)

  return (
    <section className={styles.section} aria-label={formatMonth(y, m)}>
      <header className={styles.header}>
        <h2 className={styles.title}>{formatMonth(y, m)}</h2>
        <span className={styles.count}>
          {changeCount === 0 ? 'Keine Änderungen' : `${changeCount} ${changeCount === 1 ? 'Änderung' : 'Änderungen'}`}
        </span>
        {past.length > 0 && (
          <button type="button" className={ui.ghost} onClick={() => setShowPast((v) => !v)}>
            {showPast ? 'Vergangene Tage ausblenden' : `Vergangene Tage einblenden (${past.length})`}
          </button>
        )}
      </header>

      <div className={styles.grid}>
        {visible.map(({ iso, rows }, index) => (
          <DayCard
            key={iso}
            iso={iso}
            rows={rows}
            isToday={iso === today}
            isPast={iso < today}
            showWeek={index === 0 || weekdayOf(iso) === 1}
          />
        ))}
      </div>
    </section>
  )
}

interface DayCardProps {
  iso: IsoDate
  rows: DayRow[]
  isToday: boolean
  isPast: boolean
  showWeek: boolean
}

function DayCard({ iso, rows, isToday, isPast, showWeek }: DayCardProps) {
  const hasChanges = rows.some((r) => r.status)
  return (
    <article className={`${styles.day} ${isToday ? styles.today : ''} ${isPast ? styles.past : ''}`}>
      <header className={styles.dayHead}>
        <span className={styles.weekday}>{formatWeekday(iso)}</span>
        <span className={styles.date}>{formatDayMonth(iso)}</span>
        {showWeek && <span className={styles.week}>KW {isoWeek(iso)}</span>}
        {isToday && <span className={styles.todayTag}>Heute</span>}
        {hasChanges && !isToday && <span className={styles.changeDot} title="Enthält Änderungen" />}
      </header>
      {rows.length > 0 ? (
        <div className={styles.rows}>
          {rows.map((row) => (
            <LessonRow key={row.key} row={row} iso={iso} />
          ))}
        </div>
      ) : (
        <p className={styles.empty}>Kein Unterricht</p>
      )}
    </article>
  )
}
