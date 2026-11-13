import React from 'react'
import { Sparkles, BookOpen, Layers, MessageSquare, Volume2 } from 'lucide-react'
import { SynonymBadgeCloud } from '../widgets/SynonymBadgeCloud'
import { MeaningVariantRow } from '../widgets/MeaningVariantRow'

function BlockLabel({ icon: Icon, id, children, tone = 'muted' }) {
  return (
    <span
      id={id}
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
 * DefinitionTab
 * B1–B5 word insight (AC-WI-01, AC-WI-02, AC-WI-12).
 * Visual hierarchy: one anchoring block (B1), then a single grouped surface for
 * details B3–B5 so the drawer does not read as five identical cards.
 */
export function DefinitionTab({
  word = '',
  entry = null,
  selectedVariant = null,
  contextSentence = '',
  sourceLang = 'en',
  onSelectVariant,
  onOpenWord,
  onPlayAudio,
  blockErrors = {},
  onRetryBlock,
  className = '',
}) {
  if (!entry) return null

  const activeMeaning =
    selectedVariant?.target_word ||
    selectedVariant?.meaning ||
    entry.contextual_meaning ||
    (entry.senses && entry.senses[0]?.meaning) ||
    entry.translation ||
    ''

  const variants =
    entry.translations_table ||
    (entry.other_meanings && Array.isArray(entry.other_meanings)
      ? entry.other_meanings.map((m) =>
          typeof m === 'string' ? { target_word: m, frequency: 2 } : m
        )
      : [])

  const definitions =
    entry.definitions ||
    (entry.senses
      ? entry.senses.map((s) => ({
          pos: entry.part_of_speech || '',
          definition: s.meaning,
          example_phrase: s.examples?.[0] || '',
          synonyms: s.synonyms || [],
        }))
      : [])
  const visibleDefs = definitions.slice(0, 2)

  const allSynonyms = entry.synonyms || definitions.flatMap((d) => d.synonyms || []).filter(Boolean)
  const uniqueSynonyms = Array.from(new Set(allSynonyms))

  const visibleExamples = (entry.examples || []).slice(0, 2)

  const hasDetail = visibleDefs.length > 0 || uniqueSynonyms.length > 0 || visibleExamples.length > 0

  return (
    <div className={`space-y-3.5 pb-2 ${className}`}>
      {/* B1 — anchoring meaning */}
      {activeMeaning && (
        <section
          aria-labelledby="block-b1-title"
          className="relative overflow-hidden rounded-2xl bg-[var(--cr-highlight-word-hover)] px-4 py-4"
        >
          <div className="flex items-center justify-between gap-2">
            <BlockLabel icon={Sparkles} id="block-b1-title" tone="accent">
              Arti di kalimat ini
            </BlockLabel>
            {entry.confidence ? (
              <span className="shrink-0 rounded-full border border-[var(--cr-text-accent)] px-2 py-0.5 text-[10px] font-bold text-[var(--cr-text-accent)]">
                {Math.round(entry.confidence * 100)}% cocok
              </span>
            ) : null}
          </div>

          <p className="mt-1.5 font-heading text-[26px] font-extrabold leading-[1.12] text-[var(--cr-text-primary)]">
            {activeMeaning}
          </p>

          {contextSentence && (
            <blockquote className="mt-2 border-l-2 border-[var(--cr-text-accent)] pl-2.5 text-[12px] italic leading-relaxed text-[var(--cr-text-secondary)] line-clamp-2">
              &ldquo;{contextSentence}&rdquo;
            </blockquote>
          )}
        </section>
      )}

      {/* B2 — meaning variants */}
      {variants.length > 0 && (
        <section aria-labelledby="block-b2-title" className="px-0.5">
          <BlockLabel icon={Layers} id="block-b2-title">
            Varian makna
          </BlockLabel>
          <div className="mt-2">
            <MeaningVariantRow
              variants={variants}
              selected={activeMeaning}
              onSelect={onSelectVariant}
            />
          </div>
        </section>
      )}

      {/* B3–B5 — one grouped detail surface */}
      {hasDetail && (
        <div className="divide-y divide-[var(--cr-border-subtle)] overflow-hidden rounded-2xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)]">
          {/* B3 */}
          <section aria-labelledby="block-b3-title" className="p-4">
            <div className="flex items-center justify-between gap-2">
              <BlockLabel icon={BookOpen} id="block-b3-title">
                Definisi &amp; kelas kata
              </BlockLabel>
              {entry.part_of_speech && (
                <span className="shrink-0 rounded bg-[var(--cr-bg-surface)] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[var(--cr-text-secondary)]">
                  {entry.part_of_speech}
                </span>
              )}
            </div>

            {blockErrors.definitions ? (
              <div className="mt-2 space-y-1 text-[12px] text-[var(--cr-text-danger)]">
                <p>Definisi belum dapat dimuat.</p>
                {onRetryBlock && (
                  <button
                    type="button"
                    onClick={() => onRetryBlock('definitions')}
                    className="font-bold underline underline-offset-2"
                  >
                    Coba lagi
                  </button>
                )}
              </div>
            ) : visibleDefs.length > 0 ? (
              <ol className="mt-2 space-y-2.5">
                {visibleDefs.map((defItem, idx) => (
                  <li key={idx} className="flex gap-2.5 text-[13px] leading-relaxed text-[var(--cr-text-primary)]">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 font-mono text-[10px] font-bold text-[var(--cr-text-secondary)]"
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <span>{defItem.definition}</span>
                      {defItem.example_phrase && (
                        <p className="mt-0.5 text-[11px] italic text-[var(--cr-text-secondary)]">
                          &ldquo;{defItem.example_phrase}&rdquo;
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-[12px] text-[var(--cr-text-secondary)]">
                Definisi belum tersedia untuk kata ini.
              </p>
            )}
          </section>

          {/* B4 */}
          {uniqueSynonyms.length > 0 && (
            <section aria-labelledby="block-b4-title" className="p-4">
              <BlockLabel icon={Sparkles} id="block-b4-title">
                Sinonim
              </BlockLabel>
              <div className="mt-2">
                <SynonymBadgeCloud
                  synonyms={uniqueSynonyms}
                  maxDisplay={6}
                  onSelectWord={onOpenWord}
                />
              </div>
            </section>
          )}

          {/* B5 */}
          {visibleExamples.length > 0 && (
            <section aria-labelledby="block-b5-title" className="p-4">
              <BlockLabel icon={MessageSquare} id="block-b5-title">
                Contoh penggunaan
              </BlockLabel>

              <div className="mt-2 space-y-3">
                {visibleExamples.map((ex, idx) => {
                  const srcText = ex.source_text || ex.source || ex.en || ''
                  const tgtText = ex.target_text || ex.target || ex.id || ''
                  const kw = ex.keyword || word

                  return (
                    <div key={idx} className="space-y-1">
                      <p className="text-[13px] font-medium leading-relaxed text-[var(--cr-text-primary)]">
                        {highlightKeyword(srcText, kw)}
                      </p>
                      {tgtText && (
                        <p className="text-[12px] leading-relaxed text-[var(--cr-text-secondary)]">
                          {tgtText}
                        </p>
                      )}
                      {onPlayAudio && srcText && (
                        <button
                          type="button"
                          onClick={() => onPlayAudio(srcText, sourceLang)}
                          aria-label={`Dengarkan contoh kalimat: ${srcText}`}
                          className="inline-flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold text-[var(--cr-text-secondary)] transition-colors hover:bg-[var(--cr-bg-surface)] hover:text-[var(--cr-text-primary)]"
                        >
                          <Volume2 className="h-4 w-4" />
                          <span>Dengarkan</span>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function highlightKeyword(text, keyword) {
  if (!text || !keyword) return text
  const lowerText = text.toLowerCase()
  const lowerKw = keyword.toLowerCase()
  const matchIdx = lowerText.indexOf(lowerKw)
  if (matchIdx === -1) return text

  const before = text.slice(0, matchIdx)
  const match = text.slice(matchIdx, matchIdx + keyword.length)
  const after = text.slice(matchIdx + keyword.length)

  return (
    <>
      {before}
      <mark className="rounded-sm bg-[var(--cr-highlight-sentence)] px-1 font-bold text-[var(--cr-text-primary)]">
        {match}
      </mark>
      {after}
    </>
  )
}

export default DefinitionTab
