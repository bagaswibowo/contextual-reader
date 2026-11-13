import React, { useState } from 'react'
import { Languages, Check } from 'lucide-react'
import { FrequencyMeter } from '../widgets/FrequencyMeter'

/**
 * TranslationsTab
 * Displays complete translation variants table sorted by frequency descending.
 * Features 3-bar FrequencyMeter, back-translations, and meaning selector (DESIGN §3.3, §4.4).
 */
export function TranslationsTab({
  translations = [],
  selected = '',
  onSelectVariant,
  className = '',
}) {
  const [showAll, setShowAll] = useState(false)

  if (!Array.isArray(translations) || translations.length === 0) {
    return (
      <div className={`p-8 text-center text-xs text-[var(--cr-text-secondary)] space-y-2 ${className}`}>
        <Languages className="w-8 h-8 mx-auto opacity-40 text-[var(--cr-text-secondary)]" />
        <p className="font-semibold text-sm text-[var(--cr-text-primary)]">Tidak ada variasi terjemahan</p>
        <p>Hanya arti kontekstual tunggal yang tersedia untuk kata ini.</p>
      </div>
    )
  }

  // Sort descending by frequency (3 > 2 > 1)
  const sorted = [...translations].sort((a, b) => (b.frequency || 0) - (a.frequency || 0))
  const visibleList = showAll ? sorted : sorted.slice(0, 6)
  const remaining = sorted.length - 6

  return (
    <div className={`space-y-3 pb-4 ${className}`}>
      <div className="flex items-center justify-between pb-1">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--cr-text-secondary)]">
          Daftar Terjemahan ({sorted.length})
        </span>
      </div>

      <div className="space-y-2.5">
        {visibleList.map((item, idx) => {
          const targetWord = item.target_word || item.meaning || item.word || ''
          const isSelected = selected ? targetWord === selected : idx === 0
          const freq = item.frequency || 2
          const pos = item.pos || item.part_of_speech || ''
          const backTrans = Array.isArray(item.back_translations)
            ? item.back_translations.join(', ')
            : item.back_translations || ''

          return (
            <div
              key={`${targetWord}-${idx}`}
              onClick={() => onSelectVariant && onSelectVariant(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  if (onSelectVariant) onSelectVariant(item)
                }
              }}
              aria-pressed={isSelected}
              className={`p-3.5 rounded-2xl border transition-colors text-left cursor-pointer space-y-1.5 ${
                isSelected
                  ? 'border-[var(--cr-text-accent)] bg-[var(--cr-highlight-word-hover)]'
                  : 'border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] hover:border-[var(--cr-border-interactive)]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-heading font-extrabold text-base text-[var(--cr-text-primary)]">
                    {targetWord}
                  </span>
                  {pos && (
                    <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-[var(--cr-bg-surface)] text-[var(--cr-text-secondary)] border border-[var(--cr-border-subtle)]">
                      {pos}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <FrequencyMeter value={freq} max={3} />
                  <span className="text-[11px] font-bold text-[var(--cr-text-secondary)]">
                    {freq}/3
                  </span>
                  {isSelected && (
                    <Check className="w-4 h-4 text-[var(--cr-text-accent)]" />
                  )}
                </div>
              </div>

              {backTrans && (
                <p className="text-xs text-[var(--cr-text-secondary)]">
                  <span className="font-semibold text-[var(--cr-text-primary)]">Balik: </span>
                  {backTrans}
                </p>
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
            Lihat semua ({sorted.length})
          </button>
        </div>
      )}
    </div>
  )
}

export default TranslationsTab
