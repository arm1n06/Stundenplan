import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { decode, encode } from '../src/lib/codec.ts'
import { cleanupCutoff, pruneDoc } from '../src/lib/cleanup.ts'
import { isIsoDate, isoWeek, minusOneMonth, weekdayOf } from '../src/lib/dates.ts'
import { emptyDoc, lessonActiveInWeek, lessonsOn, normalizeDoc, type Change } from '../src/lib/schema.ts'
import { buildDay } from '../src/lib/schedule.ts'

const plan = normalizeDoc(JSON.parse(readFileSync(new URL('../supabase/plan-p-mh-2-26-03.json', import.meta.url), 'utf8')))
const withChanges = (c: Change[]) => normalizeDoc({ ...plan, c })

test('Base64-Codec ist verlustfrei, auch mit Umlauten', () => {
  const doc = { v: 2, p: [{ s: '08:00', e: '08:45' }], w: [[{ p: 1, n: 1, f: '1.2 ÖDR – Seltmann ß €' }]], c: [] }
  const encoded = encode(doc)
  assert.match(encoded, /^[A-Za-z0-9+/=]+$/)
  assert.deepEqual(decode(encoded), doc)
})

test('decode wirft bei kaputten Daten', () => {
  assert.throws(() => decode('%%%'))
  assert.throws(() => decode(''))
})

test('Stichtag: gleicher Tag im Vormonat, Monatsende wird begrenzt', () => {
  assert.equal(cleanupCutoff('2026-11-08'), '2026-10-08')
  assert.equal(minusOneMonth('2026-03-31'), '2026-02-28')
  assert.equal(minusOneMonth('2028-03-31'), '2028-02-29')
  assert.equal(minusOneMonth('2027-01-15'), '2026-12-15')
})

test('Bereinigung: ≤ Stichtag weg, alles danach bleibt (auch weit in der Zukunft)', () => {
  const mk = (d: string, extra: Partial<Change> = {}): Change => ({ id: d, d, p: 1, k: 'a', ...extra })
  const doc = {
    ...emptyDoc(),
    c: [
      mk('2026-09-30'),
      mk('2026-10-08'),
      mk('2026-10-09'),
      mk('2026-11-08'),
      mk('2027-06-01'),
      mk('2026-10-01', { k: 'x', nd: '2026-11-20' }), // Verlegung in die Zukunft bleibt
    ],
  }
  const { doc: pruned, removed } = pruneDoc(doc, '2026-11-08')
  assert.equal(removed, 2)
  assert.deepEqual(pruned.c.map((c) => c.id), ['2026-10-09', '2026-11-08', '2027-06-01', '2026-10-01'])
})

test('Bereinigung ändert nichts, wenn nichts abgelaufen ist', () => {
  const doc = { ...emptyDoc(), c: [{ id: 'a', d: '2026-12-01', p: 2, k: 'v' as const }] }
  const result = pruneDoc(doc, '2026-11-08')
  assert.equal(result.removed, 0)
  assert.equal(result.doc, doc)
})

test('Datumshilfen und ISO-Kalenderwochen', () => {
  assert.equal(weekdayOf('2026-11-08'), 7) // Sonntag
  assert.equal(weekdayOf('2026-11-09'), 1) // Montag
  assert.equal(isIsoDate('2026-02-29'), false)
  assert.equal(isIsoDate('2028-02-29'), true)
  assert.equal(isoWeek('2026-11-08'), 45)
  assert.equal(isoWeek('2026-11-09'), 46)
  assert.equal(isoWeek('2026-09-07'), 37)
  assert.equal(isoWeek('2027-01-01'), 53) // 2026 hat 53 Kalenderwochen
  assert.equal(isoWeek('2027-01-04'), 1)
  assert.equal(isoWeek('2027-01-18'), 3)
})

test('KW-Bereiche, auch über den Jahreswechsel', () => {
  const lesson = { p: 1, n: 2, f: 'X', a: 37, b: 3 }
  assert.equal(lessonActiveInWeek(lesson, 37), true)
  assert.equal(lessonActiveInWeek(lesson, 53), true)
  assert.equal(lessonActiveInWeek(lesson, 3), true)
  assert.equal(lessonActiveInWeek(lesson, 4), false)
  assert.equal(lessonActiveInWeek(lesson, 36), false)
  assert.equal(lessonActiveInWeek({ p: 1, n: 1, f: 'Y' }, 20), true)
})

test('Version-1-Daten werden übernommen', () => {
  const doc = normalizeDoc({ v: 1, p: [{ s: '08:00', e: '08:45' }], w: [['Mathe', '', 'Deutsch']], c: [] })
  assert.deepEqual(doc.w[0], [
    { p: 1, n: 1, f: 'Mathe' },
    { p: 3, n: 1, f: 'Deutsch' },
  ])
  assert.throws(() => normalizeDoc({ v: 99 }))
})

test('Plan P MH 2/26-03: richtige Blöcke je Kalenderwoche', () => {
  const fach = (iso: string) => lessonsOn(plan, iso).map((l) => l.f)
  // KW 46: Sozi läuft noch, IT/Psych noch nicht
  assert.deepEqual(fach('2026-11-09'), ['1.1.2 Sozi', '1.6 ET', '1.6 ET'])
  assert.deepEqual(fach('2026-11-13'), ['1.2 StVR', '1.2 ÖDR'])
  // KW 47: Sozi vorbei, IT/Psych beginnen
  assert.deepEqual(fach('2026-11-16'), ['1.6 ET', '1.6 ET'])
  assert.deepEqual(fach('2026-11-20'), ['1.1 IT', '1.1.4 Psych', '1.2 StVR', '1.2 ÖDR'])
  // KW 52: EL (bis KW 51) entfällt
  assert.equal(fach('2026-12-22').includes('1.1.4 EL'), false)
  // KW 4: alles außer ÖDR-freien Bereichen vorbei
  assert.deepEqual(fach('2027-01-25'), [])
})

test('Einzelstunde in einer Doppelstunde teilt den Block', () => {
  const doc = withChanges([{ id: 'a1', d: '2026-11-09', p: 4, k: 'a' }]) // nur 4. Std. von Sozi 3–4
  const rows = buildDay(doc, '2026-11-09').filter((r) => r.subject === '1.1.2 Sozi')
  assert.deepEqual(
    rows.map((r) => [r.p, r.n, r.status, r.start, r.end]),
    [
      [3, 1, null, '09:45', '10:30'],
      [4, 1, 'a', '10:30', '11:15'],
    ],
  )
})

test('Ganzer Block: Ausfall, Vertretung, Verlegung (Quelle + Ziel) und Zusatzstunde', () => {
  const doc = withChanges([
    { id: 'a1', d: '2026-11-10', p: 1, n: 2, k: 'a' },
    { id: 'v1', d: '2026-11-10', p: 3, n: 2, k: 'v', f: '1.1.4 EL', l: 'Kasper' },
    { id: 'x1', d: '2026-11-10', p: 5, n: 2, k: 'x', nd: '2026-11-12', nt: '14:00' },
    { id: 'z1', d: '2026-11-10', p: 12, k: 'z', f: 'Sprechstunde' },
  ])
  const tuesday = buildDay(doc, '2026-11-10')
  assert.deepEqual(
    tuesday.map((r) => [r.p, r.n, r.status]),
    [
      [1, 2, 'a'],
      [3, 2, 'v'],
      [5, 2, 'x'],
      [7, 1, null],
      [8, 2, null],
      [10, 2, null],
      [12, 1, 'z'],
    ],
  )
  const moved = buildDay(doc, '2026-11-12').find((r) => r.status === 'in')
  assert.ok(moved)
  assert.equal(moved.subject, '1.1.4 EL')
  assert.equal(moved.start, '14:00')
  assert.equal(moved.end, '15:30') // gleiche Dauer wie der Originalblock (11:30–13:00)
})
