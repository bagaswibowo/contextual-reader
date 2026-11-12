import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Search, RotateCcw, Trash2 } from 'lucide-react'
import { HistoryRow } from './HistoryRow'
import { HistoryEmptyState } from './HistoryEmptyState'

const HISTORY_STORAGE_KEY = 'cr_lookup_history_v1'

/**
 * Format timestamp into group labels ("Hari ini", "Kemarin", or "DD MMM YYYY")
 */
function getDayGroupLabel(timestamp) {
  if (!timestamp) return 'Lainnya'
  const date = new Date(timestamp)
  const now = new Date()

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()

  if (isToday) return 'Hari ini'

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()

  if (isYesterday) return 'Kemarin'

  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * LookupHistoryTab
 * Local history view for Vocabulary page (F2, AC-RS-01...12).
 * Fast client-side search without network requests, grouped by date with 5s undo.
 */
export function LookupHistoryTab({ onOpenWord, onNavigateBook }) {
  const [historyItems, setHistoryItems] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [filterMode, setFilterMode] = useState('all') // 'all' | 'saved'
  const [undoItem, setUndoItem] = useState(null)
  const [isStorageCorrupt, setIsStorageCorrupt] = useState(false)

  const undoTimerRef = useRef(null)

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        setHistoryItems(Array.isArray(parsed.items) ? parsed.items : [])
      }
    } catch (e) {
      console.warn('Failed to parse lookup history from localStorage', e)
      setIsStorageCorrupt(true)
    }
  }, [])

  // Sync back to localStorage
  const saveToStorage = (newItems) => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify({ v: 1, items: newItems }))
      setHistoryItems(newItems)
    } catch (e) {
      console.warn('Failed to persist history to localStorage', e)
    }
  }

  // Debounced search query (250ms) (AC-RS-05)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim().toLowerCase())
    }, 250)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Toggle saved status
  const handleToggleSave = (item) => {
    const updated = historyItems.map((h) =>
      h.id === item.id ? { ...h, saved: !h.saved } : h
    )
    saveToStorage(updated)
  }

  // Delete item with 5s undo (AC-RS-08)
  const handleDeleteItem = (item) => {
    clearTimeout(undoTimerRef.current)
    const index = historyItems.findIndex((h) => h.id === item.id)
    if (index === -1) return

    const remaining = historyItems.filter((h) => h.id !== item.id)
    saveToStorage(remaining)

    setUndoItem({ item, index })
    undoTimerRef.current = setTimeout(() => {
      setUndoItem(null)
    }, 5000)
  }

  // Undo delete action
  const handleUndo = () => {
    if (!undoItem) return
    clearTimeout(undoTimerRef.current)

    const updated = [...historyItems]
    updated.splice(undoItem.index, 0, undoItem.item)
    saveToStorage(updated)
    setUndoItem(null)
  }

  // Clear all with undo
  const handleClearAll = () => {
    if (historyItems.length === 0) return
    clearTimeout(undoTimerRef.current)

    const prev = [...historyItems]
    saveToStorage([])

    setUndoItem({ items: prev, isAll: true })
    undoTimerRef.current = setTimeout(() => {
      setUndoItem(null)
    }, 5000)
  }

  // Undo clear all
  const handleUndoClearAll = () => {
    if (!undoItem?.items) return
    clearTimeout(undoTimerRef.current)
    saveToStorage(undoItem.items)
    setUndoItem(null)
  }

  // Filtered and grouped items
  const filteredList = useMemo(() => {
    return historyItems.filter((item) => {
      if (filterMode === 'saved' && !item.saved) return false
      if (!debouncedQuery) return true

      const matchesWord = item.word?.toLowerCase().includes(debouncedQuery)
      const matchesTranslation = item.translation?.toLowerCase().includes(debouncedQuery)
      const matchesBook = item.bookTitle?.toLowerCase().includes(debouncedQuery)
      return matchesWord || matchesTranslation || matchesBook
    })
  }, [historyItems, debouncedQuery, filterMode])

  // Group by day label
  const groupedList = useMemo(() => {
    const groups = {}
    filteredList.forEach((item) => {
      const label = getDayGroupLabel(item.createdAt)
      if (!groups[label]) groups[label] = []
      groups[label].push(item)
    })
    return groups
  }, [filteredList])

  if (isStorageCorrupt) {
    return (
      <div className="p-8 text-center text-xs space-y-2">
        <p className="font-bold text-red-500">Penyimpanan lokal tidak dapat dibaca.</p>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem(HISTORY_STORAGE_KEY)
            setIsStorageCorrupt(false)
            setHistoryItems([])
          }}
          className="px-4 py-2 bg-[var(--cr-btn-primary-bg)] text-white rounded-xl font-bold"
        >
          Reset Riwayat
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search Bar & Filter Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Instant Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--cr-text-secondary)] pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari di riwayat kata..."
            className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-2xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] text-xs font-semibold text-[var(--cr-text-primary)] placeholder:text-[var(--cr-text-secondary)] focus:border-[var(--cr-ring-focus)] focus:ring-2 focus:ring-[var(--cr-ring-focus)]/20"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
              filterMode === 'all'
                ? 'bg-[var(--cr-bg-surface-elevated)] border-[var(--cr-text-accent)] text-[var(--cr-text-accent)] shadow-xs'
                : 'border-[var(--cr-border-subtle)] text-[var(--cr-text-secondary)] hover:text-[var(--cr-text-primary)]'
            }`}
          >
            Semua ({historyItems.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('saved')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
              filterMode === 'saved'
                ? 'bg-[var(--cr-bg-surface-elevated)] border-[var(--cr-text-accent)] text-[var(--cr-text-accent)] shadow-xs'
                : 'border-[var(--cr-border-subtle)] text-[var(--cr-text-secondary)] hover:text-[var(--cr-text-primary)]'
            }`}
          >
            Tersimpan ({historyItems.filter((h) => h.saved).length})
          </button>

          {historyItems.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              title="Hapus seluruh riwayat"
              className="min-h-[44px] min-w-[44px] p-2 rounded-xl border border-[var(--cr-border-subtle)] text-[var(--cr-text-secondary)] hover:text-red-500 hover:border-red-400 transition-colors inline-flex items-center justify-center"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Undo Notification Banner (5 seconds) */}
      {undoItem && (
        <div className="p-3 rounded-xl bg-[var(--cr-bg-surface-elevated)] border border-[var(--cr-border-subtle)] shadow-md flex items-center justify-between text-xs animate-in">
          <span>
            {undoItem.isAll
              ? 'Seluruh riwayat telah dihapus.'
              : `Kata "${undoItem.item.word}" dihapus dari riwayat.`}
          </span>
          <button
            type="button"
            onClick={undoItem.isAll ? handleUndoClearAll : handleUndo}
            className="font-bold text-[var(--cr-text-accent)] underline hover:opacity-80 inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Urungkan (5d)</span>
          </button>
        </div>
      )}

      {/* List content or empty states */}
      {historyItems.length === 0 ? (
        <HistoryEmptyState type="empty" />
      ) : filteredList.length === 0 ? (
        debouncedQuery ? (
          <HistoryEmptyState
            type="no-search"
            query={searchQuery}
            onClearSearch={() => setSearchQuery('')}
          />
        ) : (
          <HistoryEmptyState type="no-filter" />
        )
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedList).map(([groupLabel, items]) => (
            <div key={groupLabel} className="space-y-2.5">
              <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--cr-text-secondary)] px-1">
                {groupLabel}
              </h4>
              <div className="space-y-2">
                {items.map((item) => (
                  <HistoryRow
                    key={item.id}
                    item={item}
                    onOpenItem={(it) => {
                      if (onNavigateBook && it.bookId) {
                        onNavigateBook(it)
                      } else if (onOpenWord) {
                        onOpenWord(it.word)
                      }
                    }}
                    onToggleSave={handleToggleSave}
                    onDelete={handleDeleteItem}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default LookupHistoryTab
