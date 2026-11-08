// Alle Datumswerte werden als lokale Kalenderdaten im Format "YYYY-MM-DD" behandelt.
// Dadurch gibt es keine Zeitzonen-Verschiebungen (kein UTC-Parsing via new Date("YYYY-MM-DD")),
// und Vergleiche funktionieren direkt per String-Vergleich.

/** Kalenderdatum im Format "YYYY-MM-DD" */
export type IsoDate = string

const pad = (n: number) => String(n).padStart(2, '0')

export const toIso = (y: number, m: number, d: number): IsoDate => `${y}-${pad(m)}-${pad(d)}`

export const dateToIso = (date: Date): IsoDate => toIso(date.getFullYear(), date.getMonth() + 1, date.getDate())

export const todayIso = (): IsoDate => dateToIso(new Date())

export function parseIso(iso: IsoDate) {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number)
  return { y, m, d }
}

/** m ist 1-basiert. new Date(y, m, 0) liefert den letzten Tag des Monats m. */
export const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate()

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const { y, m, d } = parseIso(value)
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m)
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
export const isTime = (value: unknown): value is string => typeof value === 'string' && TIME_RE.test(value)

export function addMonths(y: number, m: number, delta: number) {
  const index = y * 12 + (m - 1) + delta
  return { y: Math.floor(index / 12), m: (index % 12) + 1 }
}

/** Gleicher Kalendertag einen Monat früher; bei kürzeren Monaten auf den Monatsletzten begrenzt (31.03. → 28./29.02.). */
export function minusOneMonth(iso: IsoDate): IsoDate {
  const { y, m, d } = parseIso(iso)
  const prev = addMonths(y, m, -1)
  return toIso(prev.y, prev.m, Math.min(d, daysInMonth(prev.y, prev.m)))
}

/** Lokales Date-Objekt (12:00 Uhr, damit Sommerzeitwechsel keine Rolle spielen). */
export function isoToDate(iso: IsoDate): Date {
  const { y, m, d } = parseIso(iso)
  return new Date(y, m - 1, d, 12)
}

/** 1 = Montag … 7 = Sonntag */
export function weekdayOf(iso: IsoDate): number {
  const day = isoToDate(iso).getDay()
  return day === 0 ? 7 : day
}

/** ISO-8601-Kalenderwoche (KW 1 = Woche mit dem ersten Donnerstag des Jahres). */
export function isoWeek(iso: IsoDate): number {
  const date = isoToDate(iso)
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7)) // Donnerstag derselben Woche
  const jan4 = new Date(date.getFullYear(), 0, 4, 12)
  return 1 + Math.round(((date.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7)
}

export function monthDays(y: number, m: number): IsoDate[] {
  return Array.from({ length: daysInMonth(y, m) }, (_, i) => toIso(y, m, i + 1))
}

export function timeToMinutes(time: string): number {
  const [h = 0, m = 0] = time.split(':').map(Number)
  return h * 60 + m
}

export function addMinutes(time: string, minutes: number): string {
  const total = Math.min(23 * 60 + 59, timeToMinutes(time) + minutes)
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

const fmtLong = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const fmtShort = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
const fmtWeekday = new Intl.DateTimeFormat('de-DE', { weekday: 'short' })
const fmtMonth = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' })

export const formatLong = (iso: IsoDate) => fmtLong.format(isoToDate(iso))
/** "Mo., 09.11." */
export const formatShort = (iso: IsoDate) => fmtShort.format(isoToDate(iso))
export const formatWeekday = (iso: IsoDate) => fmtWeekday.format(isoToDate(iso)).replace('.', '')
export function formatDayMonth(iso: IsoDate) {
  const { m, d } = parseIso(iso)
  return `${pad(d)}.${pad(m)}.`
}
export const formatMonth = (y: number, m: number) => fmtMonth.format(new Date(y, m - 1, 1, 12))
