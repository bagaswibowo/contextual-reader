import { useState } from 'react'
import { Settings as SettingsIcon, Sliders, Moon, Sun, Type, Trash2, CheckCircle2, Cpu, Globe, Zap, Key, Server } from 'lucide-react'
import { useReaderStore } from '../stores'
import { useTheme } from '../hooks/useTheme'
import { coreApi } from '../utils/api'
import { AVAILABLE_LANGUAGES } from '../constants/languages'

export function Settings() {
  const { theme, setTheme } = useTheme()
  const { 
    fontSize, setFontSize, 
    fontFamily, setFontFamily, 
    lineHeight, setLineHeight,
    targetLanguage, setTargetLanguage,
    translationEngine, setTranslationEngine,
    customBaseUrl, setCustomBaseUrl,
    customApiKey, setCustomApiKey,
    customModel, setCustomModel
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

            {/* Default Target Language Dropdown (22 Languages) */}
            <div className="space-y-2">
              <label className="font-bold text-sm block">Bahasa Target Utama:</label>
              <select
                value={targetLanguage || 'id'}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="input-duo py-2.5 px-4 text-sm font-extrabold w-full cursor-pointer bg-white dark:bg-dark-card border-2 border-duo-blue/40 rounded-duo"
              >
                {AVAILABLE_LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.name} ({l.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Translation Engine Selector */}
            <div className="space-y-3 pt-2">
              <label className="font-bold text-sm block">Pilih Engine Penerjemah:</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Engine 1: Google Translate */}
                <button
                  onClick={() => setTranslationEngine('google')}
                  className={`p-4 rounded-duo border-2 text-left transition-all ${
                    translationEngine === 'google'
                      ? 'border-duo-green bg-duo-green/10 shadow-3d'
                      : 'border-gray-200 dark:border-dark-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Zap className="w-5 h-5 text-duo-green" />
                    {translationEngine === 'google' && <CheckCircle2 className="w-5 h-5 text-duo-green" />}
                  </div>
                  <span className="font-heading font-extrabold text-sm block">Google Translate</span>
                  <span className="text-[11px] text-gray-500 block mt-1 leading-tight">
                    ⚡ Gratis, Respon Instan, Kamus Kelas Kata & Transliterasi Latin.
                  </span>
                </button>

                {/* Engine 2: OmniRoute Proxy */}
                <button
                  onClick={() => setTranslationEngine('omni')}
                  className={`p-4 rounded-duo border-2 text-left transition-all ${
                    translationEngine === 'omni'
                      ? 'border-duo-blue bg-duo-blue/10 shadow-3d-blue'
                      : 'border-gray-200 dark:border-dark-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Cpu className="w-5 h-5 text-duo-blue" />
                    {translationEngine === 'omni' && <CheckCircle2 className="w-5 h-5 text-duo-blue" />}
                  </div>
                  <span className="font-heading font-extrabold text-sm block">OmniRoute Proxy</span>
                  <span className="text-[11px] text-gray-500 block mt-1 leading-tight">
                    🤖 Model auto/best-free via local OmniRoute Proxy server.
                  </span>
                </button>

                {/* Engine 3: Custom AI Provider */}
                <button
                  onClick={() => setTranslationEngine('custom')}
                  className={`p-4 rounded-duo border-2 text-left transition-all ${
                    translationEngine === 'custom'
                      ? 'border-duo-purple bg-duo-purple/10 shadow-3d'
                      : 'border-gray-200 dark:border-dark-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Key className="w-5 h-5 text-duo-purple" />
                    {translationEngine === 'custom' && <CheckCircle2 className="w-5 h-5 text-duo-purple" />}
                  </div>
                  <span className="font-heading font-extrabold text-sm block">Custom AI Provider</span>
                  <span className="text-[11px] text-gray-500 block mt-1 leading-tight">
                    🔑 Gunakan API Key OpenAI, OpenRouter, Groq, atau LLM kustom Anda.
                  </span>
                </button>
              </div>
            </div>

            {/* Custom AI Provider Setup Card */}
            {translationEngine === 'custom' && (
              <div className="p-5 rounded-duo bg-duo-purple/5 border-2 border-duo-purple space-y-4 animate-in">
                <div className="flex items-center gap-2 text-duo-purple font-heading font-extrabold text-base">
                  <Key className="w-5 h-5" />
                  Konfigurasi Custom AI Provider
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold block mb-1">Base URL (OpenAI-compatible):</label>
                    <input
                      type="text"
                      placeholder="https://api.openai.com/v1 atau https://openrouter.ai/api/v1"
                      value={customBaseUrl}
                      onChange={(e) => setCustomBaseUrl(e.target.value)}
                      className="input-duo w-full p-2.5 font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-bold block mb-1">API Key:</label>
                    <input
                      type="password"
                      placeholder="sk-or-v1-... atau sk-..."
                      value={customApiKey}
                      onChange={(e) => setCustomApiKey(e.target.value)}
                      className="input-duo w-full p-2.5 font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-bold block mb-1">Nama Model:</label>
                    <input
                      type="text"
                      placeholder="gpt-4o-mini, claude-3-5-sonnet, deepseek/deepseek-r1"
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      className="input-duo w-full p-2.5 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Reader Display Settings */}
          <div className="space-y-4">
            <h3 className="heading-3 text-lg flex items-center gap-2 border-b-2 border-gray-100 dark:border-dark-border pb-2">
              <Sliders className="w-5 h-5 text-duo-green" />
              Tampilan Pembaca
            </h3>

            {/* Font Size */}
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-sm block">Ukuran Font Teks:</span>
                <span className="text-xs text-gray-500">Sesuaikan kenyamanan membaca</span>
              </div>
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-dark-border rounded-duo p-1">
                <button
                  onClick={() => setFontSize(fontSize - 2)}
                  disabled={fontSize <= 12}
                  className="px-3 py-1 font-bold text-sm bg-white dark:bg-dark-card rounded-duo shadow-sm disabled:opacity-50"
                >
                  A-
                </button>
                <span className="px-3 font-mono font-bold text-sm">{fontSize}px</span>
                <button
                  onClick={() => setFontSize(fontSize + 2)}
                  disabled={fontSize >= 32}
                  className="px-3 py-1 font-bold text-sm bg-white dark:bg-dark-card rounded-duo shadow-sm disabled:opacity-50"
                >
                  A+
                </button>
              </div>
            </div>

            {/* Font Family */}
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-sm block">Jenis Tipografi:</span>
                <span className="text-xs text-gray-500">Gaya font novel vs sans-serif</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFontFamily('serif')}
                  className={`px-4 py-2 rounded-duo font-bold text-xs ${
                    fontFamily === 'serif' ? 'bg-duo-green text-white shadow-3d' : 'bg-gray-100 dark:bg-dark-border'
                  }`}
                >
                  Serif (Georgia)
                </button>
                <button
                  onClick={() => setFontFamily('sans')}
                  className={`px-4 py-2 rounded-duo font-bold text-xs ${
                    fontFamily === 'sans' ? 'bg-duo-green text-white shadow-3d' : 'bg-gray-100 dark:bg-dark-border'
                  }`}
                >
                  Sans (Nunito)
                </button>
              </div>
            </div>

            {/* Theme */}
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-sm block">Tema Pembaca:</span>
                <span className="text-xs text-gray-500">Mode warna canvas bacaan</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTheme('light')}
                  className={`p-3 rounded-duo border-2 ${theme === 'light' ? 'border-duo-yellow bg-duo-yellow/10' : 'border-gray-200'}`}
                >
                  <Sun className="w-5 h-5 text-duo-yellow" />
                </button>
                <button
                  onClick={() => setTheme('sepia')}
                  className={`p-3 rounded-duo border-2 ${theme === 'sepia' ? 'border-amber-700 bg-amber-100' : 'border-gray-200'}`}
                >
                  <Type className="w-5 h-5 text-amber-800" />
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`p-3 rounded-duo border-2 ${theme === 'dark' ? 'border-duo-blue bg-duo-blue/10' : 'border-gray-200'}`}
                >
                  <Moon className="w-5 h-5 text-duo-blue" />
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Server Health Status */}
          <div className="space-y-4 pt-4 border-t-2 border-gray-100 dark:border-dark-border">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-sm block">Status Server Backend (sxz):</span>
                <span className="text-xs text-gray-500">Cek konektivitas database & OmniRoute API</span>
              </div>
              <button
                onClick={checkHealth}
                disabled={checkingHealth}
                className="btn-secondary py-2 px-4 text-xs font-bold"
              >
                {checkingHealth ? 'Memeriksa...' : 'Cek Status'}
              </button>
            </div>

            {healthStatus && (
              <div className="p-4 rounded-duo bg-gray-100 dark:bg-dark-border/40 text-xs font-mono space-y-1">
                <div>Status: <span className="font-bold text-duo-green">{healthStatus.status}</span></div>
                {healthStatus.database && <div>Database: {healthStatus.database}</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
