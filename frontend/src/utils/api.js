import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 2 minutes
})

// Request interceptor
api.interceptors.request.use(
  config => config,
  error => Promise.reject(error)
)

// Response interceptor
api.interceptors.response.use(
  response => response,
  error => {
    const data = error.response?.data
    let message = error.message

    if (data) {
      if (typeof data === 'string') {
        message = data
      } else if (data.detail) {
        message = data.detail
      } else if (data.error) {
        message = data.error
      } else if (typeof data === 'object') {
        message = Object.entries(data)
          .map(([key, val]) => {
            const valStr = Array.isArray(val) ? val.join(', ') : String(val)
            return `${key}: ${valStr}`
          })
          .join(' | ')
      }
    }

    return Promise.reject(new Error(message))
  }
)

export const booksApi = {
  list: () => api.get('/books/'),
  upload: (formData, onUploadProgress) => api.post('/books/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onUploadProgress,
  }),
  get: (id) => api.get(`/books/${id}/`),
  chapter: (id, index) => api.get(`/books/${id}/chapter/`, { params: { index } }),
  toc: (id) => api.get(`/books/${id}/toc/`),
  delete: (id) => api.delete(`/books/${id}/`),
}

export const translationsApi = {
  word: (sentenceId, word, targetLang = 'id', engine = 'google') => api.post('/translations/word/', { sentence_id: sentenceId, word, target_lang: targetLang, engine }),
  sentence: (sentenceId, targetLang = 'id', engine = 'google') => api.post('/translations/sentence/', { sentence_id: sentenceId, target_lang: targetLang, engine }),
  batchSentence: (sentenceIds, targetLang = 'id', engine = 'google') => api.post('/translations/batch-sentence/', { sentence_ids: sentenceIds, target_lang: targetLang, engine }),
}

export const vocabularyApi = {
  list: (params) => api.get('/vocabulary/', { params }),
  add: (wordTranslationId, userId = 'default') => api.post('/vocabulary/', { word_translation: wordTranslationId, user_id: userId }),
  byBook: (userId = 'default', bookId) => api.get('/vocabulary/by_book/', { params: { user_id: userId, book_id: bookId } }),
  due: (userId = 'default') => api.get('/vocabulary/due_for_review/', { params: { user_id: userId } }),
  review: (id, quality) => api.post(`/vocabulary/${id}/review/`, { quality }),
  startSession: (userId = 'default', bookId) => api.post('/vocabulary/start_session/', { user_id: userId, book_id: bookId }),
  endSession: (id, cardsReviewed, cardsCorrect) => api.post(`/vocabulary/${id}/end_session/`, { cards_reviewed: cardsReviewed, cards_correct: cardsCorrect }),
}

export const coreApi = {
  health: () => api.get('/core/health/'),
}

export default api
