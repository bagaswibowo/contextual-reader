import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, BookOpen, Trash2, Loader2, AlertCircle, FileText,
  CheckCircle, Clock, UploadCloud, RefreshCw, Type,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { booksApi } from '../utils/api'
import { useBookStore } from '../stores'
import { BookLanguageBadge } from '../components/language/BookLanguageBadge'

const COVER_TINTS = [
  { bg: 'var(--cr-cover-1-bg)', border: 'var(--cr-cover-1-border)', ink: 'var(--cr-cover-1-ink)' },
  { bg: 'var(--cr-cover-2-bg)', border: 'var(--cr-cover-2-border)', ink: 'var(--cr-cover-2-ink)' },
  { bg: 'var(--cr-cover-3-bg)', border: 'var(--cr-cover-3-border)', ink: 'var(--cr-cover-3-ink)' },
  { bg: 'var(--cr-cover-4-bg)', border: 'var(--cr-cover-4-border)', ink: 'var(--cr-cover-4-ink)' },
]

function coverTint(seed) {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 9973
  }
  return COVER_TINTS[hash % COVER_TINTS.length]
}

function formatTitle(title) {
  if (!title) return 'Buku Tanpa Judul'
  return title.replace(/_/g, ' ').trim()
}

function WordCardStack() {
  const cards = [
    { label: 'kata', value: 'pilih satu kata', tint: 'var(--cr-cover-2-bg)', border: 'var(--cr-cover-2-border)', ink: 'var(--cr-cover-2-ink)', rotate: '-3deg', offset: '0px' },
    { label: 'makna', value: 'arti sesuai kalimat', tint: 'var(--cr-cover-1-bg)', border: 'var(--cr-cover-1-border)', ink: 'var(--cr-cover-1-ink)', rotate: '1.5deg', offset: '10px' },
    { label: 'konteks', value: 'kalimat aslinya tetap terlihat', tint: 'var(--cr-cover-3-bg)', border: 'var(--cr-cover-3-border)', ink: 'var(--cr-cover-3-ink)', rotate: '3deg', offset: '20px' },
  ]

  return (
    <div className="relative mx-auto w-full max-w-[300px]" aria-hidden="true">
      {cards.map((card) => (
        <div
          key={card.label}
          className="relative mb-2 rounded-2xl border-2 px-4 py-3"
          style={{
            backgroundColor: card.tint,
            borderColor: card.border,
            transform: `rotate(${card.rotate}) translateX(${card.offset})`,
            boxShadow: '0 4px 0 0 var(--cr-border-subtle)',
          }}
        >
          <span
            className="block text-[10px] font-extrabold uppercase tracking-[0.16em]"
            style={{ color: card.ink }}
          >
            {card.label}
          </span>
          <span
            className="mt-0.5 block font-heading text-[15px] font-extrabold leading-tight"
            style={{ color: 'var(--cr-text-primary)' }}
          >
            {card.value}
          </span>
        </div>
      ))}
      <div
        className="mt-4 flex items-center justify-center gap-2 rounded-2xl border-2 px-3 py-2"
        style={{ borderColor: 'var(--cr-border-subtle)', backgroundColor: 'var(--cr-bg-surface-elevated)' }}
      >
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--cr-btn-primary-bg)' }} />
        <span className="text-[11px] font-extrabold" style={{ color: 'var(--cr-text-secondary)' }}>
          ketuk kata mana pun saat membaca
        </span>
      </div>
    </div>
  )
}

export function Library() {
  const navigate = useNavigate()
  const { books, setBooks, loading, setLoading, error, setError, removeBook, setCurrentBook } = useBookStore()
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadingFileName, setUploadingFileName] = useState('')
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    loadBooks()
    // Poll while any book is still processing so the status flips without a reload
    const interval = setInterval(() => {
      loadBooks(true)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const loadBooks = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const response = await booksApi.list()
      const bookList = response.data.results || response.data
      setBooks(bookList)
      setError(null)
    } catch (err) {
      if (!silent) {
        setError(err.message)
        toast.error('Gagal memuat perpustakaan')
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const handleUpload = async (file) => {
    if (!file) return

    const validExts = ['.epub', '.txt', '.pdf', '.md', '.zip']
    const ext = '.' + file.name.split('.').pop().toLowerCase()

    if (!validExts.includes(ext)) {
      toast.error('Format tidak didukung. Gunakan EPUB, PDF, TXT, MD, atau ZIP (MinerU).')
      return
    }

    if (file.size > 100 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 100MB')
      return
    }

    setUploading(true)
    setUploadProgress(0)
    setUploadingFileName(file.name)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '))
    formData.append('author', '')
    formData.append('format', ext.slice(1))

    try {
      await booksApi.upload(formData, (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || file.size))
        setUploadProgress(percentCompleted)
      })
      toast.success('Buku berhasil diunggah!')
      await loadBooks(true)
    } catch (err) {
      toast.error(err.message || 'Gagal mengunggah buku')
    } finally {
      setUploading(false)
      setUploadProgress(0)
      setUploadingFileName('')
    }
  }

  const handleDelete = async (e, id) => {
    if (e && e.stopPropagation) e.stopPropagation()
    if (!window.confirm('Hapus buku ini? Semua bab dan kosakata terkait akan dihapus secara permanen.')) return

    try {
      await booksApi.delete(id)
      removeBook(id)
      toast.success('Buku berhasil dihapus')
      await loadBooks(true)
    } catch (err) {
      toast.error(err.message || 'Gagal menghapus buku')
    }
  }

  const handleRead = (book) => {
    setCurrentBook(book)
    navigate(`/read/${book.id}`)
  }

  const bookList = Array.isArray(books) ? books : []
  const readyCount = bookList.filter(b => b.status === 'ready' || b.status === 'completed').length
  const chapterCount = bookList.reduce((sum, b) => sum + (b.total_chapters || 0), 0)
  const wordCount = bookList.reduce((sum, b) => sum + (b.total_words || 0), 0)
  const nextBook = bookList.find(b => b.status === 'ready' || b.status === 'completed')

  const hasBooks = bookList.length > 0

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ready':
      case 'completed':
        return <span className="badge-green"><CheckCircle className="h-3 w-3" aria-hidden="true" /> Siap baca</span>
      case 'processing':
        return <span className="badge-yellow"><Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Memproses</span>
      case 'failed':
        return <span className="badge-red"><AlertCircle className="h-3 w-3" aria-hidden="true" /> Gagal</span>
      default:
        return <span className="badge-blue"><Clock className="h-3 w-3" aria-hidden="true" /> Menunggu</span>
    }
  }

  const renderUploadInput = () => (
    <input
      type="file"
      accept=".epub,.txt,.pdf,.md,.zip"
      id="file-upload"
      className="sr-only"
      disabled={uploading}
      onChange={(e) => handleUpload(e.target.files[0])}
      onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
      onDragLeave={(e) => { e.preventDefault(); setDragActive(false) }}
      onDrop={(e) => {
        e.preventDefault()
        setDragActive(false)
        handleUpload(e.dataTransfer.files[0])
      }}
    />
  )

  return (
    <div className="flex flex-col gap-8 pb-10">
      {renderUploadInput()}

      {/* Hero */}
      <section className="hero-band cr-anim-rise" aria-labelledby="library-title">
        <div className="relative grid items-center gap-8 md:grid-cols-[1.25fr_0.75fr]">
          <div>
            <p className="eyebrow">Perpustakaan pribadi</p>
            <h1 id="library-title" className="display-1 mt-3 max-w-[16ch]">              Satu kata, satu langkah lebih{' '}
              <span style={{ color: 'var(--cr-text-accent)' }}>paham</span>.
            </h1>
            <p
              className="mt-4 max-w-[46ch] text-base font-semibold leading-relaxed"
              style={{ color: 'var(--cr-text-secondary)' }}
            >
              Unggah buku berbahasa Inggris, ketuk kata yang sulit, dan simpan maknanya.
              Semua bacaan dan kosakata tersimpan di perangkat ini.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {nextBook ? (
                <button type="button" onClick={() => handleRead(nextBook)} className="btn-primary">
                  <BookOpen className="h-5 w-5" aria-hidden="true" />
                  Lanjutkan bacaan
                </button>
              ) : (
                <label htmlFor="file-upload" className="btn-primary">
                  <UploadCloud className="h-5 w-5" aria-hidden="true" />
                  {uploading ? `Mengunggah ${uploadProgress}%` : 'Unggah buku pertama'}
                </label>
              )}
              <label
                htmlFor="file-upload"
                className={`btn-outline ${dragActive ? 'ring-4' : ''}`}
                style={dragActive ? { borderColor: 'var(--cr-text-accent)', boxShadow: '0 4px 0 0 var(--cr-btn-primary-shadow)' } : undefined}
              >
                <Plus className="h-5 w-5" aria-hidden="true" />
                Tambah buku
              </label>
            </div>

            <p className="mt-3 text-xs font-semibold" style={{ color: 'var(--cr-text-secondary)' }}>
              EPUB, PDF, TXT, MD, atau ZIP. Maksimal 100MB per file.
            </p>
          </div>

          <div className="hidden justify-end pb-4 md:flex">
            <WordCardStack />
          </div>
        </div>

        {/* Real library counters, derived from the loaded book list */}
        <div className="mt-8 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="stat-tile justify-center sm:justify-start">
            <BookOpen className="hidden h-5 w-5 shrink-0 sm:block" style={{ color: 'var(--cr-text-accent)' }} aria-hidden="true" />
            <div className="min-w-0">
              <span className="block font-heading text-lg font-extrabold leading-none tabular-nums sm:text-xl" style={{ color: 'var(--cr-text-primary)' }}>
                {bookList.length}
              </span>
              <span className="block truncate text-[11px] font-bold" style={{ color: 'var(--cr-text-secondary)' }}>buku</span>
            </div>
          </div>
          <div className="stat-tile justify-center sm:justify-start">
            <FileText className="hidden h-5 w-5 shrink-0 sm:block" style={{ color: 'var(--cr-blue-text)' }} aria-hidden="true" />
            <div className="min-w-0">
              <span className="block font-heading text-lg font-extrabold leading-none tabular-nums sm:text-xl" style={{ color: 'var(--cr-text-primary)' }}>
                {chapterCount}
              </span>
              <span className="block truncate text-[11px] font-bold" style={{ color: 'var(--cr-text-secondary)' }}>bab</span>
            </div>
          </div>
          <div className="stat-tile justify-center sm:justify-start">
            <Type className="hidden h-5 w-5 shrink-0 sm:block" style={{ color: 'var(--cr-yellow-text)' }} aria-hidden="true" />
            <div className="min-w-0">
              <span className="block truncate font-heading text-lg font-extrabold leading-none tabular-nums sm:text-xl" style={{ color: 'var(--cr-text-primary)' }}>
                <span className="sm:hidden">{wordCount}</span>
                <span className="hidden sm:inline">{wordCount.toLocaleString('id-ID')}</span>
              </span>
              <span className="block truncate text-[11px] font-bold" style={{ color: 'var(--cr-text-secondary)' }}>kata</span>
            </div>
          </div>
        </div>
      </section>

      {/* Upload progress */}
      {uploading && (
        <section className="card-duo cr-anim-rise p-5" aria-live="polite">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" style={{ color: 'var(--cr-blue-text)' }} aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate font-heading text-base font-extrabold" style={{ color: 'var(--cr-text-primary)' }}>
                  {uploadingFileName || 'Mengunggah file'}
                </p>
                <p className="text-xs font-bold" style={{ color: 'var(--cr-text-secondary)' }}>
                  {uploadProgress < 100 ? 'Mengirim file ke server' : 'Memecah bab dan kalimat'}
                </p>
              </div>
            </div>
            <span className="font-heading text-sm font-extrabold" style={{ color: 'var(--cr-blue-text)' }}>
              {uploadProgress}%
            </span>
          </div>
          <div
            className="progress-duo"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={uploadProgress}
            aria-label="Progres unggah buku"
          >
            <div className="progress-duo-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
        </section>
      )}

      {/* Error state */}
      {error && !loading && (
        <section
          className="flex flex-col items-start gap-3 rounded-duo-lg border-2 p-5 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: 'var(--cr-text-danger)', backgroundColor: 'rgba(252, 165, 165, 0.12)' }}
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--cr-text-danger)' }} aria-hidden="true" />
            <div>
              <p className="font-heading text-base font-extrabold" style={{ color: 'var(--cr-text-primary)' }}>
                Perpustakaan gagal dimuat
              </p>
              <p className="text-sm font-semibold" style={{ color: 'var(--cr-text-secondary)' }}>{error}</p>
            </div>
          </div>
          <button type="button" onClick={() => loadBooks()} className="btn-outline px-4 py-2 text-sm">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Coba lagi
          </button>
        </section>
      )}

      {/* Shelf */}
      <section aria-labelledby="shelf-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="shelf-title" className="heading-2">Rak buku</h2>
            <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--cr-text-secondary)' }}>
              {hasBooks
                ? `${bookList.length} buku, ${readyCount} siap dibaca.`
                : 'Belum ada buku di rak.'}
            </p>
          </div>
          {hasBooks && (
            <label htmlFor="file-upload" className="btn-ghost text-sm" style={{ color: 'var(--cr-text-accent)' }}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Tambah buku
            </label>
          )}
        </div>

        {loading && !hasBooks ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card-duo p-4">
                <div className="cr-skeleton h-36 rounded-2xl" />
                <div className="cr-skeleton mt-4 h-5 w-3/4 rounded" />
                <div className="cr-skeleton mt-2 h-4 w-1/2 rounded" />
              </div>
            ))}
          </div>
        ) : !hasBooks ? (
          <div className="card-duo flex flex-col items-center gap-4 px-6 py-12 text-center">
            <WordCardStack />
            <div>
              <h3 className="heading-3">Rak masih kosong</h3>
              <p className="mx-auto mt-2 max-w-[42ch] text-sm font-semibold" style={{ color: 'var(--cr-text-secondary)' }}>
                Mulai dari satu buku. Setelah diunggah, buku otomatis dipecah per bab
                supaya kamu bisa membaca dan mengetuk kata satu per satu.
              </p>
            </div>
            <label htmlFor="file-upload" className="btn-primary">
              <UploadCloud className="h-5 w-5" aria-hidden="true" />
              Pilih file buku
            </label>
          </div>
        ) : (
          <ul className="cr-stagger grid list-none gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {bookList.map((book) => {
              const isReady = book.status === 'ready' || book.status === 'completed'
              const title = formatTitle(book.title)
              const tint = coverTint(title)
              return (
                <li key={book.id}>
                  <article className="book-card h-full">
                    <div className="flex flex-1 flex-col p-4">
                      <div
                        className="book-cover mb-4"
                        style={{ backgroundColor: tint.bg, borderColor: tint.border }}
                      >
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-0 left-0 w-2"
                          style={{ backgroundColor: tint.ink, opacity: 0.35 }}
                        />
                        <span aria-hidden="true" className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
                          <span className="block h-1 w-9 rounded-full" style={{ backgroundColor: tint.ink, opacity: 0.35 }} />
                          <span className="block h-1 w-6 rounded-full" style={{ backgroundColor: tint.ink, opacity: 0.25 }} />
                        </span>
                        <span
                          aria-hidden="true"
                          className="font-heading text-[64px] font-extrabold leading-none"
                          style={{ color: tint.ink }}
                        >
                          {title.charAt(0).toUpperCase()}
                        </span>
                        <span
                          className="absolute bottom-3 right-3 rounded-lg border-2 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide"
                          style={{ borderColor: tint.border, color: tint.ink, backgroundColor: 'var(--cr-bg-surface-elevated)' }}
                        >
                          {(book.format || 'TXT').toUpperCase()}
                        </span>
                      </div>

                      <div className="mb-2 flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 font-heading text-lg font-extrabold leading-snug" style={{ color: 'var(--cr-text-primary)' }} title={title}>
                          {title}
                        </h3>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, book.id)}
                          className="btn-ghost -mr-2 shrink-0 px-2"
                          aria-label={`Hapus buku ${title}`}
                          title="Hapus buku"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>

                      <p className="mb-3 line-clamp-1 text-sm font-semibold" style={{ color: 'var(--cr-text-secondary)' }}>
                        {book.author || 'Penulis tidak dicantumkan'}
                      </p>

                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        {getStatusBadge(book.status)}
                        <BookLanguageBadge sourceLang={book.language || '?'} targetLang="id" interactive={false} />
                      </div>

                      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold" style={{ color: 'var(--cr-text-secondary)' }}>
                        <span>{book.total_chapters || 0} bab</span>
                        <span>{Number(book.total_words || 0).toLocaleString('id-ID')} kata</span>
                      </div>

                      {book.status === 'processing' && (
                        <div className="mb-3 rounded-xl border p-3" style={{ borderColor: 'var(--cr-yellow-text)' }}>
                          <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold" style={{ color: 'var(--cr-yellow-text)' }}>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            Memecah teks dan kalimat
                          </p>
                          <div className="progress-duo h-2">
                            <div className="progress-duo-fill" style={{ width: '70%', backgroundColor: 'var(--cr-yellow-bright)' }} />
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRead(book)}
                        disabled={!isReady}
                        className={isReady ? 'btn-primary mt-auto w-full' : 'btn-outline mt-auto w-full'}
                      >
                        {isReady ? (
                          <>
                            <BookOpen className="h-5 w-5" aria-hidden="true" />
                            Baca buku
                          </>
                        ) : book.status === 'processing' ? (
                          'Sedang diproses'
                        ) : book.status === 'failed' ? (
                          'Gagal dimuat'
                        ) : (
                          'Menunggu antrean'
                        )}
                      </button>
                    </div>
                  </article>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
