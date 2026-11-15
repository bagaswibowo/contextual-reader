import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { BookOpen, Library, Brain, Settings, Sun, Moon, Menu, X } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import { useBookStore } from '../stores'

const NAV_ITEMS = [
  { path: '/library', label: 'Perpustakaan', short: 'Buku', icon: Library },
  { path: '/vocabulary', label: 'Kosakata', short: 'Kosakata', icon: Brain },
  { path: '/settings', label: 'Pengaturan', short: 'Atur', icon: Settings },
]

function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border-2"
      style={{
        backgroundColor: 'var(--cr-btn-primary-bg)',
        borderColor: 'var(--cr-btn-primary-shadow)',
        color: 'var(--cr-btn-primary-text)',
        boxShadow: '0 3px 0 0 var(--cr-btn-primary-shadow)',
      }}
    >
      <BookOpen className="h-5 w-5" strokeWidth={2.6} />
    </span>
  )
}

export function Layout() {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const menuButtonRef = useRef(null)
  const { currentBook, clearCurrentBook } = useBookStore()

  const isReader = location.pathname.startsWith('/read')

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileMenuOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mobileMenuOpen])

  const goHome = () => {
    clearCurrentBook()
    navigate('/library')
  }

  const nextThemeLabel = theme === 'dark' ? 'Mode terang' : 'Mode gelap'

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--cr-bg-page)' }}>
      {/* Desktop rail */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r-2 px-4 py-6 lg:flex"
        style={{
          backgroundColor: 'var(--cr-bg-surface-elevated)',
          borderColor: 'var(--cr-border-subtle)',
        }}
      >
        <button
          type="button"
          onClick={goHome}
          className="flex items-center gap-3 rounded-2xl px-1 py-1 text-left"
        >
          <BrandMark />
          <span className="min-w-0">
            <span className="block font-heading text-[17px] font-extrabold leading-tight" style={{ color: 'var(--cr-text-primary)' }}>
              Contextual
            </span>
            <span className="block font-heading text-[17px] font-extrabold leading-tight" style={{ color: 'var(--cr-text-accent)' }}>
              Reader
            </span>
          </span>
        </button>

        <nav aria-label="Navigasi utama" className="mt-8 flex flex-col gap-1.5">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => clearCurrentBook()}
              className={({ isActive }) => `rail-link ${isActive ? 'is-active' : ''}`}
            >
              {({ isActive }) => (
                <>
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={isActive ? 2.6 : 2} aria-hidden="true" />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-3 pt-6">
          <button
            type="button"
            onClick={toggleTheme}
            className="rail-link w-full justify-start"
            aria-label={`Ganti ke ${nextThemeLabel.toLowerCase()}`}
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5 shrink-0" aria-hidden="true" />
            ) : (
              <Moon className="h-5 w-5 shrink-0" aria-hidden="true" />
            )}
            <span>{nextThemeLabel}</span>
          </button>

          {currentBook && !isReader && (
            <button
              type="button"
              onClick={() => navigate(`/read/${currentBook.id}`)}
              className="w-full rounded-2xl border-2 px-3 py-2.5 text-left"
              style={{
                borderColor: 'var(--cr-border-subtle)',
                backgroundColor: 'var(--cr-bg-surface)',
              }}
            >
              <span className="eyebrow block">Lanjut baca</span>
              <span
                className="mt-0.5 block truncate text-sm font-extrabold"
                style={{ color: 'var(--cr-text-primary)' }}
              >
                {currentBook.title}
              </span>
            </button>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b-2 px-4 py-3 lg:hidden"
        style={{
          backgroundColor: 'var(--cr-bg-surface-elevated)',
          borderColor: 'var(--cr-border-subtle)',
        }}
      >
        <button type="button" onClick={goHome} className="flex min-h-[48px] min-w-0 items-center gap-2.5 text-left">
          <BrandMark />
          <span className="min-w-0">
            <span className="block truncate font-heading text-base font-extrabold leading-tight" style={{ color: 'var(--cr-text-primary)' }}>
              Contextual Reader
            </span>
            <span className="eyebrow block">Baca, ketuk, paham</span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={toggleTheme}
            className="btn-ghost px-2"
            aria-label={`Ganti ke ${nextThemeLabel.toLowerCase()}`}
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Moon className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileMenuOpen(open => !open)}
            className="btn-ghost px-2"
            aria-label={mobileMenuOpen ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div
          id="mobile-menu"
          ref={menuRef}
          className="cr-anim-rise sticky top-[73px] z-30 border-b-2 px-4 py-3 lg:hidden"
          style={{
            backgroundColor: 'var(--cr-bg-surface-elevated)',
            borderColor: 'var(--cr-border-subtle)',
          }}
        >
          <nav aria-label="Navigasi seluler" className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                onClick={() => {
                  setMobileMenuOpen(false)
                  clearCurrentBook()
                }}
                className={({ isActive }) => `rail-link ${isActive ? 'is-active' : ''}`}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      )}

      <div className="lg:pl-[248px]">
        <main
          className={`mx-auto w-full max-w-[1180px] px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:pb-16 ${
            isReader ? 'max-w-[1020px]' : ''
          }`}
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tabs, hidden while reading for an immersive page */}
      {!isReader && (
        <nav
          aria-label="Navigasi bawah"
          className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t-2 px-2 pb-[env(safe-area-inset-bottom)] pt-1 lg:hidden"
          style={{
            backgroundColor: 'var(--cr-bg-surface-elevated)',
            borderColor: 'var(--cr-border-subtle)',
          }}
        >
          {NAV_ITEMS.map(({ path, short, icon: Icon }) => {
            const active = location.pathname.startsWith(path)
            return (
              <NavLink
                key={path}
                to={path}
                onClick={() => clearCurrentBook()}
                className={`mobile-tab ${active ? 'is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.6 : 2} aria-hidden="true" />
                <span>{short}</span>
              </NavLink>
            )
          })}
        </nav>
      )}
    </div>
  )
}
