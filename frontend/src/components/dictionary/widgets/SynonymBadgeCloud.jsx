import React, { useState } from 'react'

/**
 * SynonymBadgeCloud
 * Renders synonym chips up to maxDisplay (default 6) plus expandable "+n lainnya".
 * Clicking a chip initiates lookup for that word (AC-WI-05, AC-WI-18).
 */
export function SynonymBadgeCloud({
  synonyms = [],
  maxDisplay = 6,
  onSelectWord,
  className = '',
}) {
  const [expanded, setExpanded] = useState(false)

  if (!Array.isArray(synonyms) || synonyms.length === 0) {
    return null
  }

  const visibleList = expanded ? synonyms : synonyms.slice(0, maxDisplay)
  const remainingCount = synonyms.length - maxDisplay

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {visibleList.map((syn, idx) => {
        const wordText = typeof syn === 'string' ? syn : (syn?.word || syn?.meaning || String(syn))
        return (
          <button
            key={`${wordText}-${idx}`}
            type="button"
            onClick={() => onSelectWord && onSelectWord(wordText)}
            aria-label={`Lihat sinonim ${wordText}`}
            className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl text-xs font-semibold border transition-all inline-flex items-center justify-center text-[var(--cr-text-primary)] bg-[var(--cr-bg-surface-elevated)] border-[var(--cr-border-subtle)] hover:border-[var(--cr-border-interactive)] hover:text-[var(--cr-text-accent)] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[var(--cr-ring-focus)]"
          >
            {wordText}
          </button>
        )
      })}

      {!expanded && remainingCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label={`Tampilkan ${remainingCount} sinonim lainnya`}
          className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border border-dashed text-[var(--cr-text-secondary)] border-[var(--cr-border-interactive)] hover:text-[var(--cr-text-primary)] hover:border-[var(--cr-text-accent)] bg-transparent transition-all inline-flex items-center justify-center"
        >
          +{remainingCount} lainnya
        </button>
      )}

      {expanded && remainingCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label="Sembunyikan sebagian sinonim"
          className="min-h-[44px] px-2.5 py-2 text-xs font-semibold text-[var(--cr-text-secondary)] hover:text-[var(--cr-text-primary)] underline transition-colors inline-flex items-center"
        >
          Tampilkan lebih sedikit
        </button>
      )}
    </div>
  )
}

export default SynonymBadgeCloud
