import React from 'react'
import { Volume2 } from 'lucide-react'
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
    // Maximal onset: one consonant goes to the next syllable, the rest stays coda.
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
  audioUrl = '',
  className = '',
}) {
  const ipa = entry?.pronunciation?.ipa || entry?.phonetic_ipa || ''
  const guide = entry?.pronunciation?.guide || ''
  const romanization = entry?.pronunciation?.romanization || ''
  const syllables = syllabify(guide || ipa)

  if (!word) return null

  return (
    <div className={`space-y-4 pb-2 ${className}`}>
      <section className="rounded-2xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] p-4">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--cr-text-secondary)]">
          Cara baca
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="font-heading text-2xl font-extrabold text-[var(--cr-text-primary)]">{word}</span>
          {ipa ? (
            <span className="rounded bg-[var(--cr-highlight-word-hover)] px-2 py-0.5 font-mono text-[13px] font-bold text-[var(--cr-text-accent)]">
              {ipa.startsWith('/') ? ipa : `/${ipa}/`}
            </span>
          ) : (
            <span className="font-mono text-[12px] text-[var(--cr-text-secondary)]">IPA belum tersedia</span>
          )}
          {guide && (
            <span className="rounded bg-[var(--cr-bg-surface)] px-2 py-0.5 text-[13px] font-extrabold text-[var(--cr-text-primary)]">
              {guide}
            </span>
          )}
          {romanization && !guide && (
            <span className="font-mono text-[12px] text-[var(--cr-text-secondary)]">[{romanization}]</span>
          )}
        </div>
        {guide && (
          <p className="mt-1.5 text-[11px] font-medium text-[var(--cr-text-secondary)]">
            Ejaan baca: <span className="font-bold text-[var(--cr-text-primary)]">{guide}</span>
            {guide !== guide.toLowerCase() ? ' (huruf besar = suku kata ditekankan)' : ''}
          </p>
        )}
        {audioUrl && (
          <p className="mt-1 break-all text-[11px] text-[var(--cr-text-secondary)]">
            <Volume2 className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
            Audio tersedia di panduan di bawah, satu tombol putar.
          </p>
        )}
      </section>

      {syllables.length > 1 && (
        <section aria-labelledby="block-syllables" className="space-y-2">
          <p id="block-syllables" className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--cr-text-secondary)]">
            Pemecahan suku kata (perkiraan)
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {syllables.map((part, idx) => {
              const stressed = part === part.toUpperCase() && /[A-Z]/.test(part)
              return (
                <span
                  key={`${part}-${idx}`}
                  className={`rounded-lg border px-2 py-1 font-mono text-[13px] font-bold ${
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
        <p id="block-audio" className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--cr-text-secondary)]">
          Audio dan gerak bibir
        </p>
        <PronunciationWidget
          word={word}
          ipa={ipa}
          transliteration={romanization}
          showVisemeGuide={true}
          compact={true}
          lang={entry?.lang || 'en'}
          speeds={[0.5, 1]}
          speedLabels={{ 0.5: 'Lambat', 1: 'Normal' }}
          showReplay={true}
        />
      </section>
    </div>
  )
}

export default PronunciationTab
