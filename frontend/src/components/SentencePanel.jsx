import React, { useEffect, useRef, useState } from 'react'
import { Globe, Languages, Volume2, X, Lightbulb, RefreshCw, AlertCircle } from 'lucide-react'
import { translationsApi } from '../utils/api'
import { AVAILABLE_LANGUAGES } from '../constants/languages'

function languageName(code) {
  const found = AVAILABLE_LANGUAGES.find((item) => item.code === code)
  return found ? found.name : String(code || '').toUpperCase()
}

/**
 * SentencePanel
 * Full-sentence translation in the same right sidebar as the word card, so the
 * reader never leaves the page for a modal.
 */
export function SentencePanel({
  isOpen = false,
  sentenceId = null,
  sentenceText = '',
  sourceLang = 'en',
  targetLang = 'id',
  translationEngine = 'google',
  customConfig = {},
  onPlayAudio,
  onClose,
}) {
  const [lang, setLang] = useState(targetLang || 'id')
  const [state, setState] = useState({ loading: false, error: null, data: null })
  const [attempt, setAttempt] = useState(0)
  const panelRef = useRef(null)
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  )

  useEffect(() => {
    setLang(targetLang || 'id')
  }, [targetLang, sentenceId])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const query = window.matchMedia('(max-width: 767px)')
    const onChange = (event) => setIsNarrow(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!isOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose && onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return undefined
    const timer = window.setTimeout(() => panelRef.current?.focus({ preventScroll: true }), 0)
    return () => window.clearTimeout(timer)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !sentenceId) return undefined
    let active = true
    setState({ loading: true, error: null, data: null })

    translationsApi
      .sentence(sentenceId, lang, translationEngine, customConfig)
      .then((res) => {
        if (!active) return
        const data = res.data || {}
        setState({ loading: false, error: null, data })
      })
      .catch((err) => {
        if (!active) return
        setState({ loading: false, error: err.message || 'Gagal menerjemahkan kalimat', data: null })
      })

    return () => {
      active = false
    }
  }, [isOpen, sentenceId, lang, translationEngine, attempt])

  if (!isOpen) return null

  const data = state.data || {}
  const notesRaw = data.notes || ''
  const translation = data.indonesian_text || ''

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
        aria-modal={isNarrow ? 'true' : undefined}
        aria-labelledby="cr-sentence-panel-title"
        className="cr-drawer-enter fixed inset-x-0 bottom-0 z-[61] flex h-[72dvh] max-h-[72dvh] flex-col rounded-t-3xl border-t border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface)] text-[var(--cr-text-primary)] shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:h-full md:max-h-full md:w-[380px] md:rounded-none md:border-l md:border-t-0"
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] px-4 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--cr-text-secondary)]">
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              Terjemahan kalimat
            </p>
            <h2 id="cr-sentence-panel-title" className="mt-1 font-heading text-lg font-extrabold leading-tight">
              Kalimat utuh
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onPlayAudio && (
              <button
                type="button"
                onClick={() => onPlayAudio(sentenceText, sourceLang, `sentence_panel_${sentenceId}`)}
                aria-label="Dengarkan kalimat asli"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--cr-text-secondary)] hover:bg-[var(--cr-bg-surface)]"
              >
                <Volume2 className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup terjemahan kalimat"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--cr-text-secondary)] hover:bg-[var(--cr-bg-surface)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="cr-scroll-contain flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <section className="rounded-2xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] p-3.5">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--cr-text-secondary)]">
              Kalimat asli ({languageName(sourceLang)})
            </span>
            <p className="mt-1.5 font-body text-[15px] italic leading-relaxed text-[var(--cr-text-primary)]">
              &ldquo;{sentenceText}&rdquo;
            </p>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--cr-text-secondary)]">
                <Languages className="h-3.5 w-3.5" aria-hidden="true" />
                Terjemahan
              </span>
              <label className="sr-only" htmlFor="sentence-lang">Bahasa terjemahan</label>
              <select
                id="sentence-lang"
                value={lang}
                onChange={(event) => setLang(event.target.value)}
                className="min-h-[44px] rounded-xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] px-2 text-xs font-extrabold text-[var(--cr-text-primary)]"
              >
                {AVAILABLE_LANGUAGES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-[var(--cr-border-subtle)] bg-[var(--cr-highlight-word-hover)] p-4">
              {state.loading ? (
                <div className="space-y-2" aria-busy="true">
                  <div className="cr-skeleton h-4 w-3/4 rounded" />
                  <div className="cr-skeleton h-4 w-full rounded" />
                  <span className="sr-only">Menerjemahkan kalimat</span>
                </div>
              ) : state.error ? (
                <div className="space-y-2" role="alert">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-[var(--cr-text-danger)]">
                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    {state.error}
                  </p>
                  <button
                    type="button"
                    onClick={() => setAttempt((value) => value + 1)}
                    className="btn-outline px-3 py-2 text-xs"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Coba lagi
                  </button>
                </div>
              ) : translation ? (
                <p className="font-heading text-lg font-extrabold leading-relaxed text-[var(--cr-text-primary)]">
                  {translation}
                </p>
              ) : (
                <p className="text-xs font-semibold text-[var(--cr-text-secondary)]">
                  Terjemahan belum tersedia untuk kalimat ini.
                </p>
              )}
            </div>
          </section>

          {(data.tense || data.structure) && (
            <section className="space-y-1.5 rounded-2xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] p-3.5">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--cr-text-secondary)]">
                Struktur
              </span>
              {data.tense && (
                <p className="text-[12px] font-bold text-[var(--cr-text-primary)]">{data.tense}</p>
              )}
              {data.structure && (
                <p className="text-[12px] leading-relaxed text-[var(--cr-text-secondary)]">{data.structure}</p>
              )}
            </section>
          )}

          {notesRaw && (
            <section className="flex gap-2 rounded-2xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] p-3.5">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cr-yellow-text)]" aria-hidden="true" />
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--cr-text-secondary)]">
                  Catatan konteks
                </span>
                <p className="mt-1 text-[12px] font-semibold leading-relaxed text-[var(--cr-text-primary)]">
                  {notesRaw}
                </p>
              </div>
            </section>
          )}
        </div>
      </aside>
    </>
  )
}

export default SentencePanel
