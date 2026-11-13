import React from 'react'
import { Bookmark, Check, X } from 'lucide-react'
import { WordAudioButton } from './widgets/WordAudioButton'

const LANGUAGE_LABELS = {
  id: 'Indonesia',
  en: 'Inggris',
  es: 'Spanyol',
  fr: 'Prancis',
  de: 'Jerman',
  ja: 'Jepang',
  ko: 'Korea',
  zh: 'Mandarin',
  ar: 'Arab',
  ru: 'Rusia',
}

function languageLabel(code) {
  const key = (code || '').toLowerCase()
  return LANGUAGE_LABELS[key] || (code ? code.toUpperCase() : 'Asal')
}

/**
 * DrawerHeader
 * Word title, IPA, dual audio, save toggle and close (DESIGN §3.2).
 * Compact on mobile so the sheet keeps room for content (AC-WI-04, AC-WI-05, AC-WI-06).
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

  return (
    <div
      className={`shrink-0 border-b border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] px-4 pt-3 pb-3 sm:px-5 sm:pt-4 sm:pb-4 ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2
            id="cr-drawer-word-title"
            className="font-heading text-[22px] font-extrabold leading-[1.15] text-[var(--cr-text-primary)] break-words [overflow-wrap:anywhere] sm:text-2xl"
          >
            {displayWord}
          </h2>

          <div className="mt-0.5 flex items-baseline gap-2">
            {ipa ? (
              <span className="font-mono text-[13px] text-[var(--cr-text-secondary)]">
                {ipa.startsWith('/') ? ipa : `/${ipa}/`}
              </span>
            ) : (
              <span
                aria-label="Fonetik tidak tersedia"
                className="font-mono text-[13px] text-[var(--cr-text-secondary)] opacity-60"
              >
                —
              </span>
            )}
            {displayTarget && (
              <span className="truncate text-[13px] font-semibold text-[var(--cr-text-accent)]">
                {displayTarget}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup kamus"
          className="min-h-[44px] min-w-[44px] -mr-1 -mt-1 inline-flex shrink-0 items-center justify-center rounded-xl text-[var(--cr-text-secondary)] transition-colors hover:bg-[var(--cr-bg-surface)] hover:text-[var(--cr-text-primary)]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <WordAudioButton
            text={displayWord}
            lang={sourceLang}
            label={languageLabel(sourceLang)}
            isPlaying={isSourcePlaying}
            audioUrl={sourceAudioUrl}
            onPlay={(txt, lng, url) =>
              onPlayAudio && onPlayAudio(txt, lng, `audio_source_${displayWord}`, url)
            }
          />

          {displayTarget && (
            <WordAudioButton
              text={displayTarget}
              lang={targetLang}
              label={languageLabel(targetLang)}
              isPlaying={isTargetPlaying}
              audioUrl={targetAudioUrl}
              onPlay={(txt, lng, url) =>
                onPlayAudio && onPlayAudio(txt, lng, `audio_target_${displayTarget}`, url)
              }
            />
          )}
        </div>

        {onToggleSave && (
          <button
            type="button"
            onClick={onToggleSave}
            disabled={saving}
            aria-pressed={saved}
            aria-label={saved ? `Kata ${displayWord} tersimpan` : `Simpan kata ${displayWord}`}
            title={saved ? 'Tersimpan di kosakata' : 'Simpan kata ke kosakata'}
            className={`min-h-[44px] min-w-[44px] shrink-0 rounded-xl border px-2.5 text-xs font-bold transition-colors inline-flex select-none items-center justify-center gap-1.5 sm:px-3.5 ${
              saved
                ? 'border-[var(--cr-btn-primary-bg)] bg-[var(--cr-btn-primary-bg)] text-[var(--cr-btn-primary-text)]'
                : 'border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface)] text-[var(--cr-text-secondary)] hover:border-[var(--cr-border-interactive)] hover:text-[var(--cr-text-primary)]'
            }`}
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                <span className="hidden sm:inline">Tersimpan</span>
              </>
            ) : (
              <>
                <Bookmark className="w-4 h-4" />
                <span className="hidden sm:inline">Simpan</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export default DrawerHeader
