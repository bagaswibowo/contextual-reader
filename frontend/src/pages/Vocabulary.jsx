import { useState, useEffect } from 'react'
import { 
  Brain, BookOpen, Volume2, RotateCcw, CheckCircle2, 
  XCircle, HelpCircle, Sparkles, Flame, Search, Filter 
} from 'lucide-react'
import { vocabularyApi, booksApi } from '../utils/api'

export function Vocabulary() {
  const [activeTab, setActiveTab] = useState('list') // 'list' | 'flashcards'
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

  const speakText = (text) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    window.speechSynthesis.speak(utterance)
  }

  const vocabList = Array.isArray(vocabulary) ? vocabulary : []
  const filteredVocabulary = vocabList.filter(item => {
    const word = item.word_translation?.word?.toLowerCase() || ''
    const meaning = item.word_translation?.contextual_meaning?.toLowerCase() || ''
    const q = searchQuery.toLowerCase()
    return word.includes(q) || meaning.includes(q)
  })

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-16">
      {/* Header Banner */}
      <div className="card-duo p-6 md:p-8 bg-gradient-to-r from-duo-green/10 via-duo-blue/10 to-duo-yellow/10 border-2 border-duo-green flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-duo-green text-white font-extrabold text-xs shadow-3d">
            <Brain className="w-4 h-4" />
            <span>Spaced Repetition System</span>
          </div>
          <h1 className="heading-1 text-2xl md:text-3xl">Daftar Kosakata & Review</h1>
          <p className="text-sm font-semibold text-gray-600 dark:text-dark-muted max-w-xl">
            Simpan kata baru saat membaca dan kuasai dengan flashcard cerdas berstandar Duolingo.
          </p>
        </div>

        <button
          onClick={startFlashcardSession}
          className="btn-primary flex items-center gap-2 px-6 py-3 text-base shadow-3d"
        >
          <Flame className="w-5 h-5 fill-current" />
          <span>Mulai Flashcard Review</span>
        </button>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-3 border-b-2 border-gray-200 dark:border-dark-border pb-2">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-5 py-2.5 rounded-duo font-ui font-extrabold text-sm transition-all ${
            activeTab === 'list'
              ? 'bg-duo-green text-white shadow-3d'
              : 'text-eel dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-border'
          }`}
        >
          Semua Kata ({vocabList.length})
        </button>
        <button
          onClick={startFlashcardSession}
          className={`px-5 py-2.5 rounded-duo font-ui font-extrabold text-sm transition-all ${
            activeTab === 'flashcards'
              ? 'bg-duo-blue text-white shadow-3d-blue'
              : 'text-eel dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-border'
          }`}
        >
          Sesi Review Flashcard
        </button>
      </div>

      {/* TAB 1: LIST VIEW */}
      {activeTab === 'list' && (
        <div className="space-y-6">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cari kata atau arti..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input-duo pl-11 py-2.5 text-sm"
              />
            </div>

            {/* Book Filter Selector */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={selectedBook}
                onChange={e => setSelectedBook(e.target.value)}
                className="input-duo py-2.5 text-sm w-full sm:w-60"
              >
                <option value="">Semua Buku</option>
                {books.map(b => (
                  <option key={b.id} value={b.id}>{b.title}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Vocabulary Grid */}
          {loading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-duo-green border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="font-bold text-gray-500">Memuat kosakata...</p>
            </div>
          ) : filteredVocabulary.length === 0 ? (
            <div className="card-duo p-12 text-center max-w-md mx-auto my-8">
              <Brain className="w-16 h-16 text-gray-300 dark:text-dark-border mx-auto mb-3" />
              <h3 className="heading-3 mb-1">Belum ada kosakata</h3>
              <p className="text-sm text-gray-500 mb-6">
                Klik kata saat membaca buku untuk menyimpannya ke daftar pelajari.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredVocabulary.map(item => {
                const trans = item.word_translation || {}
                const sentence = item.sentence || {}

                return (
                  <div 
                    key={item.id}
                    className="card-duo p-5 hover:border-duo-green transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-heading font-extrabold text-xl text-eel dark:text-dark-text">
                              {trans.word}
                            </h3>
                            {trans.ipa && (
                              <span className="text-xs font-mono text-gray-500 bg-gray-100 dark:bg-dark-border px-2 py-0.5 rounded-full">
                                /{trans.ipa}/
                              </span>
                            )}
                            <button
                              onClick={() => speakText(trans.word)}
                              className="p-1 rounded-full text-duo-blue hover:bg-duo-blue/10"
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <span className={`badge-duo ${
                          item.status === 'mastered' ? 'badge-green' :
                          item.status === 'known' ? 'badge-blue' : 'badge-yellow'
                        }`}>
                          {item.status === 'mastered' ? 'Mahir' :
                           item.status === 'known' ? 'Paham' : 'Belajar'}
                        </span>
                      </div>

                      {/* Contextual Meaning */}
                      <div className="p-3 rounded-duo bg-duo-green/10 border border-duo-green/30 mb-3">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-duo-green block mb-0.5">
                          Arti Kontekstual
                        </span>
                        <p className="font-heading font-bold text-base text-eel dark:text-dark-text">
                          {trans.contextual_meaning}
                        </p>
                      </div>

                      {/* Sentence Context */}
                      {sentence.text && (
                        <p className="text-xs italic text-gray-500 dark:text-dark-muted line-clamp-2">
                          "{sentence.text}"
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-dark-border flex items-center justify-between text-xs text-gray-400">
                      <span>Buku: {item.book?.title || 'Umum'}</span>
                      <span>Review: {item.review_count}x</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: FLASHCARD REVIEW SESSION */}
      {activeTab === 'flashcards' && (
        <div className="max-w-xl mx-auto w-full py-6">
          {sessionFinished ? (
            /* Session Completed Screen */
            <div className="card-duo p-8 text-center bg-white dark:bg-dark-card animate-bounce-in">
              <div className="w-20 h-20 bg-duo-green/20 text-duo-green rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-10 h-10 animate-spin" />
              </div>
              <h2 className="heading-1 text-3xl mb-2">Sesi Review Selesai! 🎉</h2>
              <p className="text-gray-600 dark:text-dark-muted mb-6">
                Hebat! Kamu telah mereview {sessionStats.reviewed} kata pada sesi ini.
              </p>

              <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto mb-8">
                <div className="p-4 rounded-duo bg-duo-green/10 border-2 border-duo-green">
                  <span className="font-heading font-extrabold text-3xl text-duo-green">
                    {sessionStats.correct}
                  </span>
                  <span className="block text-xs font-bold text-gray-500 mt-1">Benar</span>
                </div>
                <div className="p-4 rounded-duo bg-duo-blue/10 border-2 border-duo-blue">
                  <span className="font-heading font-extrabold text-3xl text-duo-blue">
                    {Math.round((sessionStats.correct / (sessionStats.reviewed || 1)) * 100)}%
                  </span>
                  <span className="block text-xs font-bold text-gray-500 mt-1">Akurasi</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={() => setActiveTab('list')} className="btn-secondary flex-1">
                  Kembali ke Daftar
                </button>
                <button onClick={startFlashcardSession} className="btn-primary flex-1">
                  Latihan Lagi
                </button>
              </div>
            </div>
          ) : dueQueue.length === 0 ? (
            <div className="card-duo p-12 text-center">
              <CheckCircle2 className="w-16 h-16 text-duo-green mx-auto mb-3" />
              <h3 className="heading-2 mb-2">Tidak ada kata yang perlu direview!</h3>
              <p className="text-sm text-gray-500 mb-6">
                Semua kosakata berada dalam jadwal aman. Tambahkan kata baru dari mode baca.
              </p>
              <button onClick={() => setActiveTab('list')} className="btn-primary">
                Lihat Semua Kosakata
              </button>
            </div>
          ) : (
            /* Active Flashcard */
            <div className="space-y-6">
              {/* Progress Header */}
              <div className="flex items-center justify-between font-bold text-sm text-gray-500">
                <span>Kartu {currentCardIndex + 1} dari {dueQueue.length}</span>
                <div className="w-48 progress-duo">
                  <div 
                    className="progress-duo-fill" 
                    style={{ width: `${((currentCardIndex + 1) / dueQueue.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* 3D Interactive Card Flip */}
              {(() => {
                const card = dueQueue[currentCardIndex]
                const trans = card?.word_translation || {}
                const sentence = card?.sentence || {}

                return (
                  <div 
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="card-duo min-h-[320px] p-8 cursor-pointer flex flex-col items-center justify-center text-center relative hover:border-duo-blue transition-all duration-300 shadow-xl"
                  >
                    {!isFlipped ? (
                      /* FRONT SIDE */
                      <div className="space-y-4 animate-in">
                        <span className="badge-blue text-xs uppercase tracking-wider">
                          Ketuk untuk melihat arti
                        </span>

                        <h2 className="heading-1 text-4xl md:text-5xl text-eel dark:text-dark-text">
                          {trans.word}
                        </h2>

                        {trans.ipa && (
                          <div className="flex items-center justify-center gap-2">
                            <span className="font-mono text-sm text-gray-500">/{trans.ipa}/</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); speakText(trans.word); }}
                              className="p-1.5 rounded-full text-duo-blue hover:bg-duo-blue/10"
                            >
                              <Volume2 className="w-5 h-5" />
                            </button>
                          </div>
                        )}

                        {sentence.text && (
                          <div className="mt-6 p-4 rounded-duo bg-gray-50 dark:bg-dark-border/40 text-sm italic text-gray-600 dark:text-dark-muted max-w-md">
                            "{sentence.text}"
                          </div>
                        )}
                      </div>
                    ) : (
                      /* BACK SIDE */
                      <div className="space-y-4 animate-bounce-in w-full max-w-md">
                        <span className="badge-green text-xs uppercase tracking-wider">
                          Arti Kontekstual
                        </span>

                        <h2 className="heading-1 text-3xl text-duo-green">
                          {trans.contextual_meaning}
                        </h2>

                        {trans.other_meanings?.length > 0 && (
                          <div className="p-3 rounded-duo bg-gray-100 dark:bg-dark-border/60 text-xs text-left">
                            <span className="font-bold text-gray-500 block mb-1">Arti Lain:</span>
                            <p>{trans.other_meanings.join(', ')}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Assessment Buttons (Duolingo 3D Press) */}
              {isFlipped ? (
                <div className="grid grid-cols-3 gap-3 animate-in">
                  <button
                    onClick={() => handleReviewAnswer(1)}
                    className="btn-danger flex flex-col items-center py-3 gap-1"
                  >
                    <XCircle className="w-5 h-5" />
                    <span className="text-xs">Lupa (1)</span>
                  </button>
                  <button
                    onClick={() => handleReviewAnswer(3)}
                    className="btn-warning flex flex-col items-center py-3 gap-1"
                  >
                    <HelpCircle className="w-5 h-5" />
                    <span className="text-xs">Ragu (3)</span>
                  </button>
                  <button
                    onClick={() => handleReviewAnswer(5)}
                    className="btn-primary flex flex-col items-center py-3 gap-1"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-xs">Ingat (5)</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsFlipped(true)}
                  className="btn-secondary w-full py-3 text-base"
                >
                  Tunjukkan Jawaban
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
