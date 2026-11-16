import React, { useEffect, useRef, useState } from 'react'
import { Globe, Languages, Volume2, X, Lightbulb, RefreshCw, AlertCircle } from 'lucide-react'
import { translationsApi } from '../utils/api'
import { useLanguages } from '../hooks/useLanguages'

function languageName(code, list) {
  const found = (list || []).find((item) => item.code === code)
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
  motherLang = 'id',
  translationEngine = 'google',
  customConfig = {},
  onPlayAudio,
  onOpenWord,
  onClose,
}) {
  const [lang, setLang] = useState(targetLang || 'id')
  const [state, setState] = useState({ loading: false, error: null, data: null, motherText: '', targetText: '' })
  const [attempt, setAttempt] = useState(0)
  const [fontSize, setFontSize] = useState(() => {
    if (typeof window === 'undefined') return 16
    const saved = Number(localStorage.getItem('cr_sentence_font'))
    return saved >= 13 && saved <= 22 ? saved : 16
  })
  const [interlinear, setInterlinear] = useState({ loading: false, words: [], structure: null, grammar: null })
  const languages = useLanguages()
  const panelRef = useRef(null)
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  )

  useEffect(() => {
    setLang(targetLang || 'id')
  }, [targetLang, sentenceId])

  useEffect(() => {
    try { localStorage.setItem('cr_sentence_font', String(fontSize)) } catch (e) {}
  }, [fontSize])

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
    setState({ loading: true, error: null, data: null, motherText: '', targetText: '' })

    translationsApi
      .sentenceLayers(sentenceId, lang, motherLang, translationEngine, customConfig)
      .then((res) => {
        if (!active) return
        const data = res.data || {}
        const layers = data.layers || null
        if (layers) {
          setState({
            loading: false,
            error: null,
            data,
            motherText: layers.mother?.text || '',
            targetText: layers.target?.text || data.indonesian_text || '',
          })
          return
        }
        // Older backend: fall back to two calls.
        const motherRequest =
          String(lang).toLowerCase() === String(motherLang).toLowerCase()
            ? Promise.resolve(null)
            : translationsApi
                .sentence(sentenceId, motherLang, translationEngine, customConfig)
                .catch(() => null)
        return motherRequest.then((motherRes) => {
          if (!active) return
          setState({
            loading: false,
            error: null,
            data,
            motherText: motherRes?.data?.indonesian_text || '',
            targetText: data.indonesian_text || '',
          })
        })
      })
      .catch((err) => {
        if (!active) return
        setState({ loading: false, error: err.message || 'Gagal menerjemahkan kalimat', data: null, motherText: '', targetText: '' })
      })
  }, [isOpen, sentenceId, lang, motherLang, translationEngine, attempt])

  useEffect(() => {
    if (!isOpen || !sentenceText) return undefined
    const cacheKey = `cr_interlinear_v3:${sourceLang}:${lang}:${motherLang}:${sentenceText}`
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null')
      if (cached && Array.isArray(cached.words)) {
        setInterlinear(cached)
        return undefined
      }
    } catch (e) {}

    let active = true
    setInterlinear({ loading: true, words: [], structure: null, grammar: null })
    const sameLanguage = String(lang).toLowerCase() === String(motherLang).toLowerCase()
    const targetRequest = translationsApi.interlinear(sentenceText, sourceLang, lang)
    const motherRequest = sameLanguage
      ? Promise.resolve(null)
      : translationsApi.interlinear(sentenceText, sourceLang, motherLang).catch(() => null)

    Promise.all([targetRequest, motherRequest])
      .then(([res, motherRes]) => {
        if (!active) return
        const data = res.data || {}
        const motherWords = motherRes?.data?.words || []
        const words = (data.words || []).map((row, index) => ({
          ...row,
          mother: motherWords[index]?.target || '',
        }))
        const merged = { ...data, words }
        setInterlinear({ loading: false, ...merged })
        try { localStorage.setItem(cacheKey, JSON.stringify(merged)) } catch (e) {}
      })
      .catch(() => {
        if (!active) return
        setInterlinear({ loading: false, words: [], structure: null, grammar: null })
      })

    return () => { active = false }
  }, [isOpen, sentenceId, sentenceText, lang, motherLang, sourceLang])

  if (!isOpen) return null

  const data = state.data || {}
  const notesRaw = data.notes || ''
  const translation = state.targetText || data.indonesian_text || ''

  const colorFor = (role) => {
    if (role === 'subject') return 'text-[var(--cr-text-accent)]'
    if (role === 'predicate') return 'text-[var(--cr-blue-text)]'
    if (role === 'object') return 'text-[var(--cr-yellow-text)]'
    if (role === 'adverbial') return 'text-[var(--cr-text-quaternary)]'
    return 'text-[var(--cr-text-primary)]'
  }

  const structureLayers = [
    { key: 'book', label: 'Bahasa buku', parts: interlinear.structure?.source, fallback: sentenceText },
    { key: 'learning', label: 'Bahasa dipelajari', parts: interlinear.structure?.target, fallback: translation },
    { key: 'mother', label: 'Bahasa induk', parts: interlinear.structure?.mother, fallback: state.motherText },
  ].reduce((layers, { key, label, parts, fallback }) => {
    const items = Array.isArray(parts) && parts.length > 0
      ? parts
      : fallback
      ? [{ text: fallback, color: 'neutral' }]
      : []
    if (items.length === 0) return layers
    const text = items.map((part) => part.text).join(' ')
    if (layers.some((layer) => layer.text === text)) return layers
    layers.push({ key, label, items, text })
    return layers
  }, [])

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
        style={{ fontSize: `${fontSize}px` }}
        className="cr-drawer-enter fixed inset-x-0 bottom-0 z-[61] flex h-[72dvh] max-h-[72dvh] flex-col rounded-t-3xl border-t border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface)] text-[var(--cr-text-primary)] shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:h-full md:max-h-full md:w-[380px] md:rounded-none md:border-l md:border-t-0"
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] px-4 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[0.68em] font-extrabold uppercase tracking-[0.12em] text-[var(--cr-text-secondary)]">
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              Terjemahan kalimat
            </p>
            <h2 id="cr-sentence-panel-title" className="mt-1 font-heading text-[1.1em] font-extrabold leading-tight">
              Kalimat utuh
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <div className="flex items-center rounded-xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface)] p-0.5">
              <button
                type="button"
                onClick={() => setFontSize((value) => Math.max(13, value - 1))}
                disabled={fontSize <= 13}
                aria-label="Perkecil teks panel"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[0.8em] font-extrabold text-[var(--cr-text-secondary)] disabled:opacity-40"
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => setFontSize((value) => Math.min(22, value + 1))}
                disabled={fontSize >= 22}
                aria-label="Perbesar teks panel"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[0.9em] font-extrabold text-[var(--cr-text-secondary)] disabled:opacity-40"
              >
                A+
              </button>
            </div>
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
            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.68em] font-extrabold uppercase tracking-[0.12em] text-[var(--cr-text-secondary)]">
                Kalimat asli ({languageName(sourceLang, languages)})
              </span>
              {onPlayAudio && (
                <button
                  type="button"
                  onClick={() => onPlayAudio(sentenceText, sourceLang, `sentence_book_${sentenceId}`)}
                  aria-label="Dengarkan kalimat bahasa buku"
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--cr-text-secondary)] hover:bg-[var(--cr-bg-surface)]"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="mt-1.5 font-body text-[0.95em] italic leading-relaxed text-[var(--cr-text-primary)]">
              &ldquo;{sentenceText}&rdquo;
            </p>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[0.68em] font-extrabold uppercase tracking-[0.12em] text-[var(--cr-text-secondary)]">
                <Languages className="h-3.5 w-3.5" aria-hidden="true" />
                Bahasa dipelajari ({languageName(lang, languages)})
              </span>
              {onPlayAudio && translation && (
                <button
                  type="button"
                  onClick={() => onPlayAudio(translation, lang, `sentence_target_${sentenceId}_${lang}`)}
                  aria-label="Dengarkan kalimat bahasa yang dipelajari"
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--cr-text-secondary)] hover:bg-[var(--cr-bg-surface)]"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
              )}
              <label className="sr-only" htmlFor="sentence-lang">Bahasa terjemahan</label>
              <select
                id="sentence-lang"
                value={lang}
                onChange={(event) => setLang(event.target.value)}
                className="min-h-[44px] rounded-xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] px-2 text-[0.8em] font-extrabold text-[var(--cr-text-primary)]"
              >
                {languages.map((item) => (
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
                  <p className="flex items-center gap-1.5 text-[0.8em] font-bold text-[var(--cr-text-danger)]">
                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    {state.error}
                  </p>
                  <button
                    type="button"
                    onClick={() => setAttempt((value) => value + 1)}
                    className="btn-outline px-3 py-2 text-[0.8em]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Coba lagi
                  </button>
                </div>
              ) : translation ? (
                <p className="font-heading text-[1.1em] font-extrabold leading-relaxed text-[var(--cr-text-primary)]">
                  {translation}
                </p>
              ) : (
                <p className="text-[0.8em] font-semibold text-[var(--cr-text-secondary)]">
                  Terjemahan belum tersedia untuk kalimat ini.
                </p>
              )}
            </div>
          </section>

          {String(lang).toLowerCase() !== String(motherLang).toLowerCase() && (
            <section className="space-y-2">
              <span className="flex items-center gap-1.5 text-[0.68em] font-extrabold uppercase tracking-[0.12em] text-[var(--cr-text-secondary)]">
                <Languages className="h-3.5 w-3.5" aria-hidden="true" />
                Bahasa induk ({languageName(motherLang, languages)})
              </span>
              {onPlayAudio && state.motherText && (
                <button
                  type="button"
                  onClick={() => onPlayAudio(state.motherText, motherLang, `sentence_mother_${sentenceId}_${motherLang}`)}
                  aria-label="Dengarkan kalimat bahasa induk"
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--cr-text-secondary)] hover:bg-[var(--cr-bg-surface)]"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
              )}
              <div className="rounded-2xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] p-4">
                {state.loading ? (
                  <div className="space-y-2" aria-busy="true">
                    <div className="cr-skeleton h-4 w-2/3 rounded" />
                    <div className="cr-skeleton h-4 w-full rounded" />
                  </div>
                ) : state.motherText ? (
                  <p className="font-heading text-[1em] font-extrabold leading-relaxed text-[var(--cr-text-primary)]">
                    {state.motherText}
                  </p>
                ) : (
                  <p className="text-[0.8em] font-semibold text-[var(--cr-text-secondary)]">
                    Terjemahan bahasa induk belum tersedia.
                  </p>
                )}
              </div>
            </section>
          )}

          {structureLayers.length > 0 && (
            <section className="space-y-2.5 rounded-2xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] p-3.5">
              <span className="text-[0.68em] font-extrabold uppercase tracking-[0.12em] text-[var(--cr-text-secondary)]">
                Susunan kalimat
              </span>

              {structureLayers.map(({ key, label, items }) => (
                <div key={key} data-structure-layer={key}>
                  <p className="mb-1 text-[0.68em] font-bold text-[var(--cr-text-secondary)]">{label}</p>
                  <p className="text-[max(12px,0.8em)] leading-relaxed">
                    {items.map((part, index) => (
                      <React.Fragment key={`${key}-${index}`}>
                        {index > 0 && ' '}
                        <span className={`font-bold ${colorFor(part.color)}`}>{part.text}</span>
                      </React.Fragment>
                    ))}
                  </p>
                </div>
              ))}

              {(interlinear.grammar?.tense || data.tense) && (
                <p className="text-[0.8em] font-bold text-[var(--cr-text-primary)]">
                  {interlinear.grammar?.tense || data.tense}
                </p>
              )}
              {interlinear.grammar?.note && (
                <p className="text-[0.72em] leading-relaxed text-[var(--cr-text-secondary)]">
                  {interlinear.grammar.note}
                </p>
              )}
            </section>
          )}

          <section className="space-y-2 rounded-2xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] p-3.5">
            <span className="text-[0.68em] font-extrabold uppercase tracking-[0.12em] text-[var(--cr-text-secondary)]">
              Terjemahan per kata
            </span>
            {interlinear.loading ? (
              <div className="flex flex-wrap gap-1.5" aria-busy="true">
                {[0, 1, 2, 3, 4].map((index) => (
                  <div key={index} className="cr-skeleton h-12 w-20 rounded-xl" />
                ))}
              </div>
            ) : Array.isArray(interlinear.words) && interlinear.words.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {interlinear.words.map((row, index) => (
                  <button
                    key={`${row.source}-${index}`}
                    type="button"
                    onClick={() => onOpenWord && onOpenWord(row.source)}
                    className="min-h-[44px] rounded-xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface)] px-2 py-1 text-left hover:border-[var(--cr-text-accent)]"
                    title={row.alternatives?.length ? `Arti lain: ${row.alternatives.join(', ')}` : row.source}
                  >
                    <span className="block text-[max(12px,0.8em)] font-bold leading-tight text-[var(--cr-text-primary)]">{row.source}</span>
                    <span className="block text-[max(12px,0.8em)] font-semibold leading-tight text-[var(--cr-text-accent)]">
                      {row.target || '-'}
                    </span>
                    {row.mother && row.mother !== row.target && (
                      <span className="block text-[max(12px,0.8em)] font-normal leading-tight text-[var(--cr-text-tertiary)]">
                        {row.mother}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[0.8em] text-[var(--cr-text-secondary)]">
                Terjemahan per kata belum tersedia untuk kalimat ini.
              </p>
            )}
            <p className="text-[0.68em] text-[var(--cr-text-secondary)]">
              Ketuk kata untuk membuka panel kata; arti alternatif ada di tab Arti.
            </p>
          </section>

          {notesRaw && (
            <section className="flex gap-2 rounded-2xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] p-3.5">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cr-yellow-text)]" aria-hidden="true" />
              <div>
                <span className="text-[0.68em] font-extrabold uppercase tracking-[0.12em] text-[var(--cr-text-secondary)]">
                  Catatan konteks
                </span>
                <p className="mt-1 text-[0.8em] font-semibold leading-relaxed text-[var(--cr-text-primary)]">
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
