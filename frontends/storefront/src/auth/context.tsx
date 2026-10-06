import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useFlash } from '@/shared/Flash'
import {
  beginLogin,
  clearSession,
  completeLogin,
  logout as endSession,
  readSession,
  refreshSession,
  type AuthSession,
} from './oidc'

type AuthContextValue = {
  session: AuthSession | null
  login: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() =>
    readSession(),
  )
  const location = useLocation()
  const navigate = useNavigate()
  const { flash } = useFlash()

  useEffect(() => {
    if (location.pathname !== '/auth/callback') return
    completeLogin()
      .then((returnTo) => {
        setSession(readSession())
        navigate(returnTo, { replace: true })
      })
      .catch(() => {
        clearSession()
        navigate('/account?login_error=1', { replace: true })
      })
  }, [location.pathname, navigate])
  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshSession().then(setSession)
    }, 30_000)
    return () => window.clearInterval(id)
  }, [])
  useEffect(() => {
    const onAuthError = (event: Event) => {
      const status = (event as CustomEvent<number>).detail
      if (status === 401) {
        flash('セッションが切れました。再ログインしてください。', 'error')
        void beginLogin(`${location.pathname}${location.search}`)
      }
      if (status === 403) flash('この操作を行う権限がありません。', 'error')
    }
    window.addEventListener('sample-ec:auth-error', onAuthError)
    return () => window.removeEventListener('sample-ec:auth-error', onAuthError)
  }, [flash, location.pathname, location.search])

  const value = useMemo(
    () => ({
      session,
      login: async () => beginLogin(`${location.pathname}${location.search}`),
      logout: async () => endSession(),
    }),
    [location.pathname, location.search, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, login } = useAuth()
  useEffect(() => {
    if (!session) void login()
  }, [session, login])
  return session ? <>{children}</> : null
}
