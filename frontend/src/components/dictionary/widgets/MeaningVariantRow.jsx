import React from 'react'
import { FrequencyMeter } from './FrequencyMeter'

/**
 * MeaningVariantRow
 * Selectable meaning chips with a 3-bar frequency meter and back-translations.
 * Selection is local only — no network request (AC-WI-09).
 */
export function MeaningVariantRow({ variants = [], selected = '', onSelect, className = '' }) {
  if (!Array.isArray(variants) || variants.length === 0) return null

  const currentVariant =
    variants.find((v) => (v.target_word || v.meaning || v.word) === selected) || variants[0]

  return (
    <div className={`space-y-2 ${className}`}>
      <div
        role="group"
        aria-label="Varian makna dan frekuensi"
        className="flex flex-wrap items-center gap-1.5"
      >
        {variants.map((v, idx) => {
          const targetWord = v.target_word || v.meaning || v.word || ''
          const isSelected = selected ? targetWord === selected : idx === 0
          const freq = v.frequency || 2

          return (
            <button
              key={`${targetWord}-${idx}`}
              type="button"
              onClick={() => onSelect && onSelect(v)}
              aria-pressed={isSelected}
              className={`inline-flex min-h-[44px] select-none items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-bold transition-colors ${
                isSelected
                  ? 'border-[var(--cr-text-accent)] bg-[var(--cr-bg-surface-elevated)] text-[var(--cr-text-primary)]'
                  : 'border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] text-[var(--cr-text-secondary)] hover:border-[var(--cr-border-interactive)] hover:text-[var(--cr-text-primary)]'
              }`}
            >
              <span className="leading-tight">{targetWord}</span>
              <FrequencyMeter value={freq} max={3} />
            </button>
          )
        })}
      </div>

      {currentVariant?.back_translations && currentVariant.back_translations.length > 0 && (
        <p className="pl-0.5 text-[11px] leading-relaxed text-[var(--cr-text-secondary)]">
          <span className="font-semibold text-[var(--cr-text-primary)]">Balik: </span>
          {Array.isArray(currentVariant.back_translations)
            ? currentVariant.back_translations.join(', ')
            : String(currentVariant.back_translations)}
        </p>
      )}
    </div>
  )
}

export default MeaningVariantRow
