import { useState, useEffect, useRef, type ReactNode } from "react"
import { NavLink } from "react-router"
import { useFlash } from "@/shared/Flash"

const NAV_ITEMS = [
  { to: "/", label: "ホーム", end: true },
  { to: "/products", label: "商品一覧", end: false },
  { to: "/orders", label: "注文履歴", end: false },
]

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
)

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const BagIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
)

interface IconButtonProps {
  onClick?: () => void
  "aria-label": string
  active?: boolean
  children: ReactNode
  className?: string
}

const IconButton = ({ onClick, "aria-label": ariaLabel, active, children, className = "" }: IconButtonProps) => (
  <button
    onClick={onClick}
    aria-label={ariaLabel}
    className={`relative p-2.5 transition-colors duration-200 cursor-pointer hover:text-gold ${active ? "text-gold" : "text-soft"} ${className}`}
  >
    {children}
  </button>
)

export const Header = () => {
  const { flash } = useFlash()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [scrolled, setScrolled] = useState(false)
  const [cartCount] = useState(2)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 60)
  }, [searchOpen])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [menuOpen])

  useEffect(() => {
    const id = "header-font-cormorant"
    if (document.getElementById(id)) return
    const link = document.createElement("link")
    link.id = id
    link.rel = "stylesheet"
    link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&display=swap"
    document.head.appendChild(link)
  }, [])

  const closeAll = () => {
    setMenuOpen(false)
    setSearchOpen(false)
  }

  const toggleSearch = () => {
    setSearchOpen(prev => !prev)
    if (menuOpen) setMenuOpen(false)
  }

  const toggleMenu = () => {
    setMenuOpen(prev => !prev)
    if (searchOpen) setSearchOpen(false)
  }

  return (
    <>
      {/* ─── Fixed header ─── */}
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b ${
          scrolled ? "bg-canvas/92 border-gold/12" : "bg-canvas border-white/5"
        }`}
        style={{
          backdropFilter: scrolled ? "blur(16px) saturate(1.4)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(16px) saturate(1.4)" : "none",
          transition: "background-color 0.4s ease, border-color 0.4s ease, backdrop-filter 0.4s ease",
        }}
      >
        <div className="max-w-[1280px] mx-auto px-6">
          {/* Main row */}
          <div className="flex items-center justify-between h-16">

            {/* ── Logo ── */}
            <NavLink to="/" onClick={closeAll} className="no-underline flex items-center gap-[10px]">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 1L19 10L10 19L1 10Z" stroke="#c8a46a" strokeWidth="1.5" fill="none" />
                <path d="M10 5L15 10L10 15L5 10Z" fill="#c8a46a" opacity="0.35" />
              </svg>
              <span className="font-display text-[1.35rem] font-semibold text-pale tracking-[0.18em] leading-none">
                MAISON
              </span>
            </NavLink>

            {/* ── Desktop nav ── */}
            <nav className="hidden md:flex items-center gap-8">
              {NAV_ITEMS.map(({ to, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={closeAll}
                  className={({ isActive }) =>
                    `group relative no-underline text-[0.8125rem] font-medium tracking-[0.09em] pb-1 transition-colors duration-200 hover:text-gold ${isActive ? "text-gold" : "text-soft"}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {label}
                      <span
                        className={`absolute bottom-0 left-0 h-px bg-gold transition-[width] duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${isActive ? "w-full" : "w-0 group-hover:w-full"}`}
                      />
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* ── Action icons ── */}
            <div className="flex items-center gap-[2px]">
              {/* Search toggle */}
              <IconButton onClick={toggleSearch} aria-label="検索" active={searchOpen}>
                <SearchIcon />
              </IconButton>

              {/* Account */}
              <NavLink
                to="/account"
                onClick={closeAll}
                className="text-soft hover:text-gold flex p-[10px] transition-colors duration-200"
              >
                <UserIcon />
              </NavLink>

              {/* Cart */}
              <NavLink
                to="/cart"
                onClick={closeAll}
                className="text-soft hover:text-gold flex p-[10px] relative transition-colors duration-200"
                aria-label={`カート (${cartCount}点)`}
              >
                <BagIcon />
                {cartCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-gold text-canvas text-[10px] font-bold flex items-center justify-center leading-none">
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </NavLink>

              {/* Hamburger (mobile only) */}
              <button
                onClick={toggleMenu}
                aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"}
                aria-expanded={menuOpen}
                className="flex md:hidden p-[10px] cursor-pointer bg-transparent border-none"
              >
                <div className="w-[22px] h-4 relative flex flex-col justify-between">
                  {[
                    { transform: menuOpen ? "rotate(45deg) translate(3px, 3px)" : "none" },
                    { transform: menuOpen ? "scaleX(0)" : "scaleX(1)", transformOrigin: "right center" },
                    { transform: menuOpen ? "rotate(-45deg) translate(3px, -3px)" : "none" },
                  ].map((s, i) => (
                    <span
                      key={i}
                      className="block h-[1.5px] bg-soft rounded-[1px] transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                      style={s}
                    />
                  ))}
                </div>
              </button>
            </div>
          </div>

          {/* ── Search drawer ── */}
          <div
            className={`overflow-hidden transition-[height,border-color] duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)] border-t ${
              searchOpen ? "h-14 border-gold/12" : "h-0 border-transparent"
            }`}
          >
            <div className="flex items-center gap-3 h-14">
              <span className="text-dim shrink-0">
                <SearchIcon />
              </span>
              <input
                ref={searchRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    flash("検索機能はまだ実装していません", "error")
                    setSearchOpen(false)
                    setSearchQuery("")
                  }
                }}
                placeholder="商品名・カテゴリで検索..."
                className="flex-1 bg-transparent border-none outline-none text-pale text-[0.9rem] tracking-[0.03em] caret-gold"
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="text-dim hover:text-soft text-[0.7rem] tracking-[0.12em] uppercase bg-transparent border-none cursor-pointer shrink-0 transition-colors duration-200 py-1"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Mobile menu overlay ─── */}
      <div
        aria-hidden={!menuOpen}
        className={`fixed inset-0 z-40 bg-canvas flex flex-col pt-20 px-9 overflow-y-auto transition-transform duration-[420ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
          menuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Decorative line */}
        <div
          className="w-8 h-px bg-gold mb-10 transition-opacity duration-300 delay-200"
          style={{ opacity: menuOpen ? 1 : 0 }}
        />

        {/* Nav links */}
        <nav className="flex flex-col">
          {NAV_ITEMS.map(({ to, label, end }, i) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={closeAll}
              className="no-underline py-[14px] border-b border-white/5 font-display text-[2.6rem] font-medium leading-[1.1] tracking-[0.04em] transition-[opacity,transform]"
              style={({ isActive }) => ({
                color: isActive ? "#c8a46a" : "#e8e0d8",
                opacity: menuOpen ? 1 : 0,
                transform: menuOpen ? "translateX(0)" : "translateX(24px)",
                transitionDuration: "0.4s",
                transitionDelay: `${i * 0.08 + 0.18}s`,
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Mobile footer actions */}
        <div
          className="mt-auto pt-8 pb-12 flex gap-6 transition-opacity duration-[400ms]"
          style={{ opacity: menuOpen ? 1 : 0, transitionDelay: "0.45s" }}
        >
          <NavLink to="/account" onClick={closeAll} className="text-dim text-[0.8rem] tracking-[0.1em] no-underline">
            アカウント
          </NavLink>
          <NavLink to="/cart" onClick={closeAll} className="text-dim text-[0.8rem] tracking-[0.1em] no-underline">
            カート {cartCount > 0 && `(${cartCount})`}
          </NavLink>
        </div>
      </div>

      {/* Header height spacer */}
      <div className="h-16" />
    </>
  )
}
