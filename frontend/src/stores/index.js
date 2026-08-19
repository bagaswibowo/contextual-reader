import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useBookStore = create(
  persist(
    (set, get) => ({
      books: [],
      currentBook: null,
      currentChapter: null,
      currentChapterIndex: 0,
      loading: false,
      error: null,

      setBooks: (books) => set({ books }),
      addBook: (book) => set((state) => ({ books: [book, ...state.books] })),
      updateBook: (id, data) => set((state) => ({
        books: state.books.map(b => b.id === id ? { ...b, ...data } : b)
      })),
      removeBook: (id) => set((state) => ({
        books: state.books.filter(b => b.id !== id)
      })),

      setCurrentBook: (book) => set({ currentBook: book }),
      setCurrentChapter: (chapter, index) => set({ currentChapter: chapter, currentChapterIndex: index }),

      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

      clearCurrentBook: () => set({ currentBook: null, currentChapter: null, currentChapterIndex: 0 }),
    }),
    {
      name: 'book-storage',
      partialize: (state) => ({ books: state.books }),
    }
  )
)

export const useReaderStore = create(
  persist(
    (set, get) => ({
      fontSize: 18,
      fontFamily: 'serif', // 'serif' | 'sans'
      theme: 'light', // 'light' | 'dark' | 'sepia'
      showTranslations: true,
      showWordHints: true,
      lineHeight: 1.8,
      targetLanguage: 'id', // 'id', 'es', 'fr', 'de', 'ja', 'zh-CN', 'ar', etc.
      translationEngine: 'google', // 'google' | 'omniroute'
      
      setFontSize: (size) => set({ fontSize: Math.max(12, Math.min(32, size)) }),
      setFontFamily: (family) => set({ fontFamily: family }),
      setTheme: (theme) => set({ theme }),
      setShowTranslations: (show) => set({ showTranslations: show }),
      setShowWordHints: (show) => set({ showWordHints: show }),
      setLineHeight: (height) => set({ lineHeight: Math.max(1.4, Math.min(2.5, height)) }),
      setTargetLanguage: (targetLanguage) => set({ targetLanguage }),
      setTranslationEngine: (translationEngine) => set({ translationEngine }),
    }),
    {
      name: 'reader-settings',
    }
  )
)

export const useTranslationStore = create((set) => ({
  wordCache: new Map(),
  sentenceCache: new Map(),
  pendingRequests: new Set(),

  getWordTranslation: (sentenceId, word) => {
    const key = `${sentenceId}:${word.toLowerCase()}`
    return get().wordCache.get(key)
  },
  setWordTranslation: (sentenceId, word, data) => {
    const key = `${sentenceId}:${word.toLowerCase()}`
    set((state) => {
      const newCache = new Map(state.wordCache)
      newCache.set(key, data)
      return { wordCache: newCache }
    })
  },

  getSentenceTranslation: (sentenceId) => {
    return get().sentenceCache.get(sentenceId)
  },
  setSentenceTranslation: (sentenceId, data) => {
    set((state) => {
      const newCache = new Map(state.sentenceCache)
      newCache.set(sentenceId, data)
      return { sentenceCache: newCache }
    })
  },

  isPending: (key) => get().pendingRequests.has(key),
  setPending: (key, pending) => {
    set((state) => {
      const newPending = new Set(state.pendingRequests)
      if (pending) newPending.add(key)
      else newPending.delete(key)
      return { pendingRequests: newPending }
    })
  },

  clearCache: () => set({ wordCache: new Map(), sentenceCache: new Map() }),
}))

export const useVocabularyStore = create(
  persist(
    (set) => ({
      entries: [],
      currentSession: null,
      reviewQueue: [],
      
      setEntries: (entries) => set({ entries }),
      addEntry: (entry) => set((state) => ({ entries: [entry, ...state.entries] })),
      updateEntry: (id, data) => set((state) => ({
        entries: state.entries.map(e => e.id === id ? { ...e, ...data } : e)
      })),
      removeEntry: (id) => set((state) => ({
        entries: state.entries.filter(e => e.id !== id)
      })),
      
      setCurrentSession: (session) => set({ currentSession: session }),
      setReviewQueue: (queue) => set({ reviewQueue: queue }),
    }),
    {
      name: 'vocabulary-storage',
      partialize: (state) => ({ entries: state.entries }),
    }
  )
)
