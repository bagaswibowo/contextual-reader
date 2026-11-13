import React from 'react'
import { Volume2, Square } from 'lucide-react'

/**
 * WordAudioButton
 * Accessible audio playback button with >= 44x44 target, state indicators,
 * and aria-live announcements for screen readers (AC-WI-05, AC-WI-06, A11Y-08, A11Y-09).
 */
export function WordAudioButton({
  text = '',
  lang = 'en',
  label = 'Inggris',
  isPlaying = false,
  onPlay,
  audioUrl = null,
  className = '',
}) {
  const handleClick = (e) => {
    e.stopPropagation()
    if (onPlay) {
      onPlay(text, lang, audioUrl)
    }
  }

  const ariaDescription = isPlaying
    ? `Menghentikan audio ${text}`
    : `Dengarkan pengucapan ${text} dalam bahasa ${label}`

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaDescription}
      aria-pressed={isPlaying}
      title={ariaDescription}
      className={`min-w-[44px] min-h-[44px] px-2.5 py-1.5 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-all select-none ${
        isPlaying
          ? 'bg-[var(--cr-highlight-sentence)] border-[var(--cr-text-accent)] text-[var(--cr-text-primary)] shadow-sm'
          : 'bg-[var(--cr-bg-surface-elevated)] border-[var(--cr-border-subtle)] text-[var(--cr-text-primary)] hover:border-[var(--cr-border-interactive)] hover:bg-[var(--cr-bg-surface)]'
      } ${className}`}
    >
      <span aria-hidden="true" className="shrink-0">
        {isPlaying ? (
          <Square className="w-4 h-4 fill-current text-[var(--cr-text-accent)] animate-pulse" />
        ) : (
          <Volume2 className="w-4 h-4 text-[var(--cr-text-secondary)]" />
        )}
      </span>
      <span className="text-[12px] font-semibold leading-none">
        {isPlaying ? 'Memutar…' : label}
      </span>
      <span className="sr-only" aria-live="polite">
        {isPlaying ? `Sedang memutar audio ${label}` : ''}
      </span>
    </button>
  )
}

export default WordAudioButton
