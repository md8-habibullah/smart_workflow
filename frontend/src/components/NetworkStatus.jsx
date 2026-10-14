import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { RefreshCw, ServerCrash, WifiOff } from 'lucide-react'
import { serverStatus } from '../lib/api'
import { cn } from './ui'

const subscribeOnline = (callback) => {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

const useOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)
const useServerReachable = () => useSyncExternalStore(serverStatus.subscribe, serverStatus.isReachable, () => true)

const RETRY_MS = 10_000

/**
 * Global connection banner: "you're offline" (browser has no network) or
 * "can't reach the server" (network fine, API down). While the API is down it
 * is pinged every 10 s; when the connection returns, data is refreshed.
 */
export default function NetworkStatus() {
  const online = useOnline()
  const reachable = useServerReachable()
  const queryClient = useQueryClient()
  const [checking, setChecking] = useState(false)
  const wasDown = useRef(false)

  useEffect(() => {
    if (!online || reachable) return undefined
    const id = setInterval(() => serverStatus.check(), RETRY_MS)
    return () => clearInterval(id)
  }, [online, reachable])

  useEffect(() => {
    const down = !online || !reachable
    if (!down && wasDown.current) {
      toast.success('Connection restored', { id: 'connection' })
      queryClient.invalidateQueries()
    }
    wasDown.current = down
  }, [online, reachable, queryClient])

  if (online && reachable) return null

  const retry = async () => {
    setChecking(true)
    await serverStatus.check()
    setChecking(false)
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-[60] mx-auto flex max-w-xl animate-pop-in items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl sm:inset-x-auto sm:left-1/2 sm:w-max sm:-translate-x-1/2"
    >
      {online ? <ServerCrash className="size-5 shrink-0 text-amber-300" /> : <WifiOff className="size-5 shrink-0 text-amber-300" />}
      <p className="min-w-0 flex-1">
        {online ? (
          <>
            <span className="font-semibold">Can&apos;t reach the server.</span>{' '}
            <span className="text-slate-300">Retrying automatically…</span>
          </>
        ) : (
          <>
            <span className="font-semibold">You&apos;re offline.</span>{' '}
            <span className="text-slate-300">Changes can&apos;t be saved until the connection is back.</span>
          </>
        )}
      </p>
      {online && (
        <button
          type="button"
          onClick={retry}
          disabled={checking}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold transition hover:bg-white/20 disabled:opacity-60"
        >
          <RefreshCw className={cn('size-3.5', checking && 'animate-spin')} /> Retry now
        </button>
      )}
    </div>
  )
}
