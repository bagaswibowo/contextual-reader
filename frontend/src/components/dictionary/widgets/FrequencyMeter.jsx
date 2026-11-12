import React from 'react'

/**
 * FrequencyMeter
 * 3-bar frequency meter indicating word usage frequency (1 = rare, 2 = common, 3 = most common).
 * Uses --cr-text-accent for filled bars and --cr-border-interactive for empty bars (AC-WI-08).
 * Accessible role="img" with descriptive aria-label (AC-WI-07).
 */
export function FrequencyMeter({ value = 1, max = 3, className = '' }) {
  const clamped = Math.max(0, Math.min(max, Number(value) || 0))

  return (
    <span
      role="img"
      aria-label={`Frekuensi ${clamped} dari ${max}`}
      className={`inline-flex items-center gap-0.5 align-middle select-none ${className}`}
      title={`Tingkat frekuensi: ${clamped} / ${max}`}
    >
      {Array.from({ length: max }, (_, idx) => {
        const isFilled = idx < clamped
        return (
          <span
            key={idx}
            className="w-1.5 h-3 rounded-[2px] transition-colors"
            style={{
              backgroundColor: isFilled ? 'var(--cr-text-accent)' : 'var(--cr-border-interactive)',
              opacity: isFilled ? 1 : 0.45,
            }}
          />
        )
      })}
    </span>
  )
}

export default FrequencyMeter
