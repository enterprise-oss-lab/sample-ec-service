import { NavLink } from 'react-router'
import { PageHeader } from '@/shared/ui/PageHeader'

export const CartPage = () => (
  <main className="mx-auto max-w-5xl px-6 py-10">
    <PageHeader label="Cart" title="カート" />

    <div className="py-20 flex flex-col items-center gap-5 text-center">
      <div className="w-16 h-16 rounded-full bg-sage-light/50 flex items-center justify-center">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6b8c72" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      </div>
      <div>
        <p className="text-pale font-medium text-[0.95rem] mb-1">カートは空です</p>
        <p className="text-dim text-[0.82rem]">カート機能は現在実装中です。</p>
      </div>
      <NavLink
        to="/products"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-sage text-white text-[0.82rem] font-medium tracking-wide rounded no-underline transition-colors duration-150 hover:bg-[#4d6b54]"
      >
        商品一覧を見る
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </NavLink>
    </div>
  </main>
)
