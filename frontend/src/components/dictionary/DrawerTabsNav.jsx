import React, { useRef } from 'react'
import { BookOpen, MessageSquare, Languages, Layers } from 'lucide-react'

const DEFAULT_TABS = [
  { id: 'definition', label: 'Definisi', icon: BookOpen },
  { id: 'examples', label: 'Contoh', icon: MessageSquare },
  { id: 'translations', label: 'Terjemahan', icon: Languages },
  { id: 'grammar', label: 'Tata Bahasa 3D', icon: Layers },
]

/**
 * DrawerTabsNav
 * Accessible segmented tab navigation with arrow key roving tabindex and WAI-ARIA tab pattern (A11Y-15).
 */
export function DrawerTabsNav({
  activeTab = 'definition',
  onTabChange,
  tabs = DEFAULT_TABS,
  className = '',
}) {
  const tabListRef = useRef(null)

  const handleKeyDown = (e, index) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const nextIndex = (index + 1) % tabs.length
      onTabChange && onTabChange(tabs[nextIndex].id)
      const buttons = tabListRef.current?.querySelectorAll('[role="tab"]')
      buttons?.[nextIndex]?.focus()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prevIndex = (index - 1 + tabs.length) % tabs.length
      onTabChange && onTabChange(tabs[prevIndex].id)
      const buttons = tabListRef.current?.querySelectorAll('[role="tab"]')
      buttons?.[prevIndex]?.focus()
    }
  }

  return (
    <div
      ref={tabListRef}
      role="tablist"
      aria-label="Navigasi wawasan kata"
      className={`flex items-center gap-1 p-1 bg-[var(--cr-bg-surface)] border-b border-[var(--cr-border-subtle)] overflow-x-auto no-scrollbar select-none ${className}`}
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
            className={`min-h-[44px] flex-1 min-w-[70px] sm:min-w-0 px-2.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 ${
              isActive
                ? 'bg-[var(--cr-bg-surface-elevated)] text-[var(--cr-text-primary)] shadow-xs border border-[var(--cr-border-subtle)]'
                : 'text-[var(--cr-text-secondary)] hover:text-[var(--cr-text-primary)] hover:bg-[var(--cr-bg-surface-elevated)]/60'
            }`}
          >
            {Icon && <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[var(--cr-text-accent)]' : ''}`} />}
            <span className="whitespace-nowrap">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default DrawerTabsNav
