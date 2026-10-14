import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, Ban, Clock, GripVertical, MoreHorizontal, Target } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { tasksApi } from '../../lib/endpoints'
import { STATUS_META, hours, transitionLabel } from '../../lib/format'
import { Avatar, cn } from '../../components/ui'
import { Deadline, PriorityBadge } from '../../components/badges'

const COLUMNS = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'COMPLETED']

const COLUMN_ACCENT = {
  PENDING: 'bg-slate-400',
  ASSIGNED: 'bg-blue-500',
  IN_PROGRESS: 'bg-amber-500',
  REVIEW: 'bg-violet-500',
  COMPLETED: 'bg-brand-600',
  CANCELLED: 'bg-red-400',
}

/*
 * Mirrors TRANSITIONS in backend/src/services/taskService.js so the board can
 * show valid drop targets while dragging. The server still enforces the rules.
 */
const WORKFLOW = {
  ASSIGNED: { IN_PROGRESS: ['admin', 'assignee'] },
  IN_PROGRESS: { REVIEW: ['admin', 'assignee'] },
  REVIEW: { COMPLETED: ['admin'], IN_PROGRESS: ['admin'] },
  COMPLETED: { IN_PROGRESS: ['admin'] },
}

/** Where a task may be dropped by this user. PENDING → ASSIGNED opens smart allocation. */
const targetsFor = (task, { isAdmin, employeeId }) => {
  const isAssignee = Boolean(employeeId) && task.assigned_employee_id === employeeId
  const targets = Object.entries(WORKFLOW[task.status] || {})
    .filter(([, who]) => (isAdmin && who.includes('admin')) || (isAssignee && who.includes('assignee')))
    .map(([to]) => to)
  if (isAdmin && task.status === 'PENDING') targets.push('ASSIGNED')
  return targets
}

const EDGE = 80 // px from the board edge that triggers auto-scroll while dragging

/**
 * Kanban view. Drag a card to a highlighted column (or use its "Move to" menu,
 * which also works on touch screens and with the keyboard). Moves are applied
 * optimistically and rolled back if the server rejects them.
 */
export default function TaskBoard({ tasks }) {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const scrollRef = useRef(null)
  const [dragging, setDragging] = useState(null)
  // Drag events can arrive before React re-renders, so handlers read the dragged task from a ref.
  const dragRef = useRef(null)
  const [over, setOver] = useState(null)
  // taskId → status shown while the request is in flight.
  const [optimistic, setOptimistic] = useState({})
  const [landed, setLanded] = useState(null)

  const move = useMutation({
    mutationFn: ({ task, status }) => tasksApi.setStatus(task.id, status),
    onMutate: ({ task, status }) => setOptimistic((o) => ({ ...o, [task.id]: status })),
    onSuccess: (res, { task }) => {
      toast.success(res.message)
      setLanded(task.id)
    },
    onError: (e) => toast.error(e.message),
    onSettled: async (res, err, { task }) => {
      await Promise.all(['tasks', 'task', 'dashboard'].map((k) => queryClient.invalidateQueries({ queryKey: [k] })))
      setOptimistic((o) => {
        const next = { ...o }
        delete next[task.id]
        return next
      })
    },
  })

  useEffect(() => {
    if (!landed) return undefined
    const t = setTimeout(() => setLanded(null), 900)
    return () => clearTimeout(t)
  }, [landed])

  const statusOf = (t) => optimistic[t.id] ?? t.status
  const validTargets = dragging ? targetsFor(dragging, auth) : []

  const perform = (task, status) => {
    if (status === statusOf(task)) return
    if (status === 'ASSIGNED' && task.status === 'PENDING') {
      navigate(`/app/tasks/${task.id}/allocate`)
      return
    }
    if (!targetsFor(task, auth).includes(status)) {
      toast.error(`Can't move "${task.title}" from ${STATUS_META[task.status].label} to ${STATUS_META[status].label}.`)
      return
    }
    move.mutate({ task, status })
  }

  const startDrag = (task) => {
    dragRef.current = task
    // Restyle on the next frame so the browser's drag image is the un-faded card.
    requestAnimationFrame(() => dragRef.current === task && setDragging(task))
  }

  const endDrag = () => {
    dragRef.current = null
    setDragging(null)
    setOver(null)
  }

  // Scroll the board sideways when dragging near its left/right edge.
  const autoScroll = (clientX) => {
    const el = scrollRef.current
    if (!el) return
    const { left, right } = el.getBoundingClientRect()
    if (clientX < left + EDGE) el.scrollLeft -= 14
    else if (clientX > right - EDGE) el.scrollLeft += 14
  }

  const cancelled = tasks.filter((t) => statusOf(t) === 'CANCELLED')

  return (
    <div>
      <div
        ref={scrollRef}
        onDragOver={(e) => dragRef.current && autoScroll(e.clientX)}
        className="-mx-4 snap-x snap-mandatory overflow-x-auto scroll-smooth px-4 pb-3 scroll-thin sm:mx-0 sm:px-0 lg:snap-none"
      >
        <div className="grid auto-cols-[minmax(260px,85vw)] grid-flow-col gap-3 sm:auto-cols-[minmax(240px,1fr)] lg:auto-cols-[minmax(200px,1fr)] xl:gap-4">
          {COLUMNS.map((status) => {
            const items = tasks.filter((t) => statusOf(t) === status)
            const effort = items.reduce((sum, t) => sum + Number(t.estimated_hours || 0), 0)
            const isTarget = validTargets.includes(status)
            const isSource = dragging && statusOf(dragging) === status
            const isOver = over === status && isTarget
            return (
              <section
                key={status}
                aria-label={`${STATUS_META[status].label} column`}
                onDragOver={(e) => {
                  const task = dragRef.current
                  if (!task) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = targetsFor(task, auth).includes(status) ? 'move' : 'none'
                  if (over !== status) setOver(status)
                }}
                onDragLeave={(e) => {
                  // Ignore leave events caused by moving over child elements.
                  if (!e.currentTarget.contains(e.relatedTarget)) setOver((o) => (o === status ? null : o))
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const task = dragRef.current
                  endDrag()
                  if (task && targetsFor(task, auth).includes(status)) perform(task, status)
                }}
                className={cn(
                  'flex min-h-[460px] snap-start flex-col rounded-2xl border bg-slate-100/70 transition-all duration-200',
                  'border-slate-200',
                  dragging && isTarget && 'border-dashed border-brand-300 bg-brand-50/40',
                  isOver && 'border-solid border-brand-500 bg-brand-50 shadow-[0_0_0_3px] shadow-brand-500/15',
                  dragging && !isTarget && !isSource && 'opacity-45 saturate-50',
                )}
              >
                <header className="flex items-center justify-between gap-2 px-3.5 pt-3.5 pb-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-700">
                    <span className={cn('size-2 shrink-0 rounded-full', COLUMN_ACCENT[status])} />
                    <span className="truncate">{STATUS_META[status].label}</span>
                    <span className="rounded-full bg-white px-2 text-xs font-semibold text-slate-500 tabular-nums ring-1 ring-slate-200">{items.length}</span>
                  </span>
                  {effort > 0 && <span className="text-[11px] font-medium text-slate-400 tabular-nums">{hours(effort)}</span>}
                </header>

                <div className="flex-1 space-y-2.5 p-2.5 pt-1">
                  {items.map((t) => (
                    <BoardCard
                      key={t.id}
                      task={t}
                      status={statusOf(t)}
                      targets={targetsFor(t, auth)}
                      pending={t.id in optimistic}
                      landed={landed === t.id}
                      lifted={dragging?.id === t.id}
                      onDragStart={() => startDrag(t)}
                      onDragEnd={endDrag}
                      onMove={(to) => perform(t, to)}
                    />
                  ))}

                  {isOver && !isSource && (
                    <div className="flex h-20 animate-fade-in items-center justify-center rounded-xl border-2 border-dashed border-brand-400 bg-white/70 text-xs font-semibold text-brand-700">
                      {status === 'ASSIGNED' ? (
                        <span className="flex items-center gap-1.5">
                          <Target className="size-4" /> Drop to find the best match
                        </span>
                      ) : (
                        `Drop: ${transitionLabel(dragging.status, status)}`
                      )}
                    </div>
                  )}

                  {items.length === 0 && !isOver && (
                    <p className="py-10 text-center text-xs text-slate-400">{dragging && isTarget ? 'Drop here' : 'No tasks'}</p>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      {cancelled.length > 0 && (
        <details className="group mt-4 rounded-2xl border border-slate-200 bg-white">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-600 select-none">
            <Ban className="size-4 text-red-400" /> Cancelled
            <span className="rounded-full bg-slate-100 px-2 text-xs tabular-nums">{cancelled.length}</span>
            <span className="ml-auto text-xs font-medium text-slate-400 group-open:hidden">Show</span>
          </summary>
          <div className="grid gap-2.5 border-t border-slate-100 p-3 sm:grid-cols-2 lg:grid-cols-4">
            {cancelled.map((t) => (
              <Link key={t.id} to={`/app/tasks/${t.id}`} className="rounded-xl border border-slate-200 p-3 text-sm text-slate-500 line-through decoration-slate-300 hover:border-slate-300">
                {t.title}
              </Link>
            ))}
          </div>
        </details>
      )}

      <p className="mt-3 hidden text-xs text-slate-400 sm:block">
        Tip: drag a card onto a highlighted column, or use <MoreHorizontal className="inline size-3.5" /> on a card. Drop a pending task on
        “Assigned” to open smart allocation.
      </p>
    </div>
  )
}

function BoardCard({ task: t, status, targets, pending, landed, lifted, onDragStart, onDragEnd, onMove }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const draggable = targets.length > 0 && !pending

  useEffect(() => {
    if (!menuOpen) return undefined
    const close = (e) => !menuRef.current?.contains(e.target) && setMenuOpen(false)
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <article
      draggable={draggable}
      onDragStart={(e) => {
        // Firefox only starts a drag when data is attached.
        e.dataTransfer.setData('text/plain', String(t.id))
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'group relative rounded-xl border border-slate-200 bg-white p-3 shadow-sm',
        'transition-[box-shadow,transform,opacity,border-color] duration-200 ease-out',
        'hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md',
        draggable && 'cursor-grab active:cursor-grabbing',
        lifted && 'scale-[0.97] border-dashed border-brand-300 opacity-40 shadow-none',
        pending && 'animate-pulse',
        landed && 'animate-card-land',
        t.is_overdue && status !== 'COMPLETED' && 'border-l-4 border-l-red-400',
      )}
    >
      <div className="flex items-start gap-1.5">
        <Link to={`/app/tasks/${t.id}`} draggable={false} className="flex-1 text-sm leading-snug font-semibold text-slate-900 hover:text-brand-700">
          {t.title}
        </Link>
        {draggable && <GripVertical className="mt-0.5 size-4 shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100" aria-hidden="true" />}
      </div>
      <p className="mt-1 truncate text-xs text-slate-500">{t.project_name}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={t.priority} />
        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
          <Clock className="size-3" /> {hours(t.logged_hours)}/{hours(t.estimated_hours)}
        </span>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
        <Deadline value={t.deadline} overdue={Boolean(t.is_overdue)} done={status === 'COMPLETED'} className="text-xs whitespace-nowrap" />
        <div className="flex items-center gap-1.5">
          {t.assigned_employee_name ? (
            <Avatar name={t.assigned_employee_name} src={t.assigned_avatar_url} size="xs" />
          ) : (
            <span className="text-[11px] text-slate-400">Unassigned</span>
          )}
          {targets.length > 0 && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-label={`Move "${t.title}"`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                disabled={pending}
                onClick={() => setMenuOpen((v) => !v)}
                className="flex size-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <MoreHorizontal className="size-4" />
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 bottom-full z-20 mb-1 w-52 animate-pop-in rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                  <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Move to</p>
                  {targets.map((to) => (
                    <button
                      key={to}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false)
                        onMove(to)
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <span className={cn('size-2 rounded-full', COLUMN_ACCENT[to])} />
                      <span className="flex-1">{to === 'ASSIGNED' ? 'Find best match…' : transitionLabel(status, to)}</span>
                      <ArrowRight className="size-3.5 text-slate-300" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
