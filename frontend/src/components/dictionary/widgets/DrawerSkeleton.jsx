import React from 'react'
import { X } from 'lucide-react'

/**
 * DrawerSkeleton
 * Skeleton loader displayed while fetching dictionary data.
 * Includes shimmer animation (disabled under prefers-reduced-motion), slow loading notice,
 * and accessible Cancel action (AC-WI-10, AC-WI-11, AC-X-04).
 */
export function DrawerSkeleton({ isSlow = false, onCancel, className = '' }) {
  return (
    <div
      role="status"
      aria-label="Memuat definisi kata"
      className={`space-y-4 p-1 animate-in ${className}`}
    >
      <div className="flex items-center justify-between pb-2 border-b border-[var(--cr-border-subtle)]">
        <div className="h-6 w-36 bg-[var(--cr-border-subtle)] rounded-lg animate-pulse" />
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Batalkan memuat definisi"
            className="min-h-[44px] min-w-[44px] px-2 py-1 text-xs font-semibold text-[var(--cr-text-secondary)] hover:text-[var(--cr-text-primary)] inline-flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            <span>Batal</span>
          </button>
        )}
      </div>

      {/* B1 Skeleton Card */}
      <div className="p-4 rounded-2xl bg-[var(--cr-bg-surface-elevated)] border border-[var(--cr-border-subtle)] space-y-2.5">
        <div className="h-3 w-28 bg-[var(--cr-border-subtle)] rounded animate-pulse" />
        <div className="h-7 w-48 bg-[var(--cr-border-subtle)] rounded-lg animate-pulse" />
        <div className="h-3 w-full bg-[var(--cr-border-subtle)] rounded animate-pulse" />
      </div>

      {/* B3 Skeleton Card */}
      <div className="p-4 rounded-2xl bg-[var(--cr-bg-surface-elevated)] border border-[var(--cr-border-subtle)] space-y-2.5">
        <div className="h-3 w-32 bg-[var(--cr-border-subtle)] rounded animate-pulse" />
        <div className="h-4 w-5/6 bg-[var(--cr-border-subtle)] rounded animate-pulse" />
        <div className="h-4 w-4/6 bg-[var(--cr-border-subtle)] rounded animate-pulse" />
      </div>

      {/* B4 Skeleton Card */}
      <div className="p-4 rounded-2xl bg-[var(--cr-bg-surface-elevated)] border border-[var(--cr-border-subtle)] space-y-2.5">
        <div className="h-3 w-24 bg-[var(--cr-border-subtle)] rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-8 w-20 bg-[var(--cr-border-subtle)] rounded-xl animate-pulse" />
          <div className="h-8 w-24 bg-[var(--cr-border-subtle)] rounded-xl animate-pulse" />
          <div className="h-8 w-16 bg-[var(--cr-border-subtle)] rounded-xl animate-pulse" />
        </div>
      </div>

      {isSlow && (
        <p className="text-center text-xs font-semibold text-[var(--cr-text-secondary)] animate-fade-in pt-2">
          Masih memuat wawasan kata…
        </p>
      )}

      <span className="sr-only">Sedang memuat definisi kata...</span>
    </div>
  )
}

export default DrawerSkeleton
