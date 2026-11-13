import React, { useEffect, useRef, useState } from 'react'
import { Bookmark, Check, ThumbsUp, ThumbsDown, RotateCcw } from 'lucide-react'

/**
 * DrawerActionBar
 * Sticky bottom bar: one-click word + source-sentence save, and 👍/👎 feedback
 * with a 5s undo. All colours come from --cr-* tokens (AC-WI-15, AC-WI-16, AC-X-01).
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
  const [notice, setNotice] = useState(null)
  const noticeTimerRef = useRef(null)

  useEffect(() => () => clearTimeout(noticeTimerRef.current), [])

  const showNotice = (text) => {
    clearTimeout(noticeTimerRef.current)
    setNotice(text)
    noticeTimerRef.current = setTimeout(() => setNotice(null), 5000)
  }

  const handleFeedbackClick = (type) => {
    if (feedback === type) {
      setFeedback(null)
      setNotice(null)
      clearTimeout(noticeTimerRef.current)
      if (onFeedback) onFeedback(null)
      return
    }

    setFeedback(type)
    showNotice(type === 'up' ? 'Masukan terkirim. Terima kasih.' : 'Masukan terkirim.')
    if (onFeedback) onFeedback(type)
  }

  const handleUndoFeedback = () => {
    setFeedback(null)
    setNotice(null)
    clearTimeout(noticeTimerRef.current)
    if (onFeedback) onFeedback(null)
  }

  const feedbackButtonClass = (isActive) =>
    `min-h-[44px] min-w-[44px] p-2 rounded-xl border transition-colors inline-flex items-center justify-center ${
      isActive
        ? 'bg-[var(--cr-highlight-word-hover)] border-[var(--cr-text-accent)] text-[var(--cr-text-accent)]'
        : 'bg-[var(--cr-bg-surface)] border-[var(--cr-border-subtle)] text-[var(--cr-text-secondary)] hover:text-[var(--cr-text-primary)] hover:border-[var(--cr-border-interactive)]'
    }`

  return (
    <div
      className={`shrink-0 border-t border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)] px-3 pt-3 sm:px-4 ${className}`}
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
    >
      <div className="flex items-center gap-2.5">
        {onToggleSave && (
          <button
            type="button"
            onClick={onToggleSave}
            disabled={saving}
            aria-pressed={saved}
            aria-label={
              saved
                ? `Kata ${word} tersimpan bersama kalimat`
                : `Simpan kata ${word} dan kalimat sumber`
            }
            className={`min-h-[44px] flex-1 px-3.5 py-2 rounded-xl text-[13px] font-extrabold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${
              saved
                ? 'bg-[var(--cr-bg-surface)] border border-[var(--cr-text-accent)] text-[var(--cr-text-accent)]'
                : 'bg-[var(--cr-btn-primary-bg)] text-[var(--cr-btn-primary-text)] hover:bg-[var(--cr-btn-primary-hover)]'
            }`}
          >
            {saved ? (
              <>
                <Check className="w-4 h-4 shrink-0" />
                <span className="truncate">Tersimpan</span>
              </>
            ) : (
              <>
                <Bookmark className="w-4 h-4 shrink-0" />
                <span className="truncate">Simpan Kata &amp; Kalimat</span>
              </>
            )}
          </button>
        )}

        <div
          className="flex items-center gap-1.5 shrink-0"
          role="group"
          aria-label="Umpan balik wawasan kata"
        >
          <span className="hidden lg:inline text-[11px] font-semibold text-[var(--cr-text-secondary)]">
            Membantu?
          </span>
          <button
            type="button"
            onClick={() => handleFeedbackClick('up')}
            aria-pressed={feedback === 'up'}
            aria-label="Wawasan kata ini membantu"
            title="Membantu"
            className={feedbackButtonClass(feedback === 'up')}
          >
            <ThumbsUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleFeedbackClick('down')}
            aria-pressed={feedback === 'down'}
            aria-label="Wawasan kata ini kurang membantu"
            title="Kurang membantu"
            className={feedbackButtonClass(feedback === 'down')}
          >
            <ThumbsDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {notice && (
        <div
          className="cr-anim-fade mt-2 flex items-center justify-center gap-2 text-[11px] font-medium text-[var(--cr-text-secondary)]"
          aria-live="polite"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={handleUndoFeedback}
            className="inline-flex items-center gap-1 font-bold text-[var(--cr-text-accent)] underline underline-offset-2 hover:opacity-80"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Urungkan (5s)</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default DrawerActionBar
