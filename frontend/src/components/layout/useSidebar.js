import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'swta.sidebar'
export const SIDEBAR = { min: 208, max: 400, default: 256, rail: 76, snapToRail: 150 }

const clamp = (w) => Math.min(SIDEBAR.max, Math.max(SIDEBAR.min, Math.round(w)))

const load = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return {
      width: Number.isFinite(saved.width) ? clamp(saved.width) : SIDEBAR.default,
      collapsed: saved.collapsed === true,
    }
  } catch {
    return { width: SIDEBAR.default, collapsed: false }
  }
}

const persist = (prefs) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    /* storage unavailable: the layout still works, it just isn't remembered */
  }
}

/**
 * Desktop sidebar size, remembered per browser in localStorage.
 * Drag the edge to resize (drag far left to collapse to an icon rail),
 * double-click it to reset, use arrow keys on it, or press Ctrl+B to toggle.
 */
export function useSidebar() {
  const [prefs, setPrefs] = useState(load)
  const [dragging, setDragging] = useState(false)
  const prefsRef = useRef(prefs)

  useEffect(() => {
    prefsRef.current = prefs
    // Persisting on every pointer move would hammer storage; only store settled values.
    if (!dragging) persist(prefs)
  }, [prefs, dragging])

  const toggle = useCallback(() => setPrefs((p) => ({ ...p, collapsed: !p.collapsed })), [])
  const reset = useCallback(() => setPrefs({ width: SIDEBAR.default, collapsed: false }), [])
  const nudge = useCallback((delta) => setPrefs((p) => ({ collapsed: false, width: clamp((p.collapsed ? SIDEBAR.min : p.width) + delta) })), [])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return
    e.preventDefault()
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    setDragging(true)
    document.body.classList.add('select-none', 'cursor-col-resize')

    const onMove = (ev) => {
      const x = ev.clientX
      setPrefs(x < SIDEBAR.snapToRail ? { ...prefsRef.current, collapsed: true } : { collapsed: false, width: clamp(x) })
    }
    const onUp = (ev) => {
      handle.releasePointerCapture?.(ev.pointerId)
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
      document.body.classList.remove('select-none', 'cursor-col-resize')
      setDragging(false)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }, [])

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === 'ArrowLeft') nudge(-16)
      else if (e.key === 'ArrowRight') nudge(16)
      else if (e.key === 'Enter' || e.key === ' ') toggle()
      else if (e.key === 'Home') reset()
      else return
      e.preventDefault()
    },
    [nudge, toggle, reset],
  )

  return {
    width: prefs.collapsed ? SIDEBAR.rail : prefs.width,
    collapsed: prefs.collapsed,
    dragging,
    toggle,
    reset,
    handleProps: {
      onPointerDown,
      onKeyDown,
      onDoubleClick: reset,
      role: 'separator',
      tabIndex: 0,
      'aria-orientation': 'vertical',
      'aria-label': 'Resize sidebar (arrow keys, Enter to collapse, double-click to reset)',
      'aria-valuemin': SIDEBAR.rail,
      'aria-valuemax': SIDEBAR.max,
      'aria-valuenow': prefs.collapsed ? SIDEBAR.rail : prefs.width,
    },
  }
}
