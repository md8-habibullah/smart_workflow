/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import clsx from 'clsx'
import { twMerge } from 'tailwind-merge'
import { AlertTriangle, ArrowLeft, Inbox, Loader2, RefreshCw, Search, X } from 'lucide-react'
import { initials } from '../lib/format'

/** clsx + tailwind-merge: later classes (e.g. a className override) win over defaults. */
export const cn = (...inputs) => twMerge(clsx(inputs))

// ------------------------------------------------------------------ tones

const TONES = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-500/15',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/15',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/15',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/15',
  brand: 'bg-brand-50 text-brand-700 ring-brand-600/20',
}

const DOTS = {
  slate: 'bg-slate-400',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  violet: 'bg-violet-500',
  green: 'bg-emerald-500',
  red: 'bg-red-500',
  brand: 'bg-brand-500',
}

const BARS = {
  slate: 'bg-slate-400',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  violet: 'bg-violet-500',
  green: 'bg-emerald-500',
  red: 'bg-red-500',
  brand: 'bg-brand-500',
}

export function Badge({ tone = 'slate', dot = false, className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset',
        TONES[tone] || TONES.slate,
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', DOTS[tone] || DOTS.slate)} />}
      {children}
    </span>
  )
}

// ------------------------------------------------------------------ buttons

const VARIANTS = {
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800',
  secondary: 'bg-white text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
  'danger-ghost': 'text-red-600 hover:bg-red-50',
  dark: 'bg-slate-900 text-white shadow-sm hover:bg-slate-800',
  success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700',
}

const SIZES = {
  xs: 'h-7 px-2.5 text-xs gap-1',
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  iconRight: IconRight,
  to,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}) {
  const classes = cn(
    'inline-flex shrink-0 items-center justify-center rounded-lg font-semibold transition-colors',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    className,
  )
  const content = (
    <>
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon && <Icon className="size-4" />}
      {children}
      {IconRight && !loading && <IconRight className="size-4" />}
    </>
  )
  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {content}
      </Link>
    )
  }
  return (
    <button type={type} className={classes} disabled={disabled || loading} {...props}>
      {content}
    </button>
  )
}

export function IconButton({ icon: Icon, label, className, variant = 'ghost', ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-lg transition-colors disabled:opacity-50',
        variant === 'ghost' && 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
        variant === 'danger' && 'text-slate-400 hover:bg-red-50 hover:text-red-600',
        className,
      )}
      {...props}
    >
      <Icon className="size-[18px]" />
    </button>
  )
}

// ------------------------------------------------------------------ layout pieces

export function Card({ className, children, padded = true, ...props }) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white shadow-sm', padded && 'p-5', className)} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ title, description, action, icon: Icon, className }) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Icon className="size-[18px]" />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function PageHeader({ title, description, actions, back, children }) {
  return (
    <div className="mb-6">
      {back && (
        <Link
          to={back.to}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500 sm:text-base">{description}</p>}
          {children}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

export function StatCard({ label, value, icon: Icon, tone = 'brand', hint, to }) {
  const iconTone = {
    brand: 'bg-brand-50 text-brand-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    violet: 'bg-violet-50 text-violet-600',
    slate: 'bg-slate-100 text-slate-600',
  }[tone]
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums sm:text-3xl">{value}</p>
        {hint && <p className="mt-1 truncate text-xs text-slate-500">{hint}</p>}
      </div>
      {Icon && (
        <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', iconTone)}>
          <Icon className="size-5" />
        </div>
      )}
    </div>
  )
  if (to) {
    return (
      <Link
        to={to}
        className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
      >
        {body}
      </Link>
    )
  }
  return <Card>{body}</Card>
}

export function Avatar({ name, src, size = 'md', className }) {
  const palette = ['bg-brand-500', 'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-rose-500', 'bg-amber-500', 'bg-teal-500']
  const hash = [...(name || '?')].reduce((h, c) => h + c.charCodeAt(0), 0)
  const sizes = { xs: 'size-6 text-[10px]', sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg', xl: 'size-20 text-2xl' }
  const [failedSrc, setFailedSrc] = useState(null)
  if (src && failedSrc !== src) {
    return (
      <img
        src={src}
        alt={name || ''}
        onError={() => setFailedSrc(src)}
        className={cn('inline-block shrink-0 rounded-full bg-slate-100 object-cover', sizes[size], className)}
      />
    )
  }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        palette[hash % palette.length],
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}

export function ProgressBar({ value = 0, tone = 'brand', className, showLabel = false }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={cn('h-full rounded-full transition-all duration-500', BARS[tone] || BARS.brand)} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <span className="w-10 text-right text-xs font-semibold text-slate-600 tabular-nums">{Math.round(Number(value) || 0)}%</span>}
    </div>
  )
}

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cn('flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 scroll-thin', className)} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition',
            value === tab.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800',
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                'rounded-full px-1.5 text-xs tabular-nums',
                value === tab.value ? 'bg-brand-100 text-brand-700' : 'bg-slate-200 text-slate-600',
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ form controls

export function Field({ label, error, hint, required, children, className }) {
  const id = useId()
  const child = typeof children === 'function' ? children(id) : children
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
          {required && <span aria-hidden="true" className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {child}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  )
}

export function Input({ className, error, ...props }) {
  return <input className={cn('input', error && 'input-error', className)} {...props} />
}

export function Textarea({ className, error, rows = 3, ...props }) {
  return <textarea rows={rows} className={cn('input resize-y', error && 'input-error', className)} {...props} />
}

export function Select({ className, error, children, ...props }) {
  return (
    <select className={cn('input pr-8', error && 'input-error', className)} {...props}>
      {children}
    </select>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-9"
      />
    </div>
  )
}

export function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-brand-600' : 'bg-slate-300',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-4',
          )}
        />
      </button>
      <span>
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </span>
    </label>
  )
}

/** Small helper so forms can surface API validation errors next to the submit button. */
export function FormError({ error }) {
  if (!error) return null
  return (
    <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium">{error.message}</p>
        {error.details?.length > 1 && (
          <ul className="mt-1 list-disc pl-4 text-xs">
            {error.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ feedback states

export function Spinner({ className }) {
  return <Loader2 className={cn('size-5 animate-spin text-brand-600', className)} />
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-slate-500">
      <Spinner className="size-7" />
      {label}
    </div>
  )
}

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-lg bg-slate-200/70', className)} />
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon className="size-6" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
        <AlertTriangle className="size-6" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">Something went wrong</h3>
      <p className="mt-1 max-w-md text-sm text-slate-500">{error?.message || 'Unexpected error.'}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RefreshCw} className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

/** Renders loading / error / content for a react-query result. */
export function QueryView({ query, children, loader }) {
  if (query.isPending) return loader ?? <PageLoader />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  return children(query.data)
}

// ------------------------------------------------------------------ overlays

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const panelRef = useRef(null)
  // Callers usually pass an inline onClose; keep the latest one without re-running the effect.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current?.()
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Focus the first form control (skip the header close button).
    const first = panelRef.current?.querySelector('[data-modal-body] input, [data-modal-body] select, [data-modal-body] textarea')
    first?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) return null

  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panelRef}
        className={cn(
          'relative flex max-h-[92vh] w-full animate-pop-in flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl',
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <IconButton icon={X} label="Close" onClick={onClose} className="-mr-2" />
        </div>
        <div data-modal-body className="overflow-y-auto px-6 py-5">
          {children}
        </div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4 sm:rounded-b-2xl">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/**
 * Promise-based confirmation dialog.
 *   const [confirm, confirmDialog] = useConfirm()
 *   if (await confirm({ title, message, tone: 'danger' })) { ... }
 *   return <>{confirmDialog}...</>
 */
export function useConfirm() {
  const [state, setState] = useState(null)

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        setState({ ...options, resolve })
      }),
    [],
  )

  const close = (result) => {
    state?.resolve(result)
    setState(null)
  }

  const dialog = (
    <Modal
      open={Boolean(state)}
      onClose={() => close(false)}
      title={state?.title || 'Are you sure?'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            {state?.cancelLabel || 'Cancel'}
          </Button>
          <Button variant={state?.tone === 'danger' ? 'danger' : 'primary'} onClick={() => close(true)}>
            {state?.confirmLabel || 'Confirm'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{state?.message}</p>
    </Modal>
  )

  return [confirm, dialog]
}
