import { NavLink } from "react-router"

export const HomePage = () => (
  <div className="bg-canvas min-h-screen flex flex-col">

    {/* ── Hero ── */}
    <section className="flex-1 max-w-5xl mx-auto w-full px-6 flex flex-col justify-center py-24">
      <p className="text-[0.72rem] tracking-[0.25em] text-dim uppercase mb-6">
        MAISON STORE
      </p>
      <h1 className="text-[clamp(3rem,6.5vw,5.2rem)] font-semibold text-pale leading-[1.08] tracking-tight mb-6">
        新しい暮らしを、<br />
        もっとシンプルに。
      </h1>
      <p className="text-soft text-[1.05rem] leading-relaxed max-w-[480px] mb-10">
        日々の暮らしに溶け込む、厳選されたプロダクトをお届けします。
      </p>
      <div className="flex gap-4 flex-wrap">
        <NavLink
          to="/products"
          className="inline-flex items-center gap-2 px-7 py-3.5 bg-sage text-white text-[0.875rem] font-medium tracking-wide rounded no-underline transition-colors duration-150 hover:bg-[#4d6b54]"
        >
          商品を見る
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </NavLink>
        <NavLink
          to="/orders"
          className="inline-flex items-center gap-2 px-7 py-3.5 border border-border text-soft text-[0.875rem] font-medium tracking-wide rounded no-underline transition-colors duration-150 hover:border-sage hover:text-sage"
        >
          注文履歴
        </NavLink>
      </div>
    </section>

    {/* ── Footer ── */}
    <footer className="border-t border-border py-10 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <path d="M10 1L19 10L10 19L1 10Z" stroke="#6b8c72" strokeWidth="1.5" fill="none" />
            <path d="M10 5L15 10L10 15L5 10Z" fill="#6b8c72" opacity="0.4" />
          </svg>
          <span className="text-[0.78rem] font-semibold text-pale tracking-[0.12em]">MAISON</span>
        </div>
        <p className="text-[0.68rem] text-dim/70 tracking-wide text-center">
          Apache Kafka × React × TypeScript — Event-Driven Commerce Demo
        </p>
      </div>
    </footer>

  </div>
)
