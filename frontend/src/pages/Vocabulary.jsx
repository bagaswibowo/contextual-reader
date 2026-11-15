import { PronunciationWidget } from '../components/PronunciationWidget'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Brain, BookOpen, Volume2, RotateCcw, CheckCircle2, 
  XCircle, HelpCircle, Flame, Search, Filter, Trash2, History 
} from 'lucide-react'
import toast from 'react-hot-toast'
import { vocabularyApi, booksApi } from '../utils/api'
import { LookupHistoryTab } from '../components/history/LookupHistoryTab'

export function Vocabulary() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('list') // 'list' | 'flashcards' | 'history'
  const [vocabulary, setVocabulary] = useState([])
  const [books, setBooks] = useState([])
  const [selectedBook, setSelectedBook] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // Flashcard Review Session state
  const [dueQueue, setDueQueue] = useState([])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 })
  const [sessionFinished, setSessionFinished] = useState(false)

  useEffect(() => {
    loadVocabulary()
    loadBooks()
  }, [selectedBook])

  const loadVocabulary = async () => {
    try {
      setLoading(true)
      const params = {}
      if (selectedBook) params.book_id = selectedBook
      const res = await vocabularyApi.list(params)
      const list = res.data.results || res.data || []
      setVocabulary(Array.isArray(list) ? list : [])
      setLoading(false)
    } catch (err) {
      console.error(err)
      setVocabulary([])
      setLoading(false)
    }
  }

  const handleDeleteVocabulary = async (e, id) => {
    if (e && e.stopPropagation) e.stopPropagation()
    if (!window.confirm('Hapus kata ini dari daftar kosakata?')) return

    try {
      await vocabularyApi.delete(id)
      setVocabulary(prev => prev.filter(item => item.id !== id))
      toast.success('Kosakata berhasil dihapus')
    } catch (err) {
      toast.error(err.message || 'Gagal menghapus kosakata')
    }
  }

  const loadBooks = async () => {
    try {
      const res = await booksApi.list()
      const list = res.data.results || res.data || []
      setBooks(Array.isArray(list) ? list : [])
    } catch (err) {
      console.error(err)
      setBooks([])
    }
  }

  const startFlashcardSession = async () => {
    try {
      setLoading(true)
      const res = await vocabularyApi.due()
      let queue = res.data.results || res.data || []
      if (!Array.isArray(queue)) queue = []
      if (queue.length === 0 && vocabulary.length > 0) {
        queue = vocabulary.slice(0, 10)
      }
      setDueQueue(queue)
      setCurrentCardIndex(0)
      setIsFlipped(false)
      setSessionStats({ reviewed: 0, correct: 0 })
      setSessionFinished(false)
      setActiveTab('flashcards')
      setLoading(false)
    } catch (err) {
      alert(err.message || 'Gagal memulai sesi flashcard')
      setLoading(false)
    }
  }

  const handleReviewAnswer = async (quality) => {
    const currentCard = dueQueue[currentCardIndex]
    if (!currentCard) return

    try {
      await vocabularyApi.review(currentCard.id, quality)
      
      const isCorrect = quality >= 3
      setSessionStats(prev => ({
        reviewed: prev.reviewed + 1,
        correct: isCorrect ? prev.correct + 1 : prev.correct
      }))

      if (currentCardIndex + 1 < dueQueue.length) {
        setCurrentCardIndex(prev => prev + 1)
        setIsFlipped(false)
      } else {
        setSessionFinished(true)
      }
    } catch (err) {
      console.error('Failed to submit review', err)
    }
  }

  const speakText = (text, lang = 'en') => {
    if (!text) return
    try {
      const audio = new Audio(`/api/translations/tts/?text=${encodeURIComponent(text)}&lang=${lang}`)
      audio.play().catch(() => {
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel()
          const utterance = new SpeechSynthesisUtterance(text)
          utterance.lang = 'en-US'
          window.speechSynthesis.speak(utterance)
        }
      })
    } catch (e) {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = 'en-US'
        window.speechSynthesis.speak(utterance)
      }
    }
  }

  const vocabList = Array.isArray(vocabulary) ? vocabulary : []
  const filteredVocabulary = vocabList.filter(item => {
    const word = item.word_translation?.word?.toLowerCase() || ''
    const meaning = item.word_translation?.contextual_meaning?.toLowerCase() || ''
    const q = searchQuery.toLowerCase()
    return word.includes(q) || meaning.includes(q)
  })

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-16">
      {/* Header */}
      <section className="hero-band cr-anim-rise" aria-labelledby="vocab-title">
        <div className="relative">
          <p className="eyebrow">Latihan kosakata</p>
          <h1 id="vocab-title" className="display-1 mt-3 max-w-[18ch]">
            Kata yang kamu simpan, jadi milikmu.
          </h1>
          <p className="mt-4 max-w-[52ch] text-base font-semibold leading-relaxed" style={{ color: 'var(--cr-text-secondary)' }}>
            Setiap kata yang diketuk saat membaca masuk ke daftar ini.
            Review berulang dengan jeda membantu kamu mengingatnya lebih lama.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={startFlashcardSession}
              className="btn-primary w-full sm:w-auto"
            >
              <Flame className="h-5 w-5" aria-hidden="true" />
              Mulai review
            </button>
            <p className="font-heading text-base font-extrabold" style={{ color: 'var(--cr-text-accent)' }}>
              {vocabList.length > 0
                ? `${vocabList.length} kata tersimpan`
                : 'Belum ada kata tersimpan'}
            </p>
          </div>
        </div>
      </section>

      {/* View switcher */}
      <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
        <div className="segmented w-max" role="tablist" aria-label="Tampilan kosakata">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'list'}
            aria-controls="vocab-panel"
            onClick={() => setActiveTab('list')}
            className="min-h-[44px] shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 font-ui text-sm font-extrabold transition-colors sm:px-5"
            style={activeTab === 'list'
              ? { backgroundColor: 'var(--cr-bg-surface-elevated)', color: 'var(--cr-text-accent)', boxShadow: '0 2px 0 0 var(--cr-border-subtle)' }
              : { color: 'var(--cr-text-secondary)' }}
          >
            Semua kata ({vocabList.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'flashcards'}
            aria-controls="vocab-panel"
            onClick={startFlashcardSession}
            className="min-h-[44px] shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 font-ui text-sm font-extrabold transition-colors sm:px-5"
            style={activeTab === 'flashcards'
              ? { backgroundColor: 'var(--cr-bg-surface-elevated)', color: 'var(--cr-blue-text)', boxShadow: '0 2px 0 0 var(--cr-border-subtle)' }
              : { color: 'var(--cr-text-secondary)' }}
          >
            Flashcard
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'history'}
            aria-controls="vocab-panel"
            onClick={() => setActiveTab('history')}
            className="flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2.5 font-ui text-sm font-extrabold transition-colors sm:px-5"
            style={activeTab === 'history'
              ? { backgroundColor: 'var(--cr-bg-surface-elevated)', color: 'var(--cr-text-accent)', boxShadow: '0 2px 0 0 var(--cr-border-subtle)' }
              : { color: 'var(--cr-text-secondary)' }}
          >
            <History className="h-4 w-4" aria-hidden="true" />
            Riwayat
          </button>
        </div>
      </div>

      {/* TAB 1: LIST VIEW */}
      {activeTab === 'list' && (
        <div id="vocab-panel" role="tabpanel" className="space-y-6">
          {/* Filters & Search */}
          <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--cr-text-secondary)' }} aria-hidden="true" />
              <label htmlFor="vocab-search" className="sr-only">Cari kata atau arti</label>
              <input
                id="vocab-search"
                type="search"
                placeholder="Cari kata atau arti"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input-duo pl-10"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 shrink-0" style={{ color: 'var(--cr-text-secondary)' }} aria-hidden="true" />
              <label htmlFor="vocab-book-filter" className="sr-only">Filter berdasarkan buku</label>
              <select
                id="vocab-book-filter"
                value={selectedBook}
                onChange={e => setSelectedBook(e.target.value)}
                className="input-duo w-full sm:w-60"
              >
                <option value="">Semua buku</option>
                {books.map(b => (
                  <option key={b.id} value={b.id}>{b.title}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Vocabulary list */}
          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-busy="true">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="card-duo p-5">
                  <div className="cr-skeleton h-6 w-1/3 rounded" />
                  <div className="cr-skeleton mt-3 h-16 rounded-xl" />
                  <div className="cr-skeleton mt-3 h-4 w-2/3 rounded" />
                </div>
              ))}
              <p className="sr-only">Memuat kosakata</p>
            </div>
          ) : filteredVocabulary.length === 0 ? (
            <div className="card-duo mx-auto my-6 max-w-md p-10 text-center">
              <div
                className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl border-2"
                style={{ borderColor: 'var(--cr-border-subtle)', backgroundColor: 'var(--cr-bg-surface)' }}
              >
                <Brain className="h-8 w-8" style={{ color: 'var(--cr-text-secondary)' }} aria-hidden="true" />
              </div>
              <h3 className="heading-3 mb-2">
                {searchQuery || selectedBook ? 'Tidak ada kata yang cocok' : 'Belum ada kosakata'}
              </h3>
              <p className="mb-6 text-sm font-semibold" style={{ color: 'var(--cr-text-secondary)' }}>
                {searchQuery || selectedBook
                  ? 'Coba kata kunci lain atau pilih semua buku.'
                  : 'Ketuk kata saat membaca untuk menyimpannya ke daftar ini.'}
              </p>
              {(searchQuery || selectedBook) ? (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setSelectedBook('') }}
                  className="btn-outline"
                >
                  Hapus filter
                </button>
              ) : (
                <button type="button" onClick={() => navigate('/library')} className="btn-primary">
                  <BookOpen className="h-5 w-5" aria-hidden="true" />
                  Pilih buku
                </button>
              )}
            </div>
          ) : (
            <ul className="cr-stagger grid list-none grid-cols-1 gap-4 md:grid-cols-2">
              {filteredVocabulary.map(item => {
                const trans = item.word_translation || {}
                const sentence = item.sentence || {}

                return (
                  <li key={item.id}>
                    <article className="card-duo flex h-full flex-col justify-between p-5">
                      <div>
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <h3 className="font-heading text-xl font-extrabold" style={{ color: 'var(--cr-text-primary)' }}>
                              {trans.word}
                            </h3>
                            {trans.ipa && (
                              <span
                                className="rounded-lg border px-2 py-0.5 font-mono text-xs font-bold"
                                style={{ borderColor: 'var(--cr-border-subtle)', color: 'var(--cr-text-secondary)' }}
                              >
                                /{trans.ipa}/
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => speakText(trans.word)}
                              className="btn-ghost -ml-1 px-2"
                              aria-label={`Dengarkan pelafalan ${trans.word}`}
                            >
                              <Volume2 className="h-4 w-4" style={{ color: 'var(--cr-blue-text)' }} aria-hidden="true" />
                            </button>
                          </div>

                          <span className={
                            item.status === 'mastered' ? 'badge-green' :
                            item.status === 'known' ? 'badge-blue' : 'badge-yellow'
                          }>
                            {item.status === 'mastered' ? 'Mahir' :
                             item.status === 'known' ? 'Paham' : 'Belajar'}
                          </span>
                        </div>

                        <div
                          className="mb-3 rounded-xl border p-3"
                          style={{ borderColor: 'var(--cr-btn-primary-shadow)', backgroundColor: 'var(--cr-highlight-word-hover)' }}
                        >
                          <span className="eyebrow block" style={{ color: 'var(--cr-text-accent)' }}>
                            Arti kontekstual
                          </span>
                          <p className="mt-1 font-heading text-base font-bold" style={{ color: 'var(--cr-text-primary)' }}>
                            {trans.contextual_meaning}
                          </p>
                        </div>

                        {sentence.text && (
                          <p className="line-clamp-2 text-sm font-medium italic" style={{ color: 'var(--cr-text-secondary)' }}>
                            “{sentence.text}”
                          </p>
                        )}
                      </div>

                      <div
                        className="mt-4 flex items-center justify-between gap-2 border-t-2 pt-3 text-xs font-bold"
                        style={{ borderColor: 'var(--cr-border-subtle)', color: 'var(--cr-text-secondary)' }}
                      >
                        <span className="truncate">
                          {item.book?.title || 'Umum'} · {item.review_count || 0} review
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteVocabulary(e, item.id)}
                          className="btn-ghost shrink-0 px-2"
                          aria-label={`Hapus kata ${trans.word}`}
                          title="Hapus kata"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </article>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {/* TAB 2: FLASHCARD REVIEW SESSION */}
      {activeTab === 'flashcards' && (
        <div className="mx-auto w-full max-w-xl py-2">
          {sessionFinished ? (
            <div className="card-duo cr-anim-rise p-8 text-center">
              <div
                className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-3xl border-2"
                style={{ borderColor: 'var(--cr-btn-primary-shadow)', backgroundColor: 'var(--cr-highlight-word-hover)' }}
              >
                <CheckCircle2 className="h-10 w-10" style={{ color: 'var(--cr-text-accent)' }} aria-hidden="true" />
              </div>
              <h2 className="heading-2 mb-2">Sesi review selesai</h2>
              <p className="mb-6 text-sm font-semibold" style={{ color: 'var(--cr-text-secondary)' }}>
                {sessionStats.reviewed > 0
                  ? `${sessionStats.reviewed} kata direview pada sesi ini.`
                  : 'Belum ada kata yang direview.'}
              </p>

              <div className="mx-auto mb-8 grid max-w-xs grid-cols-2 gap-3">
                <div className="rounded-2xl border-2 p-4" style={{ borderColor: 'var(--cr-btn-primary-shadow)' }}>
                  <span className="font-heading text-3xl font-extrabold" style={{ color: 'var(--cr-text-accent)' }}>
                    {sessionStats.correct}
                  </span>
                  <span className="mt-1 block text-xs font-bold" style={{ color: 'var(--cr-text-secondary)' }}>benar</span>
                </div>
                <div className="rounded-2xl border-2 p-4" style={{ borderColor: 'var(--cr-blue-text)' }}>
                  <span className="font-heading text-3xl font-extrabold" style={{ color: 'var(--cr-blue-text)' }}>
                    {Math.round((sessionStats.correct / (sessionStats.reviewed || 1)) * 100)}%
                  </span>
                  <span className="mt-1 block text-xs font-bold" style={{ color: 'var(--cr-text-secondary)' }}>akurasi</span>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => setActiveTab('list')} className="btn-outline flex-1">
                  Kembali ke daftar
                </button>
                <button type="button" onClick={startFlashcardSession} className="btn-primary flex-1">
                  Latihan lagi
                </button>
              </div>
            </div>
          ) : dueQueue.length === 0 ? (
            <div className="card-duo p-10 text-center">
              <div
                className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl border-2"
                style={{ borderColor: 'var(--cr-border-subtle)', backgroundColor: 'var(--cr-bg-surface)' }}
              >
                <CheckCircle2 className="h-8 w-8" style={{ color: 'var(--cr-text-accent)' }} aria-hidden="true" />
              </div>
              <h3 className="heading-3 mb-2">Tidak ada kata untuk direview</h3>
              <p className="mb-6 text-sm font-semibold" style={{ color: 'var(--cr-text-secondary)' }}>
                Semua kata masih dalam jadwal aman. Tambah kata baru dengan membacanya di mode baca.
              </p>
              <button type="button" onClick={() => setActiveTab('list')} className="btn-primary">
                Lihat semua kata
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 text-sm font-bold" style={{ color: 'var(--cr-text-secondary)' }}>
                <span>Kartu {currentCardIndex + 1} dari {dueQueue.length}</span>
                <div
                  className="progress-duo w-40"
                  role="progressbar"
                  aria-valuemin={1}
                  aria-valuemax={dueQueue.length}
                  aria-valuenow={currentCardIndex + 1}
                  aria-label="Progres sesi flashcard"
                >
                  <div
                    className="progress-duo-fill"
                    style={{ width: `${((currentCardIndex + 1) / dueQueue.length) * 100}%` }}
                  />
                </div>
              </div>

              {(() => {
                const card = dueQueue[currentCardIndex]
                const trans = card?.word_translation || {}
                const sentence = card?.sentence || {}

                return (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={isFlipped ? 'Kartu arti. Tekan untuk kembali ke kata.' : 'Kartu kata. Tekan untuk melihat arti.'}
                    onClick={() => setIsFlipped(!isFlipped)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setIsFlipped(!isFlipped)
                      }
                    }}
                    className="card-duo cr-anim-rise relative flex min-h-[320px] cursor-pointer flex-col items-center justify-center p-8 text-center"
                  >
                    {!isFlipped ? (
                      <div className="cr-anim-fade w-full max-w-md space-y-4">
                        <span className="badge-blue">Ketuk untuk melihat arti</span>

                        <h2 className="font-heading text-4xl font-extrabold tracking-tight md:text-5xl" style={{ color: 'var(--cr-text-primary)' }}>
                          {trans.word}
                        </h2>

                        {trans.ipa && (
                          <div className="flex items-center justify-center gap-2">
                            <span className="font-mono text-sm" style={{ color: 'var(--cr-text-secondary)' }}>/{trans.ipa}/</span>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); speakText(trans.word) }}
                              className="btn-ghost px-2"
                              aria-label={`Dengarkan pelafalan ${trans.word}`}
                            >
                              <Volume2 className="h-5 w-5" style={{ color: 'var(--cr-blue-text)' }} aria-hidden="true" />
                            </button>
                          </div>
                        )}

                        {sentence.text && (
                          <p
                            className="mt-6 rounded-xl border p-4 text-sm font-medium italic"
                            style={{ borderColor: 'var(--cr-border-subtle)', backgroundColor: 'var(--cr-bg-surface)', color: 'var(--cr-text-secondary)' }}
                          >
                            “{sentence.text}”
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="cr-anim-fade w-full max-w-md space-y-4">
                        <span className="badge-green">Arti kontekstual</span>

                        <h2 className="heading-1 text-3xl" style={{ color: 'var(--cr-text-accent)' }}>
                          {trans.contextual_meaning}
                        </h2>

                        {trans.other_meanings?.length > 0 && (
                          <div
                            className="rounded-xl border p-3 text-left text-xs font-semibold"
                            style={{ borderColor: 'var(--cr-border-subtle)', backgroundColor: 'var(--cr-bg-surface)', color: 'var(--cr-text-secondary)' }}
                          >
                            <span className="eyebrow mb-1 block">Arti lain</span>
                            <p>{trans.other_meanings.join(', ')}</p>
                          </div>
                        )}

                        <div className="w-full pt-2 text-left" onClick={(e) => e.stopPropagation()}>
                          <PronunciationWidget
                            word={trans.word}
                            ipa={trans.ipa}
                            showVisemeGuide={true}
                            compact={true}
                            lang={trans.target_lang || trans.source_lang || trans.lang || 'en'}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {isFlipped ? (
                <div className="cr-anim-rise grid grid-cols-3 gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => handleReviewAnswer(1)}
                    className="btn-danger flex-col gap-1 py-3"
                  >
                    <XCircle className="h-5 w-5" aria-hidden="true" />
                    <span className="text-xs">Lupa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReviewAnswer(3)}
                    className="btn-warning flex-col gap-1 py-3"
                  >
                    <HelpCircle className="h-5 w-5" aria-hidden="true" />
                    <span className="text-xs">Ragu</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReviewAnswer(5)}
                    className="btn-primary flex-col gap-1 py-3"
                  >
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    <span className="text-xs">Ingat</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsFlipped(true)}
                  className="btn-secondary w-full"
                >
                  Tunjukkan jawaban
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RIWAYAT PENCARIAN (F2) */}
      {activeTab === 'history' && (
        <div id="vocab-panel" role="tabpanel" className="space-y-4">
          <LookupHistoryTab
            onNavigateBook={(item) => {
              if (item.bookId) {
                navigate(`/read/${item.bookId}`)
              }
            }}
          />
        </div>
      )}
    </div>
  )
}
