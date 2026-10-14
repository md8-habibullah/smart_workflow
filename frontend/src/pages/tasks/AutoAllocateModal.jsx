import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { tasksApi } from '../../lib/endpoints'
import { Avatar, Badge, Button, EmptyState, FormError, Modal, Skeleton, cn } from '../../components/ui'
import { Deadline, PriorityBadge } from '../../components/badges'
import { MagicIcon, MagicIconSolid, magicButtonClass } from '../../components/MagicBadge'

const CONFIDENCE = {
  CLEAR: { label: 'Clear', tone: 'green' },
  GOOD: { label: 'Good', tone: 'brand' },
  CLOSE: { label: 'Close call', tone: 'amber' },
  ONLY_OPTION: { label: 'Only option', tone: 'blue' },
}

/**
 * Batch allocation: previews a plan for every unassigned task (regret-based
 * planner, most constrained task first), then applies it in one transaction.
 */
export default function AutoAllocateModal({ open, onClose }) {
  const queryClient = useQueryClient()
  const preview = useMutation({ mutationFn: () => tasksApi.autoAllocate({ dryRun: true }) })
  const apply = useMutation({
    mutationFn: () => tasksApi.autoAllocate({ taskIds: preview.data?.data.assignments.map((a) => a.taskId) }),
    onSuccess: (res) => {
      toast.success(res.message)
      ;['tasks', 'task', 'dashboard', 'recommendations'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }))
      onClose()
    },
  })

  // Build a fresh plan every time the dialog opens.
  const { mutate: runPreview, reset: resetPreview } = preview
  useEffect(() => {
    if (open) runPreview()
    else resetPreview()
  }, [open, runPreview, resetPreview])

  const plan = preview.data?.data
  const count = plan?.assignments.length ?? 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Auto-allocate pending tasks"
      description="The planner serves the most constrained tasks first (biggest gap between their best and second-best person), so specialists go where they are needed most."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={MagicIconSolid} className={magicButtonClass} onClick={() => apply.mutate()} loading={apply.isPending} disabled={!count}>
            Apply {count} assignment{count === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <FormError error={preview.error || apply.error} />
      {preview.isPending || (!plan && !preview.error) ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : plan ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="flex items-center gap-1.5 font-semibold text-slate-900">
              <MagicIcon /> Allocation engine v{plan.algorithmVersion}
            </span>
            <span>
              <b className="text-slate-900">{plan.stats.tasks}</b> pending
            </span>
            <span>
              <b className="text-slate-900">{plan.stats.candidates}</b> candidates
            </span>
            <span>
              <b className="text-slate-900">{plan.stats.assigned}</b> assignable
            </span>
            <span className="ml-auto text-xs text-slate-400">planned in {plan.stats.elapsedMs} ms</span>
          </div>

          {plan.assignments.length === 0 && plan.unassignable.length === 0 ? (
            <EmptyState title="Nothing to allocate" description="Every task already has someone assigned." className="py-8" />
          ) : (
            <ol className="space-y-2">
              {plan.assignments.map((a, i) => (
                <li key={a.taskId} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center">
                  <span className="hidden size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500 sm:flex">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{a.taskTitle}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={a.priority} />
                      <Deadline value={a.deadline} className="text-xs" />
                    </div>
                  </div>
                  <ArrowRight className="hidden size-4 shrink-0 text-slate-300 sm:block" />
                  <div className="flex min-w-0 items-center gap-2.5 sm:w-64">
                    <Avatar name={a.employeeName} src={a.avatarUrl} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{a.employeeName}</p>
                      <p className="truncate text-xs text-slate-500">
                        {a.runnerUp ? `next best: ${a.runnerUp.employeeName} (${a.runnerUp.score})` : a.jobPosition}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:w-36 sm:justify-end">
                    <span title="How sure the allocation engine is about this pick">
                      <Badge tone={CONFIDENCE[a.confidence.level].tone}>{CONFIDENCE[a.confidence.level].label}</Badge>
                    </span>
                    <span className={cn('text-lg font-bold tabular-nums', a.score >= 80 ? 'text-emerald-600' : a.score >= 60 ? 'text-amber-600' : 'text-red-600')}>
                      {Math.round(a.score)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {plan.unassignable.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <AlertTriangle className="size-4" /> {plan.unassignable.length} task(s) have no eligible person
              </p>
              <ul className="mt-2 space-y-1 text-sm text-amber-800">
                {plan.unassignable.map((u) => (
                  <li key={u.taskId}>
                    • {u.taskTitle}: {u.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : null}
    </Modal>
  )
}
