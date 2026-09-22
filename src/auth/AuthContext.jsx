import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  authApi,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from '../api/client'
import { hasPermission, hasRole } from './permissions'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [bootstrapping, setBootstrapping] = useState(true)

  const loadUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null)
      return null
    }
    const me = await authApi.me()
    setUser(me)
    return me
  }, [])

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      try {
        if (getAccessToken()) {
          await loadUser()
        }
      } catch {
        if (getRefreshToken()) {
          try {
            const tokens = await authApi.refresh(getRefreshToken())
            setTokens(tokens)
            await loadUser()
          } catch {
            clearTokens()
            if (!cancelled) setUser(null)
          }
        } else {
          clearTokens()
          if (!cancelled) setUser(null)
        }
      } finally {
        if (!cancelled) setBootstrapping(false)
      }
    }
    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [loadUser])

  const login = useCallback(async (email, password) => {
    const tokens = await authApi.login(email, password)
    setTokens(tokens)
    const me = await authApi.me()
    setUser(me)
    return me
  }, [])

  const logout = useCallback(async () => {
    const refresh_token = getRefreshToken()
    try {
      await authApi.logout(refresh_token)
    } catch {
      // ignore network errors on logout
    } finally {
      clearTokens()
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      bootstrapping,
      isAuthenticated: Boolean(user),
      login,
      logout,
      reloadUser: loadUser,
      can: (permission) => hasPermission(user, permission),
      isRole: (...roles) => hasRole(user, ...roles),
    }),
    [user, bootstrapping, login, logout, loadUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
