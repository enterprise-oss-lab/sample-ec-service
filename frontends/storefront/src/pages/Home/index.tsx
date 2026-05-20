import React, { useState, useEffect, useRef } from "react"
import { NavLink } from "react-router"

// Runtime-only values that can't be expressed as static Tailwind classes
const ACCENT        = "#c8a46a"
const GREEN         = "#4caf7d"
const BLUE          = "#6ab4c8"
const BORDER_SUBTLE = "rgba(255, 255, 255, 0.05)"

// ─── Data ─────────────────────────────────────────────────────────────────────
const STREAM_EVENTS = [
  { type: "ORDER_PLACED",       color: "#4caf7d", topic: "ec.orders.v1",    partition: 0, offset: 10482 },
  { type: "INVENTORY_UPDATED",  color: "#6ab4c8", topic: "ec.inventory.v1", partition: 2, offset: 5931  },
  { type: "PAYMENT_PROCESSED",  color: "#c8a46a", topic: "ec.payments.v1",  partition: 1, offset: 8823  },
  { type: "SHIPMENT_CREATED",   color: "#a46ac8", topic: "ec.logistics.v1", partition: 0, offset: 10481 },
  { type: "USER_REGISTERED",    color: "#c86a88", topic: "ec.users.v1",     partition: 3, offset: 2104  },
  { type: "CART_UPDATED",       color: "#c8a46a", topic: "ec.cart.v1",      partition: 1, offset: 8824  },
  { type: "REVIEW_POSTED",      color: "#4caf7d", topic: "ec.reviews.v1",   partition: 2, offset: 1203  },
]

type Product = {
  id: string
  nameJa: string
  nameEn: string
  category: string
  price: number
  tag: string | null
}

const PRODUCTS: Product[] = [
  { id: "PRD-001", nameJa: "ミニマルウォッチ",         nameEn: "Minimal Watch",   category: "時計",         price: 48000,  tag: "人気" },
  { id: "PRD-002", nameJa: "レザートート",             nameEn: "Leather Tote",    category: "バッグ",       price: 128000, tag: "NEW"  },
  { id: "PRD-003", nameJa: "シルクスカーフ",           nameEn: "Silk Scarf",      category: "ファッション", price: 32000,  tag: null   },
  { id: "PRD-004", nameJa: "セラミックベース",         nameEn: "Ceramic Vase",    category: "インテリア",   price: 18000,  tag: null   },
  { id: "PRD-005", nameJa: "リネンジャケット",         nameEn: "Linen Jacket",    category: "ファッション", price: 84000,  tag: "人気" },
  { id: "PRD-006", nameJa: "ウォルナットデスクセット", nameEn: "Walnut Desk Set", category: "オフィス",     price: 56000,  tag: "NEW"  },
]

const STATS = [
  { label: "処理イベント数",    value: 2847382 },
  { label: "Kafkaトピック",    value: 8       },
  { label: "パーティション数", value: 24      },
  { label: "コンシューマー",   value: 12      },
]

// ─── Event Ticker ─────────────────────────────────────────────────────────────
const EventTicker = () => {
  const doubled = [...STREAM_EVENTS, ...STREAM_EVENTS]
  return (
    <div className="border-b border-gold/12 bg-panel overflow-hidden h-[38px] flex items-center">
      {/* LIVE badge */}
      <div className="shrink-0 flex items-center gap-2 px-5 border-r border-gold/12 h-full bg-panel relative z-10">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse-dot"
          style={{ backgroundColor: GREEN }}
        />
        <span
          className="text-[0.6rem] font-mono tracking-[0.14em] font-semibold whitespace-nowrap"
          style={{ color: GREEN }}
        >
          KAFKA STREAM
        </span>
      </div>

      {/* Scrolling events */}
      <div
        className="flex-1 overflow-hidden"
        style={{
          WebkitMaskImage: "linear-gradient(to right, transparent, black 4%, black 96%, transparent)",
          maskImage: "linear-gradient(to right, transparent, black 4%, black 96%, transparent)",
        }}
      >
        <div className="flex animate-ticker w-max">
          {doubled.map((evt, i) => (
            <div key={i} className="flex items-center gap-2 px-6 h-[38px] shrink-0 border-r border-white/5">
              <span
                className="w-[5px] h-[5px] rounded-full shrink-0"
                style={{ backgroundColor: evt.color }}
              />
              <span
                className="font-mono text-[0.66rem] font-semibold tracking-[0.04em] whitespace-nowrap"
                style={{ color: evt.color }}
              >
                {evt.type}
              </span>
              <span className="font-mono text-[0.6rem] text-dim tracking-[0.02em] whitespace-nowrap">
                {evt.topic} · p{evt.partition} · @{evt.offset}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Kafka Pipeline Diagram ───────────────────────────────────────────────────
const KafkaPipeline = () => {
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setActiveIdx(i => (i + 1) % STREAM_EVENTS.length), 2200)
    return () => clearInterval(id)
  }, [])

  const evt = STREAM_EVENTS[activeIdx]
  const consumers = ["Order Service", "Inventory", "Payments"]

  return (
    <section className="border-t border-b border-white/5 py-14 px-6">
      <div className="max-w-[1000px] mx-auto">
        <p className="text-[0.6rem] tracking-[0.2em] text-dim uppercase font-mono mb-9 text-center">
          Event-Driven Architecture
        </p>

        <div className="overflow-x-auto">
          <div className="flex items-center min-w-[600px]">

            {/* Producer */}
            <div className="shrink-0 w-[148px] p-4 border border-gold/12 rounded-[3px] bg-panel">
              <div className="text-[0.54rem] tracking-[0.14em] text-dim mb-1.5 font-mono uppercase">
                PRODUCER
              </div>
              <div className="text-[0.84rem] font-semibold text-pale">Storefront</div>
              <div
                className="mt-2.5 text-[0.58rem] font-mono transition-colors duration-500"
                style={{ color: evt.color }}
              >
                → {evt.type}
              </div>
            </div>

            {/* Arrow + Topic label */}
            <div className="relative flex-1 flex items-center justify-center px-2">
              <div
                className="absolute h-px inset-x-0"
                style={{
                  background: `linear-gradient(to right, ${evt.color}30, ${evt.color}70, ${evt.color}30)`,
                  transition: "background 0.5s ease",
                }}
              />
              <div
                className="relative px-3 py-[5px] bg-canvas text-[0.57rem] font-mono tracking-[0.06em] rounded-[2px] whitespace-nowrap border transition-all duration-500"
                style={{ borderColor: `${evt.color}40`, color: evt.color }}
              >
                {evt.topic}
              </div>
            </div>

            {/* Kafka Broker */}
            <div
              className="shrink-0 w-[148px] p-4 rounded-[3px] bg-panel transition-all duration-500"
              style={{
                border: `1px solid ${evt.color}35`,
                boxShadow: `0 0 20px ${evt.color}08`,
              }}
            >
              <div className="text-[0.54rem] tracking-[0.14em] text-dim mb-1.5 font-mono uppercase">
                BROKER
              </div>
              <div className="text-[0.84rem] font-semibold text-pale">Apache Kafka</div>
              <div className="mt-2.5 flex gap-[3px]">
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    className="w-4 h-[5px] rounded-[1px] transition-colors duration-500"
                    style={{ backgroundColor: i <= evt.partition ? `${evt.color}80` : BORDER_SUBTLE }}
                  />
                ))}
              </div>
              <div className="mt-[5px] text-[0.54rem] text-dim font-mono">
                p{evt.partition} @{evt.offset}
              </div>
            </div>

            {/* Arrow */}
            <div className="relative flex-1 h-px">
              <div
                className="absolute inset-x-0 h-px"
                style={{
                  background: `linear-gradient(to right, ${evt.color}70, ${evt.color}30)`,
                  transition: "background 0.5s ease",
                }}
              />
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0"
                style={{
                  borderTop: "4px solid transparent",
                  borderBottom: "4px solid transparent",
                  borderLeft: `6px solid ${evt.color}60`,
                }}
              />
            </div>

            {/* Consumers */}
            <div className="shrink-0 w-[148px] flex flex-col gap-[5px]">
              {consumers.map((svc, i) => (
                <div
                  key={svc}
                  className="px-[11px] py-[7px] rounded-[3px] bg-panel text-[0.7rem] transition-all duration-500 flex items-center gap-1.5"
                  style={{
                    border: `1px solid ${i === 0 ? `${evt.color}40` : BORDER_SUBTLE}`,
                    color: i === 0 ? "#c2b8ae" : "#7a726a",
                  }}
                >
                  <span
                    className="w-1 h-1 rounded-full shrink-0 transition-colors duration-500"
                    style={{ backgroundColor: i === 0 ? evt.color : BORDER_SUBTLE }}
                  />
                  {svc}
                </div>
              ))}
              <div className="px-[11px] py-[5px] text-[0.58rem] text-dim tracking-[0.06em] font-mono">
                + more consumers
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Product thumbnail (abstract SVG) ─────────────────────────────────────────
const ProductThumb = ({ id }: { id: string }) => {
  const col = ACCENT
  const map: Record<string, React.JSX.Element> = {
    "PRD-001": (
      <svg viewBox="0 0 120 120" className="w-full h-full">
        <circle cx="60" cy="60" r="30" fill="none" stroke={col} strokeWidth="2" opacity="0.5" />
        <circle cx="60" cy="60" r="20" fill={`${col}14`} />
        <line x1="60" y1="60" x2="60" y2="44" stroke={col} strokeWidth="2" strokeLinecap="round" />
        <line x1="60" y1="60" x2="73" y2="60" stroke={col} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <circle cx="60" cy="60" r="2.5" fill={col} />
        <rect x="53" y="21" width="14" height="10" rx="2.5" fill="none" stroke="#7a726a" strokeWidth="1.2" />
        <rect x="53" y="89" width="14" height="10" rx="2.5" fill="none" stroke="#7a726a" strokeWidth="1.2" />
      </svg>
    ),
    "PRD-002": (
      <svg viewBox="0 0 120 120" className="w-full h-full">
        <path d="M32 52 Q30 88 32 98 L88 98 Q90 88 88 52 Z" fill={`${col}12`} stroke={col} strokeWidth="1.5" opacity="0.6" />
        <path d="M47 52 Q46 38 60 34 Q74 38 73 52" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" opacity="0.8" />
        <line x1="32" y1="65" x2="88" y2="65" stroke="#7a726a" strokeWidth="1" opacity="0.4" />
        <line x1="60" y1="65" x2="60" y2="98" stroke="#7a726a" strokeWidth="0.8" opacity="0.3" />
      </svg>
    ),
    "PRD-003": (
      <svg viewBox="0 0 120 120" className="w-full h-full">
        <path d="M15 55 Q32 35 50 55 Q68 75 85 55 Q102 35 120 55" fill="none" stroke={col} strokeWidth="2.5" opacity="0.7" strokeLinecap="round" />
        <path d="M15 67 Q32 47 50 67 Q68 87 85 67 Q102 47 120 67" fill="none" stroke={col} strokeWidth="1.5" opacity="0.35" strokeLinecap="round" />
        <path d="M15 43 Q32 23 50 43 Q68 63 85 43 Q102 23 120 43" fill="none" stroke={col} strokeWidth="1" opacity="0.2" strokeLinecap="round" />
      </svg>
    ),
    "PRD-004": (
      <svg viewBox="0 0 120 120" className="w-full h-full">
        <path d="M48 28 Q37 48 36 70 Q35 88 40 98 L80 98 Q85 88 84 70 Q83 48 72 28 Z" fill={`${col}10`} stroke={col} strokeWidth="1.5" opacity="0.6" />
        <ellipse cx="60" cy="28" rx="12" ry="5" fill="none" stroke={col} strokeWidth="1.5" opacity="0.55" />
        <path d="M40 66 Q60 61 80 66" fill="none" stroke="#7a726a" strokeWidth="1" opacity="0.35" />
      </svg>
    ),
    "PRD-005": (
      <svg viewBox="0 0 120 120" className="w-full h-full">
        <path d="M28 42 L18 62 L22 100 L54 100 L54 58 Z" fill={`${col}10`} stroke={col} strokeWidth="1.5" opacity="0.55" />
        <path d="M92 42 L102 62 L98 100 L66 100 L66 58 Z" fill={`${col}10`} stroke={col} strokeWidth="1.5" opacity="0.55" />
        <path d="M28 42 Q40 18 60 18 Q80 18 92 42 L66 58 L60 46 L54 58 Z" fill="none" stroke={col} strokeWidth="1.5" opacity="0.7" />
        <line x1="54" y1="58" x2="54" y2="100" stroke="#7a726a" strokeWidth="0.8" opacity="0.4" />
        <line x1="66" y1="58" x2="66" y2="100" stroke="#7a726a" strokeWidth="0.8" opacity="0.4" />
      </svg>
    ),
    "PRD-006": (
      <svg viewBox="0 0 120 120" className="w-full h-full">
        <rect x="22" y="72" width="76" height="9" rx="2" fill={`${col}12`} stroke={col} strokeWidth="1.5" opacity="0.6" />
        <rect x="36" y="46" width="14" height="27" rx="2" fill="none" stroke={col} strokeWidth="1.5" opacity="0.55" />
        <rect x="55" y="36" width="11" height="37" rx="2" fill="none" stroke={col} strokeWidth="1.5" opacity="0.55" />
        <rect x="71" y="52" width="9" height="21" rx="2" fill="none" stroke={col} strokeWidth="1.5" opacity="0.45" />
      </svg>
    ),
  }
  return map[id] ?? <svg viewBox="0 0 120 120" className="w-full h-full" />
}

// ─── Product Card ─────────────────────────────────────────────────────────────
const ProductCard = ({ product, index }: { product: Product; index: number }) => (
  <div
    className="group bg-panel hover:bg-panel-hover p-7 cursor-pointer transition-colors duration-[220ms] flex flex-col relative animate-fade-in-up"
    style={{ animationDelay: `${index * 0.07}s` }}
  >
    {product.tag && (
      <div
        className="absolute top-4 right-4 text-[0.57rem] font-bold tracking-[0.12em] px-2 py-[3px] rounded-[1px] border font-mono"
        style={{
          color: product.tag === "NEW" ? BLUE : ACCENT,
          borderColor: product.tag === "NEW" ? `${BLUE}50` : `${ACCENT}50`,
        }}
      >
        {product.tag}
      </div>
    )}

    <div className="h-[140px] flex items-center justify-center mb-5 opacity-[0.68] group-hover:opacity-100 group-hover:scale-105 transition-all duration-300">
      <ProductThumb id={product.id} />
    </div>

    <p className="text-[0.57rem] tracking-[0.15em] text-dim uppercase mb-[5px] font-mono">
      {product.category} · {product.id}
    </p>
    <h3 className="font-display text-[1.25rem] font-medium text-pale mb-[2px] tracking-[0.02em]">
      {product.nameJa}
    </h3>
    <p className="text-[0.74rem] text-dim tracking-[0.04em] mb-[18px]">
      {product.nameEn}
    </p>

    <div className="flex items-center justify-between mt-auto">
      <span className="font-display text-[1.1rem] font-medium text-gold tracking-[0.03em]">
        ¥{product.price.toLocaleString()}
      </span>
      <button className="px-[14px] py-[7px] border border-gold/12 text-dim group-hover:border-gold/50 group-hover:text-gold text-[0.63rem] tracking-[0.1em] uppercase cursor-pointer transition-all duration-[220ms] rounded-[1px] font-mono bg-transparent">
        カートへ
      </button>
    </div>
  </div>
)

// ─── Animated counter ─────────────────────────────────────────────────────────
const Counter = ({ target }: { target: number }) => {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const dur = 1600
        const start = performance.now()
        const tick = (now: number) => {
          const t = Math.min((now - start) / dur, 1)
          setCount(Math.round((1 - Math.pow(1 - t, 3)) * target))
          if (t < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [target])

  return <span ref={ref}>{count.toLocaleString()}</span>
}

// ─── Stats Section ────────────────────────────────────────────────────────────
const StatsSection = () => (
  <section className="bg-panel border-t border-b border-white/5 py-[60px] px-6">
    <div className="max-w-7xl mx-auto">
      <p className="text-[0.6rem] tracking-[0.2em] text-dim uppercase font-mono mb-10 text-center">
        Live Metrics
      </p>
      <div
        className="grid gap-px border border-white/5"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          backgroundColor: BORDER_SUBTLE,
        }}
      >
        {STATS.map(stat => (
          <div key={stat.label} className="bg-panel py-7 px-6 text-center">
            <div className="font-display text-[2.4rem] font-medium text-gold leading-none mb-2">
              <Counter target={stat.value} />
            </div>
            <div className="text-[0.64rem] tracking-[0.15em] text-dim uppercase font-mono">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
)

// ─── Home Page ────────────────────────────────────────────────────────────────
export const HomePage = () => {
  useEffect(() => {
    const id = "home-page-fonts"
    if (document.getElementById(id)) return
    const link = document.createElement("link")
    link.id = id
    link.rel = "stylesheet"
    link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500;600&display=swap"
    document.head.appendChild(link)
  }, [])

  return (
    <div className="bg-canvas min-h-screen text-soft">

      {/* ── Kafka Event Ticker ── */}
      <EventTicker />

      {/* ── Hero ── */}
      <section className="max-w-7xl mx-auto px-6 pt-[72px] pb-[60px] relative">
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 pointer-events-none opacity-50"
          style={{
            backgroundImage: [
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
              "linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            ].join(", "),
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative max-w-[680px]">
          {/* Kafka badge */}
          <div className="inline-flex items-center gap-2 px-[14px] py-[6px] border border-gold/12 rounded-[2px] bg-gold/6 mb-7">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse-dot"
              style={{ backgroundColor: GREEN }}
            />
            <span className="font-mono text-[0.68rem] tracking-[0.1em] text-gold font-semibold">
              Apache Kafka
            </span>
            <span className="font-mono text-[0.62rem] text-dim">
              Event-Driven Demo
            </span>
          </div>

          <h1
            className="font-display font-medium text-pale leading-[1.06] tracking-[-0.01em] mb-[6px]"
            style={{ fontSize: "clamp(2.8rem, 6vw, 4.8rem)" }}
          >
            イベント駆動型
            <br />
            <em className="text-gold not-italic font-display" style={{ fontStyle: "italic" }}>コマース</em>
          </h1>
          <p className="font-display text-[1.05rem] text-dim tracking-[0.15em] mb-6">
            Event-Driven Commerce
          </p>

          <p className="text-soft text-[0.9rem] leading-[1.8] max-w-[500px] tracking-[0.03em] mb-9">
            Apache Kafka のリアルタイムイベントストリームを活用した
            ECサイトのデモです。注文・在庫・決済・物流の各サービスが
            Kafka トピックを介して非同期に連携しています。
          </p>

          <div className="flex gap-[14px] flex-wrap">
            <NavLink
              to="/products"
              className="inline-flex items-center gap-2 px-[26px] py-[13px] bg-gold text-canvas text-[0.78rem] font-bold tracking-[0.12em] uppercase rounded-[2px] no-underline transition-colors duration-200 hover:bg-[#d4b07a]"
            >
              商品を見る
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </NavLink>

            <NavLink
              to="/orders"
              className="inline-flex items-center gap-2 px-[26px] py-[13px] border border-gold/12 text-soft text-[0.78rem] font-medium tracking-[0.1em] uppercase rounded-[2px] no-underline transition-all duration-200 hover:border-gold/50 hover:text-gold"
            >
              注文履歴
            </NavLink>
          </div>
        </div>
      </section>

      {/* ── Kafka Architecture ── */}
      <KafkaPipeline />

      {/* ── Featured Products ── */}
      <section className="max-w-7xl mx-auto px-6 py-[72px]">
        <div className="flex items-end justify-between mb-11">
          <div>
            <p className="text-[0.6rem] tracking-[0.2em] text-dim uppercase font-mono mb-2">
              Featured Products
            </p>
            <h2 className="font-display text-[2rem] font-medium text-pale tracking-[0.02em]">
              注目商品
            </h2>
          </div>
          <NavLink
            to="/products"
            className="text-[0.72rem] text-gold no-underline tracking-[0.1em] flex items-center gap-1.5 border-b border-gold/25 pb-[2px]"
          >
            すべて見る
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </NavLink>
        </div>

        <div
          className="grid gap-px border border-white/5"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            backgroundColor: BORDER_SUBTLE,
          }}
        >
          {PRODUCTS.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
        </div>
      </section>

      {/* ── Live Metrics ── */}
      <StatsSection />

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-8 px-6 text-center">
        <p className="text-[0.66rem] text-dim tracking-[0.1em] font-mono">
          Apache Kafka × React × TypeScript — Event-Driven Commerce Demo
        </p>
      </footer>

    </div>
  )
}
