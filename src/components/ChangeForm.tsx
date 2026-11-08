import { useId, useState, type ChangeEvent, type FormEvent } from 'react'
import { cleanupCutoff } from '../lib/cleanup.ts'
import { formatShort, isIsoDate, isTime, type IsoDate } from '../lib/dates.ts'
import {
  CHANGE_KINDS,
  CHANGE_TYPES,
  lastPeriod,
  lessonAt,
  newId,
  normalizeChange,
  type Change,
  type ChangeKind,
  type TimetableDoc,
} from '../lib/schema.ts'
import ui from './ui.module.css'
import styles from './ChangeForm.module.css'

/** Vorbelegung: bestehende Änderung oder Datum/Stunden aus der Übersicht */
export type ChangeFormInitial = Partial<Change>

interface FormState {
  d: string
  p: string // erste Stunde
  e: string // letzte Stunde
  k: ChangeKind
  f: string
  l: string
  r: string
  nd: string
  nt: string
  i: string
}
type FieldName = Exclude<keyof FormState, 'k'>
type Errors = Partial<Record<FieldName, string>>

// Welche Felder pro Änderungsart sichtbar sind
const FIELDS: Record<ChangeKind, { teacher: boolean; room: boolean; newDate: boolean; newTime: boolean }> = {
  v: { teacher: true, room: true, newDate: false, newTime: true },
  a: { teacher: false, room: false, newDate: false, newTime: false },
  x: { teacher: false, room: true, newDate: true, newTime: true },
  z: { teacher: true, room: true, newDate: false, newTime: true },
  s: { teacher: false, room: true, newDate: false, newTime: true },
}

const periodCount = (doc: TimetableDoc) => doc.p.length || 12

/** Standard-Ende: ganzer regulärer Block, sonst Einzelstunde (Zusatzstunde: Doppelstunde). */
function defaultEnd(doc: TimetableDoc, date: string, p: number, kind: ChangeKind): number {
  const lesson = isIsoDate(date) ? lessonAt(doc, date, p) : null
  if (lesson && kind !== 'z') return lastPeriod(lesson)
  return kind === 'z' ? Math.min(p + 1, periodCount(doc)) : p
}

function toForm(initial: ChangeFormInitial | undefined, doc: TimetableDoc): FormState {
  const d = initial?.d ?? ''
  const k = initial?.k ?? 'v'
  const p = initial?.p
  const e = p == null ? undefined : initial?.n != null || initial?.id ? p + (initial?.n ?? 1) - 1 : defaultEnd(doc, d, p, k)
  return {
    d,
    p: p == null ? '' : String(p),
    e: e == null ? '' : String(e),
    k,
    f: initial?.f ?? '',
    l: initial?.l ?? '',
    r: initial?.r ?? '',
    nd: initial?.nd ?? '',
    nt: initial?.nt ?? '',
    i: initial?.i ?? '',
  }
}

function validate(form: FormState, subject: string, today: IsoDate): Errors {
  const errors: Errors = {}
  if (!isIsoDate(form.d)) errors.d = 'Bitte ein Datum wählen.'
  else if (form.d <= cleanupCutoff(today)) errors.d = 'Das Datum liegt mehr als einen Monat zurück und würde automatisch gelöscht.'
  if (!form.p) errors.p = 'Bitte eine Stunde wählen.'
  else if (!form.e || Number(form.e) < Number(form.p)) errors.e = 'Die letzte Stunde darf nicht vor der ersten liegen.'
  if (form.k === 'x') {
    if (!form.nd && !form.nt) errors.nd = 'Bitte ein neues Datum und/oder eine neue Uhrzeit angeben.'
    else if (form.nd && !isIsoDate(form.nd)) errors.nd = 'Ungültiges Datum.'
  }
  if (form.k === 'z' && !subject.trim()) errors.f = 'Bitte ein Fach angeben.'
  if (form.nt && !isTime(form.nt)) errors.nt = 'Ungültige Uhrzeit.'
  if (form.k === 's' && !form.i.trim()) errors.i = 'Bitte eine Beschreibung eingeben.'
  return errors
}

interface Props {
  doc: TimetableDoc
  initial?: ChangeFormInitial
  today: IsoDate
  isEdit: boolean
  pending: boolean
  onSubmit: (change: Change) => void
  onCancel?: () => void
}

export function ChangeForm({ doc, initial, today, isEdit, pending, onSubmit, onCancel }: Props) {
  const uid = useId()
  const [form, setForm] = useState<FormState>(() => toForm(initial, doc))
  const [subjectTouched, setSubjectTouched] = useState(Boolean(initial?.f))
  const [errors, setErrors] = useState<Errors>({})

  const first = Number(form.p)
  const lesson = isIsoDate(form.d) && first ? lessonAt(doc, form.d, first) : null
  const regular = form.k === 'z' ? '' : (lesson?.f ?? '')
  const subject = subjectTouched ? form.f : regular
  const fields = FIELDS[form.k]
  const count = periodCount(doc)

  const update = (patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
    setErrors((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(patch)) delete next[key as FieldName]
      return next
    })
  }
  const set = (key: FieldName) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    update({ [key]: event.target.value })

  // Beim Wechsel der ersten Stunde/des Datums/der Art wird das Ende passend vorbelegt.
  const setStart = (value: string) =>
    update({ p: value, e: value ? String(defaultEnd(doc, form.d, Number(value), form.k)) : '' })
  const setDate = (value: string) =>
    update({ d: value, e: form.p ? String(defaultEnd(doc, value, Number(form.p), form.k)) : form.e })
  const setKind = (value: ChangeKind) =>
    update({ k: value, e: form.p ? String(defaultEnd(doc, form.d, Number(form.p), value)) : form.e })

  const labelFor = (p: number) => {
    const name = isIsoDate(form.d) ? lessonAt(doc, form.d, p)?.f : undefined
    return [`${p}. Std.`, doc.p[p - 1]?.s, name ?? 'frei'].filter(Boolean).join(' · ')
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const found = validate(form, subject, today)
    setErrors(found)
    if (Object.values(found).some(Boolean)) return
    const change = normalizeChange({
      id: initial?.id ?? newId(),
      d: form.d,
      p: first,
      n: Number(form.e) - first + 1,
      k: form.k,
      f: subject,
      l: fields.teacher ? form.l : '',
      r: fields.room ? form.r : '',
      nd: fields.newDate ? form.nd : '',
      nt: fields.newTime ? form.nt : '',
      i: form.i,
    })
    if (change) onSubmit(change)
  }

  const id = (name: string) => `${uid}-${name}`
  const errorFor = (name: FieldName) => (errors[name] ? <p className={styles.error}>{errors[name]}</p> : null)
  const optional = <span className={styles.optional}>optional</span>
  const blockHint =
    lesson && form.k !== 'z' && (lesson.p !== first || lastPeriod(lesson) !== Number(form.e))
      ? `Nur ein Teil des Blocks ${lesson.p}.–${lastPeriod(lesson)}. Std. ist betroffen.`
      : null

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <fieldset className={styles.types}>
        <legend className={styles.label}>Art der Änderung</legend>
        <div className={styles.segmented}>
          {CHANGE_KINDS.map((kind) => (
            <label key={kind} className={`${styles.segment} ${styles[CHANGE_TYPES[kind].tone]}`}>
              <input
                type="radio"
                name={id('k')}
                value={kind}
                checked={form.k === kind}
                onChange={() => setKind(kind)}
              />
              <span>{CHANGE_TYPES[kind].label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={id('d')}>
          Datum
        </label>
        <input
          id={id('d')}
          type="date"
          className={styles.input}
          value={form.d}
          onChange={(e) => setDate(e.target.value)}
          aria-invalid={Boolean(errors.d)}
          required
        />
        {errorFor('d')}
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={id('p')}>
            Von Stunde
          </label>
          <select
            id={id('p')}
            className={styles.input}
            value={form.p}
            onChange={(e) => setStart(e.target.value)}
            aria-invalid={Boolean(errors.p)}
            required
          >
            <option value="">Auswählen …</option>
            {Array.from({ length: count }, (_, i) => i + 1).map((p) => (
              <option key={p} value={p}>
                {labelFor(p)}
              </option>
            ))}
          </select>
          {errorFor('p')}
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={id('e')}>
            Bis Stunde
          </label>
          <select
            id={id('e')}
            className={styles.input}
            value={form.e}
            onChange={set('e')}
            disabled={!form.p}
            aria-invalid={Boolean(errors.e)}
          >
            {!form.p && <option value="">–</option>}
            {first > 0 &&
              Array.from({ length: count - first + 1 }, (_, i) => first + i).map((p) => (
                <option key={p} value={p}>
                  {[`${p}. Std.`, doc.p[p - 1]?.e && `bis ${doc.p[p - 1]?.e}`].filter(Boolean).join(' · ')}
                </option>
              ))}
          </select>
          {errorFor('e')}
        </div>
      </div>
      {blockHint && <p className={styles.hint}>{blockHint}</p>}

      <div className={styles.field}>
        <label className={styles.label} htmlFor={id('f')}>
          {form.k === 'v' ? 'Fach in der Vertretung' : 'Fach'}
        </label>
        <input
          id={id('f')}
          className={styles.input}
          value={subject}
          list="subject-list"
          placeholder={regular || 'z. B. 1.1.4 EL'}
          aria-invalid={Boolean(errors.f)}
          onChange={(e) => {
            setSubjectTouched(true)
            update({ f: e.target.value })
          }}
        />
        {errorFor('f')}
        {regular && form.k === 'v' && <p className={styles.hint}>Regulär: {regular}</p>}
      </div>

      {(fields.teacher || fields.room) && (
        <div className={styles.row}>
          {fields.teacher && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor={id('l')}>
                Lehrkraft {optional}
              </label>
              <input
                id={id('l')}
                className={styles.input}
                value={form.l}
                onChange={set('l')}
                placeholder={(form.k !== 'z' && lesson?.l) || 'z. B. Kasper'}
              />
            </div>
          )}
          {fields.room && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor={id('r')}>
                {form.k === 'z' ? 'Raum' : 'Neuer Raum'} {optional}
              </label>
              <input
                id={id('r')}
                className={styles.input}
                value={form.r}
                onChange={set('r')}
                placeholder={(form.k !== 'z' && lesson?.r) || 'z. B. LG2, C244'}
              />
            </div>
          )}
        </div>
      )}

      {(fields.newDate || fields.newTime) && (
        <div className={styles.row}>
          {fields.newDate && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor={id('nd')}>
                Neues Datum
              </label>
              <input
                id={id('nd')}
                type="date"
                className={styles.input}
                value={form.nd}
                onChange={set('nd')}
                aria-invalid={Boolean(errors.nd)}
              />
              {errorFor('nd')}
            </div>
          )}
          {fields.newTime && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor={id('nt')}>
                {form.k === 'z' ? 'Abweichende Uhrzeit' : 'Neue Uhrzeit'} {form.k !== 'x' && optional}
              </label>
              <input
                id={id('nt')}
                type="time"
                className={styles.input}
                value={form.nt}
                onChange={set('nt')}
                aria-invalid={Boolean(errors.nt)}
              />
              {errorFor('nt')}
            </div>
          )}
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label} htmlFor={id('i')}>
          Beschreibung {form.k !== 's' && optional}
        </label>
        <textarea
          id={id('i')}
          className={styles.textarea}
          rows={3}
          value={form.i}
          onChange={set('i')}
          placeholder="z. B. Aufgaben im Skript S. 45"
          aria-invalid={Boolean(errors.i)}
        />
        {errorFor('i')}
      </div>

      <div className={styles.actions}>
        <button type="submit" className={ui.primary} disabled={pending}>
          {pending ? 'Wird gespeichert …' : isEdit ? 'Änderung speichern' : 'Änderung eintragen'}
        </button>
        {onCancel && (
          <button type="button" className={ui.secondary} onClick={onCancel} disabled={pending}>
            Abbrechen
          </button>
        )}
        {isIsoDate(form.d) && <span className={styles.summary}>{formatShort(form.d)}</span>}
      </div>
    </form>
  )
}
