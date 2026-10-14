import { useState } from 'react'
import { useNavigate } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { UserPlus, Users } from 'lucide-react'
import { departmentsApi, employeesApi } from '../../lib/endpoints'
import { hours, workloadTone } from '../../lib/format'
import { useDebounced } from '../../lib/useDebounced'
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, PageHeader, ProgressBar, SearchInput, Select, Skeleton, cn } from '../../components/ui'
import { RoleBadge } from '../../components/badges'
import CreateUserModal from '../admin/CreateUserModal'

export default function EmployeesPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [creating, setCreating] = useState(false)
  const debounced = useDebounced(search)

  const filters = { search: debounced || undefined, departmentId: departmentId || undefined, status }
  const employees = useQuery({ queryKey: ['employees', filters], queryFn: () => employeesApi.list(filters), placeholderData: keepPreviousData })
  const departments = useQuery({ queryKey: ['departments'], queryFn: departmentsApi.list })

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Team members, their capacity and current workload."
        actions={
          <Button icon={UserPlus} onClick={() => setCreating(true)}>
            Add employee
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, code, email or position…" className="sm:max-w-sm sm:flex-1" />
        <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="sm:w-56" aria-label="Department">
          <option value="">All departments</option>
          {departments.data?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-40" aria-label="Status">
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="ALL">All</option>
        </Select>
      </div>

      {employees.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : employees.isError ? (
        <Card>
          <ErrorState error={employees.error} onRetry={() => employees.refetch()} />
        </Card>
      ) : employees.data.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title="No employees found" description="Adjust the filters or add a new employee." />
        </Card>
      ) : (
        <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-3', employees.isFetching && 'opacity-70')}>
          {employees.data.map((e) => {
            const weekly = e.daily_capacity_hours * 5
            const pct = Math.round((e.outstanding_hours / weekly) * 100)
            const inactive = !e.is_active || !e.user_active
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => navigate(`/app/employees/${e.id}`)}
                className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={e.full_name} src={e.avatar_url} className={inactive ? 'opacity-50' : ''} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{e.full_name}</p>
                    <p className="truncate text-sm text-slate-500">{e.job_position}</p>
                  </div>
                  {e.role !== 'EMPLOYEE' ? <RoleBadge role={e.role} /> : inactive ? <Badge tone="red">Inactive</Badge> : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="font-mono">{e.employee_code}</span>
                  <span>·</span>
                  <span>{e.department_name || 'No department'}</span>
                  {e.approval_status !== 'APPROVED' && (
                    <Badge tone="amber" className="ml-auto">
                      {e.approval_status.toLowerCase()}
                    </Badge>
                  )}
                </div>
                {e.role === 'EMPLOYEE' && (
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="text-slate-500">
                        {e.active_task_count} active · {hours(e.outstanding_hours)} / {hours(weekly)}
                      </span>
                      <span className="font-semibold text-slate-700">{pct}%</span>
                    </div>
                    <ProgressBar value={pct} tone={workloadTone(pct)} />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      <CreateUserModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}
