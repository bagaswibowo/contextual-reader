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
  word: (sentenceId, word, targetLang = 'id', engine = 'google', customConfig = {}) => 
    api.post('/translations/word/', {
      sentence_id: sentenceId,
      word,
      target_lang: targetLang,
      mother_lang: customConfig.mother_lang || 'id',
      engine,
      custom_base_url: customConfig.customBaseUrl,
      custom_api_key: customConfig.customApiKey,
      custom_model: customConfig.customModel
    }),
  sentence: (sentenceId, targetLang = 'id', engine = 'google', customConfig = {}) => 
    api.post('/translations/sentence/', {
      sentence_id: sentenceId,
      target_lang: targetLang,
      mother_lang: customConfig.mother_lang || 'id',
      engine,
      custom_base_url: customConfig.customBaseUrl,
      custom_api_key: customConfig.customApiKey,
      custom_model: customConfig.customModel
    }),
  batchSentence: (sentenceIds, targetLang = 'id', engine = 'google', customConfig = {}) => 
    api.post('/translations/batch-sentence/', {
      sentence_ids: sentenceIds,
      target_lang: targetLang,
      engine,
      custom_base_url: customConfig.customBaseUrl,
      custom_api_key: customConfig.customApiKey,
      custom_model: customConfig.customModel
    }),
  explain3d: (sentenceText, selectedText, userLevel = 'B2', targetLang = 'id', sentenceId = null, customConfig = {}) =>
    api.post('/translations/explain-3d/', {
      sentence_text: sentenceText,
      selected_text: selectedText,
      user_level: userLevel,
      target_lang: targetLang,
      sentence_id: sentenceId,
      custom_base_url: customConfig.customBaseUrl,
      custom_api_key: customConfig.customApiKey,
      custom_model: customConfig.customModel
    }),
  paragraphSummary: (paragraphText, detailLevel = 'concise', targetLang = 'id', customConfig = {}) =>
    api.post('/translations/paragraph-summary/', {
      paragraph_text: paragraphText,
      detail_level: detailLevel,
      target_lang: targetLang,
      custom_base_url: customConfig.customBaseUrl,
      custom_api_key: customConfig.customApiKey,
      custom_model: customConfig.customModel
    }),
}

export const vocabularyApi = {
  list: (params) => api.get('/vocabulary/', { params }),
  add: (wordTranslationId, userId = 'default') => api.post('/vocabulary/', { word_translation: wordTranslationId, user_id: userId }),
  delete: (id) => api.delete(`/vocabulary/${id}/`),
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
