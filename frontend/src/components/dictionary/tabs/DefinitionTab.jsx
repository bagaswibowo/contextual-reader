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
 * Definisi tab. Uses definisi_bahasa_pilihan from the dictionary contract:
 * every sense is already in the chosen language, with its own example and a
 * flag for the sense that matches the clicked sentence.
 */
export function DefinitionTab({
  entry = null,
  word = '',
  motherLang = 'id',
  className = '',
}) {
  if (!entry) return null

  const definitions = Array.isArray(entry.definisi_bahasa_pilihan)
    ? entry.definisi_bahasa_pilihan
    : []
  const fallbackMeaning = entry.arti_konteks || entry.mother_meaning || entry.contextual_meaning || ''

  return (
    <div className={`space-y-3 pb-2 ${className}`}>
      <section className="rounded-2xl border border-[var(--cr-btn-primary-shadow)] bg-[var(--cr-highlight-word-hover)] p-4">
        <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--cr-text-accent)]">
          <Languages className="h-3.5 w-3.5" aria-hidden="true" />
          Definisi dalam {languageName(motherLang)}
        </p>
        <p className="mt-1 font-heading text-lg font-extrabold leading-tight text-[var(--cr-text-primary)]">
          {fallbackMeaning || word}
        </p>
        <p className="mt-1 text-[11px] font-semibold text-[var(--cr-text-secondary)]">
          Makna yang cocok dengan kalimat yang kamu klik.
        </p>
      </section>

      {definitions.length > 0 ? (
        <ol className="space-y-2">
          {definitions.map((item, idx) => (
            <li
              key={`${item.makna}-${idx}`}
              className={`rounded-2xl border p-4 ${
                item.sesuai_konteks
                  ? 'border-[var(--cr-btn-primary-shadow)] bg-[var(--cr-highlight-word-hover)]'
                  : 'border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)]'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 font-mono text-[10px] font-bold text-[var(--cr-text-secondary)]">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.kelas_kata && (
                      <span className="rounded bg-[var(--cr-bg-surface)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--cr-text-secondary)]">
                        {posLabel(item.kelas_kata)}
                      </span>
                    )}
                    {item.sesuai_konteks && (
                      <span className="rounded bg-[var(--cr-bg-surface-elevated)] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-[var(--cr-text-accent)]">
                        sesuai konteks
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] font-semibold leading-relaxed text-[var(--cr-text-primary)]">
                    {item.makna}
                  </p>
                  {item.contoh && (
                    <div className="mt-1 text-[11px] italic leading-relaxed text-[var(--cr-text-secondary)]">
                      <p>“{typeof item.contoh === 'string' ? item.contoh : item.contoh.source_text}”</p>
                      {typeof item.contoh === 'object' && item.contoh.target_text && (
                        <p className="not-italic">{item.contoh.target_text}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
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
