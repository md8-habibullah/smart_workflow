import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Eye,
  FolderKanban,
  History,
  MessageSquare,
  Paperclip,
  Pencil,
  Play,
  RotateCcw,
  Send,
  FilePlus,
  Target,
  UserCheck,
  Timer,
  Trash2,
  UserMinus,
  XCircle,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { tasksApi } from '../../lib/endpoints'
import { formatDate, formatDateTime, hours, timeAgo, todayLocal, transitionLabel } from '../../lib/format'
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  FormError,
  IconButton,
  Input,
  Modal,
  PageHeader,
  ProgressBar,
  QueryView,
  Spinner,
  Tabs,
  Textarea,
  cn,
  useConfirm,
} from '../../components/ui'
import { Deadline, PriorityBadge, ProficiencyBadge, StatusBadge } from '../../components/badges'
import TaskFormModal from '../../components/TaskFormModal'
import TaskAttachments from '../../components/TaskAttachments'

const TRANSITION_STYLE = {
  IN_PROGRESS: { icon: Play, variant: 'primary' },
  REVIEW: { icon: Send, variant: 'primary' },
  COMPLETED: { icon: CheckCircle2, variant: 'success' },
  CANCELLED: { icon: XCircle, variant: 'danger-ghost' },
  PENDING: { icon: RotateCcw, variant: 'secondary' },
}

export default function TaskDetailPage() {
  const { id } = useParams()
  const query = useQuery({ queryKey: ['task', id], queryFn: () => tasksApi.get(id) })
  return <QueryView query={query}>{(task) => <TaskDetail task={task} />}</QueryView>
}

function TaskDetail({ task }) {
  const { isAdmin, employeeId } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirm, confirmDialog] = useConfirm()
  const [editing, setEditing] = useState(false)
  const [transition, setTransition] = useState(null)
  const [tab, setTab] = useState('comments')

  const isAssignee = task.assigned_employee_id && task.assigned_employee_id === employeeId
  const done = task.status === 'COMPLETED' || task.status === 'CANCELLED'
  const canLogWork = isAssignee && ['ASSIGNED', 'IN_PROGRESS'].includes(task.status)
  const progress = task.estimated_hours > 0 ? (task.logged_hours / task.estimated_hours) * 100 : 0

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['task', String(task.id)] })
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['task-history', task.id] })
  }

  const remove = useMutation({
    mutationFn: () => tasksApi.remove(task.id),
    onSuccess: () => {
      toast.success('Task deleted')
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      navigate('/app/tasks')
    },
    onError: (e) => toast.error(e.message),
  })

  const unassign = useMutation({
    mutationFn: () => tasksApi.unassign(task.id),
    onSuccess: () => {
      toast.success('Task returned to the unassigned pool')
      refresh()
    },
    onError: (e) => toast.error(e.message),
  })

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Delete this task?',
      message: `"${task.title}" and its comments, work logs and history will be permanently removed.`,
      confirmLabel: 'Delete task',
      tone: 'danger',
    })
    if (ok) remove.mutate()
  }

  const onUnassign = async () => {
    const ok = await confirm({
      title: 'Unassign task?',
      message: `${task.assigned_employee_name} will be removed and the task goes back to Unassigned.`,
      confirmLabel: 'Unassign',
    })
    if (ok) unassign.mutate()
  }

  return (
    <div>
      {confirmDialog}
      <PageHeader
        back={{ to: '/app/tasks', label: 'Back to tasks' }}
        title={task.title}
        actions={
          isAdmin && (
            <>
              {!done && (
                <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
                  Edit
                </Button>
              )}
              {['PENDING', 'CANCELLED'].includes(task.status) && (
                <Button variant="danger-ghost" icon={Trash2} onClick={onDelete} loading={remove.isPending}>
                  Delete
                </Button>
              )}
            </>
          )
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
          <Deadline value={task.deadline} overdue={Boolean(task.is_overdue)} done={done} />
        </div>
      </PageHeader>

      {/* Workflow actions */}
      {task.allowedTransitions?.length > 0 && (
        <Card className="mb-6 flex flex-col gap-3 border-brand-100 bg-gradient-to-r from-brand-50/70 to-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Next step</p>
            <p className="text-sm text-slate-600">
              {task.status === 'REVIEW' && isAdmin
                ? 'Review the submitted work and approve it or request changes.'
                : task.status === 'ASSIGNED' && isAssignee
                  ? 'Start the task when you begin working; logging time starts it automatically.'
                  : task.status === 'IN_PROGRESS' && isAssignee
                    ? 'Submit for review once the work is finished.'
                    : 'Move this task forward in its lifecycle.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {task.allowedTransitions.map((to) => {
              const style = TRANSITION_STYLE[to] || { variant: 'secondary' }
              return (
                <Button key={to} variant={style.variant} icon={style.icon} onClick={() => setTransition(to)}>
                  {transitionLabel(task.status, to)}
                </Button>
              )
            })}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h3 className="text-sm font-semibold text-slate-900">Description</h3>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-slate-600">
              {task.description || <span className="text-slate-400 italic">No description provided.</span>}
            </p>
            <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
              <Metric icon={Clock} label="Estimated" value={hours(task.estimated_hours)} />
              <Metric icon={Timer} label="Logged" value={hours(task.logged_hours)} />
              <Metric icon={CalendarClock} label="Remaining" value={hours(task.remaining_hours)} />
            </div>
            <ProgressBar value={progress} tone={progress > 100 ? 'red' : 'brand'} showLabel className="mt-4" />
          </Card>

          <Card>
            <Tabs
              tabs={[
                { value: 'comments', label: 'Comments', count: task.comment_count },
                { value: 'files', label: 'Files' },
                { value: 'worklogs', label: 'Work logs' },
                { value: 'history', label: 'History' },
              ]}
              value={tab}
              onChange={setTab}
              className="mb-5"
            />
            {tab === 'comments' && <Comments taskId={task.id} onChange={refresh} />}
            {tab === 'files' && <TaskAttachments task={task} onChange={refresh} />}
            {tab === 'worklogs' && <WorkLogs task={task} canLog={canLogWork} onChange={refresh} />}
            {tab === 'history' && <TaskHistory taskId={task.id} />}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Assignment" />
            {task.assigned_employee_name ? (
              <div className="flex items-center gap-3">
                <Avatar name={task.assigned_employee_name} src={task.assigned_avatar_url} />
                <div className="min-w-0">
                  {isAdmin ? (
                    <Link to={`/app/employees/${task.assigned_employee_id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                      {task.assigned_employee_name}
                    </Link>
                  ) : (
                    <p className="font-semibold text-slate-900">{task.assigned_employee_name}</p>
                  )}
                  <p className="text-xs text-slate-500">
                    {task.assigned_employee_code} · assigned {timeAgo(task.assigned_at)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Nobody is assigned yet.</p>
            )}
            {isAdmin && !done && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button icon={Target} to={`/app/tasks/${task.id}/allocate`} size="sm">
                  {task.assigned_employee_id ? 'Reassign' : 'Find best match'}
                </Button>
                {task.assigned_employee_id && (
                  <Button variant="secondary" size="sm" icon={UserMinus} onClick={onUnassign} loading={unassign.isPending}>
                    Unassign
                  </Button>
                )}
              </div>
            )}
            {task.assignments?.length > 1 && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Previous assignees</p>
                <ul className="space-y-2">
                  {task.assignments
                    .filter((a) => !a.is_current)
                    .map((a) => (
                      <li key={a.id} className="text-sm text-slate-600">
                        <span className="font-medium text-slate-800">{a.employee_name}</span>
                        <span className="text-slate-400"> · until {formatDate(a.unassigned_at)}</span>
                        {a.reassignment_reason && <p className="text-xs text-slate-500">{a.reassignment_reason}</p>}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Details" />
            <dl className="space-y-3 text-sm">
              <Row label="Project">
                <Link to={`/app/projects/${task.project_id}`} className="inline-flex items-center gap-1.5 font-medium text-slate-800 hover:text-brand-700">
                  <FolderKanban className="size-4 text-slate-400" /> {task.project_name}
                </Link>
              </Row>
              <Row label="Deadline">{formatDateTime(task.deadline)}</Row>
              <Row label="Created">{formatDateTime(task.created_at)}</Row>
              {task.completed_at && <Row label="Completed">{formatDateTime(task.completed_at)}</Row>}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Required skills" />
            {task.requiredSkills?.length ? (
              <ul className="space-y-2">
                {task.requiredSkills.map((s) => (
                  <li key={s.skill_id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-slate-700">{s.skill_name}</span>
                    <ProficiencyBadge level={s.min_proficiency_level} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No specific skills required.</p>
            )}
          </Card>
        </div>
      </div>

      <TaskFormModal open={editing} onClose={() => setEditing(false)} task={task} />
      <TransitionModal task={task} to={transition} onClose={() => setTransition(null)} onDone={refresh} />
    </div>
  )
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-800">{children}</dd>
    </div>
  )
}

function TransitionModal({ task, to, onClose, onDone }) {
  const [note, setNote] = useState('')
  const mutation = useMutation({
    mutationFn: () => tasksApi.setStatus(task.id, to, note.trim()),
    onSuccess: (res) => {
      toast.success(res.message || 'Status updated')
      setNote('')
      onDone()
      onClose()
    },
  })
  if (!to) return null
  const label = transitionLabel(task.status, to)
  const needsNote = to === 'IN_PROGRESS' && task.status === 'REVIEW'
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={label}
      description={`"${task.title}" will move to ${to.replace('_', ' ').toLowerCase()}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={to === 'CANCELLED' ? 'danger' : 'primary'}
            loading={mutation.isPending}
            disabled={needsNote && !note.trim()}
            onClick={() => mutation.mutate()}
          >
            {label}
          </Button>
        </>
      }
    >
      <FormError error={mutation.error} />
      <Field label={needsNote ? 'What needs to change?' : 'Note (optional)'} required={needsNote} className="mt-1">
        {(id) => (
          <Textarea
            id={id}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={needsNote ? 'Describe the requested changes…' : 'Add context for the history log…'}
          />
        )}
      </Field>
    </Modal>
  )
}

function Comments({ taskId, onChange }) {
  const { user, isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const comments = useQuery({ queryKey: ['task-comments', taskId], queryFn: () => tasksApi.comments(taskId) })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] })
    onChange()
  }
  const add = useMutation({
    mutationFn: () => tasksApi.addComment(taskId, text.trim()),
    onSuccess: () => {
      setText('')
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: (commentId) => tasksApi.deleteComment(taskId, commentId),
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  })

  return (
    <div>
      {comments.isPending ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : comments.data?.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No comments yet" description="Start the conversation about this task." className="py-6" />
      ) : (
        <ul className="space-y-4">
          {comments.data?.map((c) => {
            const mine = c.user_id === user?.id
            return (
              <li key={c.id} className="group flex gap-3">
                <Avatar name={c.full_name || c.email} src={c.avatar_url} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{c.full_name || c.email}</span>
                    {c.role !== 'EMPLOYEE' && <span className="rounded bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-600">ADMIN</span>}
                    <span className="text-xs text-slate-400">{timeAgo(c.created_at)}</span>
                    {(mine || isAdmin) && (
                      <button
                        type="button"
                        onClick={() => remove.mutate(c.id)}
                        className="ml-auto text-xs text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-red-600"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <p className={cn('mt-1 rounded-xl px-3.5 py-2.5 text-sm whitespace-pre-wrap', mine ? 'bg-brand-50 text-slate-800' : 'bg-slate-100 text-slate-700')}>
                    {c.content}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <form
        className="mt-5 flex gap-2 border-t border-slate-100 pt-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim()) add.mutate()
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment…" maxLength={2000} />
        <Button type="submit" icon={Send} loading={add.isPending} disabled={!text.trim()}>
          <span className="hidden sm:inline">Send</span>
        </Button>
      </form>
    </div>
  )
}

function WorkLogs({ task, canLog, onChange }) {
  const { isAdmin, employeeId } = useAuth()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ workDate: todayLocal(), hoursWorked: '', description: '' })
  const logs = useQuery({ queryKey: ['task-worklogs', task.id], queryFn: () => tasksApi.workLogs(task.id) })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['task-worklogs', task.id] })
    onChange()
  }
  const add = useMutation({
    mutationFn: () =>
      tasksApi.addWorkLog(task.id, {
        workDate: form.workDate,
        hoursWorked: Number(form.hoursWorked),
        description: form.description.trim() || null,
      }),
    onSuccess: () => {
      toast.success('Work logged')
      setForm({ workDate: todayLocal(), hoursWorked: '', description: '' })
      invalidate()
    },
  })
  const remove = useMutation({
    mutationFn: (logId) => tasksApi.deleteWorkLog(task.id, logId),
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  })

  const total = (logs.data || []).reduce((sum, l) => sum + Number(l.hours_worked), 0)

  return (
    <div>
      {canLog && (
        <form
          className="mb-6 rounded-xl border border-slate-200 bg-slate-50/60 p-4"
          onSubmit={(e) => {
            e.preventDefault()
            add.mutate()
          }}
        >
          <p className="mb-3 text-sm font-semibold text-slate-800">Log time</p>
          <FormError error={add.error} />
          <div className="mt-2 grid gap-3 sm:grid-cols-[160px_120px_1fr_auto] sm:items-end">
            <Field label="Date">
              {(id) => <Input id={id} type="date" max={todayLocal()} value={form.workDate} onChange={(e) => setForm({ ...form, workDate: e.target.value })} />}
            </Field>
            <Field label="Hours">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min="0.25"
                  max="24"
                  step="0.25"
                  value={form.hoursWorked}
                  onChange={(e) => setForm({ ...form, hoursWorked: e.target.value })}
                />
              )}
            </Field>
            <Field label="What did you do?">
              {(id) => <Input id={id} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional" />}
            </Field>
            <Button type="submit" icon={Clock} loading={add.isPending} disabled={!(Number(form.hoursWorked) > 0)}>
              Log
            </Button>
          </div>
        </form>
      )}

      {logs.isPending ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : logs.data?.length === 0 ? (
        <EmptyState icon={Timer} title="No time logged yet" className="py-6" />
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {logs.data.map((l) => (
              <li key={l.id} className="group flex items-start gap-3 py-3">
                <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <span className="text-sm leading-none font-bold">{hours(l.hours_worked)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{l.description || <span className="text-slate-400 italic">No description</span>}</p>
                  <p className="text-xs text-slate-500">
                    {l.employee_name} · {formatDate(l.work_date)}
                  </p>
                </div>
                {(isAdmin || l.employee_id === employeeId) && task.status !== 'COMPLETED' && (
                  <IconButton icon={Trash2} label="Delete log" variant="danger" onClick={() => remove.mutate(l.id)} className="opacity-0 group-hover:opacity-100" />
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-slate-100 pt-3 text-right text-sm text-slate-600">
            Total logged: <span className="font-semibold text-slate-900">{hours(total)}</span>
          </p>
        </>
      )}
    </div>
  )
}

const HISTORY_ICONS = {
  CREATED: FilePlus,
  ASSIGNED: UserCheck,
  AUTO_ASSIGNED: UserCheck,
  REASSIGNED: RotateCcw,
  UNASSIGNED: UserMinus,
  STATUS_CHANGED: Eye,
  WORK_LOGGED: Timer,
  UPDATED: Pencil,
  ATTACHMENT_ADDED: Paperclip,
  ATTACHMENT_REMOVED: Paperclip,
}

function TaskHistory({ taskId }) {
  const history = useQuery({ queryKey: ['task-history', taskId], queryFn: () => tasksApi.history(taskId) })
  if (history.isPending) {
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    )
  }
  if (!history.data?.length) return <EmptyState icon={History} title="No history" className="py-6" />
  return (
    <ol className="relative ml-3 border-l border-slate-200">
      {history.data.map((h) => {
        const Icon = HISTORY_ICONS[h.action] || History
        return (
          <li key={h.id} className="mb-5 ml-6 last:mb-0">
            <span className="absolute -left-3 flex size-6 items-center justify-center rounded-full bg-white ring-4 ring-white">
              <span className="flex size-6 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <Icon className="size-3.5" />
              </span>
            </span>
            <p className="text-sm text-slate-800">{h.details || h.action}</p>
            <p className="text-xs text-slate-500">
              {h.actor_name || h.actor_email} · {timeAgo(h.created_at)}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
