import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, BookOpen, Trash2, Loader2, AlertCircle, FileText, CheckCircle, Clock, UploadCloud } from 'lucide-react'
import toast from 'react-hot-toast'
import { booksApi } from '../utils/api'
import { useBookStore } from '../stores'

export function Library() {
  const navigate = useNavigate()
  const { books, setBooks, loading, setLoading, setError, addBook, removeBook, setCurrentBook } = useBookStore()
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadingFileName, setUploadingFileName] = useState('')
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    loadBooks()
    // Auto-refresh book statuses every 2 seconds from server sxz
    const interval = setInterval(() => {
      loadBooks(true) // silent refresh
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const loadBooks = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const response = await booksApi.list()
      const bookList = response.data.results || response.data
      setBooks(bookList)
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
    
    const validExts = ['.epub', '.txt', '.pdf']
    const ext = '.' + file.name.split('.').pop().toLowerCase()
    
    if (!validExts.includes(ext)) {
      toast.error('Format tidak didukung. Gunakan EPUB, TXT, atau PDF.')
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
      setTimeout(() => loadBooks(true), 1500)
    } catch (err) {
      toast.error(err.message || 'Gagal mengunggah buku')
    } finally {
      setUploading(false)
      setUploadProgress(0)
      setUploadingFileName('')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus buku ini? Semua kosakata terkait akan terhapus.')) return
    
    try {
      await booksApi.delete(id)
      removeBook(id)
      toast.success('Buku dihapus')
    } catch (err) {
      toast.error('Gagal menghapus buku')
    }
  }

  const handleRead = (book) => {
    setCurrentBook(book)
    navigate(`/read/${book.id}`)
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ready':
      case 'completed': 
        return <span className="badge-green"><CheckCircle className="w-3 h-3 mr-1" /> Siap Baca</span>
      case 'processing': return <span className="badge-yellow"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Memproses Bab...</span>
      case 'failed': return <span className="badge-red"><AlertCircle className="w-3 h-3 mr-1" /> Gagal</span>
      default: return <span className="badge-blue"><Clock className="w-3 h-3 mr-1" /> Menunggu</span>
    }
  }

  const getFormatIcon = (format) => {
    switch (format) {
      case 'epub': return <FileText className="w-5 h-5 text-duo-blue" />
      case 'pdf': return <FileText className="w-5 h-5 text-duo-red" />
      default: return <FileText className="w-5 h-5 text-duo-purple" />
    }
  }

  const formatTitle = (title) => {
    if (!title) return 'Buku Tanpa Judul'
    return title.replace(/_/g, ' ').trim()
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="heading-1">Perpustakaan</h1>
          <p className="text-eel/70 dark:text-dark-text/70 mt-1 font-ui">
            Kelola buku dan mulai membaca dengan terjemahan kontekstual
          </p>
        </div>
        
        {/* Upload Button */}
        <div className="w-full sm:w-auto">
          <label className={`
            btn-primary flex items-center gap-2 w-full sm:w-auto justify-center cursor-pointer
            border-2 border-dashed ${dragActive ? 'border-duo-green bg-duo-green/5' : 'border-transparent'}
            transition-all duration-200
          `}>
            <input
              type="file"
              accept=".epub,.txt,.pdf"
              onChange={(e) => handleUpload(e.target.files[0])}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
              onDrop={(e) => { e.preventDefault(); setDragActive(false); handleUpload(e.dataTransfer.files[0]); }}
              className="hidden"
              id="file-upload"
              disabled={uploading}
            />
            <UploadCloud className="w-5 h-5" />
            <span>{uploading ? `Mengunggah... ${uploadProgress}%` : 'Tambah Buku (EPUB/PDF/TXT)'}</span>
          </label>
        </div>
      </div>

      {/* Uploading File Temporary Progress Card */}
      {uploading && (
        <div className="card-duo p-5 border-2 border-duo-blue bg-duo-blue/5 animate-bounce-in max-w-xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <Loader2 className="w-6 h-6 text-duo-blue animate-spin" />
              <div>
                <h4 className="font-heading font-extrabold text-base text-eel dark:text-dark-text truncate max-w-xs">
                  {uploadingFileName || 'Mengunggah file...'}
                </h4>
                <p className="text-xs font-bold text-duo-blue">
                  {uploadProgress < 100 ? `Mengirim file ke server (${uploadProgress}%)` : 'Parsing bab & struktur kalimat...'}
                </p>
              </div>
            </div>
            <span className="font-mono font-extrabold text-sm text-duo-blue">{uploadProgress}%</span>
          </div>

          {/* Progress Bar (Duolingo Style) */}
          <div className="progress-duo mt-3">
            <div 
              className="progress-duo-fill bg-duo-blue" 
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Books Grid */}
      {loading && !uploading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="card-duo p-6 flex flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-dark-card border-2 border-gray-200 dark:border-dark-border min-h-[220px]">
              <Loader2 className="w-8 h-8 text-duo-green animate-spin" />
              <span className="text-xs font-bold text-gray-400 dark:text-dark-muted">Memuat daftar buku...</span>
            </div>
          ))}
        </div>
      ) : !books || books.length === 0 ? (
        !uploading && (
          <div className="card-duo p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-duo-green/10 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-10 h-10 text-duo-green" />
            </div>
            <h2 className="heading-3 mb-2">Belum Ada Buku</h2>
            <p className="text-eel/70 dark:text-dark-text/70 mb-6 max-w-md mx-auto">
              Unggah buku berbahasa Inggris (EPUB, TXT, PDF) untuk memulai membaca dengan terjemahan kontekstual per-kata dan per-kalimat.
            </p>
            <label htmlFor="file-upload" className="btn-primary inline-flex items-center gap-2 cursor-pointer">
              <Plus className="w-5 h-5" />
              Unggah Buku Pertama
            </label>
          </div>
        )
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {books.map(book => {
            const isReady = book.status === 'ready' || book.status === 'completed'
            return (
              <article key={book.id} className="card-duo overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col justify-between min-h-[220px]">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      {getFormatIcon(book.format)}
                      <span className="badge-duo bg-gray-100 dark:bg-dark-border text-gray-600 dark:text-dark-muted text-xs font-bold uppercase">
                        {(book.format || 'TXT').toUpperCase()}
                      </span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(book.id); }}
                      className="p-1.5 text-gray-400 hover:text-duo-red hover:bg-duo-red/10 rounded-lg transition-colors"
                      aria-label="Hapus buku"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <h3 className="font-heading font-bold text-base md:text-lg text-eel dark:text-dark-text mb-1 line-clamp-2 break-words" title={book.title}>
                    {formatTitle(book.title)}
                  </h3>
                  {book.author && (
                    <p className="text-xs text-eel/60 dark:text-dark-text/60 mb-3 truncate">
                      {book.author}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-eel/60 dark:text-dark-text/60 mb-3">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" /> {book.total_chapters || 0} bab
                    </span>
                    <span className="flex items-center gap-1">
                      <span>{(book.total_words || 0).toLocaleString()} kata</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    {getStatusBadge(book.status)}
                  </div>

                  {/* Progress Bar under processing book card */}
                  {book.status === 'processing' && (
                    <div className="mt-3 p-2.5 rounded-duo bg-duo-yellow/10 border border-duo-yellow/30 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-yellow-700 dark:text-duo-yellow">
                        <span className="flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Ekstraksi teks & kalimat...
                        </span>
                      </div>
                      <div className="progress-duo h-1.5 bg-yellow-200 dark:bg-yellow-900/40">
                        <div className="progress-duo-fill bg-duo-yellow animate-pulse w-3/4" />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleRead(book)}
                  disabled={!isReady}
                  className={`
                    w-full btn-primary border-t-2 border-gray-200 dark:border-dark-border py-2.5 text-sm
                    ${!isReady ? 'opacity-50 cursor-not-allowed bg-gray-300 text-gray-500 shadow-none' : ''}
                  `}
                >
                  {isReady ? 'Baca' : book.status === 'processing' ? 'Memproses...' : 'Gagal Dimuat'}
                </button>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
