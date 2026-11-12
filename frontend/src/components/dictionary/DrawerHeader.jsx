import React from 'react'
import { Bookmark, Check, X } from 'lucide-react'
import { WordAudioButton } from './widgets/WordAudioButton'

/**
 * DrawerHeader
 * Displays word title, phonetic IPA, dual audio buttons, save bookmark, and close button (DESIGN §3.2).
 * Touch targets >= 44x44 px (AC-WI-05, AC-WI-06, A11Y-08, A11Y-09).
 */
export function DrawerHeader({
  word = '',
  ipa = '',
  sourceLang = 'en',
  targetLang = 'id',
  sourceWord = '',
  targetWord = '',
  sourceAudioUrl = null,
  targetAudioUrl = null,
  saved = false,
  saving = false,
  playingAudioKey = null,
  onPlayAudio,
  onToggleSave,
  onClose,
  className = '',
}) {
  const displayWord = word || sourceWord || ''
  const displayTarget = targetWord || ''

  const isSourcePlaying = playingAudioKey === `audio_source_${displayWord}`
  const isTargetPlaying = playingAudioKey === `audio_target_${displayTarget}`

  const sourceLangLabel = sourceLang.toLowerCase() === 'id' ? 'Indonesia' : 'Inggris'
  const targetLangLabel = targetLang.toLowerCase() === 'id' ? 'Indonesia' : targetLang.toUpperCase()

  return (
    <div className={`p-4 sm:p-5 border-b border-[var(--cr-border-subtle)] space-y-3 bg-[var(--cr-bg-surface-elevated)] ${className}`}>
      {/* Top row: Word, IPA, Close button */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2
            id="cr-drawer-word-title"
            className="font-heading font-extrabold text-2xl text-[var(--cr-text-primary)] leading-tight break-words [overflow-wrap:anywhere]"
          >
            {displayWord}
          </h2>

          {/* Phonetic IPA or placeholder to prevent layout shift */}
          <div className="pt-0.5">
            {ipa ? (
              <span className="font-mono text-xs text-[var(--cr-text-secondary)]">
                {ipa.startsWith('/') ? ipa : `/${ipa}/`}
              </span>
            ) : (
              <span
                aria-label="Fonetik tidak tersedia"
                className="font-mono text-xs text-[var(--cr-text-secondary)] opacity-50"
              >
                —
              </span>
            )}
          </div>
        </div>

        {/* Close Button (44x44) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup kamus"
          className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-[var(--cr-text-secondary)] hover:text-[var(--cr-text-primary)] hover:bg-[var(--cr-bg-surface)] inline-flex items-center justify-center transition-colors shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Second row: Dual Audio Buttons + Bookmark Action */}
      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Source Audio */}
          <WordAudioButton
            text={displayWord}
            lang={sourceLang}
            label={sourceLangLabel}
            isPlaying={isSourcePlaying}
            audioUrl={sourceAudioUrl}
            onPlay={(txt, lng, url) => onPlayAudio && onPlayAudio(txt, lng, `audio_source_${displayWord}`, url)}
          />

          {/* Target Audio (if target word exists) */}
          {displayTarget && (
            <WordAudioButton
              text={displayTarget}
              lang={targetLang}
              label={targetLangLabel}
              isPlaying={isTargetPlaying}
              audioUrl={targetAudioUrl}
              onPlay={(txt, lng, url) => onPlayAudio && onPlayAudio(txt, lng, `audio_target_${displayTarget}`, url)}
            />
          )}
        </div>

        {/* Save Word Toggle Button (44x44) */}
        {onToggleSave && (
          <button
            type="button"
            onClick={onToggleSave}
            disabled={saving}
            aria-pressed={saved}
            aria-label={saved ? `Kata ${displayWord} tersimpan` : `Simpan kata ${displayWord}`}
            title={saved ? 'Tersimpan di kosakata' : 'Simpan kata ke kosakata'}
            className={`min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl text-xs font-bold border transition-all inline-flex items-center gap-1.5 select-none ${
              saved
                ? 'bg-[var(--cr-btn-primary-bg)] border-[var(--cr-btn-primary-bg)] text-[var(--cr-btn-primary-text)] shadow-xs'
                : 'bg-[var(--cr-bg-surface)] border-[var(--cr-border-subtle)] text-[var(--cr-text-secondary)] hover:border-[var(--cr-border-interactive)] hover:text-[var(--cr-text-primary)]'
            }`}
          >
            {saved ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>Tersimpan</span>
              </>
            ) : (
              <>
                <Bookmark className="w-4 h-4" />
                <span>Simpan</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export default DrawerHeader
