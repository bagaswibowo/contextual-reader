import React from 'react'
import { Sparkles, Languages, MessageSquare, Link2 } from 'lucide-react'
import { posLabel } from './MeaningTabShared'

function BlockLabel({ icon: Icon, children, tone = 'muted' }) {
  return (
    <span
      className={`flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] ${
        tone === 'accent' ? 'text-[var(--cr-text-accent)]' : 'text-[var(--cr-text-secondary)]'
      }`}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  )
}

/**
 * Arti tab: contextual meaning (green), a plain definition, the alternative
 * meanings in grey with an example each, clickable synonyms, and the other
 * translations ordered by frequency.
 */
export function MeaningTab({
  word = '',
  entry = null,
  contextSentence = '',
  onOpenWord,
  className = '',
}) {
  if (!entry) return null

  const meaning = entry.mother_meaning || entry.contextual_meaning || ''
  const translations = Array.isArray(entry.translations_table) ? entry.translations_table : []
  const examples = Array.isArray(entry.examples) ? entry.examples : []
  const synonyms = Array.isArray(entry.synonyms) ? entry.synonyms : []

  const primaryKey = String(meaning || '').toLowerCase().trim()
  const seen = new Set([primaryKey])
  const alternatives = translations.filter((item) => {
    const key = String(item.target_word || '').toLowerCase().trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })

  const sortedTranslations = [...translations].sort(
    (a, b) => (b.frequency || 0) - (a.frequency || 0)
  )

  return (
    <div className={`space-y-4 pb-2 ${className}`}>
      <section className="rounded-2xl border border-[var(--cr-btn-primary-shadow)] bg-[var(--cr-highlight-word-hover)] px-4 py-4">
        <BlockLabel icon={Sparkles} tone="accent">
          Arti di kalimat ini
        </BlockLabel>
        <p className="mt-1.5 font-heading text-[26px] font-extrabold leading-[1.12] text-[var(--cr-text-primary)]">
          {meaning || word}
        </p>
        {entry.part_of_speech && (
          <span className="mt-1 inline-block rounded bg-[var(--cr-bg-surface-elevated)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--cr-text-secondary)]">
            {posLabel(entry.part_of_speech)}
          </span>
        )}
        {contextSentence && (
          <blockquote className="mt-2 border-l-2 border-[var(--cr-text-accent)] pl-2.5 text-[12px] italic leading-relaxed text-[var(--cr-text-secondary)] line-clamp-3">
            &ldquo;{contextSentence}&rdquo;
          </blockquote>
        )}
      </section>

      {alternatives.length > 0 && (
        <section aria-labelledby="block-definition" className="space-y-2">
          <BlockLabel icon={Languages} id="block-definition">
            Definisi sederhana
          </BlockLabel>
          <p className="rounded-xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] px-3 py-2.5 text-[13px] font-semibold leading-relaxed text-[var(--cr-text-primary)]">
            {posLabel(entry.part_of_speech) || 'Kata'} untuk “{word}”:{' '}
            {alternatives.slice(0, 3).map((item) => item.target_word).join(', ')}.
          </p>
        </section>
      )}

      <section aria-labelledby="block-other-meanings" className="space-y-2">
        <BlockLabel icon={Languages} id="block-other-meanings">
          Arti lainnya
        </BlockLabel>
        {alternatives.length > 0 ? (
          <ul className="space-y-2">
            {alternatives.map((item, idx) => {
              const example = examples.length > 0 ? examples[idx % examples.length] : null
              return (
                <li
                  key={`${item.target_word}-${idx}`}
                  className="rounded-xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface)] px-3 py-2.5"
                >
                  <div className="flex items-start gap-2">
                    {item.pos && (
                      <span className="mt-0.5 shrink-0 rounded bg-[var(--cr-bg-surface-elevated)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--cr-text-secondary)]">
                        {posLabel(item.pos)}
                      </span>
                    )}
                    <span className="text-[13px] font-bold leading-snug text-[var(--cr-text-primary)]">
                      {item.target_word}
                    </span>
                  </div>
                  {example?.source_text && (
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--cr-text-secondary)]">
                      “{example.source_text}”
                      {example.target_text && <span className="mt-0.5 block italic">{example.target_text}</span>}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="rounded-xl border border-[var(--cr-border-subtle)] px-3 py-2 text-[12px] text-[var(--cr-text-secondary)]">
            Tidak ada arti alternatif yang tercatat untuk kata ini.
          </p>
        )}
      </section>

      {synonyms.length > 0 && (
        <section aria-labelledby="block-synonyms" className="space-y-2">
          <BlockLabel icon={Link2} id="block-synonyms">
            Sinonim
          </BlockLabel>
          <div className="flex flex-wrap gap-1.5">
            {synonyms.slice(0, 10).map((item, idx) => {
              const text = typeof item === 'string' ? item : item?.word || ''
              if (!text) return null
              return (
                <button
                  key={`${text}-${idx}`}
                  type="button"
                  onClick={() => onOpenWord && onOpenWord(text)}
                  className="min-h-[44px] rounded-xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] px-3 text-xs font-bold text-[var(--cr-text-primary)] hover:border-[var(--cr-text-accent)]"
                >
                  {text}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {sortedTranslations.length > 1 && (
        <section aria-labelledby="block-translations" className="space-y-2">
          <BlockLabel icon={Languages} id="block-translations">
            Terjemahan lainnya
          </BlockLabel>
          <ol className="space-y-1.5">
            {sortedTranslations.slice(0, 6).map((item, idx) => (
              <li
                key={`${item.target_word}-${idx}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] px-3 py-2"
              >
                <span className="text-[13px] font-semibold text-[var(--cr-text-primary)]">
                  {idx + 1}. {item.target_word}
                </span>
                {item.pos && (
                  <span className="text-[10px] font-bold uppercase text-[var(--cr-text-secondary)]">
                    {posLabel(item.pos)}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {examples.length > 0 && (
        <section aria-labelledby="block-examples" className="space-y-2">
          <BlockLabel icon={MessageSquare} id="block-examples">
            Contoh dalam keseharian
          </BlockLabel>
          <div className="space-y-2">
            {examples.slice(0, 3).map((example, idx) => (
              <div
                key={`example-${idx}`}
                className="rounded-xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] p-3"
              >
                <p className="text-[13px] font-semibold leading-relaxed text-[var(--cr-text-primary)]">
                  {example.source_text}
                </p>
                {example.target_text && (
                  <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--cr-text-secondary)]">
                    {example.target_text}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default MeaningTab
