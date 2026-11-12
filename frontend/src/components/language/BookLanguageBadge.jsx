import React from 'react'
import { ArrowRight, Globe } from 'lucide-react'

/**
 * BookLanguageBadge
 * Renders the book language and target language indicator with 4 variants (DESIGN §13, AC-BB-01, AC-BB-08).
 * Minimum 44x44 touch target.
 */
export function BookLanguageBadge({
  sourceLang = 'en',
  targetLang = 'id',
  confidence = 1.0,
  isOriginal = false,
  onClick,
  className = '',
}) {
  const normSource = (sourceLang || '?').slice(0, 2).toUpperCase()
  const normTarget = (targetLang || 'ID').slice(0, 2).toUpperCase()

  const isLowConfidence = confidence && confidence < 0.6 && normSource !== '?'
  const isUnknown = normSource === '?'

  let labelText = `${normSource} → ${normTarget}`
  let ariaDescription = `Bahasa sumber ${normSource}, bahasa target ${normTarget}`

  if (isOriginal || normSource === normTarget) {
    labelText = `${normSource} · Asli`
    ariaDescription = `Bahasa asli ${normSource}, tanpa terjemahan`
  } else if (isLowConfidence) {
    labelText = `${normSource}? → ${normTarget}`
    ariaDescription = `Bahasa sumber terdeteksi kemungkinan ${normSource}, target ${normTarget}`
  } else if (isUnknown) {
    labelText = `? → ${normTarget}`
    ariaDescription = `Bahasa sumber belum terdeteksi, target ${normTarget}`
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${ariaDescription}. Klik untuk mengganti bahasa target.`}
      className={`min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-xl border transition-all inline-flex items-center gap-1.5 text-xs font-bold select-none text-[var(--cr-text-primary)] bg-[var(--cr-bg-surface-elevated)] border-[var(--cr-border-subtle)] hover:border-[var(--cr-border-interactive)] hover:bg-[var(--cr-bg-surface)] focus-visible:ring-2 focus-visible:ring-[var(--cr-ring-focus)] ${className}`}
      title="Ubah bahasa target terjemahan"
    >
      <Globe className="w-3.5 h-3.5 text-[var(--cr-text-accent)] shrink-0" />
      <span className="font-mono tracking-wide leading-none">{labelText}</span>
    </button>
  )
}

export default BookLanguageBadge
