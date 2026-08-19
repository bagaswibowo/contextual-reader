import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, ChevronDown, Volume2, Globe, Bookmark, 
  Check, Plus, Sparkles, BookOpen, Sun, Moon, Type, 
  SlidersHorizontal, AlertTriangle, X, Play, Square,
  GraduationCap, Clock, GitBranch, Zap, Tag, Palette, Lightbulb, Languages, FileText
} from 'lucide-react'
import { booksApi, translationsApi, vocabularyApi } from '../utils/api'
import { useReaderStore, useVocabularyStore } from '../stores'
import { useTheme } from '../hooks/useTheme'

export function Reader() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()

  // Reader settings
  const { 
    fontSize, setFontSize, 
    fontFamily, setFontFamily, 
    lineHeight, setLineHeight,
    targetLanguage, setTargetLanguage, translationEngine,
    customBaseUrl, customApiKey, customModel
  } = useReaderStore()

  // Book & Chapter state
  const [book, setBook] = useState(null)
  const [toc, setToc] = useState([])
  const [chapterIndex, setChapterIndex] = useState(0)
  const [chapter, setChapter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Mobile settings modal state
  const [showMobileSettingsModal, setShowMobileSettingsModal] = useState(false)
  const [activeWordPopup, setActiveWordPopup] = useState(null) // { word, sentenceId, data, loading }
  const [activeSentencePopup, setActiveSentencePopup] = useState(null) // { sentenceId, text, translation, loading }
  const [showTocModal, setShowTocModal] = useState(false)
  const [savedWords, setSavedWords] = useState(new Set())
  const [savingVocab, setSavingVocab] = useState(false)

  // TTS State
  const [isPlayingTTS, setIsPlayingTTS] = useState(false)
  const [playingAudioKey, setPlayingAudioKey] = useState(null)
  const [voices, setVoices] = useState([])
  const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null)
  const audioRef = useRef(null)

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
      setActiveWordPopup(null)
      setActiveSentencePopup(null)
      const res = await booksApi.chapter(bookId, index)
      setChapter(res.data)
      setChapterIndex(index)
      
      // Load saved vocabulary for this book to reflect saved status
      try {
        const vocabRes = await vocabularyApi.list({ book_id: bookId })
        const list = vocabRes.data.results || vocabRes.data || []
        const savedSet = new Set(Array.isArray(list) ? list.filter(v => v.word_translation?.id).map(v => v.word_translation.id) : [])
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

  // Handle word or multi-word phrase click -> contextual translation
  const handleWordClick = async (event, sentenceId, rawWord, wIdx, overrideLang) => {
    // Clean punctuation from word or multi-word phrase while preserving spaces
    const cleanedWord = rawWord.replace(/^[^\w]+|[^\w]+$/g, '').replace(/\s+/g, ' ')
    if (!cleanedWord || cleanedWord.length < 2) return

    const langToUse = overrideLang || targetLanguage || 'id'

    // Set initial loading popup state
    setActiveWordPopup({
      word: cleanedWord,
      sentenceId,
      wIdx,
      lang: langToUse,
      loading: true,
      data: null
    })

    try {
      const customConfig = { customBaseUrl, customApiKey, customModel }
      const res = await translationsApi.word(sentenceId, cleanedWord, langToUse, translationEngine || 'google', customConfig)
      setActiveWordPopup(prev => ({
        ...prev,
        loading: false,
        data: res.data
      }))
    } catch (err) {
      setActiveWordPopup(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Gagal menerjemahkan kata/frasa'
      }))
    }
  }

  // Handle multi-word text selection (e.g. "VIP membership" or "human computer interaction")
  const handleTextSelection = (event, sentenceId) => {
    const selection = window.getSelection()
    if (!selection) return
    const selectedText = selection.toString().trim()
    if (selectedText.length >= 2 && selectedText.includes(' ')) {
      const cleanedPhrase = selectedText.replace(/^[^\w]+|[^\w]+$/g, '').replace(/\s+/g, ' ')
      if (cleanedPhrase.length >= 2) {
        if (event && event.stopPropagation) event.stopPropagation()
        handleWordClick(event, sentenceId, cleanedPhrase)
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

  const getOriginalLanguageInfo = (langCode) => {
    const code = (langCode || 'en').toLowerCase()
    const langMap = {
      en: { flag: '🇬🇧', name: 'Bahasa Inggris' },
      id: { flag: '🇮🇩', name: 'Bahasa Indonesia' },
      es: { flag: '🇪🇸', name: 'Bahasa Spanyol' },
      fr: { flag: '🇫🇷', name: 'Bahasa Prancis' },
      de: { flag: '🇩🇪', name: 'Bahasa Jerman' },
      ja: { flag: '🇯🇵', name: 'Bahasa Jepang' },
      'zh-cn': { flag: '🇨🇳', name: 'Bahasa Mandarin' },
      zh: { flag: '🇨🇳', name: 'Bahasa Mandarin' },
      ko: { flag: '🇰🇷', name: 'Bahasa Korea' },
      ar: { flag: '🇸🇦', name: 'Bahasa Arab' },
      ru: { flag: '🇷🇺', name: 'Bahasa Rusia' },
      pt: { flag: '🇵🇹', name: 'Bahasa Portugis' },
      it: { flag: '🇮🇹', name: 'Bahasa Italia' },
      nl: { flag: '🇳🇱', name: 'Bahasa Belanda' },
    }
    return langMap[code] || { flag: '🌐', name: code.toUpperCase() }
  }

  const AVAILABLE_LANGUAGES = [
    { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
    { code: 'es', name: 'Bahasa Spanyol', flag: '🇪🇸' },
    { code: 'fr', name: 'Bahasa Prancis', flag: '🇫🇷' },
    { code: 'de', name: 'Bahasa Jerman', flag: '🇩🇪' },
    { code: 'ja', name: 'Bahasa Jepang', flag: '🇯🇵' },
    { code: 'zh-CN', name: 'Bahasa Mandarin', flag: '🇨🇳' },
    { code: 'ko', name: 'Bahasa Korea', flag: '🇰🇷' },
    { code: 'ar', name: 'Bahasa Arab', flag: '🇸🇦' },
    { code: 'ru', name: 'Bahasa Rusia', flag: '🇷🇺' },
    { code: 'pt', name: 'Bahasa Portugis', flag: '🇵🇹' },
    { code: 'it', name: 'Bahasa Italia', flag: '🇮🇹' },
    { code: 'nl', name: 'Bahasa Belanda', flag: '🇳🇱' },
    { code: 'tr', name: 'Bahasa Turki', flag: '🇹🇷' },
    { code: 'vi', name: 'Bahasa Vietnam', flag: '🇻🇳' },
    { code: 'th', name: 'Bahasa Thailand', flag: '🇹🇭' },
    { code: 'su', name: 'Bahasa Sunda', flag: '🇮🇩' },
    { code: 'jv', name: 'Bahasa Jawa', flag: '🇮🇩' },
  ]

  // Handle sentence margin icon click -> full paragraph/sentence translation
  const handleSentenceTranslate = async (sentenceId, sentenceText, overrideLang) => {
    const langToUse = overrideLang || targetLanguage || 'id'

    setActiveSentencePopup({
      sentenceId,
      text: sentenceText,
      lang: langToUse,
      loading: true,
      translation: null,
      notes: null
    })

    try {
      const customConfig = { customBaseUrl, customApiKey, customModel }
      const res = await translationsApi.sentence(sentenceId, langToUse, translationEngine || 'google', customConfig)
      let text = res.data.indonesian_text || ''
      let notes = res.data.notes || ''

      // Client-side safety parsing if note was embedded in indonesian_text
      if (!notes && text.includes('(Note:')) {
        const parts = text.split('(Note:')
        text = parts[0].trim()
        notes = parts[1].replace(/\)$/, '').trim()
      } else if (!notes && text.includes('(Catatan:')) {
        const parts = text.split('(Catatan:')
        text = parts[0].trim()
        notes = parts[1].replace(/\)$/, '').trim()
      }

      setActiveSentencePopup(prev => ({
        ...prev,
        loading: false,
        translation: text,
        transliteration: res.data.transliteration,
        tense: res.data.tense,
        structure: res.data.structure,
        grammar_details: res.data.grammar_details,
        notes: notes
      }))
    } catch (err) {
      setActiveSentencePopup(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Gagal menerjemahkan kalimat'
      }))
    }
  }

  // Save word to vocabulary list ("Pelajari")
  const handleSaveVocabulary = async () => {
    if (!activeWordPopup || !activeWordPopup.data) return
    try {
      setSavingVocab(true)
      const transId = activeWordPopup.data.id
      await vocabularyApi.add(transId)
      setSavedWords(prev => new Set(prev).add(transId))
      setSavingVocab(false)
      setActiveWordPopup(null)
    } catch (err) {
      setSavingVocab(false)
      alert(err.message || 'Gagal menyimpan kosakata')
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

  // Stop any active playing audio
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    if (synthRef.current) {
      synthRef.current.cancel()
    }
    setPlayingAudioKey(null)
  }

  // Natural Text-To-Speech Audio Engine with Play/Stop Toggle & Female Voice Support
  const speakText = (text, langCode = 'en', audioKey = null) => {
    if (!text) return

    // If clicking the same audio currently playing -> STOP IT!
    if (audioKey && playingAudioKey === audioKey) {
      stopAudio()
      return
    }

    stopAudio()
    if (audioKey) setPlayingAudioKey(audioKey)

    const cleanText = text.trim().slice(0, 300)
    const lang = (langCode || 'en').toLowerCase()
    
    // Priority 1: Web SpeechSynthesis API with Native Female Voice Selection
    if (synthRef.current) {
      try {
        const utterance = new SpeechSynthesisUtterance(cleanText)
        utterance.lang = getSpeechLangCode(langCode)
        utterance.rate = 0.95
        
        if (lang === 'ja') {
          const femaleVoice = getFemaleJapaneseVoice()
          if (femaleVoice) {
            utterance.voice = femaleVoice
          }
          utterance.pitch = 1.25 // Higher feminine pitch contour for Japanese female voice
        } else if (lang === 'zh-cn' || lang === 'zh') {
          utterance.pitch = 1.15
        }

        utterance.onend = () => setPlayingAudioKey(null)
        utterance.onerror = () => setPlayingAudioKey(null)
        
        synthRef.current.speak(utterance)
        return
      } catch (e) {}
    }

    // Fallback: Official Google Translate Neural Audio Stream
    const encodedText = encodeURIComponent(cleanText)
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodedText}`
    
    const audio = new Audio(googleTtsUrl)
    audioRef.current = audio
    audio.onended = () => setPlayingAudioKey(null)
    audio.onerror = () => setPlayingAudioKey(null)
    audio.play().catch(() => setPlayingAudioKey(null))
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
    <div className="flex flex-col gap-6 pb-20">
      {/* Reading Toolbar - Mobile-First Responsive Design */}
      <div className="card-duo p-2.5 sm:p-4 sticky top-14 sm:top-16 z-30 flex items-center justify-between gap-2 bg-white/95 dark:bg-dark-card/95 backdrop-blur-md">
        {/* Left: Back & TOC */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button 
            onClick={() => navigate('/library')}
            className="btn-ghost p-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm shrink-0"
            title="Kembali ke Perpustakaan"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden md:inline">Perpustakaan</span>
          </button>
          
          <div className="h-5 w-[1px] bg-gray-200 dark:bg-dark-border shrink-0" />

          {/* Chapter Selector Dropdown */}
          <button
            onClick={() => setShowTocModal(true)}
            className="flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-duo hover:bg-gray-100 dark:hover:bg-dark-border font-ui font-bold text-xs sm:text-sm text-eel dark:text-dark-text min-w-0"
          >
            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-duo-green shrink-0" />
            <span className="max-w-[100px] sm:max-w-[200px] truncate">
              {chapter?.title || `Bab ${chapterIndex + 1}`}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          </button>
        </div>

        {/* Center/Right: Reader Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Target Language Selector */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-border px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-duo text-xs font-bold border border-duo-blue/30">
            <Globe className="w-3.5 h-3.5 text-duo-blue shrink-0" />
            <select
              value={targetLanguage || 'id'}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="bg-transparent text-xs font-bold text-eel dark:text-dark-text focus:outline-none cursor-pointer py-0.5 max-w-[85px] sm:max-w-[130px] truncate"
            >
              {AVAILABLE_LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* Mobile Settings Modal Trigger Button [Aa] */}
          <button
            onClick={() => setShowMobileSettingsModal(true)}
            className="sm:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-duo bg-duo-green text-white font-extrabold text-xs shadow-3d"
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
      <div className="card-duo p-3 sm:p-8 md:p-12 relative max-w-4xl mx-auto w-full min-h-[70vh] overflow-x-hidden sm:overflow-x-visible">
        {/* Chapter Header */}
        <div className="border-b-2 border-gray-100 dark:border-dark-border pb-4 sm:pb-6 mb-6 sm:mb-8 text-center">
          <span className="badge-green mb-2 text-[11px] sm:text-xs">
            Bab {chapterIndex + 1} dari {toc.length || 1}
          </span>
          <h1 className="heading-1 text-xl sm:text-3xl md:text-4xl mt-1 break-words">
            {chapter?.title}
          </h1>
          {book && (
            <p className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-dark-muted mt-1 truncate">
              {book.title} — {book.author || 'Anonim'}
            </p>
          )}
        </div>

        {/* Sentences & Paragraphs Rendering */}
        <div 
          className={`reading-text space-y-4 sm:space-y-6 ${fontFamily === 'serif' ? 'font-body' : 'font-sans'}`}
          style={{ fontSize: `${fontSize}px`, lineHeight: lineHeight }}
        >
          {chapter?.sentences?.map((sent, sIdx) => {
            const words = sent.text.split(' ')
            return (
              <div 
                key={sent.id || sIdx}
                onMouseUp={(e) => handleTextSelection(e, sent.id)}
                onTouchEnd={(e) => handleTextSelection(e, sent.id)}
                className="group relative flex items-start justify-between gap-2 p-1 sm:p-1.5 rounded-duo hover:bg-gray-50 dark:hover:bg-dark-border/40 transition-colors"
              >
                {/* Sentence text with clickable words */}
                <p className="flex-1 leading-relaxed break-words min-w-0">
                  {words.map((word, wIdx) => {
                    const isSelected = activeWordPopup && activeWordPopup.sentenceId === sent.id && activeWordPopup.wIdx === wIdx
                    return (
                      <span key={wIdx} className="relative inline-block">
                        <button
                          onClick={(e) => handleWordClick(e, sent.id, word, wIdx)}
                          className={`word-clickable rounded hover:bg-duo-green/10 px-0.5 ${isSelected ? 'bg-duo-green/20 font-bold decoration-duo-green decoration-2' : ''}`}
                        >
                          {word}
                        </button>
                        {' '}
                        {isSelected && (
                          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 animate-bounce-in w-[300px] sm:w-[340px] p-4 card-duo shadow-2xl bg-white dark:bg-dark-card border-2 border-gray-300 dark:border-dark-border text-left font-ui font-normal normal-case">
                            {/* Tooltip Pointer Arrow */}
                            <div className="absolute -top-[9px] left-1/2 -translate-x-1/2 w-0 h-0 border-x-[8px] border-x-transparent border-b-[9px] border-b-gray-300 dark:border-b-dark-border" />
                            <div className="absolute -top-[7px] left-1/2 -translate-x-1/2 w-0 h-0 border-x-[7px] border-x-transparent border-b-[7px] border-b-white dark:border-b-dark-card" />

                            {/* Header & Word */}
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-heading font-extrabold text-2xl text-eel dark:text-dark-text">
                                    {activeWordPopup.word}
                                  </h3>
                                  {activeWordPopup.data?.ipa && (
                                    <span className="text-xs font-mono text-gray-500 bg-gray-100 dark:bg-dark-border px-2 py-0.5 rounded-full">
                                      /{activeWordPopup.data.ipa}/
                                    </span>
                                  )}
                                  {(() => {
                                    const audioKey = `word_orig_${activeWordPopup.word}`
                                    const isPlaying = playingAudioKey === audioKey
                                    return (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); speakText(activeWordPopup.word, book?.language || 'en', audioKey); }}
                                        className={`p-1 rounded-full transition-colors ${isPlaying ? 'text-duo-yellow bg-duo-yellow/20 animate-pulse' : 'text-duo-blue hover:bg-duo-blue/10'}`}
                                        title={isPlaying ? "Berhenti" : "Dengarkan pengucapan kata asli"}
                                      >
                                        {isPlaying ? <Square className="w-4 h-4 fill-current text-duo-yellow" /> : <Volume2 className="w-4 h-4" />}
                                      </button>
                                    )
                                  })()}
                                </div>
                                {activeWordPopup.data?.is_false_friend && (
                                  <span className="badge-red mt-1 inline-flex items-center gap-1 text-[10px]">
                                    <AlertTriangle className="w-3 h-3" /> False Friend!
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); setActiveWordPopup(null); }}
                                className="p-1 text-gray-400 hover:text-eel dark:hover:text-white"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>

                            {activeWordPopup.loading ? (
                              <div className="flex flex-col items-center justify-center py-6 gap-2">
                                <div className="w-8 h-8 border-3 border-duo-green border-t-transparent rounded-full animate-spin" />
                                <p className="text-xs font-bold text-gray-500">Mencari makna kontekstual...</p>
                              </div>
                            ) : activeWordPopup.error ? (
                              <p className="text-xs text-duo-red py-2 font-bold">{activeWordPopup.error}</p>
                            ) : (
                              <div className="space-y-3 text-sm">
                                {/* Emerald Green Accent Box: 3-Layer Word Translation */}
                                <div className="p-3.5 sm:p-4 rounded-duo bg-duo-green/10 border-2 border-duo-green space-y-2">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-extrabold tracking-wider text-duo-green uppercase flex items-center gap-1">
                                      <Sparkles className="w-3.5 h-3.5" /> Arti Kontekstual ({activeWordPopup.lang === 'zh-CN' ? '🇨🇳 Mandarin' : activeWordPopup.lang === 'ja' ? '🇯🇵 Jepang' : activeWordPopup.lang === 'es' ? '🇪🇸 Spanyol' : activeWordPopup.lang === 'fr' ? '🇫🇷 Prancis' : '🌐 Target'})
                                    </span>
                                    <span className="text-[10px] font-bold text-duo-green bg-duo-green/20 px-1.5 py-0.5 rounded">
                                      {Math.round((activeWordPopup.data?.confidence || 0.9) * 100)}% Cocok
                                    </span>
                                  </div>

                                  {/* Layer 1: Target Language Word */}
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="font-heading font-extrabold text-2xl text-eel dark:text-dark-text">
                                      {activeWordPopup.data?.contextual_meaning}
                                    </p>
                                    {(() => {
                                      const audioKey = `word_trans_${activeWordPopup.data?.contextual_meaning}`
                                      const isPlaying = playingAudioKey === audioKey
                                      return (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); speakText(activeWordPopup.data?.contextual_meaning, activeWordPopup.lang || targetLanguage || 'id', audioKey); }}
                                          className={`p-1.5 rounded-full transition-colors shrink-0 ${isPlaying ? 'text-duo-yellow bg-duo-yellow/20 animate-pulse' : 'text-duo-green hover:bg-duo-green/20'}`}
                                          title={isPlaying ? "Berhenti" : "Dengarkan pengucapan terjemahan"}
                                        >
                                          {isPlaying ? <Square className="w-4 h-4 fill-current text-duo-yellow" /> : <Volume2 className="w-4 h-4" />}
                                        </button>
                                      )
                                    })()}
                                  </div>

                                  {/* Layer 2: Latin Pronunciation Guide (Pīnyīn / Rōmaji / Latin) */}
                                  {activeWordPopup.data?.transliteration && (
                                    <div className="pt-1 flex items-center gap-1.5 text-duo-blue font-mono font-bold text-xs">
                                      <Languages className="w-3.5 h-3.5 text-duo-blue shrink-0" />
                                      <span className="text-[10px] uppercase opacity-80">Cara Baca:</span>
                                      <span className="bg-duo-blue/20 text-duo-blue px-2 py-0.5 rounded font-extrabold">{activeWordPopup.data.transliteration}</span>
                                    </div>
                                  )}

                                  {/* Layer 3: Indonesian Mother-Tongue Meaning (If target language is foreign) */}
                                  {activeWordPopup.data?.indonesian_meaning && (activeWordPopup.lang || targetLanguage || 'id').toLowerCase() !== 'id' && (
                                    <div className="pt-1 flex items-center gap-1.5 text-duo-green font-bold text-xs border-t border-duo-green/20">
                                      <span className="text-[10px] uppercase opacity-80 text-duo-green">🇮🇩 Arti Indonesia:</span>
                                      <span className="bg-duo-green/20 text-duo-green px-2 py-0.5 rounded font-extrabold">{activeWordPopup.data.indonesian_meaning}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Structured Other Meanings / Parts of Speech */}
                                {activeWordPopup.data?.other_meanings?.length > 0 && (
                                  <div className="space-y-2 pt-1">
                                    <span className="text-[10px] font-extrabold text-gray-400 dark:text-dark-muted uppercase tracking-wider block">
                                      💡 Kelas Kata & Variasi Makna
                                    </span>
                                    <div className="space-y-2">
                                      {activeWordPopup.data.other_meanings.map((line, idx) => {
                                        let category = ''
                                        let meanings = line
                                        if (line.includes(':')) {
                                          const parts = line.split(':')
                                          category = parts[0].trim()
                                          meanings = parts.slice(1).join(':').trim()
                                        }
                                        return (
                                          <div key={idx} className="p-3 rounded-duo bg-gray-50 dark:bg-dark-border/50 border border-gray-200 dark:border-dark-border space-y-1">
                                            {category && (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-duo-blue/10 text-duo-blue border border-duo-blue/20">
                                                {category}
                                              </span>
                                            )}
                                            <p className="text-xs font-bold text-eel dark:text-dark-text leading-relaxed pl-0.5">
                                              {meanings}
                                            </p>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Beginner Usage Insight / Hint */}
                                {activeWordPopup.data?.insight && (
                                  <div className="p-3 rounded-duo bg-duo-yellow/10 border border-duo-yellow/40 text-xs text-yellow-900 dark:text-duo-yellow leading-relaxed">
                                    <span className="font-bold flex items-center gap-1 mb-0.5 text-[11px] uppercase tracking-wider text-yellow-800 dark:text-duo-yellow">
                                      💡 Insight Pemula
                                    </span>
                                    {activeWordPopup.data.insight}
                                  </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex items-center gap-2 pt-2">
                                  <button
                                    onClick={() => setActiveWordPopup(null)}
                                    className="btn-ghost flex-1 py-2 text-xs font-bold border-2 border-gray-200 dark:border-dark-border"
                                  >
                                    Saya Tahu
                                  </button>
                                  <button
                                    onClick={handleSaveVocabulary}
                                    disabled={savingVocab || savedWords.has(activeWordPopup.data?.id)}
                                    className={`btn-primary flex-1 py-2 text-xs flex items-center justify-center gap-1.5 ${
                                      savedWords.has(activeWordPopup.data?.id) ? 'bg-gray-400 shadow-none' : ''
                                    }`}
                                  >
                                    {savedWords.has(activeWordPopup.data?.id) ? (
                                      <>
                                        <Check className="w-3.5 h-3.5" /> Saved
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="w-3.5 h-3.5" /> Pelajari
                                      </>
                                    )}
                                  </button>
                                </div>

                                {/* In-Word Popup Language Switcher */}
                                <div className="flex items-center justify-between gap-1 pt-2 border-t border-gray-100 dark:border-dark-border mt-2">
                                  <span className="text-[10px] font-bold text-gray-500">Bahasa Target:</span>
                                  <select
                                    value={activeWordPopup.lang || targetLanguage || 'id'}
                                    onChange={(e) => {
                                      const newLang = e.target.value
                                      setTargetLanguage(newLang)
                                      handleWordClick(null, activeWordPopup.sentenceId, activeWordPopup.word, activeWordPopup.wIdx, newLang)
                                    }}
                                    className="input-duo py-0.5 px-2 text-xs font-bold w-auto"
                                  >
                                    {AVAILABLE_LANGUAGES.map(l => (
                                      <option key={l.code} value={l.code}>
                                        {l.flag} {l.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </span>
                    )
                  })}
                </p>

                {/* Paragraph/Sentence Translate Margin Icon (PRD §6.4) */}
                <button
                  onClick={() => handleSentenceTranslate(sent.id, sent.text)}
                  className="translate-icon p-1 rounded-full hover:bg-duo-blue/10 flex-shrink-0 mt-1"
                  title="Terjemahkan kalimat utuh (Bahasa Indonesia)"
                >
                  <Globe className="w-5 h-5 text-duo-blue" />
                </button>
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
          
          <span className="font-heading font-bold text-sm text-gray-500">
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



      {/* Sentence Translation Modal / Bottom Sheet (Mobile & Desktop Responsive) */}
      {activeSentencePopup && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveSentencePopup(null);
          }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in cursor-pointer"
        >
          <div className="card-duo max-w-2xl md:max-w-3xl w-full p-4 sm:p-6 bg-white dark:bg-dark-card border-2 border-duo-blue shadow-2xl space-y-4 max-h-[85vh] flex flex-col overflow-hidden cursor-default">
            {/* Fixed Header */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-gray-100 dark:border-dark-border shrink-0">
              <div className="flex items-center gap-2 text-duo-blue font-heading font-extrabold text-lg sm:text-xl">
                <Globe className="w-5 h-5 sm:w-6 sm:h-6" />
                <span>Terjemahan Kalimat Utuh</span>
              </div>
              <button
                onClick={() => setActiveSentencePopup(null)}
                className="p-1 text-gray-400 hover:text-eel dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeSentencePopup.loading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-8 h-8 border-4 border-duo-blue border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-bold text-duo-blue">Menerjemahkan kalimat & memproses konteks...</span>
              </div>
            ) : (
              /* Scrollable Content Body */
              <div className="overflow-y-auto space-y-4 pr-1 flex-1">
                {/* SECTION 1: Kalimat Asli */}
                <div className="p-3.5 sm:p-4 rounded-duo bg-gray-100 dark:bg-dark-border/60 border border-gray-200 dark:border-dark-border">
                  <div className="flex items-center justify-between mb-2">
                    {(() => {
                      const origInfo = getOriginalLanguageInfo(book?.language)
                      return (
                        <span className="badge-duo bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 inline-flex items-center gap-1 text-xs font-bold">
                          <span>{origInfo.flag}</span> Kalimat Asli ({origInfo.name})
                        </span>
                      )
                    })()}
                    {(() => {
                      const audioKey = `sent_orig_${activeSentencePopup.sentenceId}`
                      const isPlaying = playingAudioKey === audioKey
                      return (
                        <button
                          onClick={() => speakText(activeSentencePopup.text, book?.language || 'en', audioKey)}
                          className={`p-1 rounded-full transition-colors ${isPlaying ? 'text-duo-yellow bg-duo-yellow/20 animate-pulse' : 'text-gray-500 hover:text-eel dark:hover:text-white hover:bg-gray-200 dark:hover:bg-dark-border'}`}
                          title={isPlaying ? "Berhenti" : "Dengarkan pengucapan kalimat asli"}
                        >
                          {isPlaying ? <Square className="w-4 h-4 fill-current text-duo-yellow" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                      )
                    })()}
                  </div>
                  <p className="font-body text-sm sm:text-base italic text-eel dark:text-dark-text leading-relaxed break-words">
                    "{activeSentencePopup.text}"
                  </p>
                </div>

                {/* SECTION 2: Terjemahan dalam Bahasa Pilih */}
                <div className="p-3.5 sm:p-4 rounded-duo bg-duo-blue/10 border-2 border-duo-blue space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="badge-blue inline-flex items-center gap-1 text-xs font-bold">
                      {AVAILABLE_LANGUAGES.find(l => l.code === (activeSentencePopup.lang || targetLanguage || 'id'))?.flag || '🌐'}{' '}
                      Terjemahan ({AVAILABLE_LANGUAGES.find(l => l.code === (activeSentencePopup.lang || targetLanguage || 'id'))?.name || 'Indonesia'})
                    </span>

                    <div className="flex items-center gap-2">
                      {(() => {
                        const audioKey = `sent_trans_${activeSentencePopup.sentenceId}_${activeSentencePopup.lang}`
                        const isPlaying = playingAudioKey === audioKey
                        return (
                          <button
                            onClick={() => speakText(activeSentencePopup.translation, activeSentencePopup.lang || targetLanguage || 'id', audioKey)}
                            className={`p-1 rounded-full transition-colors ${isPlaying ? 'text-duo-yellow bg-duo-yellow/20 animate-pulse' : 'text-duo-blue hover:bg-duo-blue/20'}`}
                            title={isPlaying ? "Berhenti" : "Dengarkan suara terjemahan kalimat"}
                          >
                            {isPlaying ? <Square className="w-4 h-4 fill-current text-duo-yellow" /> : <Volume2 className="w-4 h-4" />}
                          </button>
                        )
                      })()}

                      {/* Compact Language Selector Dropdown */}
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-duo-blue shrink-0" />
                        <select
                          value={activeSentencePopup.lang || targetLanguage || 'id'}
                          onChange={(e) => {
                            const newLang = e.target.value
                            setTargetLanguage(newLang)
                            handleSentenceTranslate(activeSentencePopup.sentenceId, activeSentencePopup.text, newLang)
                          }}
                          className="input-duo py-1 px-2.5 text-xs font-extrabold w-auto cursor-pointer bg-white dark:bg-dark-card text-eel dark:text-dark-text border border-duo-blue/40 rounded-duo"
                        >
                          {AVAILABLE_LANGUAGES.map(l => (
                            <option key={l.code} value={l.code}>
                              {l.flag} {l.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Primary Translation Script Display */}
                  <p className="font-heading font-extrabold text-base sm:text-lg text-eel dark:text-dark-text leading-relaxed pt-1 break-words">
                    {activeSentencePopup.translation}
                  </p>

                  {/* 3-Layer Interleaved Aligned Cards: Only for Non-Indonesian Target Languages */}
                  {(activeSentencePopup.lang || targetLanguage || 'id').toLowerCase() !== 'id' && activeSentencePopup.grammar_details?.token_pairs?.length > 0 ? (
                    <div className="space-y-2 pt-2 border-t border-duo-blue/20">
                      <span className="text-xs sm:text-sm font-extrabold text-duo-blue uppercase tracking-wider flex items-center gap-1.5">
                        <Languages className="w-4 h-4 text-duo-blue shrink-0" />
                        <span>Terjemahan 3 Layer Per-Kata ({activeSentencePopup.lang === 'zh-CN' ? 'Pīnyīn' : activeSentencePopup.lang === 'ja' ? 'Rōmaji' : activeSentencePopup.lang === 'ko' ? 'Romaja' : 'Latin'})</span>
                      </span>

                      <div className="flex flex-wrap items-end gap-1.5 sm:gap-2 p-3 rounded-duo bg-white/90 dark:bg-dark-card/90 border border-duo-blue/30 max-h-[35vh] overflow-y-auto">
                        {activeSentencePopup.grammar_details.token_pairs.map((item, idx) => (
                          <div key={idx} className="flex flex-col items-center bg-gray-50 dark:bg-dark-border/50 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border hover:border-duo-blue transition-all shrink-0">
                            {/* Layer 1: Aksara/Kata Target */}
                            <span className="font-heading font-extrabold text-base sm:text-lg text-eel dark:text-dark-text leading-tight">
                              {item.word}
                            </span>
                            {/* Layer 2: Cara Baca Latin */}
                            <span className="font-mono text-xs font-bold text-duo-blue leading-tight tracking-tight mt-0.5">
                              {item.latin}
                            </span>
                            {/* Layer 3: Terjemahan Bahasa Indonesia */}
                            <span className="text-xs font-bold text-duo-green bg-duo-green/10 px-1.5 py-0.5 rounded mt-1 max-w-[130px] truncate">
                              {item.meaning}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (activeSentencePopup.lang || targetLanguage || 'id').toLowerCase() !== 'id' && activeSentencePopup.transliteration ? (
                    <div className="space-y-2 pt-2 border-t border-duo-blue/20">
                      <span className="text-xs sm:text-sm font-extrabold text-duo-blue uppercase tracking-wider flex items-center gap-1.5">
                        <Languages className="w-4 h-4 text-duo-blue shrink-0" />
                        <span>Panduan Cara Baca Latin ({activeSentencePopup.lang === 'zh-CN' ? 'Pīnyīn' : activeSentencePopup.lang === 'ja' ? 'Rōmaji' : activeSentencePopup.lang === 'ko' ? 'Romaja' : 'Latin'})</span>
                      </span>

                      <div className="p-3 rounded-duo bg-white/90 dark:bg-dark-card/90 border border-duo-blue/30 max-h-[30vh] overflow-y-auto">
                        <p className="font-mono text-xs sm:text-sm font-bold text-duo-blue leading-relaxed break-words tracking-tight">
                          {activeSentencePopup.transliteration}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* SECTION 3: Analisis Tata Bahasa & 16 Tenses */}
                {activeSentencePopup.tense && (
                  <div className="p-4 sm:p-5 rounded-duo bg-duo-purple/10 border-2 border-duo-purple space-y-3">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-duo-purple shrink-0" />
                      <span className="font-heading font-extrabold text-sm sm:text-base text-duo-purple uppercase tracking-wider">
                        Analisis Tata Bahasa & 16 Tenses
                      </span>
                    </div>

                    <div className="space-y-2.5 pt-1 text-sm sm:text-base">
                      <div className="flex items-start gap-2 bg-white/80 dark:bg-dark-card/80 p-2.5 rounded-lg border border-duo-purple/20">
                        <Clock className="w-4 h-4 text-duo-purple shrink-0 mt-0.5" />
                        <span className="font-bold text-duo-purple shrink-0">Tenses:</span>
                        <span className="font-extrabold text-eel dark:text-dark-text">{activeSentencePopup.tense}</span>
                      </div>

                      {activeSentencePopup.structure && (
                        <div className="flex items-start gap-2 bg-white/80 dark:bg-dark-card/80 p-2.5 rounded-lg border border-duo-purple/20">
                          <GitBranch className="w-4 h-4 text-duo-blue shrink-0 mt-0.5" />
                          <span className="font-bold text-duo-blue shrink-0">Pola Kalimat:</span>
                          <span className="font-bold text-eel dark:text-dark-text">{activeSentencePopup.structure}</span>
                        </div>
                      )}

                      {/* Verbs / Nouns / Adjectives Breakdown */}
                      {activeSentencePopup.grammar_details && (
                        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-duo-purple/20">
                          {activeSentencePopup.grammar_details.verbs?.length > 0 && (
                            <div className="flex items-center gap-1.5 bg-duo-green/10 px-2.5 py-1 rounded-md border border-duo-green/20 text-xs sm:text-sm">
                              <Zap className="w-3.5 h-3.5 text-duo-green shrink-0" />
                              <span className="font-bold text-duo-green">Verb (Kata Kerja):</span>
                              <span className="font-mono font-extrabold text-eel dark:text-dark-text">{activeSentencePopup.grammar_details.verbs.join(', ')}</span>
                            </div>
                          )}
                          {activeSentencePopup.grammar_details.nouns?.length > 0 && (
                            <div className="flex items-center gap-1.5 bg-duo-blue/10 px-2.5 py-1 rounded-md border border-duo-blue/20 text-xs sm:text-sm">
                              <Tag className="w-3.5 h-3.5 text-duo-blue shrink-0" />
                              <span className="font-bold text-duo-blue">Noun (Kata Benda):</span>
                              <span className="font-mono font-extrabold text-eel dark:text-dark-text">{activeSentencePopup.grammar_details.nouns.join(', ')}</span>
                            </div>
                          )}
                          {activeSentencePopup.grammar_details.adjectives?.length > 0 && (
                            <div className="flex items-center gap-1.5 bg-duo-yellow/10 px-2.5 py-1 rounded-md border border-duo-yellow/20 text-xs sm:text-sm">
                              <Palette className="w-3.5 h-3.5 text-duo-yellow shrink-0" />
                              <span className="font-bold text-yellow-600 dark:text-duo-yellow">Adjective (Kata Sifat):</span>
                              <span className="font-mono font-extrabold text-eel dark:text-dark-text">{activeSentencePopup.grammar_details.adjectives.join(', ')}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SECTION 4: Catatan Konteks & Istilah */}
                {activeSentencePopup.notes && (
                  <div className="p-4 sm:p-5 rounded-duo bg-duo-yellow/10 border-2 border-duo-yellow space-y-2">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-duo-yellow shrink-0" />
                      <span className="font-heading font-extrabold text-sm sm:text-base text-yellow-900 dark:text-duo-yellow uppercase tracking-wider">
                        Catatan Konteks & Istilah
                      </span>
                    </div>
                    <p className="font-ui font-bold text-sm sm:text-base text-yellow-900 dark:text-duo-yellow leading-relaxed break-words pt-1">
                      {activeSentencePopup.notes}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Fixed Footer Close Button */}
            <button
              onClick={() => setActiveSentencePopup(null)}
              className="btn-secondary w-full mt-3 shrink-0"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Table of Contents Modal */}
      {showTocModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-duo max-w-md w-full p-6 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b-2 border-gray-100 dark:border-dark-border mb-4">
              <h3 className="heading-3 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-duo-green" />
                Daftar Isi Bab
              </h3>
              <button onClick={() => setShowTocModal(false)} className="p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-2">
              {toc.map((ch, idx) => (
                <button
                  key={ch.id || idx}
                  onClick={() => {
                    loadChapter(ch.index)
                    setShowTocModal(false)
                  }}
                  className={`w-full text-left px-4 py-3 rounded-duo font-ui font-bold text-sm transition-all flex items-center justify-between ${
                    idx === chapterIndex
                      ? 'bg-duo-green text-white shadow-3d'
                      : 'hover:bg-gray-100 dark:hover:bg-dark-border text-eel dark:text-dark-text'
                  }`}
                >
                  <span className="truncate pr-2">{ch.title}</span>
                  <span className="text-xs opacity-75">{ch.word_count} kata</span>
                </button>
              ))}
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
    </div>
  )
}
