import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { isUnexpectedError, setUnauthorizedHandler, tokenStore } from '../lib/api'
import { authApi } from '../lib/endpoints'

const AuthContext = createContext(null)

/**
 * Holds the signed-in user. `status` is one of:
 *   'loading'        – validating a stored token on first load
 *   'authenticated'  – user is set
 *   'anonymous'      – no valid session
 */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(() => (tokenStore.get() ? 'loading' : 'anonymous'))

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    setStatus('anonymous')
    queryClient.clear()
  }, [queryClient])

  // Any 401 from an authenticated request ends the session. Several requests can fail at
  // once, so the "session expired" message is shown a single time per session.
  const statusRef = useRef(status)
  useEffect(() => {
    statusRef.current = status
  }, [status])
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (statusRef.current === 'authenticated') {
        toast.error('Your session has expired. Please sign in again.', { id: 'session-expired' })
      }
      // RequireAuth then redirects to /login, remembering the page in `from`.
      logout()
    })
    return () => setUnauthorizedHandler(null)
  }, [logout])

  // Validate a stored token on startup. If the server is unreachable or failing, the token
  // is kept and validation retried (NetworkStatus shows a banner meanwhile): an outage must
  // not sign people out. Only a real rejection (401/403…) ends the session.
  useEffect(() => {
    if (!tokenStore.get()) return
    let cancelled = false
    let timer = null
    const validate = () =>
      authApi
        .me()
        .then((me) => {
          if (cancelled) return
          setUser(me)
          setStatus('authenticated')
        })
        .catch((error) => {
          if (cancelled) return
          if (isUnexpectedError(error)) {
            timer = setTimeout(validate, 5000)
            return
          }
          tokenStore.clear()
          setStatus('anonymous')
        })
    validate()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  const login = useCallback(async (email, password) => {
    const { data } = await authApi.login(email, password)
    tokenStore.set(data.token)
    setUser(data.user)
    setStatus('authenticated')
    return data.user
  }, [])

  const refreshUser = useCallback(async () => {
    const me = await authApi.me()
    setUser(me)
    return me
  }, [])

  const value = useMemo(() => {
    const role = user?.role
    return {
      user,
      status,
      role,
      isAdmin: role === 'ADMIN' || role === 'SUPER_ADMIN',
      isSuperAdmin: role === 'SUPER_ADMIN',
      employeeId: user?.employee?.id ?? null,
      displayName: user?.employee?.fullName || user?.email || '',
      login,
      logout,
      refreshUser,
    }
  }, [user, status, login, logout, refreshUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
