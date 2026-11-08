import type { TimetableDoc } from '../lib/schema.ts'

/** Vorschlagsliste aller Fächer aus dem regulären Plan (für schnelle Eingabe). */
export function SubjectList({ doc }: { doc: TimetableDoc }) {
  const subjects = [...new Set(doc.w.flat().map((l) => l.f))].sort((a, b) => a.localeCompare(b, 'de'))
  return (
    <datalist id="subject-list">
      {subjects.map((s) => (
        <option key={s} value={s} />
      ))}
    </datalist>
  )
}
