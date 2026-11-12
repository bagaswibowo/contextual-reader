import React from 'react'
import { Bookmark, Check, Trash2, ArrowRight } from 'lucide-react'

/**
 * HistoryRow
 * Renders an individual lookup history item with inline save (★) and delete actions.
 */
export function HistoryRow({
  item,
  onOpenItem,
  onToggleSave,
  onDelete,
}) {
  const { word, sourceLang, targetLang, translation, bookTitle, chapterTitle, saved } = item

  return (
    <div
      onClick={() => onOpenItem && onOpenItem(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (onOpenItem) onOpenItem(item)
        }
      }}
      className="p-3.5 rounded-2xl bg-[var(--cr-bg-surface-elevated)] border border-[var(--cr-border-subtle)] hover:border-[var(--cr-border-interactive)] transition-all flex items-center justify-between gap-3 text-left cursor-pointer group"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-heading font-extrabold text-base text-[var(--cr-text-primary)]">
            {word}
          </span>
          <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-[var(--cr-bg-surface)] text-[var(--cr-text-secondary)] border border-[var(--cr-border-subtle)]">
            {sourceLang?.toUpperCase()} → {targetLang?.toUpperCase()}
          </span>
        </div>

        {translation && (
          <p className="text-xs text-[var(--cr-text-secondary)] line-clamp-1">
            {translation}
          </p>
        )}

        {(bookTitle || chapterTitle) && (
          <p className="text-[11px] text-[var(--cr-text-secondary)] opacity-75 line-clamp-1">
            {bookTitle} {chapterTitle ? `· ${chapterTitle}` : ''}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        {/* Toggle Bookmark Button */}
        <button
          type="button"
          onClick={() => onToggleSave && onToggleSave(item)}
          aria-label={saved ? `Hapus bintang kata ${word}` : `Beri bintang kata ${word}`}
          className={`min-h-[44px] min-w-[44px] p-2 rounded-xl border transition-colors inline-flex items-center justify-center ${
            saved
              ? 'bg-[var(--cr-btn-primary-bg)] border-[var(--cr-btn-primary-bg)] text-white'
              : 'bg-[var(--cr-bg-surface)] border-[var(--cr-border-subtle)] text-[var(--cr-text-secondary)] hover:text-[var(--cr-text-primary)]'
          }`}
        >
          {saved ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
        </button>

        {/* Delete button */}
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(item)}
            aria-label={`Hapus ${word} dari riwayat`}
            className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-[var(--cr-text-secondary)] hover:text-red-500 hover:bg-[var(--cr-bg-surface)] transition-colors inline-flex items-center justify-center"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export default HistoryRow
