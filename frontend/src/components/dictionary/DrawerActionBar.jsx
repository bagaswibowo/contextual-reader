import React from 'react'
import { Bookmark, Trash2 } from 'lucide-react'

/**
 * DrawerActionBar
 * The single save control for the word panel. It stores the word together with
 * the sentence it came from, so the vocabulary list keeps the context. Once the
 * word is saved, the same control removes it.
 */
export function DrawerActionBar({
  word = '',
  saved = false,
  saving = false,
  onToggleSave,
  onRemove,
  className = '',
}) {
  const handleClick = () => {
    if (saved) {
      onRemove && onRemove()
    } else {
      onToggleSave && onToggleSave()
    }
  }

  return (
    <div
      className={`shrink-0 border-t border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] px-3 pt-3 sm:px-4 ${className}`}
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
    >
      {(onToggleSave || onRemove) && (
        <button
          type="button"
          onClick={handleClick}
          disabled={saving}
          aria-pressed={saved}
          style={saved ? { '--press-outline': 'var(--cr-text-danger)' } : undefined}
          aria-label={
            saved
              ? `Hapus kata ${word} dari kosakata`
              : `Pelajari kata ${word} beserta kalimatnya`
          }
          className={`cr-press min-h-[48px] w-full rounded-2xl px-4 py-2.5 text-sm font-extrabold flex items-center justify-center gap-2 disabled:opacity-60 ${
            saved
              ? 'cr-press-outline border-[var(--cr-text-danger)] text-[var(--cr-text-danger)]'
              : 'text-[var(--cr-btn-primary-text-aa)]'
          }`}
        >
          {saved ? (
            <>
              <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Hapus</span>
            </>
          ) : (
            <>
              <Bookmark className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Pelajari</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}

export default DrawerActionBar
