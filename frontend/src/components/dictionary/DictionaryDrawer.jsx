import React, { useState, useEffect, useRef, useCallback } from 'react'
import { translationsApi } from '../../utils/api'
import { DrawerHeader } from './DrawerHeader'
import { DrawerTabsNav } from './DrawerTabsNav'
import { DrawerActionBar } from './DrawerActionBar'
import { DrawerSkeleton } from './widgets/DrawerSkeleton'
import { DefinitionTab } from './tabs/DefinitionTab'
import { ExamplesTab } from './tabs/ExamplesTab'
import { TranslationsTab } from './tabs/TranslationsTab'
import { Grammar3dTab } from './tabs/Grammar3dTab'
import { AlertCircle, RefreshCw } from 'lucide-react'

const HISTORY_STORAGE_KEY = 'cr_lookup_history_v1'
const MAX_HISTORY_ITEMS = 50
const DEDUPE_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Saves a dictionary lookup to local storage history (F2, AC-RS-02, AC-RS-03).
 */
function recordLookupHistory({
  word,
  sourceLang,
  targetLang,
  translation,
  bookId,
  bookTitle,
  chapterIndex,
  chapterTitle,
  sentenceId,
  saved = false,
}) {
  if (!word || typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
    const data = raw ? JSON.parse(raw) : { v: 1, items: [] }
    const items = Array.isArray(data.items) ? data.items : []
    const now = Date.now()

    // Deduplication check: same word within 10 minutes
    const existingIdx = items.findIndex(
      (item) =>
        item.word.toLowerCase() === word.toLowerCase() &&
        item.sourceLang === sourceLang &&
        item.targetLang === targetLang
    )

    if (existingIdx !== -1) {
      const existing = items[existingIdx]
      if (now - (existing.createdAt || 0) < DEDUPE_INTERVAL_MS) {
        // Update timestamp & translation without duplicating
        items.splice(existingIdx, 1)
        items.unshift({
          ...existing,
          translation: translation || existing.translation,
          saved: saved || existing.saved,
          createdAt: now,
        })
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify({ v: 1, items }))
        return
      }
      items.splice(existingIdx, 1)
    }

    const newItem = {
      id: `${sourceLang}:${word}:${now}`,
      word,
      sourceLang,
      targetLang,
      translation: translation || '',
      bookId: bookId || '',
      bookTitle: bookTitle || '',
      chapterIndex: chapterIndex || 0,
      chapterTitle: chapterTitle || '',
      sentenceId: sentenceId || '',
      createdAt: now,
      saved: Boolean(saved),
    }

    items.unshift(newItem)
    // Enforce max 50 items FIFO (AC-RS-02)
    const trimmed = items.slice(0, MAX_HISTORY_ITEMS)
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify({ v: 1, items: trimmed }))
  } catch (err) {
    // localStorage full/blocked handling
    console.warn('Failed to record lookup history', err)
  }
}

/**
 * DictionaryDrawer
 * Two-tier progressive disclosure right drawer (desktop 440px) and bottom sheet (mobile 72vh).
 * Rendered ONCE at Reader page level (AC-WI-04, AC-WI-17).
 */
export function DictionaryDrawer({
  isOpen = false,
  word = '',
  sourceLang = 'en',
  targetLang = 'id',
  contextSentence = '',
  sentenceId = null,
  bookId = null,
  bookTitle = '',
  chapterIndex = 0,
  chapterTitle = '',
  initialTab = 'definition',
  onClose,
  onSaveWord,
  isSaved = false,
  saving = false,
  triggerRef = null,
  translationEngine = 'google',
  customConfig = {},
  grammarData = null,
  grammarLoading = false,
  grammarError = null,
  onFetchGrammar,
}) {
  const [activeTab, setActiveTab] = useState(initialTab || 'definition')
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'slow' | 'timeout' | 'success' | 'empty' | 'error' | 'offline'
  const [entry, setEntry] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [blockErrors, setBlockErrors] = useState({})
  const [playingAudioKey, setPlayingAudioKey] = useState(null)
  const [langChangeNotice, setLangChangeNotice] = useState(null)

  const drawerRef = useRef(null)
  const prevTargetLangRef = useRef(targetLang)
  const abortCtrlRef = useRef(null)
  const slowTimerRef = useRef(null)
  const timeoutTimerRef = useRef(null)
  const touchStartYRef = useRef(0)
  const audioObjRef = useRef(null)

  // Focus trap and keyboard dismiss handling (A11Y-02, A11Y-03, A11Y-04)
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
        return
      }

      if (e.key === 'Tab') {
        const drawerEl = drawerRef.current
        if (!drawerEl) return

        const focusables = drawerEl.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return

        const first = focusables[0]
        const last = focusables[focusables.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    // Focus first element or header
    setTimeout(() => {
      const drawerEl = drawerRef.current
      if (drawerEl) {
        const firstFocusable = drawerEl.querySelector('button, [tabindex="0"]')
        firstFocusable?.focus()
      }
    }, 50)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      // Return focus to trigger element if available
      if (triggerRef?.current) {
        try {
          triggerRef.current.focus()
        } catch (e) {}
      }
    }
  }, [isOpen])

  // Track target language change while open (AC-BB-07)
  useEffect(() => {
    if (isOpen && prevTargetLangRef.current && prevTargetLangRef.current !== targetLang) {
      setLangChangeNotice(`Bahasa target diganti ke ${targetLang.toUpperCase()}.`)
    }
    prevTargetLangRef.current = targetLang
  }, [targetLang, isOpen])

  // Reset tab when opening with initialTab
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab)
    }
  }, [isOpen, initialTab])

  // Main data fetcher with cancellation and timeouts (AC-WI-10, AC-WI-11, AC-WI-14)
  const fetchDictionaryData = useCallback(
    async (wordToFetch = word, targetToUse = targetLang) => {
      if (!wordToFetch || !isOpen) return

      // Abort previous in-flight request
      if (abortCtrlRef.current) {
        abortCtrlRef.current.abort()
      }
      abortCtrlRef.current = new AbortController()

      clearTimeout(slowTimerRef.current)
      clearTimeout(timeoutTimerRef.current)

      if (!navigator.onLine) {
        setStatus('offline')
        return
      }

      setStatus('loading')
      setEntry(null)
      setErrorMsg(null)
      setSelectedVariant(null)
      setBlockErrors({})
      setLangChangeNotice(null)

      // Slow loading notice (> 3s)
      slowTimerRef.current = setTimeout(() => {
        setStatus((s) => (s === 'loading' ? 'slow' : s))
      }, 3000)

      // Timeout at 8s (AC-WI-11)
      timeoutTimerRef.current = setTimeout(() => {
        setStatus((s) => (s === 'loading' || s === 'slow' ? 'timeout' : s))
      }, 8000)

      try {
        const res = await translationsApi.dictionary(
          wordToFetch,
          sourceLang,
          contextSentence,
          { signal: abortCtrlRef.current.signal }
        )

        clearTimeout(slowTimerRef.current)
        clearTimeout(timeoutTimerRef.current)

        const data = res.data || {}
        setEntry(data)
        setStatus('success')

        // Record history locally
        const primaryMeaning =
          data.contextual_meaning ||
          (data.senses && data.senses[0]?.meaning) ||
          data.word ||
          ''
        recordLookupHistory({
          word: wordToFetch,
          sourceLang,
          targetLang: targetToUse,
          translation: primaryMeaning,
          bookId,
          bookTitle,
          chapterIndex,
          chapterTitle,
          sentenceId,
          saved: isSaved,
        })
      } catch (err) {
        if (err.name === 'CanceledError' || err.message === 'canceled') {
          return // User closed drawer or searched new word
        }

        clearTimeout(slowTimerRef.current)
        clearTimeout(timeoutTimerRef.current)

        if (err.response?.status === 404) {
          setStatus('empty')
        } else {
          setStatus('error')
          setErrorMsg(err.message || 'Definisi tidak dapat dimuat.')
        }
      }
    },
    [word, sourceLang, targetLang, contextSentence, isOpen, bookId, bookTitle, chapterIndex, chapterTitle, sentenceId, isSaved]
  )

  useEffect(() => {
    if (isOpen && word) {
      fetchDictionaryData(word, targetLang)
    } else {
      if (abortCtrlRef.current) abortCtrlRef.current.abort()
      clearTimeout(slowTimerRef.current)
      clearTimeout(timeoutTimerRef.current)
      setStatus('idle')
    }
  }, [isOpen, word])

  // Handle drawer close
  const handleClose = () => {
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort()
    }
    clearTimeout(slowTimerRef.current)
    clearTimeout(timeoutTimerRef.current)
    if (audioObjRef.current) {
      audioObjRef.current.pause()
    }
    setPlayingAudioKey(null)
    onClose && onClose()
  }

  // Audio playback handler
  const handlePlayAudio = (text, lang, key, audioUrl) => {
    if (playingAudioKey === key) {
      if (audioObjRef.current) audioObjRef.current.pause()
      if (window.speechSynthesis) window.speechSynthesis.cancel()
      setPlayingAudioKey(null)
      return
    }

    if (audioObjRef.current) audioObjRef.current.pause()
    if (window.speechSynthesis) window.speechSynthesis.cancel()

    setPlayingAudioKey(key)

    // 1. Try audio URL if provided
    const directUrl = audioUrl || translationsApi.ttsUrl(text, lang)
    const audio = new Audio(directUrl)
    audioObjRef.current = audio

    audio.onended = () => setPlayingAudioKey(null)
    audio.onerror = () => {
      // 2. Fallback to SpeechSynthesis
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try {
          const utterance = new SpeechSynthesisUtterance(text)
          utterance.lang = lang
          utterance.onend = () => setPlayingAudioKey(null)
          utterance.onerror = () => setPlayingAudioKey(null)
          window.speechSynthesis.speak(utterance)
        } catch (e) {
          setPlayingAudioKey(null)
        }
      } else {
        setPlayingAudioKey(null)
      }
    }

    audio.play().catch(() => {
      // Audio playback failed (e.g. autoplay restriction), fallback to speech
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try {
          const utterance = new SpeechSynthesisUtterance(text)
          utterance.lang = lang
          utterance.onend = () => setPlayingAudioKey(null)
          utterance.onerror = () => setPlayingAudioKey(null)
          window.speechSynthesis.speak(utterance)
        } catch (e) {
          setPlayingAudioKey(null)
        }
      } else {
        setPlayingAudioKey(null)
      }
    })
  }

  // Handle opening synonym or new word lookup directly inside drawer
  const handleOpenWord = (newWord) => {
    if (!newWord || newWord === word) return
    fetchDictionaryData(newWord, targetLang)
  }

  if (!isOpen) return null

  const targetWord = selectedVariant?.target_word || entry?.contextual_meaning || ''

  return (
    <>
      {/* Mobile dim overlay. Desktop keeps the text readable (AC-WI-04). */}
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity md:hidden"
        onClick={handleClose}
        aria-hidden="true"
      />
      {/* Desktop click-away layer, no dimming so reading can continue */}
      <div
        className="fixed inset-0 z-[60] hidden md:block"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Drawer Container (Desktop 440px right drawer, Mobile bottom sheet 72vh) */}
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cr-drawer-word-title"
        className="cr-drawer-enter fixed inset-x-0 bottom-0 z-[61] flex h-[72dvh] max-h-[72dvh] flex-col rounded-t-3xl border-t border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface)] text-[var(--cr-text-primary)] shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:h-full md:max-h-full md:w-[440px] md:rounded-none md:border-l md:border-t-0"
      >
        {/* Mobile Drag Handle (Touch target 44px) */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Tutup kamus"
          className="w-full py-2.5 flex items-center justify-center cursor-pointer touch-manipulation select-none shrink-0 md:hidden"
          onClick={handleClose}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleClose()
          }}
          onTouchStart={(e) => {
            if (e.touches.length === 1) touchStartYRef.current = e.touches[0].clientY
          }}
          onTouchEnd={(e) => {
            if (e.changedTouches.length === 1) {
              const dy = e.changedTouches[0].clientY - touchStartYRef.current
              if (dy > 45) handleClose()
            }
          }}
        >
          <div className="w-12 h-1.5 bg-[var(--cr-border-interactive)] opacity-50 rounded-full" />
        </div>

        {/* Live region for accessibility announcements (A11Y-13) */}
        <div className="sr-only" aria-live="polite">
          {status === 'loading'
            ? 'Memuat wawasan kata'
            : status === 'success'
            ? `Wawasan kata ${word} dimuat`
            : status === 'error'
            ? 'Gagal memuat wawasan kata'
            : ''}
        </div>

        {/* Header (Word, IPA, Audio, Bookmark, Close) */}
        <DrawerHeader
          word={entry?.word || word}
          ipa={entry?.phonetic_ipa || ''}
          sourceLang={sourceLang}
          targetLang={targetLang}
          targetWord={targetWord}
          sourceAudioUrl={entry?.audio_url}
          saved={isSaved}
          saving={saving}
          playingAudioKey={playingAudioKey}
          onPlayAudio={handlePlayAudio}
          onToggleSave={() => onSaveWord && onSaveWord(entry?.word || word, contextSentence)}
          onClose={handleClose}
        />

        {/* Target Language Changed Banner (AC-BB-07) */}
        {langChangeNotice && (
          <div className="px-4 py-2 bg-[var(--cr-highlight-sentence)] border-b border-[var(--cr-border-subtle)] flex items-center justify-between text-xs font-semibold">
            <span>{langChangeNotice}</span>
            <button
              type="button"
              onClick={() => fetchDictionaryData(word, targetLang)}
              className="text-xs font-bold text-[var(--cr-text-accent)] underline hover:opacity-80"
            >
              Muat ulang
            </button>
          </div>
        )}

        {/* Segmented 4-Tab Navigation */}
        <DrawerTabsNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Scrollable Content Body */}
        <div className="cr-scroll-contain flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* State: Loading or Slow Loading */}
          {(status === 'loading' || status === 'slow') && (
            <DrawerSkeleton
              isSlow={status === 'slow'}
              onCancel={handleClose}
            />
          )}

          {/* State: Timeout after 8 seconds (AC-WI-11) */}
          {status === 'timeout' && (
            <div className="p-6 text-center space-y-3 rounded-2xl bg-[var(--cr-bg-surface-elevated)] border border-[var(--cr-border-subtle)]">
              <AlertCircle className="w-8 h-8 mx-auto text-[var(--cr-text-danger)]" />
              <p className="font-bold text-sm text-[var(--cr-text-primary)]">
                Definisi belum selesai dimuat.
              </p>
              <p className="text-xs text-[var(--cr-text-secondary)]">
                Koneksi memerlukan waktu lebih lama dari biasanya.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => fetchDictionaryData(word, targetLang)}
                  className="min-h-[44px] px-4 py-2 text-xs font-bold rounded-xl bg-[var(--cr-btn-primary-bg)] text-[var(--cr-btn-primary-text)] inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Coba lagi</span>
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="min-h-[44px] px-4 py-2 text-xs font-bold rounded-xl border border-[var(--cr-border-interactive)] text-[var(--cr-text-secondary)]"
                >
                  Tutup
                </button>
              </div>
            </div>
          )}

          {/* State: Offline (DESIGN §5) */}
          {status === 'offline' && (
            <div className="p-6 text-center space-y-2 rounded-2xl bg-[var(--cr-bg-surface-elevated)] border border-[var(--cr-border-subtle)] text-xs">
              <p className="font-bold text-sm text-[var(--cr-text-primary)]">Tidak ada koneksi internet</p>
              <p className="text-[var(--cr-text-secondary)]">Sambungkan internet untuk memuat definisi kata ini.</p>
              <button
                type="button"
                onClick={() => fetchDictionaryData(word, targetLang)}
                className="mt-2 min-h-[44px] px-4 py-2 text-xs font-bold rounded-xl border border-[var(--cr-border-interactive)] inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Coba lagi</span>
              </button>
            </div>
          )}

          {/* State: 404 Empty (AC-WI-13) */}
          {status === 'empty' && (
            <div className="p-6 text-center space-y-2 rounded-2xl bg-[var(--cr-bg-surface-elevated)] border border-[var(--cr-border-subtle)] text-xs">
              <p className="font-bold text-sm text-[var(--cr-text-primary)]">
                Belum ada definisi untuk kata ini
              </p>
              <p className="text-[var(--cr-text-secondary)]">
                Kamus kami belum memiliki rincian leksikal untuk &ldquo;{word}&rdquo;.
              </p>
              <button
                type="button"
                onClick={() => fetchDictionaryData(word, targetLang)}
                className="mt-2 min-h-[44px] px-4 py-2 text-xs font-bold rounded-xl border border-[var(--cr-border-interactive)] inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Coba lagi</span>
              </button>
            </div>
          )}

          {/* State: Error */}
          {status === 'error' && (
            <div className="p-6 text-center space-y-2 rounded-2xl bg-[var(--cr-bg-surface-elevated)] border border-[var(--cr-border-subtle)] text-xs">
              <p className="font-bold text-sm text-[var(--cr-text-danger)]">
                Definisi tidak bisa dimuat
              </p>
              <p className="text-[var(--cr-text-secondary)]">{errorMsg || 'Terjadi gangguan jaringan.'}</p>
              <button
                type="button"
                onClick={() => fetchDictionaryData(word, targetLang)}
                className="mt-2 min-h-[44px] px-4 py-2 text-xs font-bold rounded-xl bg-[var(--cr-btn-primary-bg)] text-[var(--cr-btn-primary-text)] inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Coba lagi</span>
              </button>
            </div>
          )}

          {/* State: Success - Render Active Tab */}
          {status === 'success' && entry && (
            <div
              key={activeTab}
              role="tabpanel"
              id={`panel-${activeTab}`}
              aria-labelledby={`tab-${activeTab}`}
              className="cr-anim-rise"
            >
              {activeTab === 'definition' && (
                <DefinitionTab
                  word={entry?.word || word}
                  entry={entry}
                  selectedVariant={selectedVariant}
                  contextSentence={contextSentence}
                  sourceLang={sourceLang}
                  onSelectVariant={(v) => setSelectedVariant(v)}
                  onOpenWord={handleOpenWord}
                  onPlayAudio={(txt, lng) => handlePlayAudio(txt, lng, `audio_ex_${txt}`)}
                  blockErrors={blockErrors}
                  onRetryBlock={(id) => fetchDictionaryData(word, targetLang)}
                />
              )}

              {activeTab === 'examples' && (
                <ExamplesTab
                  examples={entry?.examples || []}
                  word={entry?.word || word}
                  sourceLang={sourceLang}
                  targetLang={targetLang}
                  onPlayAudio={(txt, lng) => handlePlayAudio(txt, lng, `audio_ex_${txt}`)}
                />
              )}

              {activeTab === 'translations' && (
                <TranslationsTab
                  translations={entry?.translations_table || []}
                  selected={selectedVariant?.target_word || entry?.contextual_meaning}
                  onSelectVariant={(v) => setSelectedVariant(v)}
                />
              )}

              {activeTab === 'grammar' && (
                <Grammar3dTab
                  grammarData={grammarData}
                  loading={grammarLoading}
                  error={grammarError}
                  onRetry={onFetchGrammar}
                  sentenceText={contextSentence}
                  word={entry?.word || word}
                />
              )}
            </div>
          )}
        </div>

        {/* Sticky Action Bar (Simpan Kata & Kalimat + 👍/👎 Umpan Balik) */}
        <DrawerActionBar
          word={entry?.word || word}
          saved={isSaved}
          saving={saving}
          onToggleSave={() => onSaveWord && onSaveWord(entry?.word || word, contextSentence)}
          onFeedback={(type) => {
            // Optional feedback tracking (AC-WI-16, H-3)
            try {
              translationsApi.feedback({
                word: entry?.word || word,
                source_lang: sourceLang,
                target_lang: targetLang,
                type,
              }).catch(() => {})
            } catch (e) {}
          }}
        />
      </aside>
    </>
  )
}

export default DictionaryDrawer
