import React, { useState } from 'react'
import { Volume2, BookOpen, GraduationCap } from 'lucide-react'
import { PronunciationWidget } from '../../PronunciationWidget'

function syllabify(guide) {
  const word = String(guide || '').trim()
  if (!word) return []
  const groups = [...word.matchAll(/[aeiouy]+/gi)]
  if (groups.length < 2) return [word]

  const parts = []
  let start = 0
  for (let i = 0; i < groups.length - 1; i += 1) {
    const endOfVowel = groups[i].index + groups[i][0].length
    const startOfNext = groups[i + 1].index
    const cluster = startOfNext - endOfVowel
    const split = cluster <= 1 ? endOfVowel : startOfNext - 1
    parts.push(word.slice(start, split))
    start = split
  }
  parts.push(word.slice(start))
  return parts.filter(Boolean)
}

export function PronunciationTab({
  word = '',
  entry = null,
  sourceLang = 'en',
  targetLang = 'id',
  targetWord = '',
  className = '',
}) {
  const [mode, setMode] = useState('source')

  const ipa = entry?.pronunciation?.ipa || entry?.phonetic_ipa || ''
  const guide = entry?.pronunciation?.guide || ''
  const romanization = entry?.pronunciation?.romanization || ''
  const phonetic = entry?.fonetik || guide || ''

  const second = entry?.pelafalan_bahasa_pilihan || null
  const isTargetMode = mode === 'target' && Boolean(targetWord)
  const activeWord = isTargetMode ? second?.word || targetWord : word
  const activeLang = isTargetMode ? targetLang : sourceLang || entry?.lang || 'en'
  const activeIpa = isTargetMode ? second?.ipa || '' : ipa
  const activePhonetic = isTargetMode ? second?.fonetik || '' : phonetic

  const syllables = isTargetMode
    ? Array.isArray(second?.suku_kata) && second.suku_kata.length > 0
      ? second.suku_kata
      : syllabify(second?.fonetik || activeWord)
    : activePhonetic.includes('-')
    ? activePhonetic.split('-').filter(Boolean)
    : Array.isArray(entry?.suku_kata) && entry.suku_kata.length > 0
    ? entry.suku_kata
    : syllabify(activePhonetic || ipa)

  if (!word) return null

  return (
    <div className={`space-y-4 pb-2 ${className}`}>
      <div className="flex gap-1.5 rounded-2xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface)] p-1">
        <button
          type="button"
          onClick={() => setMode('source')}
          aria-pressed={!isTargetMode}
          className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[0.8em] font-extrabold ${
            !isTargetMode
              ? 'bg-[var(--cr-bg-surface-elevated)] text-[var(--cr-text-accent)] shadow-sm'
              : 'text-[var(--cr-text-secondary)]'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          Bahasa buku ({String(sourceLang || 'en').toUpperCase()})
        </button>
        <button
          type="button"
          onClick={() => setMode('target')}
          aria-pressed={isTargetMode}
          className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[0.8em] font-extrabold ${
            isTargetMode
              ? 'bg-[var(--cr-bg-surface-elevated)] text-[var(--cr-text-accent)] shadow-sm'
              : 'text-[var(--cr-text-secondary)]'
          }`}
        >
          <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
          Dipelajari ({String(targetLang || 'id').toUpperCase()})
        </button>
      </div>

      <section className="rounded-2xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] p-4">
        <p className="text-[0.72em] font-extrabold uppercase tracking-[0.12em] text-[var(--cr-text-secondary)]">
          Cara baca
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="font-heading text-[1.55em] font-extrabold text-[var(--cr-text-primary)]">{activeWord}</span>
          {activeIpa ? (
            <span className="rounded bg-[var(--cr-highlight-word-hover)] px-2 py-0.5 font-mono text-[0.82em] font-bold text-[var(--cr-text-accent)]">
              {activeIpa.startsWith('/') ? activeIpa : `/${activeIpa}/`}
            </span>
          ) : (
            <span className="font-mono text-[0.78em] text-[var(--cr-text-secondary)]">
              {isTargetMode ? 'Cara baca mengikuti audio' : 'IPA belum tersedia'}
            </span>
          )}
          {activePhonetic && (
            <span className="rounded bg-[var(--cr-bg-surface)] px-2 py-0.5 text-[0.82em] font-extrabold text-[var(--cr-text-primary)]">
              {activePhonetic}
            </span>
          )}
          {!isTargetMode && romanization && !guide && (
            <span className="font-mono text-[0.78em] text-[var(--cr-text-secondary)]">[{romanization}]</span>
          )}
        </div>
        {activePhonetic && (
          <p className="mt-1.5 text-[0.78em] font-medium text-[var(--cr-text-secondary)]">
            Ejaan baca:{' '}
            <span className="font-bold text-[var(--cr-text-primary)]">{activePhonetic}</span>{' '}
            (huruf besar menandai suku kata yang ditekankan)
          </p>
        )}
      </section>

      {syllables.length > 1 && (
        <section aria-labelledby="block-syllables" className="space-y-2">
          <p id="block-syllables" className="text-[0.72em] font-extrabold uppercase tracking-[0.12em] text-[var(--cr-text-secondary)]">
            Pemecahan suku kata (perkiraan)
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {syllables.map((part, idx) => {
              const stressed = !isTargetMode && /[A-Z]/.test(part)
              return (
                <span
                  key={`${part}-${idx}`}
                  className={`rounded-lg border px-2 py-1 font-mono text-[0.82em] font-bold ${
                    stressed
                      ? 'border-[var(--cr-text-accent)] bg-[var(--cr-highlight-word-hover)] text-[var(--cr-text-accent)]'
                      : 'border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] text-[var(--cr-text-primary)]'
                  }`}
                >
                  {part}
                </span>
              )
            })}
          </div>
        </section>
      )}

      <section aria-labelledby="block-audio" className="space-y-2">
        <p id="block-audio" className="flex items-center gap-1.5 text-[0.72em] font-extrabold uppercase tracking-[0.12em] text-[var(--cr-text-secondary)]">
          <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
          Audio dan gerak bibir
        </p>
        <PronunciationWidget
          key={`${activeWord}-${activeLang}`}
          word={activeWord}
          ipa={activeIpa}
          transliteration={isTargetMode ? '' : romanization}
          showVisemeGuide={true}
          compact={true}
          lang={activeLang}
          speeds={[0.5, 1]}
          speedLabels={{ 0.5: 'Lambat', 1: 'Normal' }}
          showReplay={true}
        />
      </section>
    </div>
  )
}

export default PronunciationTab
