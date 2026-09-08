export const AVAILABLE_LANGUAGES = [
  { code: 'id', name: 'Bahasa Indonesia', badge: 'ID', locale: 'id-ID' },
  { code: 'en', name: 'Bahasa Inggris', badge: 'EN', locale: 'en-US' },
  { code: 'es', name: 'Bahasa Spanyol', badge: 'ES', locale: 'es-ES' },
  { code: 'fr', name: 'Bahasa Prancis', badge: 'FR', locale: 'fr-FR' },
  { code: 'de', name: 'Bahasa Jerman', badge: 'DE', locale: 'de-DE' },
  { code: 'ja', name: 'Bahasa Jepang', badge: 'JA', locale: 'ja-JP' },
  { code: 'zh-CN', name: 'Bahasa Mandarin', badge: 'ZH', locale: 'zh-CN' },
  { code: 'ko', name: 'Bahasa Korea', badge: 'KO', locale: 'ko-KR' },
  { code: 'ar', name: 'Bahasa Arab', badge: 'AR', locale: 'ar-SA' },
  { code: 'ru', name: 'Bahasa Rusia', badge: 'RU', locale: 'ru-RU' },
  { code: 'pt', name: 'Bahasa Portugis', badge: 'PT', locale: 'pt-BR' },
  { code: 'it', name: 'Bahasa Italia', badge: 'IT', locale: 'it-IT' },
  { code: 'nl', name: 'Bahasa Belanda', badge: 'NL', locale: 'nl-NL' },
  { code: 'tr', name: 'Bahasa Turki', badge: 'TR', locale: 'tr-TR' },
  { code: 'vi', name: 'Bahasa Vietnam', badge: 'VI', locale: 'vi-VN' },
  { code: 'th', name: 'Bahasa Thailand', badge: 'TH', locale: 'th-TH' },
  { code: 'hi', name: 'Bahasa Hindi', badge: 'HI', locale: 'hi-IN' },
  { code: 'pl', name: 'Bahasa Polandia', badge: 'PL', locale: 'pl-PL' },
  { code: 'sv', name: 'Bahasa Swedia', badge: 'SV', locale: 'sv-SE' },
  { code: 'uk', name: 'Bahasa Ukraina', badge: 'UK', locale: 'uk-UA' },
  { code: 'el', name: 'Bahasa Yunani', badge: 'EL', locale: 'el-GR' },
  { code: 'cs', name: 'Bahasa Ceko', badge: 'CS', locale: 'cs-CZ' },
]

export const getLanguageInfo = (code) => {
  const cleanCode = (code || 'id').toLowerCase()
  return (
    AVAILABLE_LANGUAGES.find(l => l.code.toLowerCase() === cleanCode) || {
      code: cleanCode,
      name: cleanCode.toUpperCase(),
      badge: cleanCode.toUpperCase(),
      locale: 'en-US'
    }
  )
}
