/* eslint-disable react-refresh/only-export-components */
import { useId } from 'react'
import { WandSparkles } from 'lucide-react'
import { cn } from './ui'

/*
 * The "the algorithm did this" marker. Use it ONLY where the allocation engine
 * makes or suggests a decision (best match, auto-assign, auto-allocate, its
 * confidence, AUTO_ASSIGNED history) — never as decoration, so it stays meaningful.
 */

export const MAGIC_TITLE = 'Chosen by the allocation engine'

/** Gradient applied to filled controls that trigger an automatic decision (pairs with <MagicIcon solid />). */
export const magicButtonClass =
  'bg-linear-to-r from-brand-600 to-teal-600 hover:from-brand-700 hover:to-teal-700 active:from-brand-800 active:to-teal-800'

/** Soft gradient chip behind a MagicIcon in timelines/feeds. */
export const magicChipClass = 'bg-linear-to-br from-brand-50 to-teal-50 ring-1 ring-inset ring-teal-600/15'

/**
 * The wand glyph. Drawn with a brand-green → teal gradient on light surfaces;
 * `solid` uses the current text colour (for filled/gradient buttons).
 * Works as an `icon` prop for Button.
 */
export function MagicIcon({ className, solid = false, ...props }) {
  const gradientId = `magic-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <WandSparkles
      aria-hidden="true"
      className={cn('size-4 shrink-0', className)}
      stroke={solid ? 'currentColor' : `url(#${gradientId})`}
      {...props}
    >
      {!solid && (
        <defs>
          <linearGradient id={gradientId} x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
            <stop offset="0" style={{ stopColor: 'var(--color-brand-600, #039855)' }} />
            <stop offset="1" style={{ stopColor: 'var(--color-teal-600, #0d9488)' }} />
          </linearGradient>
        </defs>
      )}
    </WandSparkles>
  )
}

/** Current-colour wand for filled buttons: <Button icon={MagicIconSolid} className={magicButtonClass}>. */
export const MagicIconSolid = (props) => <MagicIcon solid {...props} />

/** Icon-only marker with a tooltip and a screen-reader label. */
export function MagicMark({ title = MAGIC_TITLE, className }) {
  return (
    <span title={title} className={cn('inline-flex items-center', className)}>
      <MagicIcon className="size-3.5" />
      <span className="sr-only">{title}</span>
    </span>
  )
}

/** Pill for an engine verdict, e.g. <MagicBadge>Best match</MagicBadge>. */
export function MagicBadge({ children, title = MAGIC_TITLE, className }) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-brand-800',
        magicChipClass,
        className,
      )}
    >
      <MagicIcon className="size-3" />
      {children}
      <span className="sr-only">({title})</span>
    </span>
  )
}
