import { useState } from 'react'
import { Link } from 'react-router'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Building2, Check, KeyRound, Mail, Phone, UserCheck, UserPlus, Users, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { adminApi } from '../../lib/endpoints'
import { timeAgo } from '../../lib/format'
import { useDebounced } from '../../lib/useDebounced'
import { Avatar, Badge, Button, Card, EmptyState, Field, FormError, Modal, PageHeader, QueryView, SearchInput, Select, Tabs, Textarea } from '../../components/ui'
import { ApprovalBadge, RoleBadge } from '../../components/badges'
import CreateUserModal from './CreateUserModal'
import RoleSelect from './RoleSelect'
import ResetPasswordModal from './ResetPasswordModal'

export default function ApprovalsPage() {
  const [tab, setTab] = useState('pending')
  const [creating, setCreating] = useState(false)
  const pending = useQuery({ queryKey: ['users', 'registrations', 'PENDING'], queryFn: () => adminApi.registrations('PENDING') })

  return (
    <div>
      <PageHeader
        title="Users & approvals"
        description="Review new registrations and manage account access."
        actions={
          <Button icon={UserPlus} onClick={() => setCreating(true)}>
            Add user
          </Button>
        }
      />
      <Tabs
        tabs={[
          { value: 'pending', label: 'Pending approval', count: pending.data?.length },
          { value: 'all', label: 'All users' },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-5 w-fit"
      />
      {tab === 'pending' ? <PendingList query={pending} /> : <AllUsers />}
      <CreateUserModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

function PendingList({ query }) {
  const queryClient = useQueryClient()
  const [rejecting, setRejecting] = useState(null)
  const invalidate = () => ['users', 'dashboard', 'employees'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }))

  const approve = useMutation({
    mutationFn: (u) => adminApi.approve(u.id),
    onSuccess: (_, u) => {
      toast.success(`${u.full_name || u.email} approved`)
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <>
    <QueryView query={query}>
      {(list) =>
        list.length === 0 ? (
          <Card>
            <EmptyState icon={UserCheck} title="No pending registrations" description="New sign-ups will appear here for review." />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {list.map((u) => (
              <Card key={u.id}>
                <div className="flex items-start gap-3">
                  <Avatar name={u.full_name || u.email} src={u.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{u.full_name}</p>
                    <p className="text-sm text-slate-500">{u.job_position}</p>
                  </div>
                  <Badge tone="amber">{timeAgo(u.created_at)}</Badge>
                </div>
                <dl className="mt-4 space-y-1.5 text-sm text-slate-600">
                  <p className="flex items-center gap-2">
                    <Mail className="size-4 text-slate-400" /> {u.email}
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="size-4 text-slate-400" /> {u.phone_number || '—'}
                  </p>
                  <p className="flex items-center gap-2">
                    <Building2 className="size-4 text-slate-400" /> {u.department_name || 'No department'} · <span className="font-mono text-xs">{u.employee_code}</span>
                  </p>
                </dl>
                <div className="mt-5 flex gap-2">
                  <Button variant="success" icon={Check} className="flex-1" loading={approve.isPending && approve.variables?.id === u.id} onClick={() => approve.mutate(u)}>
                    Approve
                  </Button>
                  <Button variant="secondary" icon={X} className="flex-1" onClick={() => setRejecting(u)}>
                    Reject
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )
      }
    </QueryView>
    <RejectModal user={rejecting} onClose={() => setRejecting(null)} onDone={invalidate} />
    </>
  )
}

function AllUsers() {
  const { user: me, isSuperAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [role, setRole] = useState('')
  const [resetting, setResetting] = useState(null)
  const debounced = useDebounced(search)
  const params = { search: debounced || undefined, status: status || undefined, role: role || undefined }
  const query = useQuery({ queryKey: ['users', 'all', params], queryFn: () => adminApi.users(params), placeholderData: keepPreviousData })

  const toggle = useMutation({
    mutationFn: (u) => adminApi.setActive(u.id, !u.is_active),
    onSuccess: (res) => {
      toast.success(res.message)
      ;['users', 'employees', 'dashboard'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }))
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, email or code…" className="sm:max-w-sm sm:flex-1" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44" aria-label="Approval status">
          <option value="">Any status</option>
          <option value="APPROVED">Approved</option>
          <option value="PENDING">Pending</option>
          <option value="REJECTED">Rejected</option>
        </Select>
        <Select value={role} onChange={(e) => setRole(e.target.value)} className="sm:w-44" aria-label="Role">
          <option value="">Any role</option>
          <option value="EMPLOYEE">Employee</option>
          <option value="ADMIN">Admin</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </Select>
      </div>
      <QueryView query={query}>
        {(users) =>
          users.length === 0 ? (
            <Card>
              <EmptyState icon={Users} title="No users match" />
            </Card>
          ) : (
            <Card padded={false} className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Department</th>
                      <th>Joined</th>
                      <th className="text-right">Access</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => {
                      const canManage = u.id !== me?.id && (u.role !== 'SUPER_ADMIN' || isSuperAdmin)
                      return (
                        <tr key={u.id}>
                          <td>
                            <div className="flex items-center gap-3">
                              <Avatar name={u.full_name || u.email} src={u.avatar_url} size="sm" className={u.is_active ? '' : 'opacity-50'} />
                              <div className="min-w-0">
                                {u.employee_id ? (
                                  <Link to={`/app/employees/${u.employee_id}`} className="block truncate font-semibold text-slate-900 hover:text-brand-700">
                                    {u.full_name || u.email}
                                  </Link>
                                ) : (
                                  <p className="truncate font-semibold text-slate-900">{u.email}</p>
                                )}
                                <p className="truncate text-xs text-slate-500">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td>
                            {isSuperAdmin && canManage && u.approval_status === 'APPROVED' ? (
                              <RoleSelect user={u} className="w-36 py-1.5" />
                            ) : (
                              <RoleBadge role={u.role} />
                            )}
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-1.5">
                              <ApprovalBadge status={u.approval_status} />
                              {!u.is_active && <Badge tone="red">Inactive</Badge>}
                            </div>
                          </td>
                          <td className="text-slate-600">{u.department_name || '—'}</td>
                          <td className="whitespace-nowrap text-slate-500">{timeAgo(u.created_at)}</td>
                          <td className="text-right">
                            {canManage && (
                              <div className="flex justify-end gap-1">
                                {u.approval_status === 'APPROVED' && (
                                  <Button size="xs" variant="ghost" icon={KeyRound} onClick={() => setResetting(u)}>
                                    Reset password
                                  </Button>
                                )}
                                <Button size="xs" variant={u.is_active ? 'danger-ghost' : 'secondary'} onClick={() => toggle.mutate(u)}>
                                  {u.is_active ? 'Deactivate' : 'Activate'}
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )
        }
      </QueryView>
      <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} />
    </div>
  )
}

function RejectModal({ user, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const mutation = useMutation({
    mutationFn: () => adminApi.reject(user.id, reason.trim() || undefined),
    onSuccess: () => {
      toast.success('Registration rejected')
      setReason('')
      onDone()
      onClose()
    },
  })
  if (!user) return null
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Reject registration"
      description={`${user.full_name} (${user.email})`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Reject
          </Button>
        </>
      }
    >
      <FormError error={mutation.error} />
      <Field label="Reason (shown to the applicant at sign-in)">
        {(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />}
      </Field>
    </Modal>
  )
}
