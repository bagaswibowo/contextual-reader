import React from 'react'
import { FrequencyMeter } from './FrequencyMeter'

/**
 * MeaningVariantRow
 * Renders selectable meaning variant chips with 3-bar FrequencyMeter and back-translations.
 * Selecting a variant switches the contextual meaning without triggering a network request (AC-WI-09).
 */
export function MeaningVariantRow({
  variants = [],
  selected = '',
  onSelect,
  className = '',
}) {
  if (!Array.isArray(variants) || variants.length === 0) {
    return null
  }

  // Find currently selected variant object
  const currentVariant = variants.find(
    (v) => (v.target_word || v.meaning || v.word) === selected
  ) || variants[0]

  return (
    <div className={`space-y-2 ${className}`}>
      <div
        role="group"
        aria-label="Varian makna dan frekuensi"
        className="flex flex-wrap items-center gap-2"
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
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold border transition-all inline-flex items-center gap-2 select-none ${
                isSelected
                  ? 'border-[var(--cr-text-accent)] bg-[var(--cr-bg-surface-elevated)] text-[var(--cr-text-primary)] ring-2 ring-[var(--cr-text-accent)] shadow-sm'
                  : 'border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] text-[var(--cr-text-secondary)] hover:border-[var(--cr-border-interactive)] hover:text-[var(--cr-text-primary)]'
              }`}
            >
              <span className="leading-tight">{targetWord}</span>
              <FrequencyMeter value={freq} max={3} />
            </button>
          )
        })}
      </div>

      {/* Back translations line for selected variant */}
      {currentVariant?.back_translations && currentVariant.back_translations.length > 0 && (
        <p className="text-xs text-[var(--cr-text-secondary)] leading-relaxed pl-0.5">
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
