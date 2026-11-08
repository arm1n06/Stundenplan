import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchDoc, saveDoc } from '../api/supabase.ts'
import { pruneDoc } from '../lib/cleanup.ts'
import { todayIso } from '../lib/dates.ts'
import { sortChanges, type Change, type Lesson, type Period, type TimetableDoc } from '../lib/schema.ts'
import { useToast } from '../components/Toast.tsx'

export const DOC_KEY = ['timetable'] as const

export type DocUpdater = (doc: TimetableDoc) => TimetableDoc

/** Laden + automatische Bereinigung. Wurde etwas entfernt, wird die Datenbank direkt aktualisiert. */
async function loadDoc(): Promise<TimetableDoc> {
  const { doc, removed } = pruneDoc(await fetchDoc(), todayIso())
  if (removed > 0) {
    try {
      await saveDoc(doc)
    } catch (error) {
      // Anzeige bleibt korrekt; die Bereinigung wird beim nächsten Laden/Speichern erneut versucht.
      console.warn('Bereinigung konnte nicht gespeichert werden:', error)
    }
  }
  return doc
}

export function useTimetable() {
  return useQuery({ queryKey: DOC_KEY, queryFn: loadDoc })
}

function finalize(doc: TimetableDoc): TimetableDoc {
  return pruneDoc({ ...doc, c: sortChanges(doc.c) }, todayIso()).doc
}

/**
 * Alle Schreibvorgänge laufen über diese Mutation:
 *  1. aktuellen Stand frisch laden (keine Überschreibung von Änderungen anderer Geräte),
 *  2. updater anwenden, bereinigen, speichern,
 *  3. Cache optimistisch aktualisieren und bei Fehlern zurückrollen.
 * Durch `scope` laufen Mutationen nacheinander statt parallel.
 */
export function useDocMutation(successMessage: string) {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation<TimetableDoc, Error, DocUpdater, { previous?: TimetableDoc }>({
    scope: { id: 'timetable-doc' },
    mutationFn: async (updater) => saveDoc(finalize(updater(await fetchDoc()))),
    onMutate: async (updater) => {
      await queryClient.cancelQueries({ queryKey: DOC_KEY })
      const previous = queryClient.getQueryData<TimetableDoc>(DOC_KEY)
      if (previous) {
        try {
          queryClient.setQueryData(DOC_KEY, finalize(updater(previous)))
        } catch {
          /* Fehler zeigt sich gleich in mutationFn */
        }
      }
      return { previous }
    },
    onError: (error, _updater, context) => {
      if (context?.previous) queryClient.setQueryData(DOC_KEY, context.previous)
      toast.error(`Nicht gespeichert: ${error.message}`)
    },
    onSuccess: (doc) => {
      queryClient.setQueryData(DOC_KEY, doc)
      toast.success(successMessage)
    },
  })
}

export class MissingEntryError extends Error {
  constructor() {
    super('Der Eintrag existiert nicht mehr (evtl. auf einem anderen Gerät gelöscht).')
  }
}

export const addChangeUpdater =
  (change: Change): DocUpdater =>
  (doc) => ({ ...doc, c: [...doc.c, change] })

export const updateChangeUpdater =
  (change: Change): DocUpdater =>
  (doc) => {
    if (!doc.c.some((c) => c.id === change.id)) throw new MissingEntryError()
    return { ...doc, c: doc.c.map((c) => (c.id === change.id ? change : c)) }
  }

export const deleteChangeUpdater =
  (id: string): DocUpdater =>
  (doc) => ({ ...doc, c: doc.c.filter((c) => c.id !== id) })

export const timetableUpdater =
  (periods: Period[], week: Lesson[][]): DocUpdater =>
  (doc) => ({ ...doc, p: periods, w: week })
