import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FlaskConical, X } from 'lucide-react'
import { authApi } from '../lib/endpoints'
import { cn } from './ui'

const DISMISS_KEY = 'swta.demoNotice.dismissed'

/** Server options (public): demo mode, uploads, password reset. Shared cache key. */
// eslint-disable-next-line react-refresh/only-export-components
export const useServerOptions = () => useQuery({ queryKey: ['auth-options'], queryFn: authApi.options, staleTime: 5 * 60_000 })

/**
 * Shown only on a public demo deployment (DEMO_MODE): explains that data is
 * temporary. Dismissible; the choice is remembered for this browser session.
 */
export default function DemoNotice({ variant = 'bar', className }) {
  const { data } = useServerOptions()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })
  if (!data?.demoMode) return null

  if (variant === 'inline') {
    return (
      <p className={cn('flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-900 ring-1 ring-amber-200', className)}>
        <FlaskConical className="mt-0.5 size-4 shrink-0" />
        <span>
          <b>Public demo.</b> Sign in with any demo account below. Everything you change is temporary and resets automatically.
        </span>
      </p>
    )
  }

  if (dismissed) return null
  return (
    <div className={cn('flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-900 sm:px-6', className)}>
      <FlaskConical className="size-3.5 shrink-0" />
      <p className="flex-1">
        <b>Public demo:</b> data is shared with other visitors and resets automatically. E-mail is log-only and the built-in accounts are protected.
      </p>
      <button
        type="button"
        aria-label="Dismiss demo notice"
        className="rounded p-0.5 hover:bg-amber-100"
        onClick={() => {
          setDismissed(true)
          try {
            sessionStorage.setItem(DISMISS_KEY, '1')
          } catch {
            /* not remembered */
          }
        }}
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
