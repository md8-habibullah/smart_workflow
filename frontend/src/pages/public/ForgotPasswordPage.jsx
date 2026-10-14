import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Info, Mail, MailCheck } from 'lucide-react'
import { authApi } from '../../lib/endpoints'
import { Button, Field, FormError, Input } from '../../components/ui'
import AuthShell from './AuthShell'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const options = useQuery({ queryKey: ['auth-options'], queryFn: authApi.options, staleTime: 60_000 })
  const send = useMutation({ mutationFn: () => authApi.forgotPassword(email.trim()) })
  const unavailable = options.data && !options.data.passwordResetByEmail

  const backToLogin = (
    <Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:text-brand-700">
      <ArrowLeft className="size-4" /> Back to sign in
    </Link>
  )

  if (send.isSuccess) {
    return (
      <AuthShell title="Check your inbox" subtitle={send.data.message} footer={backToLogin}>
        <div className="flex gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-brand-600" />
          <div>
            <p className="font-semibold">Reset link sent to {email}</p>
            <p className="mt-1 text-brand-800/80">
              The link works once and expires in 30 minutes. Didn&apos;t get it? Check spam, or{' '}
              <button type="button" className="font-semibold underline" onClick={() => send.reset()}>
                try again
              </button>
              .
            </p>
          </div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your account e-mail and we'll send you a link to choose a new one." footer={backToLogin}>
      {unavailable ? (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Info className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">E-mail isn&apos;t set up yet</p>
            <p className="mt-1">
              Self-service reset needs the super admin to configure e-mail. Meanwhile, ask an administrator to reset your password from
              <span className="font-medium"> Users &amp; Approvals</span>.
            </p>
          </div>
        </div>
      ) : (
        <form
          className="space-y-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            send.mutate()
          }}
        >
          <FormError error={send.error} />
          <Field label="Email address" required>
            {(id) => (
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id={id}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@university.edu"
                  className="pl-9"
                  autoFocus
                />
              </div>
            )}
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={send.isPending} disabled={!email.includes('@')}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
