import { useState, useEffect, useRef } from "react"
import { NavLink } from "react-router"

const NAV_ITEMS = [
  { to: "/", label: "ホーム", end: true },
  { to: "/products", label: "商品一覧", end: false },
  { to: "/orders", label: "注文履歴", end: false },
]

const C = {
  bg: "#0c0e10",
  bgScroll: "rgba(12, 14, 16, 0.92)",
  text: "#c2b8ae",
  textMuted: "#7a726a",
  accent: "#c8a46a",
  surface: "#161a1e",
  border: "rgba(200, 164, 106, 0.12)",
  borderSubtle: "rgba(255, 255, 255, 0.05)",
} as const

// Inline SVG icons
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
  children: React.ReactNode
  className?: string
}

const IconButton = ({ onClick, "aria-label": ariaLabel, active, children, className = "" }: IconButtonProps) => (
  <button
    onClick={onClick}
    aria-label={ariaLabel}
    className={`relative p-2.5 transition-all duration-200 cursor-pointer ${className}`}
    style={{ color: active ? C.accent : C.text }}
    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = C.accent }}
    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = C.text }}
  >
    {children}
  </button>
)

export const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  // Replace with real cart context/state
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

  // Load Cormorant Garamond for the logo
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
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          backgroundColor: scrolled ? C.bgScroll : C.bg,
          backdropFilter: scrolled ? "blur(16px) saturate(1.4)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(16px) saturate(1.4)" : "none",
          borderBottom: `1px solid ${scrolled ? C.border : C.borderSubtle}`,
          transition: "background-color 0.4s ease, border-color 0.4s ease, backdrop-filter 0.4s ease",
        }}
      >
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 1.5rem" }}>
          {/* Main row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "64px" }}>

            {/* ── Logo ── */}
            <NavLink
              to="/"
              onClick={closeAll}
              style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "10px" }}
            >
              {/* Diamond mark */}
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 1L19 10L10 19L1 10Z" stroke={C.accent} strokeWidth="1.5" fill="none" />
                <path d="M10 5L15 10L10 15L5 10Z" fill={C.accent} opacity="0.35" />
              </svg>
              <span style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "1.35rem",
                fontWeight: 600,
                color: "#f0ebe4",
                letterSpacing: "0.18em",
                lineHeight: 1,
              }}>
                MAISON
              </span>
            </NavLink>

            {/* ── Desktop nav ── */}
            <nav style={{ display: "flex", alignItems: "center", gap: "2rem" }} className="hidden md:flex">
              {NAV_ITEMS.map(({ to, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={closeAll}
                  style={({ isActive }) => ({
                    position: "relative",
                    textDecoration: "none",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    letterSpacing: "0.09em",
                    color: isActive ? C.accent : C.text,
                    transition: "color 0.2s ease",
                    paddingBottom: "4px",
                  })}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLAnchorElement
                    const line = el.querySelector(".nav-line") as HTMLElement
                    if (line) line.style.width = "100%"
                    el.style.color = C.accent
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLAnchorElement
                    const line = el.querySelector(".nav-line") as HTMLElement
                    if (line && !el.getAttribute("aria-current")) line.style.width = "0%"
                    if (!el.getAttribute("aria-current")) el.style.color = C.text
                  }}
                >
                  {({ isActive }) => (
                    <>
                      {label}
                      <span
                        className="nav-line"
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          height: "1px",
                          width: isActive ? "100%" : "0%",
                          backgroundColor: C.accent,
                          transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                      />
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* ── Action icons ── */}
            <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
              {/* Search toggle */}
              <IconButton onClick={toggleSearch} aria-label="検索" active={searchOpen}>
                <SearchIcon />
              </IconButton>

              {/* Account */}
              <NavLink
                to="/account"
                onClick={closeAll}
                style={{ color: C.text, display: "flex", padding: "10px" }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = C.accent)}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = C.text)}
              >
                <UserIcon />
              </NavLink>

              {/* Cart */}
              <NavLink
                to="/cart"
                onClick={closeAll}
                style={{ color: C.text, display: "flex", padding: "10px", position: "relative" }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = C.accent)}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = C.text)}
                aria-label={`カート (${cartCount}点)`}
              >
                <BagIcon />
                {cartCount > 0 && (
                  <span style={{
                    position: "absolute",
                    top: "6px",
                    right: "6px",
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    backgroundColor: C.accent,
                    color: C.bg,
                    fontSize: "10px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                  }}>
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </NavLink>

              {/* Hamburger (mobile only) */}
              <button
                onClick={toggleMenu}
                aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"}
                aria-expanded={menuOpen}
                style={{
                  display: "none",
                  padding: "10px",
                  cursor: "pointer",
                  background: "none",
                  border: "none",
                }}
                className="flex md:hidden"
              >
                <div style={{ width: "22px", height: "16px", position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  {[
                    { transform: menuOpen ? "rotate(45deg) translate(3px, 3px)" : "none" },
                    { transform: menuOpen ? "scaleX(0)" : "scaleX(1)", transformOrigin: "right center" },
                    { transform: menuOpen ? "rotate(-45deg) translate(3px, -3px)" : "none" },
                  ].map((style, i) => (
                    <span
                      key={i}
                      style={{
                        display: "block",
                        height: "1.5px",
                        backgroundColor: C.text,
                        borderRadius: "1px",
                        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        ...style,
                      }}
                    />
                  ))}
                </div>
              </button>
            </div>
          </div>

          {/* ── Search drawer ── */}
          <div
            style={{
              height: searchOpen ? "56px" : "0",
              overflow: "hidden",
              transition: "height 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
              borderTop: searchOpen ? `1px solid ${C.border}` : "1px solid transparent",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", height: "56px" }}>
              <span style={{ color: C.textMuted, flexShrink: 0 }}>
                <SearchIcon />
              </span>
              <input
                ref={searchRef}
                type="search"
                placeholder="商品名・カテゴリで検索..."
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#f0ebe4",
                  fontSize: "0.9rem",
                  letterSpacing: "0.03em",
                  caretColor: C.accent,
                }}
              />
              <button
                onClick={() => setSearchOpen(false)}
                style={{
                  color: C.textMuted,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.7rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  padding: "4px 0",
                  transition: "color 0.2s ease",
                  flexShrink: 0,
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = C.text)}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = C.textMuted)}
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
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 40,
          backgroundColor: C.bg,
          transform: menuOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.42s cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          paddingTop: "80px",
          paddingLeft: "36px",
          paddingRight: "36px",
          overflowY: "auto",
        }}
      >
        {/* Decorative line */}
        <div style={{ width: "32px", height: "1px", backgroundColor: C.accent, marginBottom: "40px", opacity: menuOpen ? 1 : 0, transition: "opacity 0.3s ease 0.2s" }} />

        {/* Nav links */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "0" }}>
          {NAV_ITEMS.map(({ to, label, end }, i) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={closeAll}
              style={({ isActive }) => ({
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "2.6rem",
                fontWeight: 500,
                letterSpacing: "0.04em",
                color: isActive ? C.accent : "#e8e0d8",
                textDecoration: "none",
                padding: "14px 0",
                borderBottom: `1px solid ${C.borderSubtle}`,
                opacity: menuOpen ? 1 : 0,
                transform: menuOpen ? "translateX(0)" : "translateX(24px)",
                transition: `opacity 0.4s ease ${i * 0.08 + 0.18}s, transform 0.4s ease ${i * 0.08 + 0.18}s`,
                lineHeight: 1.1,
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Mobile footer actions */}
        <div
          style={{
            marginTop: "auto",
            paddingTop: "32px",
            paddingBottom: "48px",
            display: "flex",
            gap: "24px",
            opacity: menuOpen ? 1 : 0,
            transition: "opacity 0.4s ease 0.45s",
          }}
        >
          <NavLink
            to="/account"
            onClick={closeAll}
            style={{ color: C.textMuted, fontSize: "0.8rem", letterSpacing: "0.1em", textDecoration: "none" }}
          >
            アカウント
          </NavLink>
          <NavLink
            to="/cart"
            onClick={closeAll}
            style={{ color: C.textMuted, fontSize: "0.8rem", letterSpacing: "0.1em", textDecoration: "none" }}
          >
            カート {cartCount > 0 && `(${cartCount})`}
          </NavLink>
        </div>
      </div>

      {/* Header height spacer */}
      <div style={{ height: "64px" }} />
    </>
  )
}
