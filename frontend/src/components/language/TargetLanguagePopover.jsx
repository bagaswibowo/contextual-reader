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
 * Target language picker for 10 backend languages (DESIGN §14).
 * Desktop: anchored popover. Mobile: bottom sheet. Radio group with arrow keys.
 */
export function TargetLanguagePopover({
  isOpen = false,
  currentTarget = 'id',
  onSelect,
  onClose,
  triggerRef = null,
}) {
  const popoverRef = useRef(null)
  const radioRefs = useRef([])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose && onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    const timer = setTimeout(() => {
      const selectedIndex = SUPPORTED_LANGUAGES.findIndex(
        (lang) => lang.code.toLowerCase() === (currentTarget || 'id').toLowerCase()
      )
      const target = radioRefs.current[selectedIndex >= 0 ? selectedIndex : 0]
      target?.focus()
    }, 50)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', handleKeyDown)
      if (triggerRef?.current) {
        try {
          triggerRef.current.focus()
        } catch (e) {}
      }
    }
  }, [isOpen, currentTarget])

  const handleRadioKeyDown = (e, index) => {
    const last = SUPPORTED_LANGUAGES.length - 1
    let next = null

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = index === last ? 0 : index + 1
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = index === 0 ? last : index - 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = last

    if (next !== null) {
      e.preventDefault()
      radioRefs.current[next]?.focus()
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[64] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog: bottom sheet on mobile, anchored popover on desktop */}
      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-label="Pilih bahasa target terjemahan"
        className="cr-drawer-enter fixed inset-x-0 bottom-0 z-[65] max-h-[80dvh] overflow-hidden rounded-t-3xl border-t border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] p-4 text-[var(--cr-text-primary)] shadow-2xl sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-16 sm:max-h-none sm:w-80 sm:rounded-2xl sm:border sm:p-5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
      >
        <div className="mb-3 flex items-center justify-between border-b border-[var(--cr-border-subtle)] pb-3">
          <h3 className="font-heading text-base font-extrabold">Pilih Bahasa Target</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pilihan bahasa"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 text-[var(--cr-text-secondary)] transition-colors hover:bg-[var(--cr-bg-surface)] hover:text-[var(--cr-text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          role="radiogroup"
          aria-label="Daftar bahasa target terjemahan"
          className="cr-scroll-contain max-h-[60dvh] space-y-1 overflow-y-auto pr-1 sm:max-h-72"
        >
          {SUPPORTED_LANGUAGES.map((lang, index) => {
            const isSelected = (currentTarget || 'id').toLowerCase() === lang.code.toLowerCase()

            return (
              <button
                key={lang.code}
                ref={(el) => {
                  radioRefs.current[index] = el
                }}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onKeyDown={(e) => handleRadioKeyDown(e, index)}
                onClick={() => {
                  try {
                    localStorage.setItem('cr_target_lang_v1', lang.code)
                  } catch (e) {}
                  onSelect && onSelect(lang.code)
                  onClose && onClose()
                }}
                className={`flex min-h-[44px] w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                  isSelected
                    ? 'border border-[var(--cr-text-accent)] bg-[var(--cr-highlight-word-hover)] text-[var(--cr-text-accent)]'
                    : 'text-[var(--cr-text-primary)] hover:bg-[var(--cr-bg-surface)]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="rounded border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface)] px-1.5 py-0.5 font-mono text-[11px] font-bold text-[var(--cr-text-secondary)]">
                    {lang.badge}
                  </span>
                  <span>{lang.name}</span>
                </span>
                {isSelected && <Check className="h-4 w-4 text-[var(--cr-text-accent)]" />}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

export default TargetLanguagePopover
