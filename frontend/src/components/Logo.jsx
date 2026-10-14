import { Link } from 'react-router'
import { cn } from './ui'

/** Brand mark: a check inside a rounded square, meaning "the right person, done right". */
export function LogoMark({ className }) {
  return (
    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 shadow-sm ring-1 ring-white/10', className)}>
      <svg viewBox="0 0 32 32" className="size-5" aria-hidden="true">
        <path d="M8 17.5 13.5 23 24 10" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

export default function Logo({ to = '/', dark = false, subtitle = true, className }) {
  return (
    <Link to={to} className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="leading-tight">
        <span className={cn('block text-[15px] font-bold tracking-tight', dark ? 'text-white' : 'text-slate-900')}>Smart Workforce</span>
        {subtitle && (
          <span className={cn('block text-[11px] font-medium', dark ? 'text-brand-100/60' : 'text-slate-500')}>Task Allocation System</span>
        )}
      </span>
    </Link>
  )
}
