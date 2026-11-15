import { useEffect, useState } from 'react'
import { translationsApi } from '../utils/api'
import { AVAILABLE_LANGUAGES } from '../constants/languages'

/**
 * Language list from the backend catalogue, with the bundled list as a
 * fallback so the picker still works when the request fails.
 */
export function useLanguages() {
  const [languages, setLanguages] = useState(AVAILABLE_LANGUAGES)

  useEffect(() => {
    let active = true
    translationsApi
      .languages()
      .then((res) => {
        const list = res.data?.languages
        if (!active || !Array.isArray(list) || list.length === 0) return
        setLanguages(
          list.map((item) => ({
            code: item.code,
            name: item.label || item.name || item.code,
            badge: String(item.code || '').slice(0, 2).toUpperCase(),
          }))
        )
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  return languages
}
