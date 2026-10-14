import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangle, Clock, Columns3, Download, List, ListTodo, Plus, Target } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { projectsApi, tasksApi } from '../../lib/endpoints'
import { PRIORITIES, PRIORITY_META, STATUS_META, hours } from '../../lib/format'
import { Avatar, Button, Card, EmptyState, ErrorState, PageHeader, SearchInput, Select, Skeleton, Tabs, cn } from '../../components/ui'
import { Deadline, PriorityBadge, StatusBadge } from '../../components/badges'
import TaskCard from '../../components/TaskCard'
import TaskFormModal from '../../components/TaskFormModal'
import { useDebounced } from '../../lib/useDebounced'
import { exportCsv } from '../../lib/csv'
import TaskBoard from './TaskBoard'

const STATUS_TABS = ['', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'CANCELLED']
const VIEW_KEY = 'swta.tasks.view'

const savedView = () => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'board'
  } catch {
    return 'board'
  }
}

/** Kanban by default; the list is used when asked for, remembered, or when a status filter is in the URL. */
const resolveView = (params) => {
  const v = params.get('view')
  if (v === 'board' || v === 'list') return v
  return params.get('status') ? 'list' : savedView()
}

export default function TasksPage() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState(params.get('search') || '')
  const debouncedSearch = useDebounced(search, 300)

  const view = resolveView(params)
  const filters = {
    // The board shows every status as a column, so the status filter only applies to the list.
    status: view === 'list' ? params.get('status') || undefined : undefined,
    priority: params.get('priority') || undefined,
    projectId: params.get('projectId') || undefined,
    overdue: params.get('overdue') === 'true' ? 'true' : undefined,
    search: debouncedSearch || undefined,
  }

  const updateParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const tasks = useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => tasksApi.list(filters),
    placeholderData: keepPreviousData,
  })
  // Unfiltered list for tab counts.
  const all = useQuery({ queryKey: ['tasks', {}], queryFn: () => tasksApi.list({}) })
  const projects = useQuery({ queryKey: ['projects'], queryFn: () => projectsApi.list() })

  const counts = {}
  for (const t of all.data || []) counts[t.status] = (counts[t.status] || 0) + 1

  const tabs = STATUS_TABS.map((s) => ({
    value: s,
    label: s ? STATUS_META[s].label : 'All',
    count: s ? counts[s] || 0 : all.data?.length,
  }))

  return (
    <div>
      <PageHeader
        title={isAdmin ? 'Tasks' : 'My tasks'}
        description={isAdmin ? 'Create, allocate and track work across every project.' : 'Everything currently or previously assigned to you.'}
        actions={
          <>
            <div className="flex rounded-lg bg-slate-100 p-1" role="group" aria-label="View">
              {[
                ['board', 'Board', Columns3],
                ['list', 'List', List],
              ].map(([v, label, Icon]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => {
                    try {
                      localStorage.setItem(VIEW_KEY, v)
                    } catch {
                      /* not remembered */
                    }
                    const next = new URLSearchParams(params)
                    next.set('view', v)
                    if (v === 'board') next.delete('status')
                    setParams(next, { replace: true })
                  }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition',
                    view === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800',
                  )}
                >
                  <Icon className="size-4" /> {label}
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              icon={Download}
              disabled={!tasks.data?.length}
              onClick={() =>
                exportCsv('tasks', tasks.data, [
                  'id', 'title', 'project_name', 'status', 'priority', 'assigned_employee_name',
                  'estimated_hours', 'logged_hours', 'deadline', 'created_at', 'completed_at',
                ])
              }
            >
              Export
            </Button>
            {isAdmin && (
              <Button icon={Plus} onClick={() => setCreating(true)}>
                New task
              </Button>
            )}
          </>
        }
      />

      {view === 'list' && <Tabs tabs={tabs} value={filters.status || ''} onChange={(v) => updateParam('status', v)} className="mb-4" />}

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v)
            updateParam('search', v)
          }}
          placeholder="Search by title, description or project…"
          className="lg:max-w-sm lg:flex-1"
        />
        <div className="flex flex-wrap gap-3">
          <Select value={filters.priority || ''} onChange={(e) => updateParam('priority', e.target.value)} className="w-auto" aria-label="Priority">
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_META[p].label}
              </option>
            ))}
          </Select>
          <Select value={filters.projectId || ''} onChange={(e) => updateParam('projectId', e.target.value)} className="w-auto max-w-[220px]" aria-label="Project">
            <option value="">All projects</option>
            {projects.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Button
            variant={filters.overdue ? 'danger' : 'secondary'}
            icon={AlertTriangle}
            onClick={() => updateParam('overdue', filters.overdue ? '' : 'true')}
          >
            Overdue only
          </Button>
        </div>
      </div>

      {tasks.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : tasks.isError ? (
        <Card>
          <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />
        </Card>
      ) : tasks.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={ListTodo}
            title="No tasks match these filters"
            description={isAdmin ? 'Try clearing filters or create a new task.' : 'Nothing here yet. New assignments will appear automatically.'}
            action={
              isAdmin && (
                <Button icon={Plus} onClick={() => setCreating(true)}>
                  New task
                </Button>
              )
            }
          />
        </Card>
      ) : view === 'board' ? (
        <TaskBoard tasks={tasks.data} />
      ) : (
        <>
          {/* Desktop table */}
          <Card padded={false} className={cn('hidden overflow-hidden md:block', tasks.isFetching && 'opacity-70')}>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Status</th>
                    <th>Priority</th>
                    {isAdmin && <th>Assignee</th>}
                    <th>Effort</th>
                    <th>Deadline</th>
                    {isAdmin && <th className="text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tasks.data.map((t) => {
                    const done = t.status === 'COMPLETED' || t.status === 'CANCELLED'
                    return (
                      <tr key={t.id} className="cursor-pointer" onClick={() => navigate(`/app/tasks/${t.id}`)}>
                        <td className="max-w-xs">
                          <p className="truncate font-semibold text-slate-900">{t.title}</p>
                          <p className="truncate text-xs text-slate-500">{t.project_name}</p>
                        </td>
                        <td>
                          <StatusBadge status={t.status} />
                        </td>
                        <td>
                          <PriorityBadge priority={t.priority} />
                        </td>
                        {isAdmin && (
                          <td>
                            {t.assigned_employee_name ? (
                              <span className="flex items-center gap-2">
                                <Avatar name={t.assigned_employee_name} src={t.assigned_avatar_url} size="xs" />
                                <span className="truncate">{t.assigned_employee_name}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">Unassigned</span>
                            )}
                          </td>
                        )}
                        <td className="whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <Clock className="size-3.5" />
                            {hours(t.logged_hours)} / {hours(t.estimated_hours)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap">
                          <Deadline value={t.deadline} overdue={Boolean(t.is_overdue)} done={done} />
                        </td>
                        {isAdmin && (
                          <td className="text-right">
                            {t.status === 'PENDING' && (
                              <Button
                                size="xs"
                                icon={Target}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  navigate(`/app/tasks/${t.id}/allocate`)
                                }}
                              >
                                Allocate
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {tasks.data.map((t) => (
              <TaskCard key={t.id} task={t} showAssignee={isAdmin} />
            ))}
          </div>
        </>
      )}

      <TaskFormModal open={creating} onClose={() => setCreating(false)} onSaved={(task) => task && navigate(`/app/tasks/${task.id}`)} />
    </div>
  )
}
