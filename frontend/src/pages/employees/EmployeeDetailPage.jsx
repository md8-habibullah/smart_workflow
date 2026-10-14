import { useState } from 'react'
import { useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Briefcase, Building2, Clock, KeyRound, ListTodo, Mail, Pencil, Phone, Power, Award, Timer } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { adminApi, departmentsApi, employeesApi } from '../../lib/endpoints'
import { formatDate, hours, workloadTone } from '../../lib/format'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  FormError,
  Input,
  Modal,
  PageHeader,
  ProgressBar,
  QueryView,
  Select,
  useConfirm,
} from '../../components/ui'
import { ApprovalBadge, RoleBadge } from '../../components/badges'
import TaskCard from '../../components/TaskCard'
import SkillsEditor from '../../components/SkillsEditor'
import RoleSelect from '../admin/RoleSelect'
import ResetPasswordModal from '../admin/ResetPasswordModal'

export default function EmployeeDetailPage() {
  const { id } = useParams()
  const query = useQuery({ queryKey: ['employee', id], queryFn: () => employeesApi.get(id) })
  return <QueryView query={query}>{(employee) => <EmployeeDetail employee={employee} />}</QueryView>
}

function EmployeeDetail({ employee }) {
  const { user, isSuperAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [confirm, confirmDialog] = useConfirm()
  const [showAll, setShowAll] = useState(false)
  const [resetting, setResetting] = useState(false)

  const active = employee.is_active && employee.user_active
  const isSelf = user?.id === employee.user_id
  const canManageAccount = !isSelf && (employee.role !== 'SUPER_ADMIN' || isSuperAdmin)
  const openTasks = employee.tasks.filter((t) => !['COMPLETED', 'CANCELLED'].includes(t.status))
  const closedTasks = employee.tasks.filter((t) => ['COMPLETED', 'CANCELLED'].includes(t.status))

  const invalidate = () => ['employee', 'employees', 'dashboard', 'users'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }))

  const toggleActive = useMutation({
    mutationFn: () => adminApi.setActive(employee.user_id, !active),
    onSuccess: (res) => {
      toast.success(res.message)
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })


  const onToggle = async () => {
    const ok = await confirm({
      title: active ? 'Deactivate account?' : 'Reactivate account?',
      message: active
        ? `${employee.full_name} will be signed out immediately and excluded from allocation.`
        : `${employee.full_name} will be able to sign in and receive tasks again.`,
      confirmLabel: active ? 'Deactivate' : 'Reactivate',
      tone: active ? 'danger' : 'primary',
    })
    if (ok) toggleActive.mutate()
  }

  return (
    <div>
      {confirmDialog}
      <PageHeader back={{ to: '/app/employees', label: 'All employees' }} title={employee.full_name} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col items-center text-center">
              <Avatar name={employee.full_name} src={employee.avatar_url} size="xl" className={active ? '' : 'opacity-50'} />
              <p className="mt-3 text-lg font-semibold text-slate-900">{employee.full_name}</p>
              <p className="text-sm text-slate-500">{employee.job_position}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <RoleBadge role={employee.role} />
                <ApprovalBadge status={employee.approval_status} />
                {!active && <Badge tone="red">Inactive</Badge>}
              </div>
            </div>
            <dl className="mt-6 space-y-3 border-t border-slate-100 pt-5 text-sm">
              <InfoRow icon={Briefcase} value={employee.employee_code} mono />
              <InfoRow icon={Mail} value={employee.email} />
              <InfoRow icon={Phone} value={employee.phone_number || '—'} />
              <InfoRow icon={Building2} value={employee.department_name || 'No department'} />
              <InfoRow icon={Clock} value={`${employee.daily_capacity_hours}h / day capacity`} />
            </dl>
            <div className="mt-5 flex flex-col gap-2">
              <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
                Edit profile
              </Button>
              {canManageAccount && (
                <Button variant={active ? 'danger-ghost' : 'secondary'} icon={Power} onClick={onToggle} loading={toggleActive.isPending}>
                  {active ? 'Deactivate account' : 'Reactivate account'}
                </Button>
              )}
            </div>
            {canManageAccount && employee.approval_status === 'APPROVED' && (
              <Button variant="ghost" icon={KeyRound} className="mt-2 w-full" onClick={() => setResetting(true)}>
                Reset password
              </Button>
            )}
            {isSuperAdmin && canManageAccount && employee.approval_status === 'APPROVED' && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="mb-1.5 text-sm font-medium text-slate-700">Role</p>
                <RoleSelect user={{ id: employee.user_id, role: employee.role, full_name: employee.full_name, email: employee.email }} />
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Workload" icon={Timer} />
            <div className="flex items-end justify-between">
              <p className="text-3xl font-bold text-slate-900">{employee.workload_percentage}%</p>
              <p className="text-sm text-slate-500">
                {hours(employee.outstanding_hours)} / {hours(employee.weekly_capacity_hours)}
              </p>
            </div>
            <ProgressBar value={employee.workload_percentage} tone={workloadTone(employee.workload_percentage)} className="mt-3" />
            <p className="mt-3 text-xs text-slate-500">
              {employee.active_task_count} active task{employee.active_task_count === 1 ? '' : 's'} · remaining effort vs. 5-day capacity
            </p>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Skills" description="Drives eligibility and skill-match scoring" icon={Award} />
            <SkillsEditor employeeId={employee.id} />
          </Card>

          <Card>
            <CardHeader title="Current tasks" icon={ListTodo} />
            {openTasks.length === 0 ? (
              <EmptyState title="No open tasks" className="py-6" />
            ) : (
              <div className="space-y-3">
                {openTasks.map((t) => (
                  <TaskCard key={t.id} task={t} showAssignee={false} />
                ))}
              </div>
            )}
            {closedTasks.length > 0 && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setShowAll((v) => !v)} className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                  {showAll ? 'Hide' : 'Show'} {closedTasks.length} closed task{closedTasks.length === 1 ? '' : 's'}
                </button>
                {showAll && (
                  <div className="mt-3 space-y-3">
                    {closedTasks.map((t) => (
                      <TaskCard key={t.id} task={t} showAssignee={false} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Recent work logs" icon={Clock} />
            {employee.recentWorkLogs.length === 0 ? (
              <EmptyState title="No time logged yet" className="py-6" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {employee.recentWorkLogs.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="w-14 shrink-0 font-semibold text-brand-700">{hours(l.hours_worked)}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-700">
                      {l.task_title}
                      {l.description && <span className="text-slate-400"> · {l.description}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">{formatDate(l.work_date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ResetPasswordModal
        user={resetting ? { id: employee.user_id, full_name: employee.full_name, email: employee.email } : null}
        onClose={() => setResetting(false)}
      />
      <EditEmployeeModal open={editing} employee={employee} onClose={() => setEditing(false)} onSaved={invalidate} />
    </div>
  )
}

function InfoRow({ icon: Icon, value, mono }) {
  return (
    <div className="flex items-center gap-3 text-slate-600">
      <Icon className="size-4 shrink-0 text-slate-400" />
      <span className={mono ? 'font-mono text-xs' : 'truncate'}>{value}</span>
    </div>
  )
}

function EditEmployeeModal({ open, employee, onClose, onSaved }) {
  if (!open) return null
  return <EditEmployeeForm employee={employee} onClose={onClose} onSaved={onSaved} />
}

function EditEmployeeForm({ employee, onClose, onSaved }) {
  const departments = useQuery({ queryKey: ['departments'], queryFn: departmentsApi.list })
  const [form, setForm] = useState({
    fullName: employee.full_name,
    jobPosition: employee.job_position,
    departmentId: employee.department_id ? String(employee.department_id) : '',
    phoneNumber: employee.phone_number || '',
    dailyCapacityHours: String(employee.daily_capacity_hours),
  })
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const mutation = useMutation({
    mutationFn: () =>
      employeesApi.update(employee.id, {
        fullName: form.fullName.trim(),
        jobPosition: form.jobPosition.trim(),
        departmentId: form.departmentId ? Number(form.departmentId) : null,
        phoneNumber: form.phoneNumber.trim() || null,
        dailyCapacityHours: Number(form.dailyCapacityHours),
      }),
    onSuccess: () => {
      toast.success('Profile updated')
      onSaved()
      onClose()
    },
  })

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit employee"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-employee" loading={mutation.isPending}>
            Save changes
          </Button>
        </>
      }
    >
      <form
        id="edit-employee"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          mutation.mutate()
        }}
      >
        <FormError error={mutation.error} />
        <Field label="Full name" required>
          {(id) => <Input id={id} value={form.fullName} onChange={set('fullName')} />}
        </Field>
        <Field label="Job position" required>
          {(id) => <Input id={id} value={form.jobPosition} onChange={set('jobPosition')} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Department">
            {(id) => (
              <Select id={id} value={form.departmentId} onChange={set('departmentId')}>
                <option value="">None</option>
                {departments.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Daily capacity (hours)">
            {(id) => <Input id={id} type="number" min="1" max="24" step="0.5" value={form.dailyCapacityHours} onChange={set('dailyCapacityHours')} />}
          </Field>
        </div>
        <Field label="Phone">
          {(id) => <Input id={id} value={form.phoneNumber} onChange={set('phoneNumber')} />}
        </Field>
      </form>
    </Modal>
  )
}
