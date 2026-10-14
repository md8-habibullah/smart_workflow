import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Eye, EyeOff, Hourglass, Lock, Mail } from 'lucide-react'
import DemoAccounts from '../../components/DemoAccounts'
import { useAuth } from '../../context/AuthContext'
import { Button, Field, FormError, Input } from '../../components/ui'
import AuthShell from './AuthShell'


export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const pending = error?.status === 403 && error.details?.includes('PENDING')

  const submit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(form.email.trim(), form.password)
      navigate(location.state?.from || '/app', { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage and track your team's work."
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        {pending ? (
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <Hourglass className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold">Your account is awaiting approval</p>
              <p className="mt-0.5">An administrator needs to approve your registration before you can sign in.</p>
            </div>
          </div>
        ) : (
          <FormError error={error} />
        )}

        <Field label="Email address" required>
          {(id) => (
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                id={id}
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@university.edu"
                className="pl-9"
              />
            </div>
          )}
        </Field>

        <Field label="Password" required>
          {(id) => (
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                id={id}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                className="pr-10 pl-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          )}
        </Field>

        <div className="-mt-2 flex justify-end">
          <Link to="/forgot-password" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={submitting} disabled={!form.email || !form.password}>
          Sign in
        </Button>
      </form>

      <div className="my-8 flex items-center gap-3 text-xs font-medium text-slate-400">
        <span className="h-px flex-1 bg-slate-200" /> or try a demo account <span className="h-px flex-1 bg-slate-200" />
      </div>
      <DemoAccounts compact />
    </AuthShell>
  )
}
