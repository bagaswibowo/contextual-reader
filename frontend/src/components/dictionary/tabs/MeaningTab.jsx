import React from 'react'
import { Volume2, Sparkles, Languages, MessageSquare } from 'lucide-react'
import { PronunciationWidget } from '../../PronunciationWidget'

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
 * Meaning tab: pronunciation, the meaning in this sentence, the other senses,
 * and example sentences in daily use. Everything is read from one dictionary
 * response, so opening a word needs no second request.
 */
export function MeaningTab({
  word = '',
  entry = null,
  sourceLang = 'en',
  targetLang = 'id',
  contextSentence = '',
  onPlayAudio,
  className = '',
}) {
  if (!entry) return null

  const ipa = entry.pronunciation?.ipa || entry.phonetic_ipa || ''
  const romanization = entry.pronunciation?.romanization || ''
  const meaning = entry.mother_meaning || entry.contextual_meaning || ''
  const translations = Array.isArray(entry.translations_table) ? entry.translations_table : []
  const otherMeanings = Array.isArray(entry.other_meanings) ? entry.other_meanings : []
  const examples = Array.isArray(entry.examples) ? entry.examples : []

  const senses = translations.length > 0
    ? translations.map((item) => ({
        label: item.target_word,
        pos: item.pos,
      }))
    : otherMeanings.map((item) => {
        const [pos, rest] = String(item).split(':')
        return rest ? { label: rest.trim(), pos: pos.trim() } : { label: String(item), pos: '' }
      })

  return (
    <div className={`space-y-4 pb-2 ${className}`}>
      {/* Meaning in this sentence */}
      {meaning && (
        <section
          aria-labelledby="block-context-meaning"
          className="rounded-2xl bg-[var(--cr-highlight-word-hover)] px-4 py-4"
        >
          <BlockLabel icon={Sparkles} tone="accent" id="block-context-meaning">
            Arti di kalimat ini
          </BlockLabel>
          <p className="mt-1.5 font-heading text-[26px] font-extrabold leading-[1.12] text-[var(--cr-text-primary)]">
            {meaning}
          </p>
          {contextSentence && (
            <blockquote className="mt-2 border-l-2 border-[var(--cr-text-accent)] pl-2.5 text-[12px] italic leading-relaxed text-[var(--cr-text-secondary)] line-clamp-3">
              &ldquo;{contextSentence}&rdquo;
            </blockquote>
          )}
        </section>
      )}

      {/* Pronunciation: the phoneme guide that used to live in the old drawer */}
      <section aria-labelledby="block-pronunciation" className="space-y-2">
        <BlockLabel icon={Volume2} id="block-pronunciation">
          Cara baca
        </BlockLabel>

        <div className="rounded-2xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-heading text-lg font-extrabold text-[var(--cr-text-primary)]">{word}</span>
            {ipa && (
              <span className="rounded bg-[var(--cr-highlight-word-hover)] px-1.5 py-0.5 font-mono text-[12px] font-bold text-[var(--cr-text-accent)]">
                /{ipa.replace(/^\/|\/$/g, '')}/
              </span>
            )}
            {romanization && (
              <span className="font-mono text-[11px] text-[var(--cr-text-secondary)]">[{romanization}]</span>
            )}
            <button
              type="button"
              onClick={() => onPlayAudio && onPlayAudio(word, sourceLang)}
              aria-label={`Dengarkan cara baca ${word}`}
              className="ml-auto inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold cr-press-outline"
            >
              <Volume2 className="h-4 w-4" />
              Dengar
            </button>
          </div>
        </div>

        <PronunciationWidget
          word={word}
          ipa={ipa}
          transliteration={romanization}
          showVisemeGuide={true}
          compact={true}
          lang={sourceLang}
          translatedWord={meaning}
          translatedLang={targetLang}
        />
      </section>

      {/* Other meanings */}
      {senses.length > 0 && (
        <section aria-labelledby="block-other-meanings" className="space-y-2">
          <BlockLabel icon={Languages} id="block-other-meanings">
            Makna lain
          </BlockLabel>
          <ul className="space-y-1.5">
            {senses.map((item, idx) => (
              <li
                key={`${item.label}-${idx}`}
                className="flex items-start gap-2 rounded-xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] px-3 py-2"
              >
                {item.pos && (
                  <span className="mt-0.5 shrink-0 rounded bg-[var(--cr-bg-surface)] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[var(--cr-text-secondary)]">
                    {item.pos}
                  </span>
                )}
                <span className="text-[13px] font-semibold leading-snug text-[var(--cr-text-primary)]">
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Everyday examples */}
      {examples.length > 0 && (
        <section aria-labelledby="block-examples" className="space-y-2">
          <BlockLabel icon={MessageSquare} id="block-examples">
            Contoh dalam keseharian
          </BlockLabel>
          <div className="space-y-2.5">
            {examples.map((example, idx) => {
              const sourceText = example.source_text || ''
              const targetText = example.target_text || ''
              return (
                <div
                  key={`example-${idx}`}
                  className="rounded-xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-semibold leading-relaxed text-[var(--cr-text-primary)]">
                      {sourceText}
                    </p>
                    {sourceText && (
                      <button
                        type="button"
                        onClick={() => onPlayAudio && onPlayAudio(sourceText, sourceLang)}
                        aria-label={`Dengarkan contoh kalimat: ${sourceText}`}
                        className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-[var(--cr-text-secondary)] hover:bg-[var(--cr-bg-surface)]"
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {targetText && (
                    <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--cr-text-secondary)]">
                      {targetText}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

export default MeaningTab
