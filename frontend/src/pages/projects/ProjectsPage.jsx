import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Building2, CalendarClock, FolderKanban, Lock, Plus, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { projectsApi } from '../../lib/endpoints'
import { formatDate } from '../../lib/format'
import { Badge, Button, Card, EmptyState, PageHeader, ProgressBar, QueryView, Toggle } from '../../components/ui'
import ProjectFormModal from './ProjectFormModal'

export default function ProjectsPage() {
  const { isAdmin } = useAuth()
  const [creating, setCreating] = useState(null)
  const [includeArchived, setIncludeArchived] = useState(false)
  const query = useQuery({
    queryKey: ['projects', { includeArchived }],
    queryFn: () => projectsApi.list(includeArchived ? { includeArchived: 'true' } : undefined),
  })

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Group related tasks and track delivery progress."
        actions={
          isAdmin && (
            <>
              <div className="mr-2">
                <Toggle checked={includeArchived} onChange={setIncludeArchived} label="Show archived" />
              </div>
              <Button icon={Plus} onClick={() => setCreating({})}>
                New project
              </Button>
            </>
          )
        }
      />
      <QueryView query={query}>
        {(projects) =>
          projects.length === 0 ? (
            <Card>
              <EmptyState icon={FolderKanban} title="No projects yet" action={isAdmin && <Button icon={Plus} onClick={() => setCreating({})}>New project</Button>} />
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((p) => {
                const pct = p.total_tasks ? Math.round((p.completed_tasks / p.total_tasks) * 100) : 0
                return (
                  <Link
                    key={p.id}
                    to={`/app/projects/${p.id}`}
                    className={`flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md ${p.is_archived ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
                        <FolderKanban className="size-5" />
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {Boolean(p.requires_membership) && (
                          <Badge tone="violet">
                            <Lock className="size-3" /> Members only
                          </Badge>
                        )}
                        {Boolean(p.is_archived) && <Badge>Archived</Badge>}
                        {p.overdue_tasks > 0 && (
                          <Badge tone="red">
                            <AlertTriangle className="size-3" /> {p.overdue_tasks} overdue
                          </Badge>
                        )}
                      </div>
                    </div>
                    <h3 className="mt-4 font-semibold text-slate-900">{p.name}</h3>
                    <p className="mt-1 line-clamp-2 flex-1 text-sm text-slate-500">{p.description || 'No description.'}</p>
                    <div className="mt-4">
                      <div className="mb-1.5 flex justify-between text-xs">
                        <span className="text-slate-500">
                          {p.completed_tasks}/{p.total_tasks} tasks done
                        </span>
                        <span className="font-semibold text-slate-700">{pct}%</span>
                      </div>
                      <ProgressBar value={pct} tone={pct === 100 ? 'green' : 'brand'} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Building2 className="size-3.5" /> {p.department_name || 'No department'}
                      </span>
                      {p.end_date && (
                        <span className="flex items-center gap-1">
                          <CalendarClock className="size-3.5" /> Ends {formatDate(p.end_date)}
                        </span>
                      )}
                      {p.member_count > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="size-3.5" /> {p.member_count}
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )
        }
      </QueryView>
      <ProjectFormModal project={creating} onClose={() => setCreating(null)} />
    </div>
  )
}
