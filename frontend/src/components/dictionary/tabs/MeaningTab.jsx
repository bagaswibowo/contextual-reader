import React from 'react'
import { Volume2, Sparkles, Languages, MessageSquare } from 'lucide-react'
import { PronunciationWidget } from '../../PronunciationWidget'

const POS_LABELS = {
  verb: 'kata kerja',
  noun: 'kata benda',
  adjective: 'kata sifat',
  adverb: 'kata keterangan',
  pronoun: 'kata ganti',
  preposition: 'kata depan',
  conjunction: 'kata sambung',
  interjection: 'kata seru',
  determiner: 'kata penentu',
  numeral: 'kata bilangan',
  article: 'kata sandang',
  auxiliary: 'kata bantu',
  'proper noun': 'nama diri',
}

export function posLabel(pos) {
  if (!pos) return ''
  const key = String(pos).toLowerCase().trim()
  return POS_LABELS[key] || String(pos)
}

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
 * Meaning tab: the meaning in this sentence, the other meanings in the chosen
 * language, everyday examples, then pronunciation for the book language only.
 * One audio control, inside the pronunciation block.
 */
export function MeaningTab({
  word = '',
  entry = null,
  sourceLang = 'en',
  contextSentence = '',
  extraExamples = [],
  className = '',
}) {
  if (!entry) return null

  const ipa = entry.pronunciation?.ipa || entry.phonetic_ipa || ''
  const romanization = entry.pronunciation?.romanization || ''
  const meaning = entry.mother_meaning || entry.contextual_meaning || ''
  const translations = Array.isArray(entry.translations_table) ? entry.translations_table : []
  const otherMeanings = Array.isArray(entry.other_meanings) ? entry.other_meanings : []

  const primaryKey = String(meaning || '').toLowerCase().trim()
  const rawSenses = translations.length > 0
    ? translations.map((item) => ({ label: item.target_word, pos: item.pos }))
    : otherMeanings.map((item) => {
        const [pos, rest] = String(item).split(':')
        return rest ? { label: rest.trim(), pos: pos.trim() } : { label: String(item), pos: '' }
      })
  const seenSense = new Set([primaryKey])
  const senses = rawSenses.filter((item) => {
    const key = String(item.label || '').toLowerCase().trim()
    if (!key || seenSense.has(key)) return false
    seenSense.add(key)
    return true
  })

  const seen = new Set()
  const examples = []
  const contextKey = String(contextSentence || '').replace(/\s+/g, ' ').trim().toLowerCase()
  const addExample = (sourceText, targetText = '') => {
    const clean = String(sourceText || '').trim()
    const key = clean.replace(/\s+/g, ' ').toLowerCase()
    if (!clean || seen.has(key) || (contextKey && key === contextKey)) return
    seen.add(key)
    examples.push({ source_text: clean, target_text: targetText })
  }
  ;(entry.examples || []).forEach((item) => addExample(item.source_text, item.target_text))
  extraExamples.forEach((text) => addExample(text))

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

      {/* Other meanings, in the chosen language */}
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
                  <span className="mt-0.5 shrink-0 rounded bg-[var(--cr-bg-surface)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--cr-text-secondary)]">
                    {posLabel(item.pos)}
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

      {/* Everyday examples from the dictionary and this chapter */}
      <section aria-labelledby="block-examples" className="space-y-2">
        <BlockLabel icon={MessageSquare} id="block-examples">
          Contoh dalam keseharian
        </BlockLabel>
        {examples.length > 0 ? (
          <div className="space-y-2.5">
            {examples.slice(0, 5).map((example, idx) => (
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
        ) : (
          <p className="rounded-xl border border-[var(--cr-border-subtle)] px-3 py-2.5 text-[12px] text-[var(--cr-text-secondary)]">
            Belum ada contoh kalimat untuk kata ini. Kalimat yang kamu klik akan
            muncul di sini.
          </p>
        )}
      </section>

      {/* Pronunciation, source language only */}
      <section aria-labelledby="block-pronunciation" className="space-y-2">
        <BlockLabel icon={Volume2} id="block-pronunciation">
          Cara baca ({String(sourceLang || 'en').toUpperCase()})
        </BlockLabel>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] px-3 py-2">
          <span className="font-heading text-lg font-extrabold text-[var(--cr-text-primary)]">{word}</span>
          {ipa ? (
            <span className="rounded bg-[var(--cr-highlight-word-hover)] px-1.5 py-0.5 font-mono text-[12px] font-bold text-[var(--cr-text-accent)]">
              /{ipa.replace(/^\/|\/$/g, '')}/
            </span>
          ) : (
            <span className="font-mono text-[12px] text-[var(--cr-text-secondary)]">
              IPA belum tersedia
            </span>
          )}
          {romanization && (
            <span className="font-mono text-[11px] text-[var(--cr-text-secondary)]">[{romanization}]</span>
          )}
        </div>

        <PronunciationWidget
          word={word}
          ipa={ipa}
          transliteration={romanization}
          showVisemeGuide={true}
          compact={true}
          lang={sourceLang}
        />
      </section>
    </div>
  )
}

export default MeaningTab
