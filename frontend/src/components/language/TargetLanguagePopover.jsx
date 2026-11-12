import React, { useEffect, useRef } from 'react'
import { Check, X } from 'lucide-react'

export const SUPPORTED_LANGUAGES = [
  { code: 'id', name: 'Bahasa Indonesia', badge: 'ID' },
  { code: 'en', name: 'English', badge: 'EN' },
  { code: 'es', name: 'Español', badge: 'ES' },
  { code: 'fr', name: 'Français', badge: 'FR' },
  { code: 'de', name: 'Deutsch', badge: 'DE' },
  { code: 'ja', name: '日本語', badge: 'JA' },
  { code: 'ko', name: '한국어', badge: 'KO' },
  { code: 'zh', name: '中文', badge: 'ZH' },
  { code: 'ar', name: 'العربية', badge: 'AR' },
  { code: 'ru', name: 'Русский', badge: 'RU' },
]

/**
 * TargetLanguagePopover
 * Modal popover to select target language across 10 backend-supported languages (DESIGN §14).
 * Accessible radio group with keyboard navigation and focus management.
 */
export function TargetLanguagePopover({
  isOpen = false,
  currentTarget = 'id',
  onSelect,
  onClose,
  triggerRef = null,
}) {
  const popoverRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose && onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    setTimeout(() => {
      const activeRadio = popoverRef.current?.querySelector('[aria-checked="true"]')
      if (activeRadio) {
        activeRadio.focus()
      } else {
        popoverRef.current?.querySelector('button')?.focus()
      }
    }, 50)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (triggerRef?.current) {
        try {
          triggerRef.current.focus()
        } catch (e) {}
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[64]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Popover dialog */}
      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-label="Pilih bahasa target terjemahan"
        className="fixed z-[65] inset-x-4 top-1/2 -translate-y-1/2 sm:inset-auto sm:top-16 sm:right-6 sm:translate-y-0 w-auto sm:w-80 max-w-sm rounded-3xl bg-[var(--cr-bg-surface-elevated)] border-2 border-[var(--cr-border-subtle)] shadow-2xl p-4 sm:p-5 text-[var(--cr-text-primary)]"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--cr-border-subtle)] mb-3">
          <h3 className="font-heading font-extrabold text-base">
            Pilih Bahasa Target
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pilihan bahasa"
            className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-[var(--cr-text-secondary)] hover:text-[var(--cr-text-primary)] inline-flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          role="radiogroup"
          aria-label="Daftar bahasa target terjemahan"
          className="space-y-1 max-h-72 overflow-y-auto pr-1"
        >
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = (currentTarget || 'id').toLowerCase() === lang.code.toLowerCase()

            return (
              <button
                key={lang.code}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => {
                  try {
                    localStorage.setItem('cr_target_lang_v1', lang.code)
                  } catch (e) {}
                  onSelect && onSelect(lang.code)
                  onClose && onClose()
                }}
                className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                  isSelected
                    ? 'bg-[var(--cr-bg-surface)] text-[var(--cr-text-accent)] border border-[var(--cr-text-accent)]'
                    : 'text-[var(--cr-text-primary)] hover:bg-[var(--cr-bg-surface)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-[var(--cr-bg-surface)] text-[var(--cr-text-secondary)] border border-[var(--cr-border-subtle)]">
                    {lang.badge}
                  </span>
                  <span>{lang.name}</span>
                </div>
                {isSelected && <Check className="w-4 h-4 text-[var(--cr-text-accent)]" />}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

export default TargetLanguagePopover
