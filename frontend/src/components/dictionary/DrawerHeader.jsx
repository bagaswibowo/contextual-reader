import React from 'react'
import { X } from 'lucide-react'

/**
 * DrawerHeader
 * Word, IPA, save toggle and close. Audio lives in one place only: the
 * pronunciation control in the meaning tab, so the panel does not repeat
 * the same play button three times.
 */
export function DrawerHeader({
  word = '',
  ipa = '',
  sourceWord = '',
  targetWord = '',
  onClose,
  className = '',
}) {
  const displayWord = word || sourceWord || ''
  const displayTarget = targetWord || ''

  return (
    <div
      className={`shrink-0 border-b border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] px-4 pt-3 pb-3 sm:px-5 sm:pt-4 sm:pb-4 ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2
            id="cr-drawer-word-title"
            className="font-heading text-[24px] font-extrabold leading-[1.15] text-[var(--cr-text-primary)] break-words [overflow-wrap:anywhere] sm:text-[28px]"
          >
            {displayWord}
          </h2>

          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            {ipa ? (
              <span className="rounded-md bg-[var(--cr-highlight-word-hover)] px-1.5 py-0.5 font-mono text-[13px] font-bold text-[var(--cr-text-secondary)]">
                {ipa.startsWith('/') ? ipa : `/${ipa}/`}
              </span>
            ) : (
              <span
                aria-label="Fonetik tidak tersedia"
                className="font-mono text-[13px] text-[var(--cr-text-secondary)] opacity-60"
              >
                ·
              </span>
            )}
            {displayTarget && (
              <span className="truncate text-[13px] font-extrabold text-[var(--cr-text-accent)]">
                {displayTarget}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup kamus"
          className="min-h-[44px] min-w-[44px] -mr-1 -mt-1 inline-flex shrink-0 items-center justify-center rounded-xl text-[var(--cr-text-secondary)] transition-colors hover:bg-[var(--cr-bg-surface)] hover:text-[var(--cr-text-primary)]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

    </div>
  )
}

export default DrawerHeader
