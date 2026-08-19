import { useState } from 'react'
import { Settings as SettingsIcon, Sliders, Moon, Sun, Type, Trash2, CheckCircle2, Cpu, Globe, Zap } from 'lucide-react'
import { useReaderStore } from '../stores'
import { useTheme } from '../hooks/useTheme'
import { coreApi } from '../utils/api'

export function Settings() {
  const { theme, setTheme } = useTheme()
  const { 
    fontSize, setFontSize, 
    fontFamily, setFontFamily, 
    lineHeight, setLineHeight,
    targetLanguage, setTargetLanguage,
    translationEngine, setTranslationEngine
  } = useReaderStore()

  const [healthStatus, setHealthStatus] = useState(null)
  const [checkingHealth, setCheckingHealth] = useState(false)

  const checkHealth = async () => {
    try {
      setCheckingHealth(true)
      const res = await coreApi.health()
      setHealthStatus(res.data)
      setCheckingHealth(false)
    } catch (err) {
      setHealthStatus({ status: 'error', error: err.message })
      setCheckingHealth(false)
    }
  }

  const languages = [
    { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
    { code: 'es', name: 'Bahasa Spanyol', flag: '🇪🇸' },
    { code: 'fr', name: 'Bahasa Prancis', flag: '🇫🇷' },
    { code: 'de', name: 'Bahasa Jerman', flag: '🇩🇪' },
    { code: 'ja', name: 'Bahasa Jepang', flag: '🇯🇵' },
    { code: 'zh-CN', name: 'Bahasa Mandarin', flag: '🇨🇳' },
    { code: 'ko', name: 'Bahasa Korea', flag: '🇰🇷' },
    { code: 'ar', name: 'Bahasa Arab', flag: '🇸🇦' },
    { code: 'ru', name: 'Bahasa Rusia', flag: '🇷🇺' },
  ]

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6 pb-16">
      <div className="card-duo p-6 md:p-8 bg-white dark:bg-dark-card">
        <h1 className="heading-1 text-2xl md:text-3xl flex items-center gap-3 mb-6">
          <SettingsIcon className="w-8 h-8 text-duo-green" />
          Pengaturan Aplikasi
        </h1>

        <div className="space-y-8">
          {/* Section 1: Translation Engine & Target Language */}
          <div className="space-y-4">
            <h3 className="heading-3 text-lg flex items-center gap-2 border-b-2 border-gray-100 dark:border-dark-border pb-2">
              <Globe className="w-5 h-5 text-duo-blue" />
              Engine Penerjemah & Bahasa Target
            </h3>

            {/* Translation Engine Selector */}
            <div className="space-y-3">
              <label className="font-bold text-sm block">Pilih Engine Penerjemah:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => setTranslationEngine('google')}
                  className={`p-4 rounded-duo border-2 text-left transition-all ${
                    translationEngine === 'google'
                      ? 'border-duo-green bg-duo-green/10 shadow-3d'
                      : 'border-gray-200 dark:border-dark-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Zap className="w-6 h-6 text-duo-green" />
                    {translationEngine === 'google' && <CheckCircle2 className="w-5 h-5 text-duo-green" />}
                  </div>
                  <span className="font-heading font-extrabold text-base block">Google Translate Engine</span>
                  <span className="text-xs text-gray-500 block mt-1">
                    ⚡ 100% Gratis, Tanpa Biaya API, Super Cepat, Kamus Banyak Makna & Kelas Kata (Noun, Verb, Adjective).
                  </span>
                </button>

                <button
                  onClick={() => setTranslationEngine('omniroute')}
                  className={`p-4 rounded-duo border-2 text-left transition-all ${
                    translationEngine === 'omniroute'
                      ? 'border-duo-blue bg-duo-blue/10 shadow-3d-blue'
                      : 'border-gray-200 dark:border-dark-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Cpu className="w-6 h-6 text-duo-blue" />
                    {translationEngine === 'omniroute' && <CheckCircle2 className="w-5 h-5 text-duo-blue" />}
                  </div>
                  <span className="font-heading font-extrabold text-base block">OmniRoute LLM Engine</span>
                  <span className="text-xs text-gray-500 block mt-1">
                    🤖 Model auto/best-free. Otomatis memilih model gratis terbaik di OmniRoute untuk terjemahan kontekstual mendalam.
                  </span>
                </button>
              </div>
            </div>

            {/* Target Language Selector */}
            <div className="pt-2 flex items-center justify-between">
              <div>
                <span className="font-bold text-sm block">Bahasa Target Hasil Terjemahan:</span>
                <span className="text-xs text-gray-500">Pilih bahasa tujuan saat membaca buku</span>
              </div>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="input-duo py-2.5 text-sm w-48 font-bold"
              >
                {languages.map(l => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 2: Appearance */}
          <div className="space-y-4">
            <h3 className="heading-3 text-lg flex items-center gap-2 border-b-2 border-gray-100 dark:border-dark-border pb-2">
              <Sun className="w-5 h-5 text-duo-yellow" />
              Tampilan & Tema
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setTheme('light')}
                className={`p-4 rounded-duo border-2 text-left transition-all ${
                  theme === 'light'
                    ? 'border-duo-green bg-duo-green/10 shadow-3d'
                    : 'border-gray-200 dark:border-dark-border'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Sun className="w-6 h-6 text-duo-yellow" />
                  {theme === 'light' && <CheckCircle2 className="w-5 h-5 text-duo-green" />}
                </div>
                <span className="font-heading font-extrabold text-base block">Mode Terang</span>
                <span className="text-xs text-gray-500">Latar belakang putih bersih</span>
              </button>

              <button
                onClick={() => setTheme('dark')}
                className={`p-4 rounded-duo border-2 text-left transition-all ${
                  theme === 'dark'
                    ? 'border-duo-blue bg-duo-blue/10 shadow-3d-blue'
                    : 'border-gray-200 dark:border-dark-border'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Moon className="w-6 h-6 text-duo-blue" />
                  {theme === 'dark' && <CheckCircle2 className="w-5 h-5 text-duo-blue" />}
                </div>
                <span className="font-heading font-extrabold text-base block">Mode Gelap</span>
                <span className="text-xs text-gray-500">Warna Warm Slate (#131F24)</span>
              </button>
            </div>
          </div>

          {/* Section 3: Reader Preferences */}
          <div className="space-y-4">
            <h3 className="heading-3 text-lg flex items-center gap-2 border-b-2 border-gray-100 dark:border-dark-border pb-2">
              <Type className="w-5 h-5 text-duo-blue" />
              Preferensi Pembaca
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm block">Ukuran Font Standar</span>
                  <span className="text-xs text-gray-500">Ukuran teks saat membaca buku</span>
                </div>
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-dark-border rounded-duo p-1">
                  <button
                    onClick={() => setFontSize(fontSize - 2)}
                    className="px-3 py-1 font-bold text-sm"
                  >
                    -
                  </button>
                  <span className="px-2 font-mono font-bold text-sm">{fontSize}px</span>
                  <button
                    onClick={() => setFontSize(fontSize + 2)}
                    className="px-3 py-1 font-bold text-sm"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm block">Jenis Font Default</span>
                  <span className="text-xs text-gray-500">Serif untuk novel, Sans untuk umum</span>
                </div>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="input-duo py-2 text-sm w-40 font-bold"
                >
                  <option value="serif">Georgia (Serif)</option>
                  <option value="sans">Nunito (Sans)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Engine Health Status */}
          <div className="space-y-4">
            <h3 className="heading-3 text-lg flex items-center gap-2 border-b-2 border-gray-100 dark:border-dark-border pb-2">
              <Cpu className="w-5 h-5 text-duo-green" />
              Status Server & Backend Engine
            </h3>

            <div className="p-4 rounded-duo bg-gray-50 dark:bg-dark-border/40 border border-gray-200 dark:border-dark-border space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-500">Google Translate GTX:</span>
                <span className="font-mono bg-duo-green/10 text-duo-green px-2 py-0.5 rounded font-bold">
                  Aktif (Sub-100ms, Free)
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-500">OmniRoute LLM Provider:</span>
                <span className="font-mono bg-duo-blue/10 text-duo-blue px-2 py-0.5 rounded font-bold">
                  http://100.127.238.166:20129/v1 (auto/best-free)
                </span>
              </div>

              <button
                onClick={checkHealth}
                disabled={checkingHealth}
                className="btn-ghost w-full py-2 text-xs border-2 border-gray-200 dark:border-dark-border mt-2"
              >
                {checkingHealth ? 'Memeriksa status...' : 'Cek Status Server'}
              </button>

              {healthStatus && (
                <div className={`p-3 rounded-duo text-xs font-mono mt-2 ${
                  healthStatus.status === 'ok' ? 'bg-duo-green/10 text-duo-green' : 'bg-duo-red/10 text-duo-red'
                }`}>
                  {JSON.stringify(healthStatus, null, 2)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
