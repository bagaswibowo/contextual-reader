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

// API keys are strictly passed via in-memory parameters (customConfig.customApiKey)
// and must never be read from or written to persistent browser storage (localStorage).
//
// Custom provider fields are only sent when the user actually selected the
// "custom" engine AND supplied a value. The backend validates custom_base_url
// against the LLM_ALLOWED_HOSTS allowlist on every request that carries it,
// regardless of `engine`; sending a leftover base URL while using Google/Omni
// therefore fails the whole request with HTTP 400
// ("custom_base_url is disabled because no LLM host allowlist is configured").
// It also avoids shipping the user's API key to the server when it is unused.
const customProviderFields = (engine, customConfig = {}) => {
  if (engine !== 'custom') return {}
  const fields = {}
  if (customConfig.customBaseUrl) fields.custom_base_url = customConfig.customBaseUrl
  if (customConfig.customApiKey) fields.custom_api_key = customConfig.customApiKey
  if (customConfig.customModel) fields.custom_model = customConfig.customModel
  return fields
}

export const translationsApi = {
  word: (sentenceId, word, targetLang = 'id', engine = 'google', customConfig = {}) => 
    api.post('/translations/word/', {
      sentence_id: sentenceId,
      word,
      target_lang: targetLang,
      mother_lang: customConfig.mother_lang || 'id',
      engine,
      ...customProviderFields(engine, customConfig)
    }),
  sentence: (sentenceId, targetLang = 'id', engine = 'google', customConfig = {}) => 
    api.post('/translations/sentence/', {
      sentence_id: sentenceId,
      target_lang: targetLang,
      mother_lang: customConfig.mother_lang || 'id',
      engine,
      ...customProviderFields(engine, customConfig)
    }),
  batchSentence: (sentenceIds, targetLang = 'id', engine = 'google', customConfig = {}) => 
    api.post('/translations/batch-sentence/', {
      sentence_ids: sentenceIds,
      target_lang: targetLang,
      engine,
      ...customProviderFields(engine, customConfig)
    }),
  explain3d: (sentenceText, selectedText, userLevel = 'B2', targetLang = 'id', sentenceId = null, customConfig = {}, engine = 'google') =>
    api.post('/translations/explain-3d/', {
      sentence_text: sentenceText,
      selected_text: selectedText,
      user_level: userLevel,
      target_lang: targetLang,
      sentence_id: sentenceId,
      engine,
      ...customProviderFields(engine, customConfig)
    }),
  paragraphSummary: (paragraphText, detailLevel = 'concise', targetLang = 'id', customConfig = {}, engine = 'google') =>
    api.post('/translations/paragraph-summary/', {
      paragraph_text: paragraphText,
      detail_level: detailLevel,
      target_lang: targetLang,
      engine,
      ...customProviderFields(engine, customConfig)
    }),
  dictionary: (word, lang = 'en', context = '', options = {}) =>
    api.get('/translations/dictionary/', {
      params: { word, lang, context },
      ...options
    }),
  detect: (text, options = {}) =>
    api.post('/translations/detect/', { text }, options),
  ttsUrl: (text, lang = 'en') =>
    `/api/translations/tts/?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(lang)}`,
  feedback: (payload) =>
    api.post('/translations/feedback/', payload),
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
