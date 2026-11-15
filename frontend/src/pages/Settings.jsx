import { useState } from 'react'
import { Settings as SettingsIcon, Sliders, Moon, Sun, Type, Trash2, CheckCircle2, Cpu, Globe, Zap, Key, Server, PanelBottom, MessageSquare } from 'lucide-react'
import { useReaderStore } from '../stores'
import { useTheme } from '../hooks/useTheme'
import { coreApi } from '../utils/api'
import { AVAILABLE_LANGUAGES } from '../constants/languages'

export function Settings() {
  const {
    theme, setTheme,
    fontSize, setFontSize,
    fontFamily, setFontFamily,
    lineHeight, setLineHeight,
    targetLanguage, setTargetLanguage,
    motherLanguage, setMotherLanguage,
    translationEngine, setTranslationEngine,
    customBaseUrl, setCustomBaseUrl,
    customApiKey, setCustomApiKey,
    customModel, setCustomModel,
    popupMode, setPopupMode
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
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-16">
        <section className="hero-band cr-anim-rise" aria-labelledby="settings-title">
          <div className="relative">
            <p className="eyebrow">Preferensi</p>
            <h1 id="settings-title" className="display-1 mt-3 max-w-[20ch]">
              Atur cara kamu membaca.
            </h1>
            <p className="mt-4 max-w-[54ch] text-base font-semibold leading-relaxed" style={{ color: 'var(--cr-text-secondary)' }}>
              Ukuran huruf, tema, bahasa target, dan mesin penerjemah berlaku untuk
              semua buku di perangkat ini.
            </p>
          </div>
        </section>

        <div className="card-duo p-5 sm:p-8">
          <div className="space-y-8">
            {/* Section 1: Translation Engine & Target Language */}
            <section className="space-y-4" aria-labelledby="settings-engine">
              <h2 id="settings-engine" className="heading-3 flex items-center gap-2 border-b-2 pb-3" style={{ borderColor: 'var(--cr-border-subtle)' }}>
                <Globe className="h-5 w-5" style={{ color: 'var(--cr-blue-text)' }} aria-hidden="true" />
                Bahasa dan mesin penerjemah
              </h2>

            {/* Default Target Language & Mother Tongue Language Dropdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="font-bold text-sm block">Bahasa Target Utama (Pembelajaran):</label>
                <select
                  value={targetLanguage || 'id'}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="input-duo py-2.5 px-4 text-sm font-extrabold w-full cursor-pointer bg-white dark:bg-dark-card border-2 border-duo-blue/40 rounded-duo"
                >
                  {AVAILABLE_LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>
                      [{l.badge}] {l.name} ({l.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="font-bold text-sm block">Bahasa Induk (Bahasa Asal Pengguna):</label>
                <select
                  value={motherLanguage || 'id'}
                  onChange={(e) => setMotherLanguage(e.target.value)}
                  className="input-duo py-2.5 px-4 text-sm font-extrabold w-full cursor-pointer bg-white dark:bg-dark-card border-2 border-duo-green/40 rounded-duo"
                >
                  {AVAILABLE_LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>
                      [{l.badge}] {l.name} ({l.code})
                    </option>
                  ))}
                </select>
              </div>
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
                  <span className="text-[11px] text-[var(--cr-text-secondary)] block mt-1 leading-tight">
                    Gratis, respon instan, kamus kelas kata & transliterasi latin.
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
                  <span className="text-[11px] text-[var(--cr-text-secondary)] block mt-1 leading-tight">
                    Model auto/best-free via local OmniRoute Proxy server.
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
                  <span className="text-[11px] text-[var(--cr-text-secondary)] block mt-1 leading-tight">
                    Gunakan API Key OpenAI, OpenRouter, Groq, atau LLM kustom Anda.
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
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold block">API Key (Hanya Memori Sesi):</label>
                      {customApiKey && (
                        <button
                          type="button"
                          onClick={() => setCustomApiKey('')}
                          className="text-[11px] text-red-500 hover:underline font-bold"
                        >
                          Hapus dari Sesi
                        </button>
                      )}
                    </div>
                    <input
                      type="password"
                      placeholder="sk-or-v1-... atau sk-..."
                      value={customApiKey}
                      onChange={(e) => setCustomApiKey(e.target.value)}
                      className="input-duo w-full p-2.5 font-mono"
                    />
                    <div className="mt-1.5 p-2 bg-blue-50 dark:bg-blue-950/40 rounded-duo border border-blue-200 dark:border-blue-900/50 text-[11px] text-blue-800 dark:text-blue-300">
                      <p className="font-semibold">🔒 Keamanan Kunci API:</p>
                      <p>Kunci API Anda hanya disimpan di memori selama tab/sesi browser aktif dan <strong>tidak pernah disimpan ke localStorage / disk</strong>. Kunci akan otomatis terhapus saat tab browser ditutup.</p>
                    </div>
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
          </section>

          {/* Section 2: Reader Display Settings */}
          <section className="space-y-4" aria-labelledby="settings-display">
            <h2 id="settings-display" className="heading-3 flex items-center gap-2 border-b-2 pb-3" style={{ borderColor: 'var(--cr-border-subtle)' }}>
              <Sliders className="h-5 w-5" style={{ color: 'var(--cr-text-accent)' }} aria-hidden="true" />
              Tampilan pembaca
            </h2>

            {/* Font Size */}
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-sm block">Ukuran Font Teks:</span>
                <span className="text-xs text-[var(--cr-text-secondary)]">Sesuaikan kenyamanan membaca</span>
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
                <span className="text-xs text-[var(--cr-text-secondary)]">Gaya font novel vs sans-serif</span>
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
                <span className="text-xs text-[var(--cr-text-secondary)]">Mode warna canvas bacaan</span>
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

            {/* Popup Mode (Bottom Sheet vs Floating Tooltip) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-dark-border">
              <div>
                <span className="font-bold text-sm block">Gaya Penjelasan Kata:</span>
                <span className="text-xs text-[var(--cr-text-secondary)]">Panel bawah ala aplikasi mobile atau tooltip melayang</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPopupMode('bottom-sheet')}
                  className={`px-3.5 py-2 rounded-duo font-bold text-xs flex items-center gap-1.5 transition-all ${
                    (popupMode || 'bottom-sheet') === 'bottom-sheet'
                      ? 'bg-duo-green text-white shadow-3d'
                      : 'bg-gray-100 dark:bg-dark-border text-eel dark:text-dark-text hover:bg-gray-200'
                  }`}
                  title="Muncul dari tepi bawah layar (ala mobile app, lebih lega di desktop)"
                >
                  <PanelBottom className="w-4 h-4" />
                  Panel Bawah
                </button>
                <button
                  type="button"
                  onClick={() => setPopupMode('tooltip')}
                  className={`px-3.5 py-2 rounded-duo font-bold text-xs flex items-center gap-1.5 transition-all ${
                    popupMode === 'tooltip'
                      ? 'bg-duo-green text-white shadow-3d'
                      : 'bg-gray-100 dark:bg-dark-border text-eel dark:text-dark-text hover:bg-gray-200'
                  }`}
                  title="Mengambang tepat di bawah kata yang diklik pada teks"
                >
                  <MessageSquare className="w-4 h-4" />
                  Tooltip
                </button>
              </div>
            </div>
          </section>

          {/* Section 3: Server Health Status */}
          <section className="space-y-4 border-t-2 pt-6" aria-labelledby="settings-server" style={{ borderColor: 'var(--cr-border-subtle)' }}>
            <h2 id="settings-server" className="heading-3 flex items-center gap-2">
              <Cpu className="h-5 w-5" style={{ color: 'var(--cr-blue-text)' }} aria-hidden="true" />
              Status server
            </h2>
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <span className="block text-sm font-bold">Koneksi backend</span>
                <span className="text-xs font-semibold" style={{ color: 'var(--cr-text-secondary)' }}>
                  Periksa database dan layanan penerjemah.
                </span>
              </div>
              <button
                type="button"
                onClick={checkHealth}
                disabled={checkingHealth}
                className="btn-secondary px-4 py-2 text-sm"
              >
                {checkingHealth ? 'Memeriksa...' : 'Cek status'}
              </button>
            </div>

            {healthStatus && (
              <div
                className="space-y-1 rounded-xl border p-4 font-mono text-xs"
                style={{ borderColor: 'var(--cr-border-subtle)', backgroundColor: 'var(--cr-bg-surface)' }}
                role="status"
              >
                <div>Status: <span className="font-bold" style={{ color: 'var(--cr-text-accent)' }}>{healthStatus.status}</span></div>
                {healthStatus.database && <div>Database: {healthStatus.database}</div>}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
