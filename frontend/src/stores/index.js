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
      targetLanguage: 'id',
      translationEngine: 'google', // 'google' | 'omni' | 'custom'
      customBaseUrl: '',
      customApiKey: '',
      customModel: '',
      
      setFontSize: (size) => set({ fontSize: Math.max(12, Math.min(32, size)) }),
      setFontFamily: (family) => set({ fontFamily: family }),
      setTheme: (theme) => set({ theme }),
      setShowTranslations: (show) => set({ showTranslations: show }),
      setShowWordHints: (show) => set({ showWordHints: show }),
      setLineHeight: (height) => set({ lineHeight: Math.max(1.4, Math.min(2.5, height)) }),
      setTargetLanguage: (targetLanguage) => set({ targetLanguage }),
      setTranslationEngine: (translationEngine) => set({ translationEngine }),
      setCustomBaseUrl: (customBaseUrl) => set({ customBaseUrl }),
      setCustomApiKey: (customApiKey) => set({ customApiKey }),
      setCustomModel: (customModel) => set({ customModel }),
    }),
    {
      name: 'reader-settings',
    }
  )
)

export const useVocabularyStore = create(
  persist(
    (set, get) => ({
      vocabulary: [],
      dueItems: [],
      reviewSession: null,
      loading: false,

      setVocabulary: (vocabulary) => set({ vocabulary }),
      setDueItems: (dueItems) => set({ dueItems }),
      addVocabulary: (item) => set((state) => ({ vocabulary: [item, ...state.vocabulary] })),
      removeVocabulary: (id) => set((state) => ({
        vocabulary: state.vocabulary.filter(v => v.id !== id)
      })),

      setReviewSession: (session) => set({ reviewSession: session }),
      setLoading: (loading) => set({ loading }),
    }),
    {
      name: 'vocab-storage',
      partialize: (state) => ({ vocabulary: state.vocabulary }),
    }
  )
)
