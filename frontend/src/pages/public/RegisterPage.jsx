import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Hourglass } from 'lucide-react'
import { authApi } from '../../lib/endpoints'
import { Button, Field, FormError, Input, Select } from '../../components/ui'
import AuthShell from './AuthShell'

const EMPTY = {
  fullName: '',
  email: '',
  jobPosition: '',
  departmentId: '',
  phoneNumber: '',
  password: '',
  confirmPassword: '',
}

/** Client-side checks mirror the backend Zod schema so users get instant feedback. */
const validate = (f) => {
  const errors = {}
  if (f.fullName.trim().length < 2) errors.fullName = 'Enter your full name'
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) errors.email = 'Enter a valid email address'
  if (f.jobPosition.trim().length < 2) errors.jobPosition = 'Enter your role or position'
  if (f.password.length < 6) errors.password = 'At least 6 characters'
  if (f.confirmPassword !== f.password) errors.confirmPassword = 'Passwords do not match'
  return errors
}

export default function RegisterPage() {
  const [form, setForm] = useState(EMPTY)
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  const departments = useQuery({ queryKey: ['departments', 'public'], queryFn: authApi.publicDepartments })
  const errors = touched ? validate(form) : {}
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setTouched(true)
    if (Object.keys(validate(form)).length) return
    setSubmitting(true)
    setError(null)
    try {
      const { data } = await authApi.register({
        ...form,
        departmentId: form.departmentId ? Number(form.departmentId) : null,
        category: departments.data?.find((d) => String(d.id) === form.departmentId)?.name,
        phoneNumber: form.phoneNumber || null,
      })
      setDone(data)
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <AuthShell title="Registration received">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <Hourglass className="size-8 text-amber-600" />
          <p className="mt-4 font-semibold text-amber-900">Your account is pending approval</p>
          <p className="mt-1 text-sm text-amber-800">
            Thanks, {form.fullName.split(' ')[0]}! Your employee ID is <strong>{done.employeeCode}</strong>. An
            administrator will review your registration; you can sign in once it&apos;s approved.
          </p>
        </div>
        <Button to="/login" size="lg" className="mt-6 w-full">
          Back to sign in
        </Button>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Register as a team member. An administrator will approve your access."
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError error={error} />
        <Field label="Full name" required error={errors.fullName}>
          {(id) => <Input id={id} value={form.fullName} onChange={set('fullName')} autoComplete="name" error={errors.fullName} />}
        </Field>
        <Field label="Email address" required error={errors.email}>
          {(id) => <Input id={id} type="email" value={form.email} onChange={set('email')} autoComplete="email" error={errors.email} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Job position" required error={errors.jobPosition}>
            {(id) => (
              <Input id={id} value={form.jobPosition} onChange={set('jobPosition')} placeholder="e.g. Backend Developer" error={errors.jobPosition} />
            )}
          </Field>
          <Field label="Department">
            {(id) => (
              <Select id={id} value={form.departmentId} onChange={set('departmentId')} disabled={departments.isPending}>
                <option value="">Select department…</option>
                {departments.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Phone number">
          {(id) => <Input id={id} type="tel" value={form.phoneNumber} onChange={set('phoneNumber')} placeholder="+8801…" autoComplete="tel" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" required error={errors.password}>
            {(id) => <Input id={id} type="password" value={form.password} onChange={set('password')} autoComplete="new-password" error={errors.password} />}
          </Field>
          <Field label="Confirm password" required error={errors.confirmPassword}>
            {(id) => (
              <Input id={id} type="password" value={form.confirmPassword} onChange={set('confirmPassword')} autoComplete="new-password" error={errors.confirmPassword} />
            )}
          </Field>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          Create account
        </Button>
      </form>
    </AuthShell>
  )
}
