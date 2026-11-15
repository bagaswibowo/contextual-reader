import React from 'react'
import { BookOpen, Languages } from 'lucide-react'
import { posLabel } from './MeaningTabShared'

const LANGUAGE_NAMES = {
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

function languageName(code) {
  return LANGUAGE_NAMES[(code || '').toLowerCase()] || (code || '').toUpperCase()
}

/**
 * Definisi tab: the word explained entirely in the reader's chosen language,
 * grouped by part of speech, with an example sentence for each meaning.
 */
export function DefinitionTab({
  entry = null,
  word = '',
  motherLang = 'id',
  className = '',
}) {
  if (!entry) return null

  const translations = Array.isArray(entry.translations_table) ? entry.translations_table : []
  const motherMeaning = entry.mother_meaning || entry.contextual_meaning || ''
  const examples = Array.isArray(entry.examples) ? entry.examples : []
  const primaryKey = String(motherMeaning || '').toLowerCase().trim()

  const grouped = new Map()
  const seen = new Set()
  translations.forEach((item) => {
    const key = String(item.target_word || '').toLowerCase().trim()
    if (!key || seen.has(key)) return
    seen.add(key)
    const pos = (item.pos || 'umum').toLowerCase()
    if (!grouped.has(pos)) grouped.set(pos, [])
    grouped.get(pos).push(item)
  })

  const groups = Array.from(grouped.entries())

  return (
    <div className={`space-y-3 pb-2 ${className}`}>
      <section className="rounded-2xl border border-[var(--cr-btn-primary-shadow)] bg-[var(--cr-highlight-word-hover)] p-4">
        <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--cr-text-accent)]">
          <Languages className="h-3.5 w-3.5" aria-hidden="true" />
          Definisi dalam {languageName(motherLang)}
        </p>
        <p className="mt-1 font-heading text-lg font-extrabold leading-tight text-[var(--cr-text-primary)]">
          {motherMeaning || word}
        </p>
        <p className="mt-1 text-[11px] font-semibold text-[var(--cr-text-secondary)]">
          Makna yang cocok dengan kalimat yang kamu klik.
        </p>
      </section>

      {groups.length > 0 ? (
        <div className="space-y-3">
          {groups.map(([pos, items]) => (
            <section
              key={pos}
              className="rounded-2xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] p-4"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--cr-text-secondary)]">
                {posLabel(pos)}
              </p>
              <ul className="mt-2 space-y-3">
                {items.map((item, idx) => {
                  const isContext = String(item.target_word || '').toLowerCase().trim() === primaryKey
                  const example = examples.length > 0 ? examples[idx % examples.length] : null
                  return (
                    <li key={`${item.target_word}-${idx}`} className="text-[13px] leading-relaxed">
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                            isContext ? 'bg-[var(--cr-text-accent)]' : 'bg-[var(--cr-border-interactive)]'
                          }`}
                          aria-hidden="true"
                        />
                        <div>
                          <span className="font-bold text-[var(--cr-text-primary)]">{item.target_word}</span>
                          {isContext && (
                            <span className="ml-1.5 rounded bg-[var(--cr-highlight-word-hover)] px-1 py-0.5 text-[9px] font-extrabold uppercase text-[var(--cr-text-accent)]">
                              sesuai konteks
                            </span>
                          )}
                          {example?.source_text && (
                            <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--cr-text-secondary)]">
                              “{example.source_text}”
                              {example.target_text && (
                                <span className="mt-0.5 block italic">{example.target_text}</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] p-4 text-[12px] text-[var(--cr-text-secondary)]">
          Definisi dalam bahasa ini belum tersedia untuk kata ini.
        </p>
      )}

      <p className="flex items-center gap-1.5 text-[10px] text-[var(--cr-text-secondary)]">
        <BookOpen className="h-3 w-3" aria-hidden="true" />
        Definisi disusun dari makna yang tersedia di bahasa {languageName(motherLang)}.
      </p>
    </div>
  )
}

export default DefinitionTab
