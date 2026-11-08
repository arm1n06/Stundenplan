import { isIsoDate, isoWeek, isTime, weekdayOf, type IsoDate } from './dates.ts'

/*
 * Datenstruktur (wird als JSON serialisiert, Base64-kodiert und in timetable.data gespeichert).
 * Kurze Schlüssel halten den gespeicherten Datensatz kompakt.
 */

/** Unterrichtsstunde im Raster; Index + 1 = Stundennummer */
export interface Period {
  s: string // Beginn "08:00"
  e: string // Ende "08:45"
}

/** Regulärer Unterrichtsblock */
export interface Lesson {
  p: number // erste Stunde
  n: number // Anzahl Stunden (2 = Doppelstunde)
  f: string // Fach, z. B. "1.1.2 Sozi"
  l?: string // Lehrkraft
  r?: string // Raum
  a?: number // gültig ab KW
  b?: number // gültig bis KW (Bereiche wie 37–3 laufen über den Jahreswechsel)
}

export type ChangeKind = 'v' | 'a' | 'x' | 'z' | 's'

/** Abweichung vom regulären Plan; betrifft die Stunden p … p+n-1 */
export interface Change {
  id: string
  d: IsoDate // Datum
  p: number // erste betroffene Stunde
  k: ChangeKind // Vertretung | Ausfall | Verlegung | Zusatzstunde | Sonstiges
  n?: number // Anzahl Stunden (fehlt = 1)
  f?: string // Fach (bei Vertretung: Fach in der Vertretungsstunde)
  l?: string // Lehrkraft
  r?: string // Raum (falls abweichend)
  nd?: IsoDate // neues Datum (Verlegung)
  nt?: string // neue Uhrzeit (Beginn)
  i?: string // Beschreibung / Hinweis
}

export interface TimetableDoc {
  v: number // Schema-Version
  p: Period[] // Stundenraster
  w: Lesson[][] // Regulärer Plan: 5 Listen (Mo–Fr)
  c: Change[] // Änderungen, sortiert nach Datum und Stunde
}

export const SCHEMA_VERSION = 2

export const WEEKDAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'] as const

export type Tone = 'sub' | 'off' | 'mov' | 'add' | 'note'

export const CHANGE_TYPES: Record<ChangeKind, { label: string; tone: Tone }> = {
  v: { label: 'Vertretung', tone: 'sub' },
  a: { label: 'Ausfall', tone: 'off' },
  x: { label: 'Verlegung', tone: 'mov' },
  z: { label: 'Zusatzstunde', tone: 'add' },
  s: { label: 'Sonstiges', tone: 'note' },
}
export const CHANGE_KINDS = Object.keys(CHANGE_TYPES) as ChangeKind[]

const isChangeKind = (value: unknown): value is ChangeKind =>
  typeof value === 'string' && value in CHANGE_TYPES

export function emptyDoc(): TimetableDoc {
  return { v: SCHEMA_VERSION, p: [], w: WEEKDAY_NAMES.map(() => []), c: [] }
}

type Raw = Record<string, unknown>
const isObject = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value)
const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const isWeekNo = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 53
const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 12
const isPeriodNo = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 1

export function normalizeLesson(raw: unknown): Lesson | null {
  if (!isObject(raw)) return null
  const f = str(raw.f)
  if (!f || !isPeriodNo(raw.p)) return null
  const lesson: Lesson = { p: raw.p, n: isCount(raw.n) ? raw.n : 1, f }
  const l = str(raw.l)
  const r = str(raw.r)
  if (l) lesson.l = l
  if (r) lesson.r = r
  if (isWeekNo(raw.a)) lesson.a = raw.a
  if (isWeekNo(raw.b)) lesson.b = raw.b
  return lesson
}

export function normalizeChange(raw: unknown): Change | null {
  if (!isObject(raw)) return null
  if (!isIsoDate(raw.d) || !isPeriodNo(raw.p) || !isChangeKind(raw.k)) return null
  const change: Change = { id: str(raw.id) || newId(), d: raw.d, p: raw.p, k: raw.k }
  if (isCount(raw.n) && raw.n > 1) change.n = raw.n
  for (const key of ['f', 'l', 'r', 'i'] as const) {
    const value = str(raw[key])
    if (value) change[key] = value
  }
  if (isIsoDate(raw.nd)) change.nd = raw.nd
  if (isTime(raw.nt)) change.nt = raw.nt
  return change
}

export function sortChanges(changes: Change[]): Change[] {
  return [...changes].sort((a, b) => (a.d === b.d ? a.p - b.p : a.d < b.d ? -1 : 1))
}

export const sortLessons = (lessons: Lesson[]) => [...lessons].sort((a, b) => a.p - b.p || (a.a ?? 0) - (b.a ?? 0))

/** Bringt beliebige (auch ältere oder unvollständige) Daten in eine gültige Form. */
export function normalizeDoc(raw: unknown): TimetableDoc {
  if (!isObject(raw)) throw new Error('Ungültiges Datenformat')
  if (typeof raw.v === 'number' && raw.v > SCHEMA_VERSION) {
    throw new Error('Die Daten stammen aus einer neueren App-Version')
  }
  const periods: Period[] = Array.isArray(raw.p)
    ? raw.p.map((x: unknown) => {
        const o = isObject(x) ? x : {}
        return { s: isTime(o.s) ? o.s : '', e: isTime(o.e) ? o.e : '' }
      })
    : []
  const rawWeek = Array.isArray(raw.w) ? raw.w : []
  const week = WEEKDAY_NAMES.map((_, i) => {
    const day: unknown[] = Array.isArray(rawWeek[i]) ? rawWeek[i] : []
    // Version 1 speicherte pro Stunde nur einen Fachnamen (String)
    const lessons = day.map((x, index) => (typeof x === 'string' ? { p: index + 1, n: 1, f: x } : x))
    return sortLessons(lessons.map(normalizeLesson).filter((l): l is Lesson => l !== null))
  })
  const changes = Array.isArray(raw.c) ? raw.c.map(normalizeChange).filter((c): c is Change => c !== null) : []
  return { v: SCHEMA_VERSION, p: periods, w: week, c: sortChanges(changes) }
}

export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 10)
}

export const lastPeriod = (item: { p: number; n?: number }) => item.p + (item.n ?? 1) - 1

/** Überschneiden sich zwei Stundenbereiche? */
export const overlaps = (a: { p: number; n?: number }, b: { p: number; n?: number }) =>
  a.p <= lastPeriod(b) && b.p <= lastPeriod(a)

/** Gilt die Stunde in Kalenderwoche `week`? Bereiche wie 37–3 laufen über den Jahreswechsel. */
export function lessonActiveInWeek(lesson: Lesson, week: number): boolean {
  const from = lesson.a ?? 1
  const to = lesson.b ?? 53
  return from <= to ? week >= from && week <= to : week >= from || week <= to
}

/** Alle am Datum gültigen regulären Blöcke, sortiert. */
export function lessonsOn(doc: TimetableDoc, iso: IsoDate): Lesson[] {
  const weekday = weekdayOf(iso)
  if (weekday > 5) return []
  const week = isoWeek(iso)
  return (doc.w[weekday - 1] ?? []).filter((lesson) => lessonActiveInWeek(lesson, week))
}

/** Regulärer Block, der am Datum die Stunde `period` enthält (oder null). */
export function lessonAt(doc: TimetableDoc, iso: IsoDate, period: number): Lesson | null {
  return lessonsOn(doc, iso).find((l) => period >= l.p && period <= lastPeriod(l)) ?? null
}

/** "3." bzw. "3.–4." */
export const periodLabel = (p: number, n = 1) => (n > 1 ? `${p}.–${p + n - 1}.` : `${p}.`)

/** Beginn/Ende eines Stundenbereichs laut Raster. */
export function blockTimes(doc: TimetableDoc, p: number, n = 1) {
  return { start: doc.p[p - 1]?.s ?? '', end: doc.p[p + n - 2]?.e ?? '' }
}
