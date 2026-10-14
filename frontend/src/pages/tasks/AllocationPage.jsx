import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { AlertTriangle, Award, CalendarClock, ChevronDown, Gauge, Info, Target, UserCheck, Users, XCircle } from 'lucide-react'
import { tasksApi } from '../../lib/endpoints'
import { hours } from '../../lib/format'
import { Avatar, Badge, Button, Card, EmptyState, Field, FormError, Modal, PageHeader, QueryView, Textarea, cn } from '../../components/ui'
import { Deadline, ProficiencyBadge, StatusBadge } from '../../components/badges'

const COMPONENTS = [
  { key: 'skillMatch', label: 'Skill match', weight: 40, icon: Target, color: 'bg-brand-500' },
  { key: 'workloadBalance', label: 'Workload', weight: 25, icon: Gauge, color: 'bg-blue-500' },
  { key: 'availability', label: 'Availability', weight: 20, icon: Users, color: 'bg-emerald-500' },
  { key: 'deadlineFit', label: 'Deadline fit', weight: 15, icon: CalendarClock, color: 'bg-violet-500' },
]

const scoreTone = (s) => (s >= 80 ? 'text-emerald-600' : s >= 60 ? 'text-amber-600' : 'text-red-600')

export default function AllocationPage() {
  const { id } = useParams()
  const query = useQuery({ queryKey: ['recommendations', id], queryFn: () => tasksApi.recommendations(id) })
  return <QueryView query={query}>{(data) => <Allocation data={data} />}</QueryView>
}

function Allocation({ data }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState(null)
  const [showIneligible, setShowIneligible] = useState(false)

  const eligible = data.recommendations.filter((r) => r.isEligible)
  const ineligible = data.recommendations.filter((r) => !r.isEligible)
  const isReassign = Boolean(data.currentAssigneeId)
  const closed = ['COMPLETED', 'CANCELLED'].includes(data.status)

  const afterAssign = (res) => {
    toast.success(res.message)
    if (res.data?.warnings?.length) toast(res.data.warnings.join(' · '), { icon: '⚠️' })
    ;['tasks', 'task', 'dashboard', 'recommendations'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }))
    navigate(`/app/tasks/${data.taskId}`)
  }

  const auto = useMutation({
    mutationFn: () => tasksApi.autoAssign(data.taskId),
    onSuccess: afterAssign,
    onError: (e) => toast.error(e.message),
  })

  return (
    <div>
      <PageHeader
        back={{ to: `/app/tasks/${data.taskId}`, label: 'Back to task' }}
        title="Smart allocation"
        description={`Ranked candidates for "${data.taskTitle}"`}
        actions={
          !isReassign &&
          !closed && (
            <Button icon={UserCheck} onClick={() => auto.mutate()} loading={auto.isPending} disabled={eligible.length === 0}>
              Assign best match
            </Button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          <Card>
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Task</p>
            <p className="mt-1 font-semibold text-slate-900">{data.taskTitle}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge status={data.status} />
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Effort remaining</dt>
                <dd className="font-semibold text-slate-900">
                  {hours(data.remainingHours)} / {hours(data.estimatedHours)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Deadline</dt>
                <dd>
                  <Deadline value={data.deadline} />
                </dd>
              </div>
            </dl>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Required skills</p>
              {data.requiredSkills.length ? (
                <ul className="space-y-1.5">
                  {data.requiredSkills.map((s) => (
                    <li key={s.skillId} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{s.skillName}</span>
                      <ProficiencyBadge level={s.minProficiencyLevel} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">None. Every active employee qualifies.</p>
              )}
            </div>
          </Card>

          <Card className="bg-slate-900 text-white">
            <div className="flex items-center gap-2">
              <Info className="size-4 text-brand-400" />
              <p className="text-sm font-semibold">How the score works</p>
            </div>
            <div className="mt-4 space-y-3">
              {COMPONENTS.map((c) => (
                <div key={c.key}>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>{c.label}</span>
                    <span>{c.weight}%</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/10">
                    <div className={cn('h-full rounded-full', c.color)} style={{ width: `${c.weight * 2.5}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-400">
              Candidates missing a required skill, below the minimum level, or outside a members-only project are
              ineligible.
            </p>
          </Card>
        </div>

        <div className="space-y-4">
          {closed && (
            <Card className="border-amber-200 bg-amber-50 text-sm text-amber-800">This task is {data.status.toLowerCase()} and cannot be assigned.</Card>
          )}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">
              {eligible.length} eligible candidate{eligible.length === 1 ? '' : 's'}
            </h2>
            <span className="text-sm text-slate-500">{data.recommendations.length} evaluated</span>
          </div>

          {eligible.length === 0 ? (
            <Card>
              <EmptyState
                icon={AlertTriangle}
                title="No eligible employees"
                description="Nobody meets the skill requirements. Lower the minimum levels, add skills to employees, or force-assign below."
              />
            </Card>
          ) : (
            eligible.map((rec, index) => (
              <CandidateCard key={rec.employeeId} rec={rec} rank={index + 1} disabled={closed} onAssign={() => setSelected(rec)} />
            ))
          )}

          {ineligible.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowIneligible((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  <XCircle className="size-4 text-slate-400" /> {ineligible.length} ineligible
                </span>
                <ChevronDown className={cn('size-4 transition', showIneligible && 'rotate-180')} />
              </button>
              {showIneligible && (
                <div className="mt-3 space-y-2">
                  {ineligible.map((rec) => (
                    <div key={rec.employeeId} className="flex items-start gap-3 rounded-xl border border-dashed border-slate-200 bg-white p-4">
                      <Avatar name={rec.employeeName} src={rec.avatarUrl} size="sm" className="opacity-60" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-700">{rec.employeeName}</p>
                        <ul className="mt-1 space-y-0.5">
                          {rec.failureReasons.map((r) => (
                            <li key={r} className="text-xs text-red-600">
                              • {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {!closed && !rec.isCurrentAssignee && (
                        <Button size="xs" variant="secondary" onClick={() => setSelected(rec)}>
                          Force assign
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AssignModal data={data} rec={selected} onClose={() => setSelected(null)} onAssigned={afterAssign} />
    </div>
  )
}

function CandidateCard({ rec, rank, onAssign, disabled }) {
  return (
    <Card className={cn('transition', rank === 1 && 'border-brand-200 ring-4 ring-brand-500/5')}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex flex-1 items-start gap-3">
          <div className="relative">
            <Avatar name={rec.employeeName} src={rec.avatarUrl} />
            <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white ring-2 ring-white">
              {rank}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-slate-900">{rec.employeeName}</p>
              {rank === 1 && (
                <Badge tone="brand">
                  <Award className="size-3" /> Best match
                </Badge>
              )}
              {rec.isCurrentAssignee && <Badge tone="blue">Current assignee</Badge>}
            </div>
            <p className="text-sm text-slate-500">
              {rec.jobPosition} · {rec.departmentName || 'No department'} · {rec.employeeCode}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {rec.workload.activeTaskCount} active task{rec.workload.activeTaskCount === 1 ? '' : 's'} · {hours(rec.workload.outstandingHours)} of{' '}
              {hours(rec.workload.weeklyCapacityHours)} booked · {hours(rec.workload.hoursAvailableBeforeDeadline)} free before deadline
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
          <div className="text-right">
            <p className={cn('text-3xl font-bold tabular-nums', scoreTone(rec.totalScore))}>{rec.totalScore}</p>
            <p className="text-xs text-slate-500">score</p>
          </div>
          {!rec.isCurrentAssignee && (
            <Button size="sm" onClick={onAssign} disabled={disabled} icon={UserCheck}>
              Assign
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
        {COMPONENTS.map((c) => (
          <div key={c.key}>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-slate-500">
                <c.icon className="size-3" /> {c.label}
              </span>
              <span className="font-semibold text-slate-800 tabular-nums">{rec.scores[c.key]}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-100">
              <div className={cn('h-full rounded-full', c.color)} style={{ width: `${rec.scores[c.key]}%` }} />
            </div>
          </div>
        ))}
      </div>

      {rec.warnings.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {rec.warnings.map((w) => (
            <span key={w} className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
              <AlertTriangle className="size-3" /> {w}
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}

function AssignModal({ data, rec, onClose, onAssigned }) {
  const [reason, setReason] = useState('')
  const isReassign = Boolean(data.currentAssigneeId)
  const force = rec ? !rec.isEligible : false

  const mutation = useMutation({
    mutationFn: () =>
      isReassign
        ? tasksApi.reassign(data.taskId, rec.employeeId, reason.trim(), force)
        : tasksApi.assign(data.taskId, rec.employeeId, force),
    onSuccess: (res) => {
      setReason('')
      onClose()
      onAssigned(res)
    },
  })

  if (!rec) return null
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={isReassign ? 'Reassign task' : 'Assign task'}
      description={`${data.taskTitle} → ${rec.employeeName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={force ? 'danger' : 'primary'} loading={mutation.isPending} onClick={() => mutation.mutate()}>
            {force ? 'Force assign' : isReassign ? 'Reassign' : 'Assign'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError error={mutation.error} />
        {force ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p className="font-semibold">This employee is not eligible</p>
            <ul className="mt-1 list-disc pl-4 text-xs">
              {rec.failureReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs">The assignment will be recorded as an administrator override.</p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
            <Avatar name={rec.employeeName} src={rec.avatarUrl} size="sm" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-slate-900">{rec.employeeName}</p>
              <p className="text-slate-500">Allocation score {rec.totalScore}</p>
            </div>
          </div>
        )}
        {rec.warnings?.length > 0 && (
          <ul className="space-y-1 text-xs text-amber-700">
            {rec.warnings.map((w) => (
              <li key={w}>⚠ {w}</li>
            ))}
          </ul>
        )}
        {isReassign && (
          <Field label="Reason for reassignment">
            {(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Original assignee on leave" />}
          </Field>
        )}
        <p className="text-xs text-slate-500">The employee will be notified immediately.</p>
      </div>
    </Modal>
  )
}
