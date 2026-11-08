import { minusOneMonth, type IsoDate } from './dates.ts'
import type { Change, TimetableDoc } from './schema.ts'

// Automatische Bereinigung: Änderungen, deren Datum mindestens einen Monat zurückliegt, werden entfernt.
// Beispiel: heute = 2026-11-08 → Stichtag = 2026-10-08 → alles mit Datum ≤ 2026-10-08 wird gelöscht.
// Alle Vergleiche erfolgen auf lokalen "YYYY-MM-DD"-Strings, daher keine Zeitzonenprobleme.

export const cleanupCutoff = (today: IsoDate) => minusOneMonth(today)

/** Spätestes relevantes Datum einer Änderung (bei Verlegungen zählt auch das Zieldatum). */
export const lastRelevantDate = (change: Change) => (change.nd && change.nd > change.d ? change.nd : change.d)

export const isExpired = (change: Change, today: IsoDate) => lastRelevantDate(change) <= cleanupCutoff(today)

export function pruneDoc(doc: TimetableDoc, today: IsoDate) {
  const kept = doc.c.filter((change) => !isExpired(change, today))
  const removed = doc.c.length - kept.length
  return { doc: removed ? { ...doc, c: kept } : doc, removed }
}
