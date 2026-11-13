import React from 'react'
import { X } from 'lucide-react'

/**
 * DrawerSkeleton
 * Loading placeholder that mirrors the real B1 → B2 → grouped-detail hierarchy,
 * so the drawer does not jump when data lands (AC-WI-10, AC-WI-11, AC-X-04).
 */
export function DrawerSkeleton({ isSlow = false, onCancel, className = '' }) {
  return (
    <div
      role="status"
      aria-label="Memuat definisi kata"
      className={`cr-anim-fade space-y-3.5 p-0.5 ${className}`}
    >
      <div className="flex items-center justify-between pb-1">
        <div className="cr-skeleton h-3 w-28 rounded" />
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Batalkan memuat definisi"
            className="inline-flex min-h-[44px] min-w-[44px] items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[var(--cr-text-secondary)] transition-colors hover:text-[var(--cr-text-primary)]"
          >
            <X className="h-4 w-4" />
            <span>Batal</span>
          </button>
        )}
      </div>

      {/* B1 anchor */}
      <div className="space-y-2.5 rounded-2xl bg-[var(--cr-highlight-word-hover)] px-4 py-4">
        <div className="cr-skeleton h-2.5 w-24 rounded" />
        <div className="cr-skeleton h-7 w-40 rounded-lg" />
        <div className="cr-skeleton h-3 w-full rounded" />
      </div>

      {/* B2 variants */}
      <div className="space-y-2 px-0.5">
        <div className="cr-skeleton h-2.5 w-20 rounded" />
        <div className="flex gap-2">
          <div className="cr-skeleton h-11 w-24 rounded-xl" />
          <div className="cr-skeleton h-11 w-28 rounded-xl" />
        </div>
      </div>

      {/* Grouped detail surface */}
      <div className="divide-y divide-[var(--cr-border-subtle)] overflow-hidden rounded-2xl border border-[var(--cr-border-subtle)] bg-[var(--cr-bg-surface-elevated)]">
        <div className="space-y-2.5 p-4">
          <div className="cr-skeleton h-2.5 w-32 rounded" />
          <div className="cr-skeleton h-3.5 w-5/6 rounded" />
          <div className="cr-skeleton h-3.5 w-4/6 rounded" />
        </div>
        <div className="space-y-2.5 p-4">
          <div className="cr-skeleton h-2.5 w-20 rounded" />
          <div className="flex gap-2">
            <div className="cr-skeleton h-8 w-20 rounded-lg" />
            <div className="cr-skeleton h-8 w-24 rounded-lg" />
            <div className="cr-skeleton h-8 w-16 rounded-lg" />
          </div>
        </div>
      </div>

      {isSlow && (
        <p className="cr-anim-fade pt-1 text-center text-xs font-semibold text-[var(--cr-text-secondary)]">
          Masih memuat wawasan kata…
        </p>
      )}

      <span className="sr-only">Sedang memuat definisi kata...</span>
    </div>
  )
}

export default DrawerSkeleton
