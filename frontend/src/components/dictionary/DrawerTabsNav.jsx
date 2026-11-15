import React, { useRef } from 'react'
import { BookOpen, Volume2, Languages } from 'lucide-react'

const TABS = [
  { id: 'meaning', label: 'Arti', icon: Languages },
  { id: 'pronunciation', label: 'Pengucapan', icon: Volume2 },
  { id: 'definition', label: 'Definisi', icon: BookOpen },
]

/**
 * Three-tab navigation for the word panel. Arrow keys, Home and End move the
 * selection, following the WAI-ARIA tabs pattern.
 */
export function DrawerTabsNav({ activeTab = 'meaning', onTabChange, className = '' }) {
  const tabListRef = useRef(null)

  const focusTab = (index) => {
    const buttons = tabListRef.current?.querySelectorAll('[role="tab"]')
    buttons?.[index]?.focus()
  }

  const handleKeyDown = (event, index) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      const next = (index + 1) % TABS.length
      onTabChange && onTabChange(TABS[next].id)
      focusTab(next)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      const prev = (index - 1 + TABS.length) % TABS.length
      onTabChange && onTabChange(TABS[prev].id)
      focusTab(prev)
    } else if (event.key === 'Home') {
      event.preventDefault()
      onTabChange && onTabChange(TABS[0].id)
      focusTab(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      onTabChange && onTabChange(TABS[TABS.length - 1].id)
      focusTab(TABS.length - 1)
    }
  }

  return (
    <div
      ref={tabListRef}
      role="tablist"
      aria-label="Isi wawasan kata"
      className={`flex shrink-0 items-stretch gap-1 border-b border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface)] px-2 py-2 ${className}`}
    >
      {TABS.map((tab, idx) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange && onTabChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, idx)}
            className={`flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-xl px-1.5 text-[0.72em] font-extrabold transition-colors ${
              isActive
                ? 'bg-[var(--cr-highlight-word-hover)] text-[var(--cr-text-accent)]'
                : 'text-[var(--cr-text-secondary)] hover:text-[var(--cr-text-primary)]'
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="whitespace-nowrap">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default DrawerTabsNav
