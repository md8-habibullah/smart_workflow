import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Archive, ArchiveRestore, Building2, CalendarClock, ListTodo, Lock, Pencil, Plus, UserPlus, Users, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { employeesApi, projectsApi } from '../../lib/endpoints'
import { formatDate } from '../../lib/format'
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, IconButton, PageHeader, ProgressBar, QueryView, Select, StatCard, useConfirm } from '../../components/ui'
import TaskCard from '../../components/TaskCard'
import TaskFormModal from '../../components/TaskFormModal'
import ProjectFormModal from './ProjectFormModal'

export default function ProjectDetailPage() {
  const { id } = useParams()
  const query = useQuery({ queryKey: ['project', id], queryFn: () => projectsApi.get(id) })
  return <QueryView query={query}>{(project) => <ProjectDetail project={project} />}</QueryView>
}

function ProjectDetail({ project }) {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [confirm, confirmDialog] = useConfirm()
  const [editing, setEditing] = useState(null)
  const [creatingTask, setCreatingTask] = useState(false)
  const [newMember, setNewMember] = useState('')

  const employees = useQuery({ queryKey: ['employees', { status: 'ACTIVE', role: 'EMPLOYEE' }], queryFn: () => employeesApi.list({ status: 'ACTIVE', role: 'EMPLOYEE' }), enabled: isAdmin })
  const invalidate = () => ['project', 'projects', 'recommendations'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }))

  const archive = useMutation({
    mutationFn: () => projectsApi.archive(project.id, !project.is_archived),
    onSuccess: (res) => {
      toast.success(res.message)
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })
  const addMember = useMutation({
    mutationFn: () => projectsApi.addMember(project.id, Number(newMember)),
    onSuccess: () => {
      setNewMember('')
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })
  const removeMember = useMutation({
    mutationFn: (employeeId) => projectsApi.removeMember(project.id, employeeId),
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  })

  const onArchive = async () => {
    const ok = await confirm({
      title: project.is_archived ? 'Restore project?' : 'Archive project?',
      message: project.is_archived ? 'The project becomes visible and usable again.' : 'Archived projects are hidden and accept no new tasks.',
      confirmLabel: project.is_archived ? 'Restore' : 'Archive',
    })
    if (ok) archive.mutate()
  }

  const memberIds = new Set(project.members.map((m) => m.employee_id))
  const candidates = (employees.data || []).filter((e) => !memberIds.has(e.id))
  const pct = project.total_tasks ? Math.round((project.completed_tasks / project.total_tasks) * 100) : 0
  const open = project.tasks.filter((t) => !['COMPLETED', 'CANCELLED'].includes(t.status))
  const closed = project.tasks.filter((t) => ['COMPLETED', 'CANCELLED'].includes(t.status))

  return (
    <div>
      {confirmDialog}
      <PageHeader
        back={{ to: '/app/projects', label: 'All projects' }}
        title={project.name}
        description={project.description}
        actions={
          isAdmin && (
            <>
              <Button variant="secondary" icon={Pencil} onClick={() => setEditing(project)}>
                Edit
              </Button>
              <Button variant="secondary" icon={project.is_archived ? ArchiveRestore : Archive} onClick={onArchive} loading={archive.isPending}>
                {project.is_archived ? 'Restore' : 'Archive'}
              </Button>
              {!project.is_archived && (
                <Button icon={Plus} onClick={() => setCreatingTask(true)}>
                  Add task
                </Button>
              )}
            </>
          )
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span className="flex items-center gap-1.5">
            <Building2 className="size-4" /> {project.department_name || 'No department'}
          </span>
          {(project.start_date || project.end_date) && (
            <span className="flex items-center gap-1.5">
              <CalendarClock className="size-4" /> {formatDate(project.start_date)} – {formatDate(project.end_date)}
            </span>
          )}
          {Boolean(project.requires_membership) && (
            <Badge tone="violet">
              <Lock className="size-3" /> Members only
            </Badge>
          )}
          {Boolean(project.is_archived) && <Badge>Archived</Badge>}
        </div>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total tasks" value={project.total_tasks} icon={ListTodo} tone="blue" />
        <StatCard label="Completed" value={project.completed_tasks} icon={ListTodo} tone="green" />
        <StatCard label="Overdue" value={project.overdue_tasks} icon={CalendarClock} tone={project.overdue_tasks ? 'red' : 'slate'} />
        <Card>
          <p className="text-sm font-medium text-slate-500">Progress</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{pct}%</p>
          <ProgressBar value={pct} tone={pct === 100 ? 'green' : 'brand'} className="mt-3" />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={isAdmin ? 'Tasks' : 'Your tasks in this project'} icon={ListTodo} />
          {project.tasks.length === 0 ? (
            <EmptyState title="No tasks yet" className="py-6" />
          ) : (
            <div className="space-y-3">
              {[...open, ...closed].map((t) => (
                <TaskCard key={t.id} task={t} showAssignee={isAdmin} />
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Members"
            description={project.requires_membership ? 'Only these people can be allocated tasks.' : 'Optional for open projects.'}
            icon={Users}
          />
          {project.members.length === 0 ? (
            <p className="text-sm text-slate-500">No members yet.</p>
          ) : (
            <ul className="space-y-2">
              {project.members.map((m) => (
                <li key={m.employee_id} className="flex items-center gap-3">
                  <Avatar name={m.full_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    {isAdmin ? (
                      <Link to={`/app/employees/${m.employee_id}`} className="block truncate text-sm font-semibold text-slate-800 hover:text-brand-700">
                        {m.full_name}
                      </Link>
                    ) : (
                      <p className="truncate text-sm font-semibold text-slate-800">{m.full_name}</p>
                    )}
                    <p className="truncate text-xs text-slate-500">{m.job_position}</p>
                  </div>
                  {isAdmin && <IconButton icon={X} label="Remove member" variant="danger" onClick={() => removeMember.mutate(m.employee_id)} />}
                </li>
              ))}
            </ul>
          )}
          {isAdmin && (
            <form
              className="mt-4 flex gap-2 border-t border-slate-100 pt-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (newMember) addMember.mutate()
              }}
            >
              <Select value={newMember} onChange={(e) => setNewMember(e.target.value)} aria-label="Employee to add">
                <option value="">Add member…</option>
                {candidates.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
              </Select>
              <Button type="submit" icon={UserPlus} disabled={!newMember} loading={addMember.isPending}>
                Add
              </Button>
            </form>
          )}
        </Card>
      </div>

      <ProjectFormModal project={editing} onClose={() => setEditing(null)} />
      <TaskFormModal open={creatingTask} onClose={() => setCreatingTask(false)} defaultProjectId={project.id} onSaved={invalidate} />
    </div>
  )
}
