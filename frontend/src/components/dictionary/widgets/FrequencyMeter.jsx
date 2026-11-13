import React from 'react'

/**
 * FrequencyMeter
 * 3-bar usage frequency (1 rare → 3 most common).
 * Filled = --cr-text-accent, empty = --cr-border-interactive at full opacity so the
 * empty state still clears the 3:1 non-text contrast floor (AC-WI-07, AC-WI-08).
 */
export function FrequencyMeter({ value = 1, max = 3, className = '' }) {
  const clamped = Math.max(0, Math.min(max, Number(value) || 0))

  return (
    <span
      role="img"
      aria-label={`Frekuensi ${clamped} dari ${max}`}
      title={`Tingkat frekuensi: ${clamped} / ${max}`}
      className={`inline-flex select-none items-end gap-[3px] align-middle ${className}`}
    >
      {Array.from({ length: max }, (_, idx) => {
        const isFilled = idx < clamped
        return (
          <span
            key={idx}
            className="w-[3px] rounded-full transition-colors"
            style={{
              height: `${6 + idx * 3}px`,
              backgroundColor: isFilled
                ? 'var(--cr-text-accent)'
                : 'var(--cr-border-interactive)',
            }}
          />
        )
      })}
    </span>
  )
}

export default FrequencyMeter
