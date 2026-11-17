import React, { useState } from 'react'
import { BookOpen, GraduationCap, Languages } from 'lucide-react'
import { posLabel } from './MeaningTabShared'
import { LayeredLines } from '../widgets/ExampleLayers'

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

function DictionaryList({ items, emptyText, contextKey, word, onOpenWord }) {
  if (!Array.isArray(items) || items.length === 0) {
    return (
      <p className="rounded-2xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] p-4 text-[0.85em] text-[var(--cr-text-secondary)]">
        {emptyText}
      </p>
    )
  }

  return (
    <ol className="space-y-2">
      {items.map((item, idx) => {
        const matchesContext =
          contextKey &&
          String(item.makna || '').toLowerCase().trim() === String(contextKey).toLowerCase().trim()
        return (
          <li
            key={`${item.makna}-${idx}`}
            className={`rounded-2xl border p-4 ${
              item.sesuai_konteks || matchesContext
                ? 'border-[var(--cr-btn-primary-shadow)] bg-[var(--cr-highlight-word-hover)]'
                : 'border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)]'
            }`}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[0.72em] font-bold text-[var(--cr-text-secondary)]">{idx + 1}.</span>
              {item.kelas_kata && (
                <span className="rounded bg-[var(--cr-bg-surface)] px-1.5 py-0.5 text-[0.68em] font-bold uppercase text-[var(--cr-text-secondary)]">
                  {posLabel(item.kelas_kata)}
                </span>
              )}
              {(item.sesuai_konteks || matchesContext) && (
                <span className="rounded bg-[var(--cr-bg-surface-elevated)] px-1.5 py-0.5 text-[0.66em] font-extrabold uppercase text-[var(--cr-text-accent)]">
                  sesuai konteks
                </span>
              )}
            </div>
            <p className="mt-1 text-[0.92em] font-semibold leading-relaxed text-[var(--cr-text-primary)]">
              {item.makna}
            </p>
            {item.contoh && (
              <div className="mt-1 text-[0.78em] italic leading-relaxed text-[var(--cr-text-secondary)]">
                <LayeredLines
                  book={typeof item.contoh === 'string' ? item.contoh : item.contoh.text_book || item.contoh.source_text}
                  learning={typeof item.contoh === 'object' ? item.contoh.text_learning : ''}
                  mother={typeof item.contoh === 'object' ? item.contoh.text_mother || item.contoh.target_text : ''}
                  highlightWord={word}
                  onOpenWord={onOpenWord}
                />
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Definisi tab with two sub-tabs: mother tongue and studied language, so the
 * panel does not turn into one long scroll.
 */
export function DefinitionTab({
  entry = null,
  word = '',
  motherLang = 'id',
  targetLang = 'id',
  onOpenWord,
  className = '',
}) {
  const [view, setView] = useState('mother')
  if (!entry) return null

  const motherDefinitions = Array.isArray(entry.definisi_bahasa_pilihan)
    ? entry.definisi_bahasa_pilihan
    : []
  const targetDefinitions = Array.isArray(entry.definisi_bahasa_pilihan_lain)
    ? entry.definisi_bahasa_pilihan_lain
    : []
  const motherMeaning = entry.arti_konteks || entry.mother_meaning || entry.contextual_meaning || ''
  const targetMeaning = entry.arti_bahasa_pilihan || ''
  const sameLanguage = String(motherLang).toLowerCase() === String(targetLang).toLowerCase()

  const activeLang = view === 'target' ? targetLang : motherLang
  const activeDefinitions = view === 'target' ? targetDefinitions : motherDefinitions
  const activeMeaning = view === 'target' ? targetMeaning : motherMeaning

  return (
    <div className={`space-y-3 pb-2 ${className}`}>
      <div className="flex gap-1.5 rounded-2xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface)] p-1">
        <button
          type="button"
          onClick={() => setView('mother')}
          aria-pressed={view === 'mother'}
          className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[0.78em] font-extrabold ${
            view === 'mother'
              ? 'bg-[var(--cr-bg-surface-elevated)] text-[var(--cr-text-accent)] shadow-sm'
              : 'text-[var(--cr-text-secondary)]'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          {languageName(motherLang)} (induk)
        </button>
        <button
          type="button"
          onClick={() => setView('target')}
          aria-pressed={view === 'target'}
          className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[0.78em] font-extrabold ${
            view === 'target'
              ? 'bg-[var(--cr-bg-surface-elevated)] text-[var(--cr-text-accent)] shadow-sm'
              : 'text-[var(--cr-text-secondary)]'
          }`}
        >
          <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
          {languageName(targetLang)} (dipelajari)
        </button>
      </div>

      <section className="rounded-2xl border border-[var(--cr-btn-primary-shadow)] bg-[var(--cr-highlight-word-hover)] p-4">
        <p className="flex items-center gap-1.5 text-[0.72em] font-extrabold uppercase tracking-[0.12em] text-[var(--cr-text-accent)]">
          <Languages className="h-3.5 w-3.5" aria-hidden="true" />
          Kamus {languageName(activeLang)}
        </p>
        <p className="mt-1 font-heading text-[1.15em] font-extrabold leading-tight text-[var(--cr-text-primary)]">
          {activeMeaning || word}
        </p>
        <p className="mt-1 text-[0.78em] font-semibold text-[var(--cr-text-secondary)]">
          Makna yang cocok dengan kalimat yang kamu klik.
        </p>
      </section>

      <DictionaryList
        items={activeDefinitions}
        contextKey={activeMeaning}
        word={word}
        onOpenWord={onOpenWord}
        emptyText={
          view === 'target' && sameLanguage
            ? 'Bahasa yang dipelajari sama dengan bahasa induk. Pilih bahasa lain di dropdown untuk melihat kamusnya.'
            : `Kamus ${languageName(activeLang)} belum tersedia untuk kata ini.`
        }
      />

      <p className="flex items-center gap-1.5 text-[0.72em] text-[var(--cr-text-secondary)]">
        <BookOpen className="h-3 w-3" aria-hidden="true" />
        Definisi disusun dari makna yang tersedia di kamus {languageName(activeLang)}.
      </p>
    </div>
  )
}

export default DefinitionTab
