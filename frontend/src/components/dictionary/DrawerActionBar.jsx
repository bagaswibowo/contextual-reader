import React, { useState } from 'react'
import { Bookmark, Check, ThumbsUp, ThumbsDown } from 'lucide-react'

/**
 * DrawerActionBar
 * Sticky bottom bar offering one-click word+sentence saving and 👍/👎 helpfulness feedback.
 * Safe-area aware, with accessible states and undo capability (AC-WI-15, AC-WI-16).
 */
export function DrawerActionBar({
  word = '',
  saved = false,
  saving = false,
  onToggleSave,
  onFeedback,
  className = '',
}) {
  const [feedback, setFeedback] = useState(null) // 'up' | 'down' | null
  const [feedbackNotice, setFeedbackNotice] = useState(null)

  const handleFeedbackClick = (type) => {
    if (feedback === type) {
      setFeedback(null)
      setFeedbackNotice(null)
      if (onFeedback) onFeedback(null)
      return
    }

    setFeedback(type)
    setFeedbackNotice(type === 'up' ? 'Terima kasih atas masukan Anda!' : 'Masukan dicatat.')
    if (onFeedback) onFeedback(type)

    // Clear notice after 5 seconds
    setTimeout(() => {
      setFeedbackNotice(null)
    }, 5000)
  }

  return (
    <div
      className={`p-3 sm:p-4 border-t border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] flex flex-col gap-2 shrink-0 ${className}`}
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Main Save Action (>= 44x44) */}
        {onToggleSave && (
          <button
            type="button"
            onClick={onToggleSave}
            disabled={saving}
            aria-pressed={saved}
            aria-label={saved ? `Kata ${word} tersimpan bersama kalimat` : `Simpan kata ${word} dan kalimat sumber`}
            className={`min-h-[44px] flex-1 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all shadow-xs ${
              saved
                ? 'bg-[var(--cr-bg-surface)] border-2 border-[var(--cr-btn-primary-bg)] text-[var(--cr-text-accent)]'
                : 'bg-[var(--cr-btn-primary-bg)] text-[var(--cr-btn-primary-text)] hover:bg-[var(--cr-btn-primary-hover)] active:translate-y-[1px]'
            }`}
          >
            {saved ? (
              <>
                <Check className="w-4 h-4 text-[var(--cr-text-accent)]" />
                <span>Tersimpan di Kosakata</span>
              </>
            ) : (
              <>
                <Bookmark className="w-4 h-4" />
                <span>Simpan Kata & Kalimat</span>
              </>
            )}
          </button>
        )}

        {/* Feedback Section (👍 / 👎) */}
        <div className="flex items-center gap-1.5 shrink-0" role="group" aria-label="Umpan balik wawasan kata">
          <span className="text-[11px] font-semibold text-[var(--cr-text-secondary)] hidden sm:inline">
            Membantu?
          </span>

          <button
            type="button"
            onClick={() => handleFeedbackClick('up')}
            aria-pressed={feedback === 'up'}
            aria-label="Wawasan kata ini sangat membantu"
            title="Membantu"
            className={`min-h-[44px] min-w-[44px] p-2 rounded-xl border transition-colors inline-flex items-center justify-center ${
              feedback === 'up'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'bg-[var(--cr-bg-surface)] border-[var(--cr-border-subtle)] text-[var(--cr-text-secondary)] hover:text-[var(--cr-text-primary)] hover:border-[var(--cr-border-interactive)]'
            }`}
          >
            <ThumbsUp className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => handleFeedbackClick('down')}
            aria-pressed={feedback === 'down'}
            aria-label="Wawasan kata ini kurang membantu"
            title="Kurang membantu"
            className={`min-h-[44px] min-w-[44px] p-2 rounded-xl border transition-colors inline-flex items-center justify-center ${
              feedback === 'down'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-600 dark:text-rose-400'
                : 'bg-[var(--cr-bg-surface)] border-[var(--cr-border-subtle)] text-[var(--cr-text-secondary)] hover:text-[var(--cr-text-primary)] hover:border-[var(--cr-border-interactive)]'
            }`}
          >
            <ThumbsDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {feedbackNotice && (
        <p className="text-[11px] text-center font-medium text-[var(--cr-text-secondary)] animate-fade-in" aria-live="polite">
          {feedbackNotice}
        </p>
      )}
    </div>
  )
}

export default DrawerActionBar
