import { useState } from 'react'
import { useNavigate } from 'react-router'
import toast from 'react-hot-toast'
import { Check, Copy, KeyRound, LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../lib/demo'
import { Avatar, Badge, Button, cn } from './ui'

const ROLE_TONE = { 'Super Admin': 'violet', Admin: 'blue', Employee: 'green' }

function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      toast.error('Copy not available in this browser')
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
      className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
    >
      {copied ? <Check className="size-3.5 text-brand-600" /> : <Copy className="size-3.5" />}
    </button>
  )
}

/**
 * Lists the seeded demo accounts with copyable credentials and one-click sign-in.
 * `compact` renders a tighter list for the login page.
 */
export default function DemoAccounts({ compact = false, className }) {
  const { login, status } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(null)

  const signIn = async (email) => {
    setBusy(email)
    try {
      if (status === 'authenticated') {
        toast('You are already signed in. Sign out first to switch accounts.')
        navigate('/app')
        return
      }
      await login(email, DEMO_PASSWORD)
      navigate('/app')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={cn('overflow-hidden rounded-2xl border border-slate-200 bg-white', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Demo accounts</p>
        <span className="flex items-center gap-1.5 rounded-md bg-white px-2 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
          <KeyRound className="size-3.5 text-slate-400" />
          Password: <code className="font-semibold text-slate-900">{DEMO_PASSWORD}</code>
          <CopyButton value={DEMO_PASSWORD} label="password" />
        </span>
      </div>
      <ul className="divide-y divide-slate-100">
        {(compact ? DEMO_ACCOUNTS.slice(0, 3) : DEMO_ACCOUNTS).map((a) => (
          <li key={a.email} className="flex items-center gap-3 px-4 py-3">
            {!compact && <Avatar name={a.name} size="sm" />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={ROLE_TONE[a.role]}>{a.role}</Badge>
                {!compact && <span className="text-sm font-semibold text-slate-900">{a.name}</span>}
              </div>
              <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-500">
                <span className="truncate font-mono">{a.email}</span>
                <CopyButton value={a.email} label={`${a.role} email`} />
              </p>
              {!compact && <p className="mt-0.5 text-xs text-slate-500">{a.description}</p>}
            </div>
            <Button size="sm" variant="secondary" icon={LogIn} loading={busy === a.email} disabled={Boolean(busy)} onClick={() => signIn(a.email)}>
              Sign in
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
