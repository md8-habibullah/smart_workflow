import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import toast, { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext.jsx'
import App from './App.jsx'
import { CrashScreen, ErrorBoundary } from './components/ErrorBoundary.jsx'
import NetworkStatus from './components/NetworkStatus.jsx'
import { isUnexpectedError, serverStatus } from './lib/api'
import { reloadForNewVersion } from './lib/chunkReload'
import './index.css'

// Signature for curious developers opening the console.
console.info(
  '%cSmart Workforce%c crafted by MD. Habibullah Sharif · https://habibullah.dev · https://github.com/md8-habibullah',
  'background:#039855;color:#fff;padding:2px 6px;border-radius:4px;font-weight:700',
  'color:#039855',
)

// Vite fires this when a preloaded chunk of an older deployment no longer exists.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewVersion()) event.preventDefault()
})

/**
 * One toast for failures the user didn't cause (server fault, network).
 * Offline / unreachable-server states are already shown by <NetworkStatus />,
 * and 4xx errors are shown where they happen (forms, inline error states).
 */
const toastUnexpected = (error) => {
  if (!isUnexpectedError(error)) return
  if (!navigator.onLine || !serverStatus.isReachable()) return
  const reference = error?.reference ? ` (ref ${error.reference})` : ''
  toast.error(`${error?.message || 'Something went wrong.'}${reference}`, { id: 'unexpected-error' })
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // First loads render an inline <ErrorState>; only background refreshes need a toast.
      if (query.meta?.silentError || query.state.data === undefined) return
      toastUnexpected(error)
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, variables, context, mutation) => {
      // Mutations with their own onError already report it.
      if (mutation.options.onError || mutation.meta?.silentError) return
      toastUnexpected(error)
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      // Don't hammer the server on auth/permission/validation errors.
      retry: (count, error) => count < 2 && !(error?.status >= 400 && error?.status < 500),
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary fallback={(props) => <CrashScreen {...props} fullPage />}>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <App />
            <NetworkStatus />
            <Toaster
              position="top-right"
              toastOptions={{
                className: '!text-sm !font-medium !rounded-xl !shadow-lg',
                success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
              }}
            />
          </AuthProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
