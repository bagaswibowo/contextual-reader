import React, { useState } from 'react'
import { Volume2, MessageSquare } from 'lucide-react'

/**
 * ExamplesTab
 * Displays comprehensive bilingual example sentences with highlighted keywords and audio.
 * Limits initially to 6 items with "Lihat semua (n)" expander (DESIGN §3.3, §4.4).
 */
export function ExamplesTab({
  examples = [],
  word = '',
  sourceLang = 'en',
  targetLang = 'id',
  onPlayAudio,
  className = '',
}) {
  const [showAll, setShowAll] = useState(false)

  if (!Array.isArray(examples) || examples.length === 0) {
    return (
      <div className={`p-8 text-center text-xs text-[var(--cr-text-secondary)] space-y-2 ${className}`}>
        <MessageSquare className="w-8 h-8 mx-auto opacity-40 text-[var(--cr-text-secondary)]" />
        <p className="font-semibold text-sm text-[var(--cr-text-primary)]">Belum ada contoh kalimat</p>
        <p>Contoh penggunaan untuk kata ini akan ditampilkan di sini saat tersedia.</p>
      </div>
    )
  }

  const visibleList = showAll ? examples : examples.slice(0, 6)
  const remaining = examples.length - 6

  return (
    <div className={`space-y-3 pb-4 ${className}`}>
      <div className="flex items-center justify-between pb-1">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--cr-text-secondary)]">
          Contoh Dwibahasa ({examples.length})
        </span>
      </div>

      <div className="space-y-3">
        {visibleList.map((ex, idx) => {
          const srcText = ex.source_text || ex.source || ex.en || ''
          const tgtText = ex.target_text || ex.target || ex.id || ''
          const kw = ex.keyword || word

          return (
            <div
              key={idx}
              className="p-3.5 rounded-2xl bg-[var(--cr-bg-surface-elevated)] border border-[var(--cr-border-subtle)] space-y-2 text-xs"
            >
              <p className="text-[var(--cr-text-primary)] font-medium leading-relaxed text-sm">
                {highlightKeyword(srcText, kw)}
              </p>

              {tgtText && (
                <p className="text-[var(--cr-text-secondary)] leading-relaxed">
                  {tgtText}
                </p>
              )}

              {onPlayAudio && (
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--cr-border-subtle)]">
                  {srcText && (
                    <button
                      type="button"
                      onClick={() => onPlayAudio(srcText, sourceLang)}
                      aria-label={`Dengarkan kalimat sumber ${idx + 1}`}
                      className="min-h-[44px] min-w-[44px] px-2.5 py-1 text-xs font-semibold rounded-lg text-[var(--cr-text-secondary)] hover:text-[var(--cr-text-primary)] hover:bg-[var(--cr-bg-surface)] inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>{sourceLang.toUpperCase()}</span>
                    </button>
                  )}
                  {tgtText && (
                    <button
                      type="button"
                      onClick={() => onPlayAudio(tgtText, targetLang)}
                      aria-label={`Dengarkan kalimat terjemahan ${idx + 1}`}
                      className="min-h-[44px] min-w-[44px] px-2.5 py-1 text-xs font-semibold rounded-lg text-[var(--cr-text-secondary)] hover:text-[var(--cr-text-primary)] hover:bg-[var(--cr-bg-surface)] inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>{targetLang.toUpperCase()}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!showAll && remaining > 0 && (
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="min-h-[44px] px-4 py-2 text-xs font-bold rounded-xl border border-[var(--cr-border-interactive)] text-[var(--cr-text-primary)] hover:bg-[var(--cr-bg-surface-elevated)] transition-colors"
          >
            Lihat semua ({examples.length})
          </button>
        </div>
      )}
    </div>
  )
}

function highlightKeyword(text, keyword) {
  if (!text || !keyword) return text
  const lowerText = text.toLowerCase()
  const lowerKw = keyword.toLowerCase()
  const matchIdx = lowerText.indexOf(lowerKw)
  if (matchIdx === -1) return text

  const before = text.slice(0, matchIdx)
  const match = text.slice(matchIdx, matchIdx + keyword.length)
  const after = text.slice(matchIdx + keyword.length)

  return (
    <>
      {before}
      <mark className="rounded-sm bg-[var(--cr-highlight-sentence)] px-1 font-bold text-[var(--cr-text-primary)]">
        {match}
      </mark>
      {after}
    </>
  )
}

export default ExamplesTab
