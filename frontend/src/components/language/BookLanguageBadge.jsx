import React from 'react'
import { Globe } from 'lucide-react'

/**
 * BookLanguageBadge
 * Book language → target language indicator with 4 variants (DESIGN §13, AC-BB-01, AC-BB-08).
 * `interactive` renders a 44x44 button; otherwise a static badge for cards (Library).
 */
export function BookLanguageBadge({
  sourceLang = 'en',
  targetLang = 'id',
  confidence = 1.0,
  isOriginal = false,
  onClick,
  interactive = true,
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

  const baseClass =
    'inline-flex select-none items-center gap-1.5 rounded-lg border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface)] px-2 py-1 text-[11px] font-bold text-[var(--cr-text-secondary)]'

  const content = (
    <>
      <Globe className="h-3 w-3 shrink-0 text-[var(--cr-text-accent)]" aria-hidden="true" />
      <span className="font-mono leading-none tracking-wide">{labelText}</span>
    </>
  )

  if (!interactive) {
    return (
      <span className={`${baseClass} ${className}`} title={ariaDescription}>
        {content}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${ariaDescription}. Klik untuk mengganti bahasa target.`}
      className={`${baseClass} min-h-[44px] min-w-[44px] px-2.5 py-1.5 text-xs text-[var(--cr-text-primary)] transition-colors hover:border-[var(--cr-border-interactive)] hover:bg-[var(--cr-bg-surface-elevated)] ${className}`}
      title="Ubah bahasa target terjemahan"
    >
      {content}
    </button>
  )
}

export default BookLanguageBadge
