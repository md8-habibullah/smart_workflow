import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Briefcase, Building2, KeyRound, Mail, Save, Award, UserCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../lib/endpoints'
import { tokenStore } from '../lib/api'
import { Button, Card, CardHeader, Field, FormError, Input, PageHeader } from '../components/ui'
import { RoleBadge } from '../components/badges'
import SkillsEditor from '../components/SkillsEditor'
import AvatarUploader from '../components/AvatarUploader'

export default function ProfilePage() {
  const { user, refreshUser, displayName } = useAuth()
  const employee = user?.employee

  const [profile, setProfile] = useState({ fullName: employee?.fullName || '', phoneNumber: employee?.phoneNumber || '' })
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })

  const saveProfile = useMutation({
    mutationFn: () => authApi.updateProfile({ fullName: profile.fullName.trim(), phoneNumber: profile.phoneNumber.trim() || null }),
    onSuccess: async () => {
      await refreshUser()
      toast.success('Profile updated')
    },
  })

  const changePassword = useMutation({
    mutationFn: () => authApi.changePassword(pw),
    onSuccess: (res) => {
      // The server revokes older sessions and returns a fresh token for this one.
      if (res.data?.token) tokenStore.set(res.data.token)
      toast.success(res.message || 'Password changed')
      setPw({ currentPassword: '', newPassword: '', confirmPassword: '' })
    },
  })

  const pwMismatch = pw.confirmPassword && pw.newPassword !== pw.confirmPassword

  return (
    <div>
      <PageHeader title="My profile" description="Your account details, skills and security settings." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col items-center text-center">
              <AvatarUploader />
              <p className="mt-4 text-lg font-semibold text-slate-900">{displayName}</p>
              <p className="text-sm text-slate-500">{employee?.position}</p>
              <div className="mt-3">
                <RoleBadge role={user?.role} />
              </div>
            </div>
            <dl className="mt-6 space-y-3 border-t border-slate-100 pt-5 text-sm text-slate-600">
              <p className="flex items-center gap-3">
                <Mail className="size-4 text-slate-400" /> {user?.email}
              </p>
              {employee && (
                <>
                  <p className="flex items-center gap-3">
                    <Briefcase className="size-4 text-slate-400" /> <span className="font-mono text-xs">{employee.code}</span>
                  </p>
                  <p className="flex items-center gap-3">
                    <Building2 className="size-4 text-slate-400" /> {employee.departmentName || 'No department'}
                  </p>
                </>
              )}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Change password" icon={KeyRound} />
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                changePassword.mutate()
              }}
            >
              <FormError error={changePassword.error} />
              <Field label="Current password">
                {(id) => <Input id={id} type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />}
              </Field>
              <Field label="New password" hint="At least 6 characters">
                {(id) => <Input id={id} type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />}
              </Field>
              <Field label="Confirm new password" error={pwMismatch ? 'Passwords do not match' : undefined}>
                {(id) => (
                  <Input id={id} type="password" autoComplete="new-password" value={pw.confirmPassword} onChange={(e) => setPw({ ...pw, confirmPassword: e.target.value })} error={pwMismatch} />
                )}
              </Field>
              <Button
                type="submit"
                variant="dark"
                className="w-full"
                loading={changePassword.isPending}
                disabled={!pw.currentPassword || pw.newPassword.length < 6 || pw.newPassword !== pw.confirmPassword}
              >
                Update password
              </Button>
            </form>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {employee && (
            <Card>
              <CardHeader title="Personal details" icon={UserCircle} />
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  saveProfile.mutate()
                }}
              >
                <FormError error={saveProfile.error} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name">
                    {(id) => <Input id={id} value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} />}
                  </Field>
                  <Field label="Phone number">
                    {(id) => <Input id={id} value={profile.phoneNumber} onChange={(e) => setProfile({ ...profile, phoneNumber: e.target.value })} />}
                  </Field>
                  <Field label="Job position" hint="Managed by an administrator">
                    {(id) => <Input id={id} value={employee.position} disabled />}
                  </Field>
                  <Field label="Daily capacity" hint="Managed by an administrator">
                    {(id) => <Input id={id} value={`${employee.dailyCapacityHours} hours`} disabled />}
                  </Field>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" icon={Save} loading={saveProfile.isPending} disabled={profile.fullName.trim().length < 2}>
                    Save changes
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {employee && (
            <Card>
              <CardHeader title="My skills" description="Keep these accurate: they decide which tasks you're matched to." icon={Award} />
              <SkillsEditor employeeId={employee.id} />
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
