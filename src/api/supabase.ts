import { decode, encode } from '../lib/codec.ts'
import { emptyDoc, normalizeDoc, type TimetableDoc } from '../lib/schema.ts'

// Direkter Zugriff auf die Supabase REST API (PostgREST) – ohne zusätzliche Client-Bibliothek.
// Gespeichert wird genau eine Zeile: { id: 1, data: "<Base64-kodiertes JSON>" }.
// Authentifizierung über den Publishable Key (sb_publishable_…), der die Rolle `anon` erhält.

const BASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const TABLE = import.meta.env.VITE_SUPABASE_TABLE || 'timetable'
const ROW_ID = 1
const TIMEOUT_MS = 15000

export class ApiError extends Error {
  readonly status: number
  readonly retryable: boolean

  constructor(message: string, options: { status?: number; retryable?: boolean; cause?: unknown } = {}) {
    super(message, { cause: options.cause })
    this.name = 'ApiError'
    this.status = options.status ?? 0
    this.retryable = options.retryable ?? false
  }
}

function assertConfig() {
  if (!BASE_URL || !API_KEY) {
    throw new ApiError(
      'Supabase ist nicht konfiguriert. Bitte VITE_SUPABASE_URL und VITE_SUPABASE_PUBLISHABLE_KEY in der Datei .env.local setzen.',
    )
  }
  if (API_KEY.startsWith('sb_secret_')) {
    throw new ApiError('Der hinterlegte Schlüssel ist ein Secret Key. Im Frontend darf nur der Publishable Key verwendet werden.')
  }
  if (!API_KEY.startsWith('sb_publishable_')) {
    throw new ApiError(
      'VITE_SUPABASE_PUBLISHABLE_KEY muss ein Publishable Key sein (beginnt mit „sb_publishable_“). Zu finden unter Project Settings → API Keys.',
    )
  }
}

async function toHttpError(res: Response): Promise<ApiError> {
  let detail = ''
  try {
    const body: unknown = await res.json()
    if (body && typeof body === 'object') {
      const { message, hint } = body as { message?: unknown; hint?: unknown }
      detail = typeof message === 'string' ? message : typeof hint === 'string' ? hint : ''
    }
  } catch {
    /* Antwort ohne JSON-Body */
  }
  const s = res.status
  let message: string
  if (s === 401 || s === 403) {
    message = 'Zugriff verweigert. Bitte Publishable Key und Row-Level-Security-Richtlinien prüfen.'
  } else if (s === 404 || /does not exist|could not find the table/i.test(detail)) {
    message = `Die Tabelle „${TABLE}“ wurde nicht gefunden. Wurde supabase/schema.sql ausgeführt?`
  } else if (s >= 500) {
    message = 'Die Datenbank ist momentan nicht erreichbar.'
  } else {
    message = 'Die Anfrage an die Datenbank ist fehlgeschlagen.'
  }
  return new ApiError(detail ? `${message} (${detail})` : message, { status: s, retryable: s >= 500 })
}

async function request(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  assertConfig()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(`${BASE_URL}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: API_KEY, Accept: 'application/json', 'Content-Type': 'application/json', ...init.headers },
      signal: controller.signal,
    })
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === 'AbortError'
        ? 'Die Datenbank antwortet nicht (Zeitüberschreitung).'
        : 'Keine Verbindung zur Datenbank. Bitte die Internetverbindung prüfen.'
    throw new ApiError(message, { retryable: true, cause: error })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw await toHttpError(res)
  return res
}

async function readRows(res: Response): Promise<Array<{ data?: unknown }>> {
  let body: unknown
  try {
    body = await res.json()
  } catch (error) {
    throw new ApiError('Unerwartete Antwort der Datenbank.', { cause: error })
  }
  if (!Array.isArray(body)) throw new ApiError('Unerwartete Antwort der Datenbank.')
  return body as Array<{ data?: unknown }>
}

/** Lädt und dekodiert das Dokument. Existiert noch keine Zeile, wird ein leeres Dokument geliefert. */
export async function fetchDoc(): Promise<TimetableDoc> {
  const rows = await readRows(await request(`${TABLE}?id=eq.${ROW_ID}&select=data`, { method: 'GET' }))
  const row = rows[0]
  if (!row) return emptyDoc()
  try {
    return normalizeDoc(decode(row.data))
  } catch (error) {
    // Bewusst kein Fallback auf ein leeres Dokument – sonst würde ein Speichern die Daten überschreiben.
    throw new ApiError('Die gespeicherten Daten konnten nicht gelesen werden. Es wurde nichts überschrieben.', {
      cause: error,
    })
  }
}

/** Speichert das Dokument (Upsert) und prüft anhand der Antwort, dass es tatsächlich geschrieben wurde. */
export async function saveDoc(doc: TimetableDoc): Promise<TimetableDoc> {
  const data = encode(doc)
  const rows = await readRows(
    await request(`${TABLE}?on_conflict=id`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ id: ROW_ID, data }),
    }),
  )
  if (rows[0]?.data !== data) {
    throw new ApiError('Die Speicherung konnte von der Datenbank nicht bestätigt werden.')
  }
  return doc
}
