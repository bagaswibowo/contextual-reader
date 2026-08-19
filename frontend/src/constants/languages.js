export const AVAILABLE_LANGUAGES = [
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩', locale: 'id-ID' },
  { code: 'en', name: 'Bahasa Inggris', flag: '🇬🇧', locale: 'en-US' },
  { code: 'es', name: 'Bahasa Spanyol', flag: '🇪🇸', locale: 'es-ES' },
  { code: 'fr', name: 'Bahasa Prancis', flag: '🇫🇷', locale: 'fr-FR' },
  { code: 'de', name: 'Bahasa Jerman', flag: '🇩🇪', locale: 'de-DE' },
  { code: 'ja', name: 'Bahasa Jepang', flag: '🇯🇵', locale: 'ja-JP' },
  { code: 'zh-CN', name: 'Bahasa Mandarin', flag: '🇨🇳', locale: 'zh-CN' },
  { code: 'ko', name: 'Bahasa Korea', flag: '🇰🇷', locale: 'ko-KR' },
  { code: 'ar', name: 'Bahasa Arab', flag: '🇸🇦', locale: 'ar-SA' },
  { code: 'ru', name: 'Bahasa Rusia', flag: '🇷🇺', locale: 'ru-RU' },
  { code: 'pt', name: 'Bahasa Portugis', flag: '🇵🇹', locale: 'pt-BR' },
  { code: 'it', name: 'Bahasa Italia', flag: '🇮🇹', locale: 'it-IT' },
  { code: 'nl', name: 'Bahasa Belanda', flag: '🇳🇱', locale: 'nl-NL' },
  { code: 'tr', name: 'Bahasa Turki', flag: '🇹🇷', locale: 'tr-TR' },
  { code: 'vi', name: 'Bahasa Vietnam', flag: '🇻🇳', locale: 'vi-VN' },
  { code: 'th', name: 'Bahasa Thailand', flag: '🇹🇭', locale: 'th-TH' },
  { code: 'hi', name: 'Bahasa Hindi', flag: '🇮🇳', locale: 'hi-IN' },
  { code: 'pl', name: 'Bahasa Polandia', flag: '🇵🇱', locale: 'pl-PL' },
  { code: 'sv', name: 'Bahasa Swedia', flag: '🇸🇪', locale: 'sv-SE' },
  { code: 'uk', name: 'Bahasa Ukraina', flag: '🇺🇦', locale: 'uk-UA' },
  { code: 'el', name: 'Bahasa Yunani', flag: '🇬🇷', locale: 'el-GR' },
  { code: 'cs', name: 'Bahasa Ceko', flag: '🇨🇿', locale: 'cs-CZ' },
]

export const getLanguageInfo = (code) => {
  const cleanCode = (code || 'id').toLowerCase()
  return (
    AVAILABLE_LANGUAGES.find(l => l.code.toLowerCase() === cleanCode) || {
      code: cleanCode,
      name: cleanCode.toUpperCase(),
      flag: '🌐',
      locale: 'en-US'
    }
  )
}
