import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router'

import { callback, login, logout, refresh, session, type Session } from './oidc'
import { useFlash } from '@/shared/Flash'

const Context = createContext<{
  session: Session | null
  login: () => Promise<void>
  logout: () => Promise<void>
} | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Session | null>(() => session())
  const location = useLocation()
  const navigate = useNavigate()
  const { flash } = useFlash()

  useEffect(() => {
    if (location.pathname !== '/auth/callback') return

    callback()
      .then((to) => {
        setCurrent(session())
        navigate(to, { replace: true })
      })
      .catch(() => navigate('/?login_error=1', { replace: true }))
  }, [location.pathname, navigate])

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh().then(setCurrent)
    }, 30_000)

    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const onError = (event: Event) => {
      const status = (event as CustomEvent<number>).detail

      if (status === 401) {
        flash('セッションが切れました。再ログインしてください。', 'error')
        void login(`${location.pathname}${location.search}`)
      } else if (status === 403) {
        flash('管理者権限が必要です。', 'error')
      }
    }

    window.addEventListener('sample-ec:auth-error', onError)
    return () => window.removeEventListener('sample-ec:auth-error', onError)
  }, [flash, location.pathname, location.search])

  return (
    <Context.Provider
      value={{
        session: current,
        login: () => login(`${location.pathname}${location.search}`),
        logout,
      }}
    >
      {children}
    </Context.Provider>
  )
}

export function useAuth() {
  const value = useContext(Context)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, login, logout } = useAuth()

  if (!session) {
    return (
      <main className="mx-auto max-w-xl space-y-4 p-10">
        <h1 className="text-xl text-pale">在庫管理へログイン</h1>
        <p className="text-soft">
          管理画面を開くにはZITADELでログインしてください。
        </p>
        <button
          className="rounded bg-sage px-4 py-2 text-white"
          onClick={() => void login()}
        >
          ログイン
        </button>
        <p className="text-sm text-dim">開発用: ec-admin / EcAdminOne1!</p>
      </main>
    )
  }

  if (session.roles.includes('admin')) {
    return <>{children}</>
  }

  return (
    <main className="mx-auto max-w-xl space-y-4 p-10">
      <h1 className="text-xl text-danger">管理者権限が必要です。</h1>
      <p className="text-soft">
        現在のアカウントには管理画面へのアクセス権がありません。ZITADEL
        からログアウトして、管理者アカウントでログインし直してください。
      </p>
      <button
        className="rounded bg-sage px-4 py-2 text-white"
        onClick={() => void logout()}
      >
        別のアカウントでログイン
      </button>
    </main>
  )
}
