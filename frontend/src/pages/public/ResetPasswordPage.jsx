import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeft, Lock, ShieldAlert } from 'lucide-react'
import { authApi } from '../../lib/endpoints'
import { Button, Field, FormError, Input } from '../../components/ui'
import AuthShell from './AuthShell'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()
  const [pw, setPw] = useState({ newPassword: '', confirm: '' })
  const mismatch = pw.confirm && pw.confirm !== pw.newPassword
  const validLink = /^[a-f0-9]{64}$/.test(token)

  const reset = useMutation({
    mutationFn: () => authApi.resetPassword(token, pw.newPassword),
    onSuccess: (res) => {
      toast.success(res.message)
      navigate('/login', { replace: true })
    },
  })

  const footer = (
    <Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:text-brand-700">
      <ArrowLeft className="size-4" /> Back to sign in
    </Link>
  )

  if (!validLink) {
    return (
      <AuthShell title="Invalid reset link" subtitle="This link is incomplete or has been mistyped." footer={footer}>
        <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" />
          <p>
            Open the link from the e-mail again, or{' '}
            <Link to="/forgot-password" className="font-semibold underline">
              request a new one
            </Link>
            .
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Choose a new password" subtitle="After saving, every device signed in to your account is signed out." footer={footer}>
      <form
        className="space-y-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          reset.mutate()
        }}
      >
        <FormError error={reset.error} />
        {reset.error?.status === 400 && (
          <p className="text-sm text-slate-600">
            <Link to="/forgot-password" className="font-semibold text-brand-600 hover:text-brand-700">
              Request a new link
            </Link>
          </p>
        )}
        <Field label="New password" hint="At least 6 characters" required>
          {(id) => (
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                value={pw.newPassword}
                onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
                className="pl-9"
                autoFocus
              />
            </div>
          )}
        </Field>
        <Field label="Confirm new password" error={mismatch ? 'Passwords do not match' : undefined} required>
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              value={pw.confirm}
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              error={mismatch}
            />
          )}
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={reset.isPending} disabled={pw.newPassword.length < 6 || pw.confirm !== pw.newPassword}>
          Update password
        </Button>
      </form>
    </AuthShell>
  )
}
