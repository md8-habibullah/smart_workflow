import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Link } from 'react-router'
import { Clock, GripVertical } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { tasksApi } from '../../lib/endpoints'
import { STATUS_META, hours } from '../../lib/format'
import { Avatar, cn } from '../../components/ui'
import { Deadline, PriorityBadge } from '../../components/badges'

const COLUMNS = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'COMPLETED']

const COLUMN_ACCENT = {
  PENDING: 'bg-slate-400',
  ASSIGNED: 'bg-blue-500',
  IN_PROGRESS: 'bg-amber-500',
  REVIEW: 'bg-violet-500',
  COMPLETED: 'bg-brand-600',
}

/**
 * Kanban view of tasks. Cards can be dragged to another column; the backend
 * validates the transition (role + state machine) and the board refreshes.
 */
export default function TaskBoard({ tasks }) {
  const { isAdmin, employeeId } = useAuth()
  const queryClient = useQueryClient()
  const [dragging, setDragging] = useState(null)
  const [over, setOver] = useState(null)

  const move = useMutation({
    mutationFn: ({ task, status }) => tasksApi.setStatus(task.id, status),
    onSuccess: (res) => toast.success(res.message),
    onError: (e) => toast.error(e.message),
    onSettled: () => {
      ;['tasks', 'task', 'dashboard'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }))
    },
  })

  const canDrag = (t) => !['COMPLETED', 'CANCELLED'].includes(t.status) && (isAdmin || t.assigned_employee_id === employeeId)

  const onDrop = (status) => {
    setOver(null)
    if (!dragging || dragging.status === status) return
    if (status === 'PENDING' || status === 'ASSIGNED') {
      toast('Use Find best match / Unassign on the task to change its assignment.', { icon: 'ℹ️' })
      return
    }
    move.mutate({ task: dragging, status })
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 scroll-thin sm:mx-0 sm:px-0">
      <div className="grid min-w-[1100px] grid-cols-5 gap-4">
        {COLUMNS.map((status) => {
          const items = tasks.filter((t) => t.status === status)
          return (
            <section
              key={status}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(status)
              }}
              onDragLeave={() => setOver((o) => (o === status ? null : o))}
              onDrop={() => onDrop(status)}
              className={cn(
                'flex min-h-[420px] flex-col rounded-2xl border border-slate-200 bg-slate-100/60 transition',
                over === status && dragging?.status !== status && 'border-brand-300 bg-brand-50/60',
              )}
            >
              <header className="flex items-center justify-between px-3.5 pt-3.5 pb-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span className={cn('size-2 rounded-full', COLUMN_ACCENT[status])} />
                  {STATUS_META[status].label}
                </span>
                <span className="rounded-full bg-white px-2 text-xs font-semibold text-slate-500 tabular-nums ring-1 ring-slate-200">{items.length}</span>
              </header>
              <div className="flex-1 space-y-2.5 p-2.5 pt-1">
                {items.map((t) => {
                  const draggable = canDrag(t)
                  return (
                    <article
                      key={t.id}
                      draggable={draggable}
                      onDragStart={() => setDragging(t)}
                      onDragEnd={() => {
                        setDragging(null)
                        setOver(null)
                      }}
                      className={cn(
                        'group rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-brand-200 hover:shadow-md',
                        draggable && 'cursor-grab active:cursor-grabbing',
                        dragging?.id === t.id && 'opacity-50',
                        t.is_overdue && 'border-l-4 border-l-red-400',
                      )}
                    >
                      <div className="flex items-start gap-1.5">
                        <Link to={`/app/tasks/${t.id}`} className="flex-1 text-sm leading-snug font-semibold text-slate-900 hover:text-brand-700">
                          {t.title}
                        </Link>
                        {draggable && <GripVertical className="size-4 shrink-0 text-slate-300 opacity-0 group-hover:opacity-100" />}
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">{t.project_name}</p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <PriorityBadge priority={t.priority} />
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="size-3" /> {hours(t.logged_hours)}/{hours(t.estimated_hours)}
                        </span>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                        <Deadline value={t.deadline} overdue={Boolean(t.is_overdue)} done={t.status === 'COMPLETED'} className="text-xs" />
                        {t.assigned_employee_name ? (
                          <Avatar name={t.assigned_employee_name} size="xs" />
                        ) : (
                          <span className="text-[11px] text-slate-400">Unassigned</span>
                        )}
                      </div>
                    </article>
                  )
                })}
                {items.length === 0 && <p className="py-8 text-center text-xs text-slate-400">No tasks</p>}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
