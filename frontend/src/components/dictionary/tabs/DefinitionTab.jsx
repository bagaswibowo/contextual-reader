import React from 'react'
import { BookOpen, Languages } from 'lucide-react'

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
 * Definition tab: the word explained in the reader's chosen mother tongue.
 * Senses come from the dictionary enrichment grouped by part of speech.
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
  const otherMeanings = Array.isArray(entry.other_meanings) ? entry.other_meanings : []

  const grouped = new Map()
  translations.forEach((item) => {
    const pos = (item.pos || 'umum').toLowerCase()
    if (!grouped.has(pos)) grouped.set(pos, [])
    if (item.target_word) grouped.get(pos).push(item)
  })

  if (grouped.size === 0) {
    otherMeanings.forEach((item) => {
      const [maybePos, rest] = String(item).split(':')
      const pos = rest ? maybePos.trim().toLowerCase() : 'umum'
      const label = rest ? rest.trim() : String(item)
      if (!grouped.has(pos)) grouped.set(pos, [])
      grouped.get(pos).push({ target_word: label, back_translations: [] })
    })
  }

  const groups = Array.from(grouped.entries())

  return (
    <div className={`space-y-4 pb-2 ${className}`}>
      <section className="flex items-start gap-3 rounded-2xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--cr-highlight-word-hover)]">
          <Languages className="h-4 w-4 text-[var(--cr-text-accent)]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--cr-text-secondary)]">
            Definisi dalam {languageName(motherLang)}
          </p>
          <p className="mt-1 font-heading text-lg font-extrabold leading-tight text-[var(--cr-text-primary)]">
            {motherMeaning || word}
          </p>
        </div>
      </section>

      {groups.length > 0 ? (
        <div className="space-y-3">
          {groups.map(([pos, items]) => (
            <section
              key={pos}
              className="rounded-2xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] p-4"
            >
              <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--cr-text-secondary)]">
                {pos}
              </p>
              <ul className="mt-2 space-y-2">
                {items.map((item, idx) => (
                  <li key={`${item.target_word}-${idx}`} className="text-[13px] leading-relaxed text-[var(--cr-text-primary)]">
                    <span className="font-semibold">{item.target_word}</span>
                    {Array.isArray(item.back_translations) && item.back_translations.length > 0 && (
                      <span className="mt-0.5 block text-[11px] text-[var(--cr-text-secondary)]">
                        Padanan: {item.back_translations.join(', ')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] p-4 text-[12px] text-[var(--cr-text-secondary)]">
          Definisi dalam bahasa induk belum tersedia untuk kata ini.
        </p>
      )}

      <section className="rounded-2xl border border-[var(--cr-border-subtle)] p-4">
        <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--cr-text-secondary)]">
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          Definisi asli ({languageName(entry.lang || 'en')})
        </p>
        <ol className="mt-2 space-y-2">
          {(entry.definitions || entry.senses || []).slice(0, 4).map((item, idx) => (
            <li key={`def-${idx}`} className="flex gap-2 text-[12px] leading-relaxed text-[var(--cr-text-secondary)]">
              <span className="mt-0.5 shrink-0 font-mono text-[10px] font-bold">{idx + 1}</span>
              <span>
                {item.definition || item.meaning}
                {item.example_phrase && (
                  <span className="mt-0.5 block italic">&ldquo;{item.example_phrase}&rdquo;</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

export default DefinitionTab
