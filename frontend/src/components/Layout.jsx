import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { BookOpen, Library, Brain, Settings, Menu, X, Sun, Moon, ChevronDown } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import { useBookStore } from '../stores'

export function Layout() {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { currentBook, clearCurrentBook } = useBookStore()

  const navItems = [
    { path: '/library', label: 'Perpustakaan', icon: Library },
    { path: '/vocabulary', label: 'Kosakata', icon: Brain },
    { path: '/settings', label: 'Pengaturan', icon: Settings },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-dark-bg">
      {/* Header */}
      <header className="bg-white dark:bg-dark-card border-b-2 border-gray-200 dark:border-dark-border px-4 py-3 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="btn-ghost p-2 lg:hidden text-eel dark:text-dark-text"
              aria-label="Menu Mobile"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            
            <div 
              onClick={() => { clearCurrentBook(); navigate('/library'); }}
              className="flex items-center gap-2 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-duo bg-duo-green flex items-center justify-center shadow-3d">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-heading font-extrabold text-lg leading-tight text-eel dark:text-dark-text">
                  Contextual Reader
                </h1>
                <span className="badge-duo bg-duo-green/10 text-duo-green text-[10px] py-0.2 px-1">v1.0</span>
              </div>
            </div>
          </div>

          {/* Navigation Desktop */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) => `
                  flex items-center gap-2 px-4 py-2 rounded-duo font-ui font-bold transition-all duration-200
                  ${isActive
                    ? 'bg-duo-green text-white shadow-3d'
                    : 'text-eel dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-border'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="btn-ghost p-2 rounded-full text-eel dark:text-dark-text"
              aria-label={theme === 'light' ? 'Mode gelap' : 'Mode terang'}
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-duo-yellow" />}
            </button>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="btn-ghost px-3 py-1.5 text-xs sm:text-sm gap-1"
              >
                <span className="font-bold">Pengguna</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 card-duo shadow-xl z-50 animate-bounce-in bg-white dark:bg-dark-card border-2 border-gray-200 dark:border-dark-border">
                  <button
                    onClick={() => { setUserMenuOpen(false); clearCurrentBook(); navigate('/library'); }}
                    className="w-full px-4 py-2.5 text-left text-xs font-bold hover:bg-gray-100 dark:hover:bg-dark-border rounded-t-duo text-eel dark:text-dark-text"
                  >
                    Perpustakaan Buku
                  </button>
                  <hr className="border-gray-200 dark:border-dark-border mx-2" />
                  <button
                    onClick={() => { setUserMenuOpen(false); navigate('/settings'); }}
                    className="w-full px-4 py-2.5 text-left text-xs font-bold hover:bg-gray-100 dark:hover:bg-dark-border rounded-b-duo text-eel dark:text-dark-text"
                  >
                    Pengaturan App
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Nav Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-3 pt-3 border-t-2 border-gray-200 dark:border-dark-border animate-in">
            <nav className="flex flex-col gap-1.5">
              {navItems.map(({ path, label, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-4 py-3 rounded-duo font-ui font-bold text-sm
                    ${isActive
                      ? 'bg-duo-green text-white shadow-3d'
                      : 'text-eel dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-border'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-dark-card/95 backdrop-blur-md border-t-2 border-gray-200 dark:border-dark-border py-2 px-4 flex items-center justify-around">
        {navItems.map(({ path, label, icon: Icon }) => {
          const active = location.pathname.startsWith(path)
          return (
            <NavLink
              key={path}
              to={path}
              className={`flex flex-col items-center gap-0.5 text-[10px] font-bold transition-all ${
                active ? 'text-duo-green scale-110' : 'text-gray-400 hover:text-eel dark:hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </NavLink>
          )
        })}
      </div>
    </div>
  )
}
