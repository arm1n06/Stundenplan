import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { ApiError } from './api/supabase.ts'
import { ToastProvider } from './components/Toast.tsx'
import { router } from './router.tsx'
import './styles/global.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // innerhalb einer Minute keine erneute Anfrage
      refetchOnWindowFocus: true, // beim Zurückkehren synchronisieren (inkl. Bereinigung)
      // Konfigurations-/Rechtefehler nicht sinnlos wiederholen
      retry: (count, error) => count < 2 && (!(error instanceof ApiError) || error.retryable),
    },
    mutations: { retry: 0 },
  },
})

const root = document.getElementById('root')
if (!root) throw new Error('#root fehlt in index.html')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
)
