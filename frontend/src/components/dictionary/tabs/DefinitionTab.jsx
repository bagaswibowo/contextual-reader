import React from 'react'
import { Sparkles, BookOpen, Layers, MessageSquare, Volume2 } from 'lucide-react'
import { SynonymBadgeCloud } from '../widgets/SynonymBadgeCloud'
import { MeaningVariantRow } from '../widgets/MeaningVariantRow'

/**
 * DefinitionTab
 * Renders strict B1–B5 cards for word insight (AC-WI-01, AC-WI-02, AC-WI-12):
 * B1: Arti di kalimat ini (contextual meaning + quoted sentence)
 * B2: Varian makna (FrequencyMeter + back-translations)
 * B3: Definisi & kelas kata (pos badge + definition list)
 * B4: Sinonim (chip cloud)
 * B5: Contoh dwibahasa terpilih (max 2)
 */
export function DefinitionTab({
  word = '',
  entry = null,
  selectedVariant = null,
  contextSentence = '',
  onSelectVariant,
  onOpenWord,
  onPlayAudio,
  blockErrors = {},
  onRetryBlock,
  className = '',
}) {
  if (!entry) return null

  // Resolve contextual meaning from selected variant or entry
  const activeMeaning = selectedVariant?.target_word ||
    selectedVariant?.meaning ||
    entry.contextual_meaning ||
    (entry.senses && entry.senses[0]?.meaning) ||
    entry.translation ||
    ''

  // Extract variants from translations_table or senses
  const variants = entry.translations_table ||
    (entry.other_meanings && Array.isArray(entry.other_meanings)
      ? entry.other_meanings.map(m => typeof m === 'string' ? { target_word: m, frequency: 2 } : m)
      : [])

  // Extract definitions / senses (max 2 visible)
  const definitions = entry.definitions || (entry.senses ? entry.senses.map(s => ({
    pos: entry.part_of_speech || '',
    definition: s.meaning,
    example_phrase: s.examples?.[0] || '',
    synonyms: s.synonyms || [],
  })) : [])
  const visibleDefs = definitions.slice(0, 2)

  // Extract synonyms
  const allSynonyms = entry.synonyms ||
    definitions.flatMap(d => d.synonyms || []).filter(Boolean)
  const uniqueSynonyms = Array.from(new Set(allSynonyms))

  // Extract examples (max 2 for tab 1)
  const examples = entry.examples || []
  const visibleExamples = examples.slice(0, 2)

  return (
    <div className={`space-y-3.5 pb-4 ${className}`}>
      {/* B1: ARTI DI KALIMAT INI */}
      {activeMeaning && (
        <section
          aria-labelledby="block-b1-title"
          className="p-4 rounded-2xl bg-[var(--cr-bg-surface-elevated)] border-2 border-[var(--cr-border-subtle)] space-y-2"
        >
          <div className="flex items-center justify-between">
            <span
              id="block-b1-title"
              className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--cr-text-accent)] flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Arti di kalimat ini
            </span>
            {entry.confidence && (
              <span className="text-[11px] font-bold text-[var(--cr-text-accent)] bg-[var(--cr-highlight-sentence)] px-2 py-0.5 rounded-md">
                {Math.round(entry.confidence * 100)}% Cocok
              </span>
            )}
          </div>

          <p className="font-heading font-extrabold text-2xl text-[var(--cr-text-primary)] leading-tight">
            {activeMeaning}
          </p>

          {contextSentence && (
            <blockquote className="text-xs italic text-[var(--cr-text-secondary)] border-l-2 border-[var(--cr-border-interactive)] pl-2.5 py-0.5 line-clamp-2">
              &ldquo;{contextSentence}&rdquo;
            </blockquote>
          )}
        </section>
      )}

      {/* B2: VARIAN MAKNA */}
      {variants.length > 0 && (
        <section
          aria-labelledby="block-b2-title"
          className="p-4 rounded-2xl bg-[var(--cr-bg-surface-elevated)] border border-[var(--cr-border-subtle)] space-y-2.5"
        >
          <span
            id="block-b2-title"
            className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--cr-text-secondary)] flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5" />
            Varian Makna
          </span>

          <MeaningVariantRow
            variants={variants}
            selected={activeMeaning}
            onSelect={onSelectVariant}
          />
        </section>
      )}

      {/* B3: DEFINISI & KELAS KATA */}
      <section
        aria-labelledby="block-b3-title"
        className="p-4 rounded-2xl bg-[var(--cr-bg-surface-elevated)] border border-[var(--cr-border-subtle)] space-y-2.5"
      >
        <div className="flex items-center justify-between">
          <span
            id="block-b3-title"
            className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--cr-text-secondary)] flex items-center gap-1.5"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Definisi & Kelas Kata
          </span>
          {entry.part_of_speech && (
            <span className="text-[11px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[var(--cr-bg-surface)] text-[var(--cr-text-secondary)] border border-[var(--cr-border-subtle)]">
              {entry.part_of_speech}
            </span>
          )}
        </div>

        {blockErrors.definitions ? (
          <div className="text-xs text-red-600 dark:text-red-400 space-y-1">
            <p>Definisi belum dapat dimuat.</p>
            {onRetryBlock && (
              <button
                type="button"
                onClick={() => onRetryBlock('definitions')}
                className="text-xs font-bold underline hover:text-[var(--cr-text-accent)]"
              >
                Coba lagi
              </button>
            )}
          </div>
        ) : visibleDefs.length > 0 ? (
          <ol className="space-y-2.5 text-xs text-[var(--cr-text-primary)] leading-relaxed list-decimal list-inside">
            {visibleDefs.map((defItem, idx) => (
              <li key={idx} className="space-y-1">
                <span>{defItem.definition}</span>
                {defItem.example_phrase && (
                  <p className="text-[var(--cr-text-secondary)] italic text-[11px] pl-3">
                    &ldquo;{defItem.example_phrase}&rdquo;
                  </p>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-[var(--cr-text-secondary)]">
            Definisi belum tersedia untuk kata ini.
          </p>
        )}
      </section>

      {/* B4: SINONIM */}
      {uniqueSynonyms.length > 0 && (
        <section
          aria-labelledby="block-b4-title"
          className="p-4 rounded-2xl bg-[var(--cr-bg-surface-elevated)] border border-[var(--cr-border-subtle)] space-y-2.5"
        >
          <span
            id="block-b4-title"
            className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--cr-text-secondary)] flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Sinonim
          </span>

          <SynonymBadgeCloud
            synonyms={uniqueSynonyms}
            maxDisplay={6}
            onSelectWord={onOpenWord}
          />
        </section>
      )}

      {/* B5: CONTOH DWIBHASA (Max 2 for tab 1) */}
      {visibleExamples.length > 0 && (
        <section
          aria-labelledby="block-b5-title"
          className="p-4 rounded-2xl bg-[var(--cr-bg-surface-elevated)] border border-[var(--cr-border-subtle)] space-y-2.5"
        >
          <span
            id="block-b5-title"
            className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--cr-text-secondary)] flex items-center gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Contoh Penggunaan
          </span>

          <div className="space-y-3">
            {visibleExamples.map((ex, idx) => {
              const srcText = ex.source_text || ex.source || ex.en || ''
              const tgtText = ex.target_text || ex.target || ex.id || ''
              const kw = ex.keyword || word

              return (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[var(--cr-bg-surface)] border border-[var(--cr-border-subtle)] text-xs space-y-1.5"
                >
                  <p className="text-[var(--cr-text-primary)] font-medium leading-relaxed">
                    {highlightKeyword(srcText, kw)}
                  </p>
                  {tgtText && (
                    <p className="text-[var(--cr-text-secondary)] leading-relaxed">
                      {tgtText}
                    </p>
                  )}
                  {onPlayAudio && srcText && (
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => onPlayAudio(srcText, 'en')}
                        aria-label={`Dengarkan contoh kalimat: ${srcText}`}
                        className="min-h-[36px] min-w-[36px] p-1.5 rounded-lg text-[var(--cr-text-secondary)] hover:text-[var(--cr-text-primary)] hover:bg-[var(--cr-bg-surface-elevated)] inline-flex items-center gap-1 text-[11px] font-semibold"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Dengarkan</span>
                      </button>
                    </div>
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

/**
 * Highlights keyword occurrence in text without regex injection risks.
 */
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
      <mark className="bg-[var(--cr-highlight-sentence)] text-[var(--cr-text-primary)] font-bold rounded-xs px-1">
        {match}
      </mark>
      {after}
    </>
  )
}

export default DefinitionTab
