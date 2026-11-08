import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { Layout, NotFound } from './components/Layout.tsx'
import { isIsoDate, type IsoDate } from './lib/dates.ts'
import { ChangesPage } from './pages/ChangesPage.tsx'
import { OverviewPage } from './pages/OverviewPage.tsx'
import { TimetablePage } from './pages/TimetablePage.tsx'

const rootRoute = createRootRoute({ component: Layout, notFoundComponent: NotFound })

const overviewRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: OverviewPage })

export interface ChangesSearch {
  date?: IsoDate // Vorbelegung: Datum
  p?: number // Vorbelegung: erste Stunde
  n?: number // Vorbelegung: Anzahl Stunden
  edit?: string // ID der zu bearbeitenden Änderung
}

const positiveInt = (value: unknown) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : undefined
}

const changesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/aenderungen',
  validateSearch: (search: Record<string, unknown>): ChangesSearch => {
    const out: ChangesSearch = {}
    if (isIsoDate(search.date)) out.date = search.date
    const p = positiveInt(search.p)
    const n = positiveInt(search.n)
    if (p) out.p = p
    if (n) out.n = n
    if (typeof search.edit === 'string' && search.edit) out.edit = search.edit
    return out
  },
  component: ChangesPage,
})

const planRoute = createRoute({ getParentRoute: () => rootRoute, path: '/plan', component: TimetablePage })

const routeTree = rootRoute.addChildren([overviewRoute, changesRoute, planRoute])

export const router = createRouter({ routeTree, scrollRestoration: true })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
