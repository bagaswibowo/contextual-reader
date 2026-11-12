import React from 'react'
import { History, Search, Filter } from 'lucide-react'

/**
 * HistoryEmptyState
 * Displays distinct empty states for:
 * 1. Initial empty history (no words looked up yet)
 * 2. Search query yielded no results
 * 3. Filter yielded no results (AC-RS-06)
 */
export function HistoryEmptyState({ type = 'empty', query = '', onClearSearch }) {
  if (type === 'no-search') {
    return (
      <div className="p-8 text-center space-y-2 text-xs text-[var(--cr-text-secondary)]">
        <Search className="w-8 h-8 mx-auto opacity-40 text-[var(--cr-text-secondary)]" />
        <p className="font-bold text-sm text-[var(--cr-text-primary)]">
          Tidak ada hasil untuk &ldquo;{query}&rdquo;
        </p>
        <p>Coba gunakan kata kunci pencarian yang lain.</p>
        {onClearSearch && (
          <button
            type="button"
            onClick={onClearSearch}
            className="mt-2 min-h-[44px] px-3 py-1.5 rounded-xl border border-[var(--cr-border-interactive)] text-xs font-semibold text-[var(--cr-text-primary)] hover:bg-[var(--cr-bg-surface-elevated)]"
          >
            Hapus pencarian
          </button>
        )}
      </div>
    )
  }

  if (type === 'no-filter') {
    return (
      <div className="p-8 text-center space-y-2 text-xs text-[var(--cr-text-secondary)]">
        <Filter className="w-8 h-8 mx-auto opacity-40 text-[var(--cr-text-secondary)]" />
        <p className="font-bold text-sm text-[var(--cr-text-primary)]">
          Tidak ada kata dengan filter ini
        </p>
        <p>Pilih filter lain untuk melihat riwayat pencarian Anda.</p>
      </div>
    )
  }

  return (
    <div className="p-8 text-center space-y-2 text-xs text-[var(--cr-text-secondary)]">
      <History className="w-8 h-8 mx-auto opacity-40 text-[var(--cr-text-secondary)]" />
      <p className="font-bold text-sm text-[var(--cr-text-primary)]">
        Belum ada riwayat pencarian
      </p>
      <p>Kata yang Anda cari atau ketuk saat membaca akan tercatat otomatis di sini.</p>
    </div>
  )
}

export default HistoryEmptyState
