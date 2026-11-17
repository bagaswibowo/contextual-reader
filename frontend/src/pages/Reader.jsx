import katex from 'katex'
import 'katex/dist/katex.min.css'

// Bounded LRU KaTeX Render Cache (prevents memory leak & OOM in long reading sessions)
const MAX_MATH_CACHE = 500
const mathRenderCache = new Map()

// Universal cross-browser regex (no lookbehind assertions for Safari/iOS compatibility)
const INLINE_MATH_REGEX = /(\$(?:[^\s\$][^\$]*[^\s\$]|[^\s\$])\$)/

function renderCachedKaTeX(formula, displayMode = false) {
  const cacheKey = `${displayMode ? 'D' : 'I'}:${formula}`
  if (mathRenderCache.has(cacheKey)) {
    const cached = mathRenderCache.get(cacheKey)
    mathRenderCache.delete(cacheKey)
    mathRenderCache.set(cacheKey, cached)
    return cached
  }
  try {
    const html = katex.renderToString(formula, { displayMode, throwOnError: false, trust: false })
    if (mathRenderCache.size >= MAX_MATH_CACHE) {
      const oldest = mathRenderCache.keys().next().value
      mathRenderCache.delete(oldest)
    }
    mathRenderCache.set(cacheKey, html)
    return html
  } catch (e) {
    return null
  }
}

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Globe, ArrowLeft, ChevronDown,
  BookOpen, Sun, Moon, Type,
  AlertTriangle, X, Play, Square,
  Target, PanelBottom, MessageSquare
} from 'lucide-react'
import { booksApi, translationsApi, vocabularyApi } from '../utils/api'
import { useReaderStore, useVocabularyStore } from '../stores'
import { useTheme } from '../hooks/useTheme'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { DictionaryDrawer } from '../components/dictionary/DictionaryDrawer'
import { BookLanguageBadge } from '../components/language/BookLanguageBadge'
import { TargetLanguagePopover } from '../components/language/TargetLanguagePopover'
import { SentencePanel } from '../components/SentencePanel'

// OCR/MinerU formula delimiter token and precompiled regexes
const MINERU_MATH_DELIMITER = '72809'
const FORMULA_START_REGEX = /^(\$\$|\$|\\\[|72809)/
const FORMULA_END_REGEX = /(\$\$|\$|\\\]|72809)$/

export function Reader() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()

  // Reader settings
  const { 
    fontSize, setFontSize, 
    fontFamily, setFontFamily, 
    lineHeight, setLineHeight,
    targetLanguage, setTargetLanguage,
    motherLanguage, setMotherLanguage,
    translationEngine,
    customBaseUrl, customApiKey, customModel,
    userCefrLevel,
    popupMode, setPopupMode
  } = useReaderStore()

  const isBottomSheet = (popupMode || 'bottom-sheet') === 'bottom-sheet'

  // Book & Chapter state
  const [book, setBook] = useState(null)
  const [toc, setToc] = useState([])
  const [chapterIndex, setChapterIndex] = useState(0)
  const [chapter, setChapter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Mobile settings modal state
  const [showMobileSettingsModal, setShowMobileSettingsModal] = useState(false)
  const [selectedWord, setSelectedWord] = useState(null) // { sentenceId, wIdx } highlight only
  const [showTocModal, setShowTocModal] = useState(false)
  const [savedWords, setSavedWords] = useState(new Set())
  const [savingVocab, setSavingVocab] = useState(false)

  // Dictionary Drawer (Tier 2) & Target Language Popover state (F1, F3)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerWord, setDrawerWord] = useState('')
  const [drawerContext, setDrawerContext] = useState('')
  const [drawerSentenceId, setDrawerSentenceId] = useState(null)
  const [drawerInitialTab, setDrawerInitialTab] = useState('meaning')
  const [drawerExtraExamples, setDrawerExtraExamples] = useState([])
  const [sentencePanel, setSentencePanel] = useState(null)
  const [isLangPopoverOpen, setIsLangPopoverOpen] = useState(false)

  const openDictionaryDrawer = (wordToOpen, sId, sentText, tab = 'meaning') => {
    setDrawerWord(wordToOpen)
    setDrawerSentenceId(sId)
    setDrawerContext(sentText || '')
    setDrawerInitialTab(tab)
    setIsDrawerOpen(true)
  }

  // TTS State
  const [isPlayingTTS, setIsPlayingTTS] = useState(false)
  const [playingAudioKey, setPlayingAudioKey] = useState(null)
  const [voices, setVoices] = useState([])
  const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null)
  const audioRef = useRef(null)
  const touchStartYRef = useRef(0)

  // Dismiss popups on Escape key
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowTocModal(false)
        setIsDrawerOpen(false)
        setIsLangPopoverOpen(false)
        setSelectedWord(null)
          }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const updateVoices = () => {
        try {
          setVoices(window.speechSynthesis.getVoices())
        } catch (e) {}
      }
      updateVoices()
      window.speechSynthesis.onvoiceschanged = updateVoices
    }
  }, [])

  // Load Book metadata & TOC
  useEffect(() => {
    async function loadBookData() {
      try {
        setLoading(true)
        const [bookRes, tocRes] = await Promise.all([
          booksApi.get(bookId),
          booksApi.toc(bookId)
        ])
        setBook(bookRes.data)
        setToc(tocRes.data)
        if (tocRes.data.length > 0) {
          loadChapter(0)
        } else {
          setLoading(false)
        }
      } catch (err) {
        setError(err.message || 'Gagal memuat buku')
        setLoading(false)
      }
    }
    loadBookData()
  }, [bookId])

  // Load specific chapter
  const loadChapter = async (index) => {
    try {
      setLoading(true)
      setSelectedWord(null)
        const res = await booksApi.chapter(bookId, index)
      setChapter(res.data)
      setChapterIndex(index)
      
      // Load saved vocabulary for this book to reflect saved status
      try {
        const savedSet = new Set()
        try {
          const savedRes = await vocabularyApi.savedWords(bookId)
          const keys = savedRes.data?.words || []
          keys.forEach((key) => savedSet.add(String(key).toLowerCase()))
        } catch (e) {
          const vocabRes = await vocabularyApi.list({ book_id: bookId })
          const list = vocabRes.data.results || vocabRes.data || []
          if (Array.isArray(list)) {
            list.forEach(v => {
              if (v.word_translation?.id) savedSet.add(v.word_translation.id)
              if (v.word_translation?.word) savedSet.add(v.word_translation.word.toLowerCase())
            })
          }
        }
        setSavedWords(savedSet)
      } catch (e) {
        console.error('Failed to load vocab set', e)
      }

      setLoading(false)
    } catch (err) {
      setError(err.message || 'Gagal memuat bab')
      setLoading(false)
    }
  }

  // One click opens the full word panel on the right, no intermediate popup.
  const handleWordClick = (event, sentenceId, rawWord, wIdx) => {
    const cleanedWord = rawWord.replace(/^[^\w]+|[^\w]+$/g, '').replace(/\s+/g, ' ')
    if (!cleanedWord || cleanedWord.length < 2) return

    const sentText = chapter?.sentences?.find(s => s.id === sentenceId)?.text || cleanedWord
    const escaped = cleanedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`\\b${escaped}\\b`, 'i')
    const extraItems = (chapter?.sentences || [])
      .filter((item) => item.id !== sentenceId && pattern.test(item.text || ''))
      .slice(0, 3)
    setDrawerExtraExamples(
      extraItems.map((item) => ({
        id: item.id,
        text: item.text,
        text_book: item.text,
      }))
    )
    setSelectedWord({ sentenceId, wIdx })
    openDictionaryDrawer(cleanedWord, sentenceId, sentText, 'meaning')
  }

  // Handle multi-word text selection (e.g. "interaction design" or "fringe to mainstream")
  const handleTextSelection = (event, sentenceId) => {
    const selection = window.getSelection()
    if (!selection) return
    const selectedText = selection.toString().trim()
    if (selectedText.length >= 2 && selectedText.includes(' ')) {
      const cleanedPhrase = selectedText.replace(/^[^\w]+|[^\w]+$/g, '').replace(/\s+/g, ' ')
      if (cleanedPhrase.length >= 2) {
        if (event && event.stopPropagation) event.stopPropagation()
        handleWordClick(event, sentenceId, cleanedPhrase, 0)
      }
    }
  }

  const getAlignedClauseTokens = (text, transliteration) => {
    if (!text || !transliteration) return { mode: 'none', tokens: [], fullText: '' }
    
    const textWords = text.trim().split(/\s+/).filter(Boolean)
    const latinWords = transliteration.trim().split(/\s+/).filter(Boolean)

    if (textWords.length > 1 && Math.abs(textWords.length - latinWords.length) <= 2) {
      const maxLength = Math.min(textWords.length, latinWords.length)
      const tokens = []
      for (let i = 0; i < maxLength; i++) {
        tokens.push({ script: textWords[i], latin: latinWords[i] })
      }
      return { mode: 'chips', tokens, fullText: transliteration }
    }

    return { mode: 'paragraph', tokens: [], fullText: transliteration }
  }

  // Handle sentence margin icon click -> full paragraph/sentence translation
  const handleSentenceTranslate = (sentenceId, sentenceText) => {
    setSelectedWord(null)
    setIsDrawerOpen(false)
    setSentencePanel({ sentenceId, text: sentenceText })
  }

  // Save word to vocabulary list ("Pelajari")
  const handleSaveVocabulary = async (wordParam, contextSentenceParam) => {
    try {
      setSavingVocab(true)
      let transId = null

      {
        const sId = drawerSentenceId
        const w = wordParam || drawerWord
        if (sId && w) {
          const customConfig = { customBaseUrl, customApiKey, customModel, mother_lang: motherLanguage || 'id' }
          const res = await translationsApi.word(sId, w, targetLanguage || 'id', translationEngine || 'google', customConfig)
          transId = res.data?.id
        }
      }

      if (transId) {
        await vocabularyApi.add(transId)
        const w = wordParam || drawerWord
        setSavedWords(prev => {
          const next = new Set(prev)
          next.add(transId)
          if (w) next.add(w.toLowerCase())
          return next
        })
      }
      setSavingVocab(false)
    } catch (err) {
      setSavingVocab(false)
      console.error('Gagal menyimpan kosakata', err)
    }
  }

  const getSpeechLangCode = (langCode) => {
    const code = (langCode || 'en').toLowerCase()
    const map = {
      id: 'id-ID',
      en: 'en-US',
      es: 'es-ES',
      fr: 'fr-FR',
      de: 'de-DE',
      ja: 'ja-JP',
      'zh-cn': 'zh-CN',
      zh: 'zh-CN',
      ko: 'ko-KR',
      ar: 'ar-SA',
      ru: 'ru-RU',
      pt: 'pt-BR',
      it: 'it-IT',
      nl: 'nl-NL',
      tr: 'tr-TR',
      vi: 'vi-VN',
      th: 'th-TH',
      su: 'id-ID',
      jv: 'id-ID',
    }
    return map[code] || 'en-US'
  }

  const getFemaleJapaneseVoice = () => {
    let currentVoices = voices
    if ((!currentVoices || currentVoices.length === 0) && synthRef.current) {
      try {
        currentVoices = synthRef.current.getVoices()
      } catch (e) {}
    }
    
    if (!currentVoices || currentVoices.length === 0) return null

    const femaleJaNames = [
      'kyoko', 'nanami', 'haruka', 'google 日本語', 'google japanese',
      'female', 'woman', 'sayaka', 'ayumi', 'otoya'
    ]
    
    for (const name of femaleJaNames) {
      const v = currentVoices.find(voice => 
        voice.lang.toLowerCase().replace('_', '-').startsWith('ja') && 
        voice.name.toLowerCase().includes(name)
      )
      if (v) return v
    }

    return currentVoices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith('ja')) || null
  }

  // Web Audio Context Singleton for Studio-Quality 48kHz Hardware Playback
  const getAudioContext = () => {
    if (typeof window === 'undefined') return null
    if (!window._appAudioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (AudioCtx) {
        window._appAudioContext = new AudioCtx()
      }
    }
    if (window._appAudioContext && window._appAudioContext.state === 'suspended') {
      try { window._appAudioContext.resume() } catch (e) {}
    }
    return window._appAudioContext || null
  }

  // Stop any active playing audio
  const stopAudio = () => {
    if (window._activeAudioSource) {
      try { window._activeAudioSource.stop() } catch (e) {}
      window._activeAudioSource = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    if (synthRef.current) {
      synthRef.current.cancel()
    }
    setPlayingAudioKey(null)
  }

  // Native Studio-Quality Speech Audio Engine (Backend Neural Audio Proxy + Native Voice Fallback)
  const speakText = async (text, langCode = 'en', audioKey = null, options = {}) => {
    if (!text) return

    const { isSlow = false } = options

    // If clicking the same audio currently playing -> STOP IT!
    if (audioKey && playingAudioKey === audioKey) {
      stopAudio()
      return
    }

    stopAudio()
    if (audioKey) setPlayingAudioKey(audioKey)

    const cleanText = text.trim().slice(0, 300)
    let lang = (langCode || 'en').toLowerCase()
    
    // Normalize language codes for Google Translate Neural Audio Engine
    if (lang === 'zh' || lang === 'zh-cn') lang = 'zh-CN'
    else if (lang === 'zh-tw') lang = 'zh-TW'

    const encodedText = encodeURIComponent(cleanText)
    // Use backend proxy endpoint to avoid CORS and ensure 100% authentic native accent
    const proxyTtsUrl = `/api/translations/tts/?text=${encodedText}&lang=${lang}`

    try {
      const audio = new Audio(proxyTtsUrl)
      audioRef.current = audio
      
      // Apply slow playback rate if requested
      if (isSlow) {
        audio.playbackRate = 0.5
      }
      
      audio.onended = () => setPlayingAudioKey(null)
      audio.onerror = () => {
        fallbackWebSpeech(cleanText, lang, isSlow)
      }

      const playPromise = audio.play()
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          fallbackWebSpeech(cleanText, lang, isSlow)
        })
      }
    } catch (e) {
      fallbackWebSpeech(cleanText, lang, isSlow)
    }
  }

  const fallbackWebSpeech = (text, lang, isSlow = false) => {
    if (!synthRef.current) {
      setPlayingAudioKey(null)
      return
    }
    try {
      synthRef.current.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      const speechCode = getSpeechLangCode(lang)
      utterance.lang = speechCode
      utterance.rate = isSlow ? 0.5 : 0.9

      // Find native voice for target language
      const allVoices = synthRef.current.getVoices() || voices
      const langPrefix = speechCode.split('-')[0].toLowerCase()
      const nativeVoice = allVoices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith(speechCode.toLowerCase())) ||
                          allVoices.find(v => v.lang.toLowerCase().startsWith(langPrefix))
      if (nativeVoice) {
        utterance.voice = nativeVoice
      }

      utterance.onend = () => setPlayingAudioKey(null)
      utterance.onerror = () => setPlayingAudioKey(null)
      synthRef.current.speak(utterance)
    } catch (err) {
      setPlayingAudioKey(null)
    }
  }

  // Read entire chapter via TTS
  const toggleChapterTTS = () => {
    if (!synthRef.current || !chapter) return

    if (isPlayingTTS) {
      synthRef.current.cancel()
      setIsPlayingTTS(false)
    } else {
      const fullText = chapter.sentences.map(s => s.text).join(' ')
      const utterance = new SpeechSynthesisUtterance(fullText)
      utterance.lang = 'en-US'
      utterance.rate = 0.9
      utterance.onend = () => setIsPlayingTTS(false)
      utterance.onerror = () => setIsPlayingTTS(false)
      
      synthRef.current.speak(utterance)
      setIsPlayingTTS(true)
    }
  }

  if (loading && !chapter) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 border-4 border-duo-green border-t-transparent rounded-full animate-spin" />
        <p className="font-heading font-bold text-xl text-eel dark:text-dark-text animate-pulse">
          Memuat buku & memproses konteks...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card-duo p-8 text-center max-w-lg mx-auto my-12">
        <AlertTriangle className="w-12 h-12 text-duo-red mx-auto mb-4" />
        <h2 className="heading-2 text-duo-red mb-2">Terjadi Kesalahan</h2>
        <p className="text-gray-600 dark:text-dark-muted mb-6">{error}</p>
        <button onClick={() => navigate('/library')} className="btn-primary">
          Kembali ke Perpustakaan
        </button>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col gap-6 pb-20 transition-[padding] duration-200 ${isDrawerOpen || sentencePanel ? 'lg:pr-[392px]' : ''}`}
      style={{ '--cr-panel-font': `${Math.round(fontSize * 0.9)}px` }}
    >
      {/* Reading Toolbar - Mobile-First Responsive Design */}
      <div
        className="card-duo sticky top-2 z-30 flex items-center justify-between gap-2 p-2.5 lg:top-4 sm:p-3"
        style={{ backgroundColor: 'var(--cr-bg-surface-elevated)' }}
      >
        {/* Left: Back & TOC */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={() => navigate('/library')}
            className="btn-ghost shrink-0 px-2 text-xs sm:px-3 sm:py-2 sm:text-sm"
            title="Kembali ke Perpustakaan"
            aria-label="Kembali ke Perpustakaan"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden xl:inline">Perpustakaan</span>
          </button>

          <div className="h-5 w-px shrink-0 bg-[var(--cr-border-subtle)]" />

          {/* Chapter Selector Dropdown */}
          <button
            onClick={() => setShowTocModal(true)}
            className="flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-duo hover:bg-gray-100 dark:hover:bg-dark-border font-ui font-bold text-xs sm:text-sm text-eel dark:text-dark-text min-w-0"
          >
            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-duo-green shrink-0" />
            <span className="max-w-[84px] truncate sm:max-w-[150px] lg:max-w-[220px]">
              {chapter?.title || `Bab ${chapterIndex + 1}`}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          </button>
        </div>

        {/* Center/Right: Reader Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* F3: Book Language & Target Language Badge */}
          <BookLanguageBadge
            sourceLang={book?.language || 'en'}
            targetLang={targetLanguage || 'id'}
            onClick={() => setIsLangPopoverOpen(true)}
          />

          {/* Mobile Settings Modal Trigger Button [Aa] */}
          <button
            onClick={() => setShowMobileSettingsModal(true)}
            className="cr-press sm:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-2xl font-extrabold text-xs text-[var(--cr-btn-primary-text-aa)]"
            title="Pengaturan Tampilan"
          >
            <Type className="w-3.5 h-3.5" />
            <span>Aa</span>
          </button>

          {/* Desktop Controls (Font Size, Font Family, Theme, TTS) */}
          <div className="hidden sm:flex items-center gap-2">
            {/* Font Size Controls */}
            <div className="flex items-center bg-gray-100 dark:bg-dark-border rounded-duo p-1">
              <button
                onClick={() => setFontSize(fontSize - 2)}
                disabled={fontSize <= 14}
                className="px-2.5 py-1 font-bold text-xs hover:bg-white dark:hover:bg-dark-card rounded-md transition-all"
              >
                A-
              </button>
              <span className="px-2 text-xs font-bold font-mono">{fontSize}px</span>
              <button
                onClick={() => setFontSize(fontSize + 2)}
                disabled={fontSize >= 28}
                className="px-2.5 py-1 font-bold text-sm hover:bg-white dark:hover:bg-dark-card rounded-md transition-all"
              >
                A+
              </button>
            </div>

            {/* Font Family Toggle */}
            <button
              onClick={() => setFontFamily(fontFamily === 'serif' ? 'sans' : 'serif')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-duo bg-gray-100 dark:bg-dark-border text-xs font-bold text-eel dark:text-dark-text"
            >
              <Type className="w-3.5 h-3.5" />
              <span>{fontFamily === 'serif' ? 'Serif' : 'Sans'}</span>
            </button>

            {/* Theme Selector */}
            <div className="flex items-center bg-gray-100 dark:bg-dark-border rounded-duo p-1">
              <button
                onClick={() => setTheme('light')}
                className={`p-1.5 rounded-md transition-all ${theme === 'light' ? 'bg-white text-duo-yellow shadow-sm' : 'text-gray-400'}`}
                title="Tema Terang"
              >
                <Sun className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTheme('sepia')}
                className={`p-1.5 rounded-md transition-all ${theme === 'sepia' ? 'bg-amber-100 text-amber-800 shadow-sm' : 'text-gray-400'}`}
                title="Tema Sepia"
              >
                <BookOpen className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`p-1.5 rounded-md transition-all ${theme === 'dark' ? 'bg-dark-card text-duo-blue shadow-sm' : 'text-gray-400'}`}
                title="Tema Gelap"
              >
                <Moon className="w-4 h-4" />
              </button>
            </div>

            {/* TTS Read Page Button */}
            <button
              onClick={toggleChapterTTS}
              className={`btn-duo text-xs px-3 py-1.5 flex items-center gap-1.5 ${
                isPlayingTTS ? 'bg-duo-yellow text-eel shadow-3d-yellow' : 'bg-duo-green text-white shadow-3d'
              }`}
            >
              {isPlayingTTS ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Berhenti</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Baca Halaman</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Reading Canvas */}
      <div className="reading-canvas card-duo p-4 sm:p-8 md:p-10 relative max-w-3xl mx-auto w-full min-h-[70vh] overflow-x-hidden sm:overflow-x-visible">
        {/* Chapter Header */}
        <div className="border-b-2 border-[var(--cr-reading-border)] pb-4 sm:pb-6 mb-6 sm:mb-8 text-center">
          <span className="reading-badge mb-2 text-[11px] sm:text-xs">
            Bab {chapterIndex + 1} dari {toc.length || 1}
          </span>
          <h1 className="heading-1 text-xl sm:text-3xl md:text-4xl mt-1 break-words">
            {chapter?.title}
          </h1>
          {book && (
            <p className="text-xs sm:text-sm font-semibold text-[var(--cr-text-secondary)] mt-1 truncate">
              {book.title} · {book.author || 'Anonim'}
            </p>
          )}
        </div>

        {/* Sentences & Paragraphs Rendering */}
        <div 
          className={`reading-measure reading-text space-y-5 sm:space-y-7 ${fontFamily === 'serif' ? 'font-body' : 'font-sans'}`}
          style={{ fontSize: `${fontSize}px`, lineHeight: lineHeight }}
        >
          {chapter?.sentences?.map((sent, sIdx) => {
            const rawText = sent.text?.trim() || '';

            // 1. Markdown Image Renderer
            if (rawText.startsWith('![') && rawText.includes('](')) {
              const imgMatch = rawText.match(/!\[(.*?)\]\((.*?)\)/);
              if (imgMatch) {
                const alt = imgMatch[1];
                const rawSrc = imgMatch[2];
                const fullSrc = /^https?:\/\//i.test(rawSrc) ? rawSrc : new URL(rawSrc.startsWith('/') ? rawSrc : `/${rawSrc}`, window.location.origin).href;
                return (
                  <figure key={sent.id || sIdx} className="my-8 text-center bg-gray-50/90 dark:bg-dark-card/80 p-4 sm:p-5 rounded-2xl border-2 border-gray-200 dark:border-dark-border shadow-sm transition-all">
                    <img 
                      src={fullSrc} 
                      alt={alt} 
                      className="max-h-[500px] max-w-full mx-auto rounded-xl shadow-md object-contain bg-white p-2"
                      loading="lazy"
                      onError={(e) => {
                        const fig = e.currentTarget.closest('figure');
                        if (fig) fig.style.display = 'none';
                      }} 
                    />
                    <figcaption className="text-xs font-semibold text-[var(--cr-text-secondary)] mt-3 font-mono tracking-wide">{alt}</figcaption>
                  </figure>
                );
              }
            }

            // 2. Markdown Table Renderer
            if (rawText.startsWith('|') && (rawText.includes('\n|') || rawText.includes(' | '))) {
              const rows = rawText.split('\n').filter(r => r.includes('|') && !r.includes('---'));
              if (rows.length >= 1) {
                const headerRow = rows[0].split('|').map(c => c.trim()).filter(Boolean);
                const bodyRows = rows.slice(1).map(r => r.split('|').map(c => c.trim()).filter(Boolean));
                return (
                  <div key={sent.id || sIdx} className="my-6 overflow-x-auto rounded-xl border-2 border-gray-200 dark:border-dark-border shadow-sm">
                    <table className="w-full text-left text-xs sm:text-sm font-sans border-collapse">
                      <thead className="bg-gray-100 dark:bg-dark-card text-eel dark:text-dark-text font-bold">
                        <tr>
                          {headerRow.map((h, i) => (
                            <th key={i} className="p-3 border-b-2 border-gray-200 dark:border-dark-border">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-dark-border bg-white dark:bg-dark-card">
                        {bodyRows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-gray-50 dark:hover:bg-dark-border/40 transition-colors">
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="p-3 text-gray-700 dark:text-gray-300">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }
            }

            // 3. Markdown Heading Renderer
            if (rawText.startsWith('#')) {
              const cleanHeading = rawText.replace(/^#+\s*/, '');
              const isH1 = rawText.startsWith('# ');
              return (
                <div key={sent.id || sIdx} className="mt-8 mb-4 border-b border-gray-200 dark:border-dark-border pb-2">
                  <h2 className={`${isH1 ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'} font-bold font-heading text-eel dark:text-dark-text`}>
                    {cleanHeading}
                  </h2>
                </div>
              );
            }

            // 4. Formula / Math Block Renderer (KaTeX Enhanced)
            const isFormulaBlock =
              (rawText.startsWith('$$') && rawText.endsWith('$$')) ||
              (rawText.startsWith('$') && rawText.endsWith('$') && rawText.length > 2) ||
              (rawText.startsWith('\\[') && rawText.endsWith('\\]')) ||
              rawText.startsWith('\\begin{') ||
              (rawText.startsWith(MINERU_MATH_DELIMITER) && rawText.endsWith(MINERU_MATH_DELIMITER));

            if (isFormulaBlock) {
              const mathFormula = rawText.replace(FORMULA_START_REGEX, "").replace(FORMULA_END_REGEX, "").trim();

              const renderedHtml = renderCachedKaTeX(mathFormula, true);

              return (
                <div key={sent.id || sIdx} className="my-5 p-4 sm:p-6 text-center bg-indigo-50/70 dark:bg-indigo-950/30 rounded-2xl border-2 border-indigo-200/80 dark:border-indigo-900/60 shadow-sm overflow-x-auto">
                  {renderedHtml ? (
                    <div
                      dangerouslySetInnerHTML={{ __html: renderedHtml }}
                      className="inline-block text-base sm:text-xl text-indigo-950 dark:text-indigo-100"
                    />
                  ) : (
                    <code className="font-mono text-sm sm:text-base text-indigo-900 dark:text-indigo-200">{mathFormula}</code>
                  )}
                </div>
              );
            }

            const tokens = []
            const rawSentText = sent.text || ''
            if (rawSentText.includes('$')) {
              const rawParts = rawSentText.split(INLINE_MATH_REGEX)
              let wordCounter = 0
              rawParts.forEach((part) => {
                if (!part) return
                if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
                  const inner = part.slice(1, -1).trim()
                  // Exact currency detection: only flag as currency if strictly numbers or price ranges
                  const isPureCurrency = /^\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?$/.test(inner) ||
                                         /^\d+(?:\.\d+)?\s*(?:-|to|–|—)\s*\$?\d+(?:\.\d+)?$/.test(inner) ||
                                         /^\d+(?:\.\d+)?\s*(?:million|billion|thousand|trillion|dollars?|cents?|usd|idr|eur)\b/i.test(inner)

                  // LaTeX Math Syntax: symbols, operators, Greek letters, sub/superscripts, equations, or single variable
                  const isMathSyntax = !isPureCurrency && (
                    /[\\^_={}\+\*\/<>~]|\b(?:log|sin|cos|tan|tau|alpha|beta|gamma|Delta|approx|sum|int)\b|^[a-zA-Z]$/.test(inner) ||
                    (inner.includes('-') && !/^[0-9\s\-]+$/.test(inner))
                  )

                  if (isMathSyntax) {
                    const mathWordCount = part.split(' ').length
                    tokens.push({ type: 'math', content: inner, raw: part, wIdx: wordCounter })
                    wordCounter += mathWordCount
                  } else {
                    const fallbackWords = part.split(' ').filter(Boolean)
                    fallbackWords.forEach((w) => {
                      tokens.push({ type: 'word', content: w, wIdx: wordCounter++ })
                    })
                  }
                } else {
                  const partWords = part.split(' ').filter(Boolean)
                  partWords.forEach((w) => {
                    tokens.push({ type: 'word', content: w, wIdx: wordCounter++ })
                  })
                }
              })
            } else {
              const defaultWords = rawSentText.split(' ').filter(Boolean)
              defaultWords.forEach((w, idx) => tokens.push({ type: 'word', content: w, wIdx: idx }))
            }
            return (
              <div key={sent.id || sIdx} className="space-y-2">
                <div 
                  onMouseUp={(e) => handleTextSelection(e, sent.id)}
                  onTouchEnd={(e) => handleTextSelection(e, sent.id)}
                  className="group relative flex items-start justify-between gap-2 p-1 sm:p-1.5 rounded-duo hover:bg-[var(--cr-reading-hover)] transition-colors"
                >
                  {/* Sentence text with clickable words & KaTeX inline math */}
                  <p className="flex-1 leading-relaxed break-words min-w-0">
                  {tokens.map((token, tIdx) => {
                    const isLast = tIdx === tokens.length - 1
                    if (token.type === 'math') {
                      const mathHtml = renderCachedKaTeX(token.content, false)
                      return (
                        <span key={`tok-${tIdx}`} className="inline-block align-baseline">
                          {mathHtml ? (
                            <span
                              dangerouslySetInnerHTML={{ __html: mathHtml }}
                              className="px-1 text-indigo-700 dark:text-indigo-300 font-semibold select-none"
                            />
                          ) : (
                            <code className="font-mono text-xs text-indigo-700 dark:text-indigo-300">{token.raw}</code>
                          )}
                          {!isLast && ' '}
                        </span>
                      )
                    }
                    const word = token.content
                    const wIdx = token.wIdx
                    const isSelected = selectedWord && selectedWord.sentenceId === sent.id && selectedWord.wIdx === wIdx
                    return (
                      <span key={`tok-${tIdx}`} className="relative inline-block">
                        <button
                          type="button"
                          onClick={(e) => handleWordClick(e, sent.id, word, wIdx)}
                          aria-label={`Buka arti kata ${word}`}
                          data-selected-word={isSelected ? "true" : undefined}
                          className={`word-clickable rounded transition-all ${
                            isSelected
                              ? 'bg-[var(--cr-highlight-sentence)] font-extrabold text-[var(--cr-reading-text)] ring-2 ring-[var(--cr-text-accent)] shadow-sm px-1'
                              : 'hover:bg-duo-green/10 px-0.5'
                          }`}
                        >
                          {word}
                        </button>
                        {' '}
                      </span>
                    )
                  })}
                </p>

                <button
                  type="button"
                  onClick={() => handleSentenceTranslate(sent.id, sent.text)}
                  className="translate-icon mt-0.5 flex-shrink-0 rounded-full p-1.5 text-[var(--cr-blue-text)] transition-colors hover:bg-[var(--cr-highlight-word-hover)]"
                  title="Terjemahkan kalimat utuh"
                  aria-label="Terjemahkan kalimat utuh"
                >
                  <Globe className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )
        })}
        </div>

        {/* Chapter Navigation Footer */}
        <div className="flex items-center justify-between mt-12 pt-6 border-t-2 border-gray-100 dark:border-dark-border">
          <button
            onClick={() => loadChapter(chapterIndex - 1)}
            disabled={chapterIndex === 0}
            className="btn-secondary text-sm disabled:opacity-40"
          >
            ← Bab Sebelumnya
          </button>
          
          <span className="font-heading font-bold text-sm text-[var(--cr-text-secondary)]">
            {chapterIndex + 1} / {toc.length}
          </span>

          <button
            onClick={() => loadChapter(chapterIndex + 1)}
            disabled={chapterIndex >= toc.length - 1}
            className="btn-primary text-sm disabled:opacity-40"
          >
            Bab Selanjutnya →
          </button>
        </div>
      </div>



      {/* Table of Contents Modal */}
      {showTocModal && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setShowTocModal(false); }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in"
        >
          <div className="card-duo max-w-lg md:max-w-xl w-full p-4 sm:p-6 max-h-[85vh] flex flex-col bg-white dark:bg-dark-card border-2 border-gray-200 dark:border-dark-border shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between pb-3.5 border-b border-gray-200 dark:border-dark-border shrink-0">
              <h3 className="font-heading font-extrabold text-lg sm:text-xl flex items-center gap-2.5 text-eel dark:text-dark-text">
                <BookOpen className="w-5 h-5 text-duo-green" />
                Table of Contents
              </h3>
              <button 
                onClick={() => setShowTocModal(false)} 
                className="p-1.5 rounded-lg text-gray-400 hover:text-eel dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-border transition-colors"
                aria-label="Tutup daftar isi"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2 pr-1 divide-y divide-gray-100/60 dark:divide-dark-border/40">
              {toc.map((ch, idx) => {
                const lvl = typeof ch.level === 'number' ? ch.level : 0;
                const isTopLevel = lvl === 0;
                const prevLvl = idx > 0 && typeof toc[idx - 1].level === 'number' ? toc[idx - 1].level : 0;
                const needsTopSpacing = isTopLevel && idx > 0 && prevLvl > 0;
                const isCurrent = idx === chapterIndex;
                const indentPadding = lvl === 1 ? 'pl-6 sm:pl-7' : lvl >= 2 ? 'pl-10 sm:pl-12' : 'pl-2';

                return (
                  <button
                    key={ch.id || idx}
                    onClick={() => {
                      loadChapter(ch.index)
                      setShowTocModal(false)
                    }}
                    title={`${ch.title} · Halaman ${ch.page_number || idx + 1} (${ch.word_count || 0} kata)`}
                    className={`w-full text-left py-2.5 px-3 rounded-lg transition-all flex items-baseline justify-between gap-3 group ${
                      needsTopSpacing ? 'mt-3.5 pt-3 border-t-0' : ''
                    } ${
                      isCurrent
                        ? 'bg-duo-green/15 dark:bg-duo-green/25 text-duo-green-dark dark:text-duo-green font-extrabold ring-1 ring-duo-green/30'
                        : 'hover:bg-gray-100/80 dark:hover:bg-dark-border/60 text-eel dark:text-dark-text'
                    }`}
                  >
                    <div className={`flex-1 min-w-0 flex items-baseline gap-2 ${indentPadding}`}>
                      <span className={`break-words ${lvl === 0 ? 'font-bold text-[15px] text-eel dark:text-dark-text tracking-tight' : 'font-normal text-sm text-eel/90 dark:text-dark-text/90'}`}>
                        {ch.title}
                      </span>
                    </div>
                    <div className="shrink-0 flex items-baseline gap-1.5 ml-3">
                      <span className="text-right tabular-nums font-mono text-sm text-gray-400 dark:text-gray-500 font-semibold group-hover:text-eel dark:group-hover:text-dark-text transition-colors">
                        {ch.page_number || idx + 1}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {/* Mobile Settings Bottom Sheet Modal [Aa] */}
      {showMobileSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center animate-in">
          <div className="card-duo w-full p-6 bg-white dark:bg-dark-card border-t-4 border-duo-green shadow-2xl rounded-b-none rounded-t-duo-lg space-y-5">
            <div className="flex items-center justify-between border-b-2 border-gray-100 dark:border-dark-border pb-3">
              <h3 className="heading-3 text-lg flex items-center gap-2">
                <Type className="w-5 h-5 text-duo-green" />
                Pengaturan Tampilan
              </h3>
              <button
                onClick={() => setShowMobileSettingsModal(false)}
                className="p-1 text-gray-400 hover:text-eel dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Font Size */}
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">Ukuran Font:</span>
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-dark-border rounded-duo p-1">
                <button
                  onClick={() => setFontSize(fontSize - 2)}
                  disabled={fontSize <= 14}
                  className="px-4 py-1.5 font-bold text-sm bg-white dark:bg-dark-card rounded-duo shadow-sm"
                >
                  A-
                </button>
                <span className="px-3 font-mono font-bold text-sm">{fontSize}px</span>
                <button
                  onClick={() => setFontSize(fontSize + 2)}
                  disabled={fontSize >= 28}
                  className="px-4 py-1.5 font-bold text-sm bg-white dark:bg-dark-card rounded-duo shadow-sm"
                >
                  A+
                </button>
              </div>
            </div>

            {/* Font Family */}
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">Jenis Font:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFontFamily('serif')}
                  className={`px-4 py-2 rounded-duo font-bold text-xs ${
                    fontFamily === 'serif' ? 'bg-duo-green text-white shadow-3d' : 'bg-gray-100 dark:bg-dark-border text-eel dark:text-dark-text'
                  }`}
                >
                  Georgia (Serif)
                </button>
                <button
                  onClick={() => setFontFamily('sans')}
                  className={`px-4 py-2 rounded-duo font-bold text-xs ${
                    fontFamily === 'sans' ? 'bg-duo-green text-white shadow-3d' : 'bg-gray-100 dark:bg-dark-border text-eel dark:text-dark-text'
                  }`}
                >
                  Nunito (Sans)
                </button>
              </div>
            </div>

            {/* Theme */}
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">Tema Warna:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTheme('light')}
                  className={`p-3 rounded-duo border-2 ${theme === 'light' ? 'border-duo-yellow bg-duo-yellow/10' : 'border-gray-200'}`}
                >
                  <Sun className="w-5 h-5 text-duo-yellow" />
                </button>
                <button
                  onClick={() => setTheme('sepia')}
                  className={`p-3 rounded-duo border-2 ${theme === 'sepia' ? 'border-amber-700 bg-amber-100' : 'border-gray-200'}`}
                >
                  <BookOpen className="w-5 h-5 text-amber-800" />
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`p-3 rounded-duo border-2 ${theme === 'dark' ? 'border-duo-blue bg-duo-blue/10' : 'border-gray-200'}`}
                >
                  <Moon className="w-5 h-5 text-duo-blue" />
                </button>
              </div>
            </div>

            {/* Popup Mode Selector */}
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">Gaya Penjelasan:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPopupMode('bottom-sheet')}
                  className={`px-3 py-1.5 rounded-duo font-bold text-xs flex items-center gap-1 transition-all ${
                    isBottomSheet ? 'bg-duo-green text-white shadow-3d' : 'bg-gray-100 dark:bg-dark-border text-eel dark:text-dark-text'
                  }`}
                >
                  <PanelBottom className="w-3.5 h-3.5" />
                  Panel Bawah
                </button>
                <button
                  type="button"
                  onClick={() => setPopupMode('tooltip')}
                  className={`px-3 py-1.5 rounded-duo font-bold text-xs flex items-center gap-1 transition-all ${
                    !isBottomSheet ? 'bg-duo-green text-white shadow-3d' : 'bg-gray-100 dark:bg-dark-border text-eel dark:text-dark-text'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Tooltip
                </button>
              </div>
            </div>

            {/* TTS Button */}
            <button
              onClick={() => { setShowMobileSettingsModal(false); toggleChapterTTS(); }}
              className={`w-full btn-duo py-3 text-sm flex items-center justify-center gap-2 ${
                isPlayingTTS ? 'bg-duo-yellow text-eel shadow-3d-yellow' : 'bg-duo-green text-white shadow-3d'
              }`}
            >
              {isPlayingTTS ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isPlayingTTS ? 'Hentikan Suara TTS' : 'Baca Seluruh Halaman Ini'}</span>
            </button>

            <button
              onClick={() => setShowMobileSettingsModal(false)}
              className="btn-secondary w-full py-2.5 text-xs"
            >
              Selesai
            </button>
          </div>
        </div>
      )}

      {/* Tier 2: Google Translate Sprint 1 Dictionary Drawer (AC-WI-04, AC-WI-17) */}
      <DictionaryDrawer
        isOpen={isDrawerOpen}
        word={drawerWord}
        sourceLang={book?.language || 'en'}
        targetLang={targetLanguage || 'id'}
        contextSentence={drawerContext}
        extraExamples={drawerExtraExamples}
        sentenceId={drawerSentenceId}
        bookId={bookId}
        bookTitle={book?.title || ''}
        chapterIndex={chapterIndex}
        chapterTitle={chapter?.title || ''}
        initialTab={drawerInitialTab}
        onClose={() => setIsDrawerOpen(false)}
        onSaveWord={(w, ctx) => handleSaveVocabulary(w, ctx)}
        onOpenWord={(nextWord) => openDictionaryDrawer(nextWord, drawerSentenceId, drawerContext, 'meaning')}
        onLanguageChange={(code) => setTargetLanguage(code)}
        isSaved={drawerWord ? (savedWords.has(drawerWord.toLowerCase()) || false) : false}
        saving={savingVocab}
        translationEngine={translationEngine || 'google'}
        motherLang={motherLanguage || 'id'}
        customConfig={{ customBaseUrl, customApiKey, customModel, mother_lang: motherLanguage || 'id' }}
      />

      <SentencePanel
        isOpen={Boolean(sentencePanel)}
        sentenceId={sentencePanel?.sentenceId || null}
        sentenceText={sentencePanel?.text || ''}
        sourceLang={book?.language || 'en'}
        targetLang={targetLanguage || 'id'}
        motherLang={motherLanguage || 'id'}
        translationEngine={translationEngine || 'google'}
        customConfig={{ customBaseUrl, customApiKey, customModel, mother_lang: motherLanguage || 'id' }}
        onPlayAudio={(text, lang, key) => speakText(text, lang, key)}
        onOpenWord={(nextWord) => {
          const current = sentencePanel
          setSentencePanel(null)
          openDictionaryDrawer(nextWord, current?.sentenceId, current?.text || '', 'meaning')
        }}
        onClose={() => setSentencePanel(null)}
      />

      {/* Target Language Popover (F3) */}
      <TargetLanguagePopover
        isOpen={isLangPopoverOpen}
        currentTarget={targetLanguage || 'id'}
        onSelect={(newLang) => setTargetLanguage(newLang)}
        onClose={() => setIsLangPopoverOpen(false)}
      />
    </div>
  )
}
