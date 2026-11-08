import { useRef, useState } from 'react'
import { addMinutes, isTime } from '../lib/dates.ts'
import {
  lessonActiveInWeek,
  normalizeLesson,
  sortLessons,
  WEEKDAY_NAMES,
  type Lesson,
  type Period,
  type TimetableDoc,
} from '../lib/schema.ts'
import { timetableUpdater, useDocMutation } from '../hooks/useTimetable.ts'
import ui from './ui.module.css'
import styles from './TimetableEditor.module.css'

/** Eingabezeile (alle Werte als Strings für die Formularfelder) */
interface Row {
  key: number
  p: string
  e: string
  f: string
  l: string
  r: string
  a: string
  b: string
}

interface State {
  periods: Period[]
  week: Row[][]
}

function toState(doc: TimetableDoc, nextKey: () => number): State {
  return {
    periods: doc.p.map((p) => ({ ...p })),
    week: doc.w.map((day) =>
      day.map((l) => ({
        key: nextKey(),
        p: String(l.p),
        e: String(l.p + l.n - 1),
        f: l.f,
        l: l.l ?? '',
        r: l.r ?? '',
        a: l.a ? String(l.a) : '',
        b: l.b ? String(l.b) : '',
      })),
    ),
  }
}

function toLesson(row: Row): Lesson | null {
  const p = Number(row.p)
  return normalizeLesson({
    p,
    n: Number(row.e) - p + 1,
    f: row.f,
    l: row.l,
    r: row.r,
    a: row.a ? Number(row.a) : undefined,
    b: row.b ? Number(row.b) : undefined,
  })
}

const serialize = (state: State) =>
  JSON.stringify({ p: state.periods, w: state.week.map((day) => day.map(({ key: _key, ...rest }) => rest)) })

const weekSet = (lesson: Lesson) =>
  new Set(Array.from({ length: 53 }, (_, i) => i + 1).filter((w) => lessonActiveInWeek(lesson, w)))

function validate(state: State): string | null {
  for (const [i, p] of state.periods.entries()) {
    if (!isTime(p.s) || !isTime(p.e)) return `Bitte für die ${i + 1}. Stunde Beginn und Ende angeben.`
    if (p.s >= p.e) return `In der ${i + 1}. Stunde muss das Ende nach dem Beginn liegen.`
  }
  const count = state.periods.length
  for (const [d, day] of state.week.entries()) {
    const name = WEEKDAY_NAMES[d]
    const lessons: Lesson[] = []
    for (const row of day) {
      if (!row.f.trim()) return `${name}: Bitte bei jedem Eintrag ein Fach angeben.`
      const p = Number(row.p)
      const e = Number(row.e)
      if (!p || !e || e < p) return `${name}, ${row.f}: Die Stunden sind ungültig.`
      if (e > count) return `${name}, ${row.f}: Die ${e}. Stunde gibt es im Stundenraster nicht.`
      for (const kw of [row.a, row.b]) {
        if (kw && !(Number.isInteger(Number(kw)) && Number(kw) >= 1 && Number(kw) <= 53)) {
          return `${name}, ${row.f}: Kalenderwochen müssen zwischen 1 und 53 liegen.`
        }
      }
      const lesson = toLesson(row)
      if (lesson) lessons.push(lesson)
    }
    // Überschneidungen sind nur erlaubt, wenn die KW-Bereiche sich nicht überlappen
    for (const [i, x] of lessons.entries()) {
      for (const y of lessons.slice(i + 1)) {
        const timeOverlap = x.p <= y.p + y.n - 1 && y.p <= x.p + x.n - 1
        if (!timeOverlap) continue
        const weeks = weekSet(y)
        if ([...weekSet(x)].some((w) => weeks.has(w))) {
          return `${name}: „${x.f}“ und „${y.f}“ überschneiden sich zeitlich in denselben Kalenderwochen.`
        }
      }
    }
  }
  return null
}

export function TimetableEditor({ doc }: { doc: TimetableDoc }) {
  const keyRef = useRef(0)
  const nextKey = () => ++keyRef.current
  const [state, setState] = useState<State>(() => toState(doc, nextKey))
  const [baseline, setBaseline] = useState(() => serialize(state))
  const [error, setError] = useState<string | null>(null)
  const mutation = useDocMutation('Stundenplan gespeichert.')

  const dirty = serialize(state) !== baseline
  const count = state.periods.length

  const setPeriod = (index: number, key: keyof Period, value: string) =>
    setState((st) => ({ ...st, periods: st.periods.map((p, i) => (i === index ? { ...p, [key]: value } : p)) }))

  const addPeriod = () =>
    setState((st) => {
      const last = st.periods[st.periods.length - 1]
      const s = last && isTime(last.e) ? addMinutes(last.e, 15) : '08:00'
      return { ...st, periods: [...st.periods, { s, e: addMinutes(s, 45) }] }
    })

  const removeLastPeriod = () => setState((st) => ({ ...st, periods: st.periods.slice(0, -1) }))

  const setRow = (day: number, key: number, patch: Partial<Row>) =>
    setState((st) => ({
      ...st,
      week: st.week.map((rows, d) =>
        d !== day
          ? rows
          : rows.map((row) => {
              if (row.key !== key) return row
              const next = { ...row, ...patch }
              // Ende nie vor dem Beginn
              if (patch.p && Number(next.e) < Number(next.p)) next.e = next.p
              return next
            }),
      ),
    }))

  const addRow = (day: number) =>
    setState((st) => ({
      ...st,
      week: st.week.map((rows, d) => {
        if (d !== day) return rows
        const lastEnd = Math.max(0, ...rows.map((r) => Number(r.e) || 0))
        const p = Math.min(lastEnd + 1, Math.max(count, 1))
        const e = Math.min(p + 1, Math.max(count, 1))
        return [...rows, { key: nextKey(), p: String(p), e: String(e), f: '', l: '', r: '', a: '', b: '' }]
      }),
    }))

  const removeRow = (day: number, key: number) =>
    setState((st) => ({ ...st, week: st.week.map((rows, d) => (d === day ? rows.filter((r) => r.key !== key) : rows)) }))

  const handleSave = () => {
    const problem = validate(state)
    setError(problem)
    if (problem) return
    const week = state.week.map((day) => sortLessons(day.map(toLesson).filter((l): l is Lesson => l !== null)))
    const saved = serialize(state)
    mutation.mutate(timetableUpdater(state.periods, week), { onSuccess: () => setBaseline(saved) })
  }

  const periodOptions = Array.from({ length: count }, (_, i) => i + 1)
  const subjects = [...new Set(state.week.flat().map((r) => r.f.trim()).filter(Boolean))].sort()
  const teachers = [...new Set(state.week.flat().map((r) => r.l.trim()).filter(Boolean))].sort()
  const rooms = [...new Set(state.week.flat().map((r) => r.r.trim()).filter(Boolean))].sort()

  return (
    <div className={styles.wrap}>
      <section className={styles.card}>
        <header className={styles.cardHead}>
          <h2 className={styles.cardTitle}>Unterrichtszeiten</h2>
        </header>
        <div className={styles.periods}>
          {state.periods.map((period, index) => (
            <div key={index} className={styles.period}>
              <span className={styles.num}>{index + 1}.</span>
              <input
                type="time"
                className={styles.input}
                value={period.s}
                onChange={(e) => setPeriod(index, 's', e.target.value)}
                aria-label={`Beginn ${index + 1}. Stunde`}
              />
              <span className={styles.dash}>–</span>
              <input
                type="time"
                className={styles.input}
                value={period.e}
                onChange={(e) => setPeriod(index, 'e', e.target.value)}
                aria-label={`Ende ${index + 1}. Stunde`}
              />
            </div>
          ))}
        </div>
        <div className={styles.cardFoot}>
          <button type="button" className={ui.secondary} onClick={addPeriod}>
            + Stunde
          </button>
          {count > 0 && (
            <button type="button" className={ui.danger} onClick={removeLastPeriod}>
              Letzte Stunde entfernen
            </button>
          )}
        </div>
      </section>

      {WEEKDAY_NAMES.map((name, day) => (
        <section key={name} className={styles.card}>
          <header className={styles.cardHead}>
            <h2 className={styles.cardTitle}>{name}</h2>
            <button type="button" className={ui.ghost} onClick={() => addRow(day)} disabled={count === 0}>
              + Unterricht
            </button>
          </header>
          {(state.week[day] ?? []).length === 0 ? (
            <p className={styles.empty}>Kein regulärer Unterricht.</p>
          ) : (
            <div className={styles.lessons}>
              <div className={`${styles.lesson} ${styles.lessonHead}`} aria-hidden="true">
                <span>Von</span>
                <span>Bis</span>
                <span>Fach</span>
                <span>Lehrkraft</span>
                <span>Raum</span>
                <span>Ab KW</span>
                <span>Bis KW</span>
                <span />
              </div>
              {(state.week[day] ?? []).map((row) => (
                <div key={row.key} className={styles.lesson}>
                  <select
                    className={styles.input}
                    value={row.p}
                    onChange={(e) => setRow(day, row.key, { p: e.target.value })}
                    aria-label="Von Stunde"
                  >
                    {periodOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}. · {state.periods[p - 1]?.s}
                      </option>
                    ))}
                  </select>
                  <select
                    className={styles.input}
                    value={row.e}
                    onChange={(e) => setRow(day, row.key, { e: e.target.value })}
                    aria-label="Bis Stunde"
                  >
                    {periodOptions
                      .filter((p) => p >= Number(row.p))
                      .map((p) => (
                        <option key={p} value={p}>
                          {p}. · {state.periods[p - 1]?.e}
                        </option>
                      ))}
                  </select>
                  <input
                    className={`${styles.input} ${styles.subject}`}
                    value={row.f}
                    list="tt-subjects"
                    placeholder="Fach"
                    onChange={(e) => setRow(day, row.key, { f: e.target.value })}
                    aria-label="Fach"
                  />
                  <input
                    className={styles.input}
                    value={row.l}
                    list="tt-teachers"
                    placeholder="Lehrkraft"
                    onChange={(e) => setRow(day, row.key, { l: e.target.value })}
                    aria-label="Lehrkraft"
                  />
                  <input
                    className={styles.input}
                    value={row.r}
                    list="tt-rooms"
                    placeholder="Raum"
                    onChange={(e) => setRow(day, row.key, { r: e.target.value })}
                    aria-label="Raum"
                  />
                  <input
                    className={styles.input}
                    inputMode="numeric"
                    value={row.a}
                    placeholder="ab KW"
                    onChange={(e) => setRow(day, row.key, { a: e.target.value.replace(/\D/g, '') })}
                    aria-label="Gültig ab Kalenderwoche"
                  />
                  <input
                    className={styles.input}
                    inputMode="numeric"
                    value={row.b}
                    placeholder="bis KW"
                    onChange={(e) => setRow(day, row.key, { b: e.target.value.replace(/\D/g, '') })}
                    aria-label="Gültig bis Kalenderwoche"
                  />
                  <button
                    type="button"
                    className={ui.danger}
                    onClick={() => removeRow(day, row.key)}
                    aria-label={`${row.f || 'Eintrag'} entfernen`}
                    title="Entfernen"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      <datalist id="tt-subjects">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
      <datalist id="tt-teachers">{teachers.map((s) => <option key={s} value={s} />)}</datalist>
      <datalist id="tt-rooms">{rooms.map((s) => <option key={s} value={s} />)}</datalist>

      <div className={styles.saveBar}>
        <p className={styles.hint}>Leere KW-Felder bedeuten: gilt in allen Wochen. Bereiche wie 37–3 laufen über den Jahreswechsel.</p>
        <div className={styles.saveArea}>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {!error && dirty && !mutation.isPending && <span className={styles.dirty}>Ungespeicherte Änderungen</span>}
          <button type="button" className={ui.primary} onClick={handleSave} disabled={!dirty || mutation.isPending}>
            {mutation.isPending ? 'Wird gespeichert …' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}
