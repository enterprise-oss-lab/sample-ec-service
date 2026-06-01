import { NavLink } from 'react-router'
import { PageHeader } from '@/shared/ui/PageHeader'

export const AccountPage = () => (
  <main className="mx-auto max-w-5xl px-6 py-10">
    <PageHeader label="Account" title="アカウント" />

    <div className="py-20 flex flex-col items-center gap-5 text-center">
      <div className="w-16 h-16 rounded-full bg-sage-light/50 flex items-center justify-center">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6b8c72" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
      <div>
        <p className="text-pale font-medium text-[0.95rem] mb-1">アカウント機能は準備中</p>
        <p className="text-dim text-[0.82rem]">ログイン・会員登録機能は現在実装中です。</p>
      </div>
      <NavLink
        to="/"
        className="text-[0.82rem] text-sage tracking-wide no-underline hover:text-[#4d6b54] transition-colors duration-150"
      >
        ← ホームに戻る
      </NavLink>
    </div>
  </main>
)
