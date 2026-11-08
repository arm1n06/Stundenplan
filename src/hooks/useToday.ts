import { useEffect, useState } from 'react'
import { todayIso, type IsoDate } from '../lib/dates.ts'

/** Aktuelles Datum ("YYYY-MM-DD"), aktualisiert sich automatisch nach Mitternacht. */
export function useToday(): IsoDate {
  const [today, setToday] = useState(todayIso)

  useEffect(() => {
    const check = () =>
      setToday((prev) => {
        const now = todayIso()
        return now === prev ? prev : now
      })
    const timer = setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [])

  return today
}
