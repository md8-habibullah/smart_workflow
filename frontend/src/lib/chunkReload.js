import { lazy } from 'react'

/*
 * After a new deployment the hashed chunk files of the previous build are gone,
 * so a tab that is still running the old build fails to load the next lazy page.
 * Reloading once picks up the new build; a sessionStorage timestamp makes sure a
 * genuinely broken chunk can't put the tab into a reload loop.
 */

const KEY = 'swta.chunk-reload-at'
const GUARD_MS = 30_000

const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading (CSS )?chunk [\w-]+ failed|Unable to preload CSS/i

export const isChunkLoadError = (error) =>
  error?.name === 'ChunkLoadError' || CHUNK_ERROR.test(String(error?.message ?? error ?? ''))

/** Reloads the page unless that was already tried in the last 30 s. Returns true when reloading. */
export function reloadForNewVersion() {
  try {
    const last = Number(sessionStorage.getItem(KEY)) || 0
    if (Date.now() - last < GUARD_MS) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    return false // without storage we can't guard against loops, so don't auto-reload
  }
  window.location.reload()
  return true
}

/** React.lazy that reloads once when the chunk is missing (new deployment). */
export const lazyWithReload = (factory) =>
  lazy(() =>
    factory().catch((error) => {
      // Keep the Suspense fallback up while the page reloads.
      if (isChunkLoadError(error) && reloadForNewVersion()) return new Promise(() => {})
      throw error
    }),
  )
