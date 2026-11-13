import React, { useRef } from 'react'
import { BookOpen, MessageSquare, Languages, Layers } from 'lucide-react'

const DEFAULT_TABS = [
  { id: 'definition', label: 'Definisi', icon: BookOpen },
  { id: 'examples', label: 'Contoh', icon: MessageSquare },
  { id: 'translations', label: 'Terjemahan', icon: Languages },
  { id: 'grammar', label: 'Tata Bahasa', icon: Layers },
]

/**
 * DrawerTabsNav
 * Segmented tab bar using the WAI-ARIA tabs pattern (A11Y-15).
 * Active state = accent underline + primary text, no border soup.
 */
export function DrawerTabsNav({
  activeTab = 'definition',
  onTabChange,
  tabs = DEFAULT_TABS,
  className = '',
}) {
  const tabListRef = useRef(null)

  const focusTab = (index) => {
    const buttons = tabListRef.current?.querySelectorAll('[role="tab"]')
    buttons?.[index]?.focus()
  }

  const handleKeyDown = (e, index) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const nextIndex = (index + 1) % tabs.length
      onTabChange && onTabChange(tabs[nextIndex].id)
      focusTab(nextIndex)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prevIndex = (index - 1 + tabs.length) % tabs.length
      onTabChange && onTabChange(tabs[prevIndex].id)
      focusTab(prevIndex)
    } else if (e.key === 'Home') {
      e.preventDefault()
      onTabChange && onTabChange(tabs[0].id)
      focusTab(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      const last = tabs.length - 1
      onTabChange && onTabChange(tabs[last].id)
      focusTab(last)
    }
  }

  return (
    <div
      ref={tabListRef}
      role="tablist"
      aria-label="Navigasi wawasan kata"
      className={`flex shrink-0 items-stretch border-b border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface)] no-scrollbar overflow-x-auto ${className}`}
    >
      {tabs.map((tab, idx) => {
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
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`relative flex min-h-[48px] flex-1 shrink-0 items-center justify-center gap-1.5 px-2.5 pb-2.5 pt-2 text-[12px] font-bold transition-colors ${
              isActive
                ? 'text-[var(--cr-text-primary)]'
                : 'text-[var(--cr-text-secondary)] hover:text-[var(--cr-text-primary)]'
            }`}
          >
            {Icon && (
              <Icon
                className={`h-3.5 w-3.5 shrink-0 ${
                  isActive ? 'text-[var(--cr-text-accent)]' : ''
                }`}
              />
            )}
            <span className="whitespace-nowrap">{tab.label}</span>
            <span
              aria-hidden="true"
              className={`absolute inset-x-2 bottom-0 h-[2px] rounded-full transition-opacity ${
                isActive ? 'bg-[var(--cr-text-accent)] opacity-100' : 'opacity-0'
              }`}
            />
          </button>
        )
      })}
    </div>
  )
}

export default DrawerTabsNav
