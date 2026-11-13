import React from 'react'
import { Clock, GitBranch, Zap, RefreshCw } from 'lucide-react'

/**
 * Grammar3dTab
 * Displays 3D grammar assistance: Tense, Syntactic structure, and Word role (DESIGN §3.3).
 */
export function Grammar3dTab({
  grammarData = null,
  loading = false,
  error = null,
  onRetry,
  sentenceText = '',
  word = '',
  className = '',
}) {
  if (loading) {
    return (
      <div className={`p-8 flex flex-col items-center justify-center gap-3 text-center ${className}`}>
        <div className="w-8 h-8 border-3 border-[var(--cr-text-accent)] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-[var(--cr-text-secondary)]">
          Menganalisis tata bahasa kalimat & peran kata…
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`p-6 text-center space-y-3 ${className}`}>
        <p className="text-xs font-bold text-[var(--cr-text-danger)]">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold border border-[var(--cr-border-interactive)] text-[var(--cr-text-primary)] hover:bg-[var(--cr-bg-surface-elevated)] inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Coba lagi</span>
          </button>
        )}
      </div>
    )
  }

  const grammar = grammarData?.grammar || grammarData

  if (!grammar) {
    return (
      <div className={`p-6 text-center text-xs text-[var(--cr-text-secondary)] space-y-2 ${className}`}>
        <p className="font-semibold text-sm text-[var(--cr-text-primary)]">Analisis tata bahasa belum tersedia</p>
        <p>Klik tombol muat ulang untuk menganalisis peran kata & struktur kalimat.</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold bg-[var(--cr-btn-primary-bg)] text-[var(--cr-btn-primary-text)] hover:bg-[var(--cr-btn-primary-hover)] inline-flex items-center gap-1.5 transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Analisis Tata Bahasa</span>
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`space-y-3.5 pb-4 ${className}`}>
      {sentenceText && (
        <div className="p-3.5 rounded-2xl bg-[var(--cr-bg-surface)] border border-[var(--cr-border-subtle)] text-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--cr-text-secondary)] block mb-1">
            Kalimat Asal
          </span>
          <p className="italic text-[var(--cr-text-primary)] leading-relaxed">
            &ldquo;{sentenceText}&rdquo;
          </p>
        </div>
      )}

      {/* Card 1: Tense */}
      {grammar.tense && (
        <div className="p-4 rounded-2xl bg-[var(--cr-bg-surface-elevated)] border border-[var(--cr-border-subtle)] space-y-1.5">
          <div className="flex items-center gap-1.5 text-[var(--cr-text-accent)] text-xs font-extrabold uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5" />
            <span>Bentuk Waktu (Tense)</span>
          </div>
          <p className="text-sm font-bold text-[var(--cr-text-primary)]">
            {grammar.tense}
          </p>
          {grammar.tense_explanation && (
            <p className="text-xs text-[var(--cr-text-secondary)] leading-relaxed">
              {grammar.tense_explanation}
            </p>
          )}
        </div>
      )}

      {/* Card 2: Structure & SVO */}
      {grammar.structure && (
        <div className="p-4 rounded-2xl bg-[var(--cr-bg-surface-elevated)] border border-[var(--cr-border-subtle)] space-y-1.5">
          <div className="flex items-center gap-1.5 text-[var(--cr-text-secondary)] text-xs font-extrabold uppercase tracking-wider">
            <GitBranch className="w-3.5 h-3.5" />
            <span>Struktur Kalimat (SVO)</span>
          </div>
          <p className="text-sm font-bold text-[var(--cr-text-primary)] font-mono">
            {grammar.structure}
          </p>
          {grammar.clause_breakdown && (
            <p className="text-xs text-[var(--cr-text-secondary)] leading-relaxed">
              {grammar.clause_breakdown}
            </p>
          )}
        </div>
      )}

      {/* Card 3: Word Role in Context */}
      {grammar.role && (
        <div className="p-4 rounded-2xl bg-[var(--cr-bg-surface-elevated)] border border-[var(--cr-border-subtle)] space-y-1.5">
          <div className="flex items-center gap-1.5 text-[var(--cr-text-secondary)] text-xs font-extrabold uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5" />
            <span>Peran Kata {word ? `(${word})` : ''}</span>
          </div>
          <p className="text-xs text-[var(--cr-text-primary)] leading-relaxed">
            {grammar.role}
          </p>
        </div>
      )}

      {/* Word Category Tags if present */}
      {(grammar.verbs?.length > 0 || grammar.nouns?.length > 0 || grammar.adjectives?.length > 0) && (
        <div className="p-3.5 rounded-2xl bg-[var(--cr-bg-surface-elevated)] border border-[var(--cr-border-subtle)] space-y-2 text-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--cr-text-secondary)] block">
            Pengelompokan Kata
          </span>
          <div className="flex flex-wrap gap-2 text-[11px]">
            {grammar.verbs?.length > 0 && (
              <span className="px-2 py-1 rounded-lg bg-[var(--cr-bg-surface)] text-[var(--cr-text-primary)] border border-[var(--cr-border-subtle)] font-mono">
                <strong>Verba:</strong> {grammar.verbs.join(', ')}
              </span>
            )}
            {grammar.nouns?.length > 0 && (
              <span className="px-2 py-1 rounded-lg bg-[var(--cr-bg-surface)] text-[var(--cr-text-primary)] border border-[var(--cr-border-subtle)] font-mono">
                <strong>Nomina:</strong> {grammar.nouns.join(', ')}
              </span>
            )}
            {grammar.adjectives?.length > 0 && (
              <span className="px-2 py-1 rounded-lg bg-[var(--cr-bg-surface)] text-[var(--cr-text-primary)] border border-[var(--cr-border-subtle)] font-mono">
                <strong>Adjektiva:</strong> {grammar.adjectives.join(', ')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Grammar3dTab
