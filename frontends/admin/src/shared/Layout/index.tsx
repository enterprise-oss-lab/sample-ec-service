import { Outlet, NavLink } from 'react-router'
import { Flash } from '@/shared/Flash'
import { useAuth } from '@/auth/context'

export const Layout = () => {
  const { logout } = useAuth()
  return (
    <>
      <header className="border-b border-border bg-canvas">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center">
          <NavLink
            to="/"
            className="no-underline text-[0.95rem] font-semibold text-pale tracking-wide"
          >
            在庫管理
          </NavLink>
          <button
            onClick={() => void logout()}
            className="ml-auto text-sm text-dim"
          >
            ログアウト
          </button>
        </div>
      </header>
      <Flash />
      <main className="max-w-5xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </>
  )
}
