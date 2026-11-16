import React from 'react'
import { Sparkles, Languages, MessageSquare, Link2 } from 'lucide-react'
import { posLabel } from './MeaningTabShared'

function BlockLabel({ icon: Icon, children, tone = 'muted' }) {
  return (
    <span
      className={`flex items-center gap-1.5 text-[0.72em] font-extrabold uppercase tracking-[0.12em] ${
        tone === 'accent' ? 'text-[var(--cr-text-accent)]' : 'text-[var(--cr-text-secondary)]'
      }`}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  )
}

/**
 * Arti tab. Reads the fixed card contract from the dictionary response:
 * arti_konteks, definisi, arti_lain, sinonim and terjemahan_lain.
 */

const LAYER_LINE = 'block text-[max(12px,0.8em)] leading-tight break-words'

/**
 * Three language layers with one size. The hierarchy comes from colour and
 * weight only; empty or repeated layers are hidden.
 */
function LayeredLines({ book = '', learning = '', mother = '' }) {
  const layers = []
  const push = (text, className) => {
    const value = String(text || '').trim()
    if (!value) return
    const key = value.toLowerCase()
    if (layers.length > 0 && layers[layers.length - 1].key === key) return
    layers.push({ value, className, key })
  }
  push(book, 'font-bold text-[var(--cr-text-primary)]')
  push(learning, 'font-semibold text-[var(--cr-text-accent)]')
  push(mother, 'font-normal text-[var(--cr-text-secondary)]')

  if (layers.length === 0) return null
  return (
    <span className="mt-1 block space-y-0.5">
      {layers.map((layer, index) => (
        <span key={`${layer.key}-${index}`} className={`${LAYER_LINE} ${layer.className}`}>
          {layer.value}
        </span>
      ))}
    </span>
  )
}

export function MeaningTab({
  word = '',
  entry = null,
  contextSentence = '',
  extraExamples = [],
  onOpenWord,
  className = '',
}) {
  if (!entry) return null

  const meaning = entry.arti_konteks || entry.mother_meaning || entry.contextual_meaning || ''
  const targetAlternatives = Array.isArray(entry.arti_lain_bahasa_pilihan)
    ? entry.arti_lain_bahasa_pilihan
    : []
  const alternativeMeanings = targetAlternatives.length > 0
    ? targetAlternatives
    : Array.isArray(entry.arti_lain)
    ? entry.arti_lain
    : []
  const synonyms = Array.isArray(entry.sinonim) ? entry.sinonim : entry.synonyms || []
  const otherTranslations = Array.isArray(entry.terjemahan_lain_bahasa_pilihan) && entry.terjemahan_lain_bahasa_pilihan.length > 0
    ? entry.terjemahan_lain_bahasa_pilihan
    : Array.isArray(entry.terjemahan_lain)
    ? entry.terjemahan_lain
    : (entry.translations_table || []).map((item) => item.target_word).filter(Boolean)
  const examples = Array.isArray(entry.examples) ? entry.examples : []
  const bookExamples = Array.isArray(extraExamples) ? extraExamples.filter(Boolean) : []
  const targetMeaning = entry.arti_bahasa_pilihan || ''

  return (
    <div className={`space-y-4 pb-2 ${className}`}>
      <section className="rounded-2xl border border-[var(--cr-btn-primary-shadow)] bg-[var(--cr-highlight-word-hover)] px-4 py-4">
        <BlockLabel icon={Sparkles} tone="accent">
          Arti di kalimat ini
        </BlockLabel>
        <p className="mt-1.5 font-heading text-[1.55em] font-extrabold leading-[1.12] text-[var(--cr-text-primary)]">
          {meaning || word}
        </p>
        {entry.part_of_speech && (
          <span className="mt-1 inline-block rounded bg-[var(--cr-bg-surface-elevated)] px-1.5 py-0.5 text-[0.72em] font-bold uppercase text-[var(--cr-text-secondary)]">
            {posLabel(entry.part_of_speech)}
          </span>
        )}
        {contextSentence && (
          <blockquote className="mt-2 border-l-2 border-[var(--cr-text-accent)] pl-2.5 text-[0.85em] italic leading-relaxed text-[var(--cr-text-secondary)] line-clamp-3">
            &ldquo;{contextSentence}&rdquo;
          </blockquote>
        )}
      </section>

      {targetMeaning && (
        <section aria-labelledby="block-target-meaning" className="space-y-2">
          <BlockLabel icon={Languages} id="block-target-meaning" tone="accent">
            Arti dalam bahasa yang dipelajari
          </BlockLabel>
          <div className="rounded-xl border border-[var(--cr-blue-text)] bg-[rgba(28,176,246,0.10)] px-3 py-2.5">
            <p className="text-[0.92em] font-extrabold leading-relaxed text-[var(--cr-text-primary)]">
              {targetMeaning}
            </p>
            {targetAlternatives.length > 1 && (
              <p className="mt-1 text-[0.78em] font-semibold text-[var(--cr-text-secondary)]">
                {targetAlternatives.map((item) => item.makna).filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="block-other-meanings" className="space-y-2">
        <BlockLabel icon={Languages} id="block-other-meanings">
          Arti lainnya{targetAlternatives.length > 0 ? ` (${String(entry.bahasa_pilihan || '').toUpperCase()})` : ''}
        </BlockLabel>
        {alternativeMeanings.length > 0 ? (
          <ul className="space-y-2">
            {alternativeMeanings.map((item, idx) => (
              <li
                key={`${item.makna}-${idx}`}
                className="rounded-xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface)] px-3 py-2.5"
              >
                <div className="flex items-start gap-2">
                  {item.kelas_kata && (
                    <span className="mt-0.5 shrink-0 rounded bg-[var(--cr-bg-surface-elevated)] px-1.5 py-0.5 text-[0.72em] font-bold uppercase text-[var(--cr-text-secondary)]">
                      {posLabel(item.kelas_kata)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <LayeredLines
                      book={item.meaning_book}
                      learning={item.meaning_learning || item.makna}
                      mother={item.meaning_mother}
                    />
                  </span>
                </div>
                {item.contoh && (
                  <div className="mt-1.5 border-t border-[var(--cr-border-subtle)] pt-1.5">
                    <LayeredLines
                      book={typeof item.contoh === 'string' ? item.contoh : item.contoh.source_text}
                      learning={typeof item.contoh === 'object' ? item.contoh.text_learning : ''}
                      mother={typeof item.contoh === 'object' ? item.contoh.text_mother || item.contoh.target_text : ''}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-[var(--cr-border-subtle)] px-3 py-2 text-[0.85em] text-[var(--cr-text-secondary)]">
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

      {otherTranslations.length > 1 && (
        <section aria-labelledby="block-translations" className="space-y-2">
          <BlockLabel icon={Languages} id="block-translations">
            Terjemahan lainnya
          </BlockLabel>
          <ol className="space-y-1.5">
            {otherTranslations.slice(0, 8).map((text, idx) => (
              <li
                key={`${text}-${idx}`}
                className="flex items-center gap-2 rounded-xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] px-3 py-2 text-[0.92em] font-semibold text-[var(--cr-text-primary)]"
              >
                <span className="text-[0.78em] font-bold text-[var(--cr-text-secondary)]">{idx + 1}</span>
                {text}
              </li>
            ))}
          </ol>
        </section>
      )}

      {(bookExamples.length > 0 || examples.length > 0) && (
        <section aria-labelledby="block-examples" className="space-y-2">
          <BlockLabel icon={MessageSquare} id="block-examples">
            Contoh dalam keseharian
          </BlockLabel>
          <div className="space-y-2">
            {bookExamples.slice(0, 3).map((item, idx) => (
              <div
                key={`book-${idx}`}
                className="rounded-xl border border-[var(--cr-btn-primary-shadow)] bg-[var(--cr-highlight-word-hover)] p-3"
              >
                <span className="text-[0.72em] font-extrabold uppercase tracking-[0.12em] text-[var(--cr-text-accent)]">
                  Dari buku ini
                </span>
                <LayeredLines
                  book={typeof item === 'string' ? item : item.text}
                  learning={typeof item === 'string' ? '' : item.translation}
                />
              </div>
            ))}
            {examples.slice(0, 3).map((example, idx) => (
              <div
                key={`example-${idx}`}
                className="rounded-xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] p-3"
              >
                <LayeredLines
                  book={example.text_book || example.source_text}
                  learning={example.text_learning}
                  mother={example.text_mother || example.target_text}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default MeaningTab
