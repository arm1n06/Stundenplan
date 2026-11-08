import { addMinutes, timeToMinutes, type IsoDate } from './dates.ts'
import {
  blockTimes,
  lastPeriod,
  lessonAt,
  lessonsOn,
  overlaps,
  type Change,
  type ChangeKind,
  type Lesson,
  type TimetableDoc,
} from './schema.ts'

/** 'in' = hierher verlegter Unterricht */
export type RowStatus = ChangeKind | 'in' | null

export interface DayRow {
  key: string
  p: number | null // erste Stunde (null bei hierher verlegtem Unterricht)
  n: number // Anzahl Stunden
  start: string
  end: string
  lesson: Lesson | null // regulärer Block (falls vorhanden)
  subject: string
  changes: Change[]
  status: RowStatus
  incoming?: Change
}

// Wenn mehrere Änderungen dieselben Stunden betreffen, bestimmt diese Reihenfolge den Status.
const PRIORITY: ChangeKind[] = ['a', 'x', 'v', 'z', 's']

const primaryKind = (changes: Change[]): ChangeKind | null =>
  PRIORITY.find((kind) => changes.some((c) => c.k === kind)) ?? null

/**
 * Teilt einen Block an den Grenzen der Änderungen auf.
 * Beispiel: Doppelstunde 3–4 mit Ausfall nur in der 4. Stunde → Segmente [3] und [4].
 */
function segments(lesson: Lesson, changes: Change[]) {
  const first = lesson.p
  const last = lastPeriod(lesson)
  const cuts = new Set([first, last + 1])
  for (const c of changes) {
    cuts.add(Math.max(first, c.p))
    cuts.add(Math.min(last, lastPeriod(c)) + 1)
  }
  const bounds = [...cuts].sort((a, b) => a - b)
  return bounds.slice(0, -1).map((p, i) => {
    const n = (bounds[i + 1] ?? last + 1) - p
    return { p, n, changes: changes.filter((c) => overlaps(c, { p, n })) }
  })
}

/** Zeilen eines Tages: gültige reguläre Blöcke (nach Kalenderwoche) + Änderungen. */
export function buildDay(doc: TimetableDoc, iso: IsoDate): DayRow[] {
  const dayChanges = doc.c.filter((c) => c.d === iso)
  const used = new Set<string>()
  const rows: DayRow[] = []

  for (const lesson of lessonsOn(doc, iso)) {
    const changes = dayChanges.filter((c) => c.k !== 'z' && overlaps(c, lesson))
    changes.forEach((c) => used.add(c.id))
    for (const seg of segments(lesson, changes)) {
      rows.push({
        key: `l${seg.p}-${lesson.a ?? ''}`,
        p: seg.p,
        n: seg.n,
        ...blockTimes(doc, seg.p, seg.n),
        lesson,
        subject: lesson.f,
        changes: seg.changes,
        status: primaryKind(seg.changes),
      })
    }
  }

  // Änderungen ohne regulären Unterricht (Zusatzstunden, Einträge in Freistunden)
  for (const change of dayChanges) {
    if (used.has(change.id)) continue
    const n = change.n ?? 1
    rows.push({
      key: `c-${change.id}`,
      p: change.p,
      n,
      ...blockTimes(doc, change.p, n),
      lesson: null,
      subject: change.f ?? '',
      changes: [change],
      status: change.k,
    })
  }

  // Hierher verlegter Unterricht
  for (const change of doc.c) {
    if (change.k !== 'x' || (change.nd ?? change.d) !== iso) continue
    const lesson = lessonAt(doc, change.d, change.p)
    const n = change.n ?? 1
    const original = blockTimes(doc, change.p, n)
    let { start, end } = original
    if (change.nt) {
      const duration = original.start && original.end ? timeToMinutes(original.end) - timeToMinutes(original.start) : 0
      start = change.nt
      end = duration > 0 ? addMinutes(change.nt, duration) : ''
    }
    rows.push({
      key: `in-${change.id}`,
      p: null,
      n,
      start,
      end,
      lesson,
      subject: change.f || lesson?.f || '',
      changes: [change],
      status: 'in',
      incoming: change,
    })
  }

  return rows.sort((a, b) => {
    const ta = rowTime(a)
    const tb = rowTime(b)
    if (ta !== tb) return ta < tb ? -1 : 1
    return (a.p ?? 99) - (b.p ?? 99)
  })
}

// Zeilen ohne Uhrzeit landen am Ende des Tages.
const rowTime = (row: DayRow) =>
  (row.status !== 'in' && row.changes.find((c) => c.k !== 'x' && c.nt)?.nt) || row.start || '99:99'
