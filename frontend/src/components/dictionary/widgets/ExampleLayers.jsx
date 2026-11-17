import React from 'react'

const LAYER_LINE = 'block text-[max(12px,0.8em)] leading-tight break-words'

const BADGE_CLASS =
  'relative inline rounded-[4px] bg-[var(--cr-highlight-sentence)] px-1 font-bold text-[var(--cr-text-primary)] underline decoration-2 underline-offset-2 decoration-[var(--cr-text-accent)] after:absolute after:-inset-x-1 after:-inset-y-[14px] after:content-[""]'

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Match the studied word and its common inflections, including the lemma when
 * the user opened a plural or past form (light/lights, study/studies).
 */
export function wordPattern(word) {
  const base = String(word || '').trim()
  if (!base) return null
  const escaped = escapeRegExp(base)
  const variants = new Set([escaped])
  const add = (value) => {
    if (value && value.length >= 2) variants.add(value)
  }

  add(`${escaped}s`)
  add(`${escaped}es`)
  add(`${escaped}ed`)
  add(`${escaped}ing`)
  add(`${escaped}er`)
  add(`${escaped}est`)
  add(`${escaped}ly`)

  if (/e$/i.test(base)) {
    const stem = escaped.slice(0, -1)
    add(`${escaped}d`)
    add(`${stem}ing`)
    add(`${escaped}r`)
    add(`${escaped}rs`)
    add(`${escaped}st`)
  }

  if (/[^aeiou]y$/i.test(base)) {
    const stem = escaped.slice(0, -1)
    add(`${stem}ies`)
    add(`${stem}ied`)
    add(`${stem}ier`)
    add(`${stem}iest`)
  }
  if (/[^aeiou][aeiou][bdgklmnprt]$/i.test(base)) {
    const last = escaped.slice(-1)
    add(`${escaped}${last}ed`)
    add(`${escaped}${last}ing`)
    add(`${escaped}${last}er`)
    add(`${escaped}${last}est`)
  }

  if (/ies$/i.test(base)) add(`${escaped.slice(0, -3)}y`)
  else if (/es$/i.test(base)) add(escaped.slice(0, -2))
  else if (/s$/i.test(base) && base.length > 3) add(escaped.slice(0, -1))
  if (/ied$/i.test(base)) add(`${escaped.slice(0, -3)}y`)
  else if (/ed$/i.test(base)) add(escaped.slice(0, -2))
  if (/ing$/i.test(base)) add(escaped.slice(0, -3))

  return new RegExp(`\\b(${[...variants].join('|')})\\b`, 'gi')
}

export function HighlightedText({ text, word, onOpenWord }) {
  const value = String(text || '')
  const pattern = wordPattern(word)
  if (!value || !pattern) return value

  const parts = []
  let lastIndex = 0
  let match = pattern.exec(value)
  while (match) {
    if (match.index > lastIndex) parts.push(value.slice(lastIndex, match.index))
    const matched = match[0]
    const key = `${match.index}-${matched}`
    parts.push(
      onOpenWord ? (
        <button
          key={key}
          type="button"
          onClick={() => onOpenWord(matched)}
          className={`${BADGE_CLASS} cursor-pointer`}
          aria-label={`Buka arti kata ${matched}`}
        >
          {matched}
        </button>
      ) : (
        <span key={key} className={BADGE_CLASS}>
          {matched}
        </span>
      )
    )
    lastIndex = match.index + matched.length
    match = pattern.exec(value)
  }
  if (lastIndex < value.length) parts.push(value.slice(lastIndex))
  return parts
}

/**
 * Three language layers with one size. The hierarchy comes from colour and
 * weight only; empty or repeated layers are hidden. Example sentences also
 * carry the studied word as a bold, tinted badge.
 */
export function LayeredLines({
  book = '',
  learning = '',
  mother = '',
  highlightWord = '',
  onOpenWord,
}) {
  const layers = []
  const push = (text, className) => {
    const value = String(text || '').trim()
    if (!value) return
    const key = value.toLowerCase()
    if (layers.length > 0 && layers[layers.length - 1].key === key) return
    layers.push({ value, className, key })
  }
  push(book, 'font-bold text-[var(--cr-text-primary)]')
  push(learning, 'font-semibold text-[var(--cr-text-accent)]')
  push(mother, 'font-normal text-[var(--cr-text-secondary)]')

  if (layers.length === 0) return null
  return (
    <span data-layered="true" className="mt-1 block space-y-0.5">
      {layers.map((layer, index) => (
        <span
          key={`${layer.key}-${index}`}
          data-layer={index}
          className={`${LAYER_LINE} ${layer.className}`}
        >
          {highlightWord ? (
            <HighlightedText text={layer.value} word={highlightWord} onOpenWord={onOpenWord} />
          ) : (
            layer.value
          )}
        </span>
      ))}
    </span>
  )
}
