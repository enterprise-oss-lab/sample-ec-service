import { Outlet, NavLink } from 'react-router'
import { Flash } from '@/shared/Flash'

export const Layout = () => (
  <>
    <header className="border-b border-border bg-canvas">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center">
        <NavLink to="/" className="no-underline text-[0.95rem] font-semibold text-pale tracking-wide">
          在庫管理
        </NavLink>
      </div>
    </header>
    <Flash />
    <main className="max-w-5xl mx-auto px-6 py-8">
      <Outlet />
    </main>
  </>
)
