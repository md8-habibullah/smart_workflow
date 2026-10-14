import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext.jsx'
import App from './App.jsx'
import './index.css'

// Signature for curious developers opening the console.
console.info(
  '%cSmart Workforce%c crafted by MD. Habibullah Sharif · https://habibullah.dev · https://github.com/md8-habibullah',
  'background:#039855;color:#fff;padding:2px 6px;border-radius:4px;font-weight:700',
  'color:#039855',
)

const queryClient = new QueryClient({
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
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
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
  </StrictMode>,
)
