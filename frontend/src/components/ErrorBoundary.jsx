/* eslint-disable react-refresh/only-export-components */
import { Component } from 'react'
import { AlertTriangle, LayoutDashboard, RefreshCw, RotateCcw } from 'lucide-react'
import { isChunkLoadError, reloadForNewVersion } from '../lib/chunkReload'
import { Button, cn } from './ui'

/**
 * Catches render errors below it. `fallback({ error, reset })` renders the
 * replacement UI; changing `resetKey` (e.g. the pathname) clears the error,
 * so navigating away from a broken page recovers automatically.
 */
export class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // A missing lazy chunk after a deployment: fetch the new build instead of showing an error.
    if (isChunkLoadError(error) && reloadForNewVersion()) return
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.reset()
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (error) return this.props.fallback({ error, reset: this.reset })
    return this.props.children
  }
}

/**
 * Friendly crash screen. `fullPage` is the last-resort, app-wide version: it
 * uses plain links because the router itself may be what broke.
 */
export function CrashScreen({ error, reset, fullPage = false }) {
  const newVersion = isChunkLoadError(error)
  const title = newVersion ? 'A new version is available' : 'Something went wrong'
  const text = newVersion
    ? 'The app was updated while this tab was open. Reload to continue with the latest version.'
    : fullPage
      ? 'The app hit an unexpected error. Reloading usually fixes it; your saved work is safe.'
      : "This page hit an unexpected error. The rest of the app still works: try again or go back to the dashboard."

  return (
    <div
      role="alert"
      className={cn(fullPage ? 'flex min-h-screen items-center justify-center bg-slate-50 px-4' : 'py-16')}
    >
      <div className="mx-auto max-w-md text-center">
        <div
          className={cn(
            'mx-auto flex size-14 items-center justify-center rounded-2xl',
            newVersion ? 'bg-brand-50 text-brand-600' : 'bg-red-50 text-red-500',
          )}
        >
          {newVersion ? <RefreshCw className="size-7" /> : <AlertTriangle className="size-7" />}
        </div>
        <h1 className="mt-6 text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-slate-500">{text}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button icon={RefreshCw} onClick={() => window.location.reload()}>
            Reload
          </Button>
          {!fullPage && !newVersion && reset && (
            <Button variant="secondary" icon={RotateCcw} onClick={reset}>
              Try again
            </Button>
          )}
          {fullPage ? (
            // A full navigation: also recovers when the router or a provider is what crashed.
            <a
              href="/app"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-300 ring-inset transition-colors hover:bg-slate-50"
            >
              <LayoutDashboard className="size-4" /> Go to dashboard
            </a>
          ) : (
            <Button variant="secondary" icon={LayoutDashboard} to="/app">
              Go to dashboard
            </Button>
          )}
        </div>
        {import.meta.env.DEV && error && (
          <details className="mt-8 rounded-xl border border-red-200 bg-red-50/60 p-4 text-left text-xs text-red-800">
            <summary className="cursor-pointer font-semibold">Error details (development only)</summary>
            <pre className="mt-2 max-h-64 overflow-auto font-mono whitespace-pre-wrap">{String(error.stack || error.message || error)}</pre>
          </details>
        )}
      </div>
    </div>
  )
}
