import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, CheckCircle2, Download } from 'lucide-react'
import { reportsApi } from '../../lib/endpoints'
import { formatDateTime, hours, workloadTone } from '../../lib/format'
import { exportCsv } from '../../lib/csv'
import { Avatar, Button, Card, CardHeader, EmptyState, PageHeader, ProgressBar, QueryView, Tabs } from '../../components/ui'
import { PriorityBadge, StatusBadge, WorkloadBadge } from '../../components/badges'

const TABS = [
  { value: 'workload', label: 'Employee workload' },
  { value: 'overdue', label: 'Overdue tasks' },
  { value: 'departments', label: 'Departments' },
  { value: 'projects', label: 'Project progress' },
  { value: 'performance', label: 'Performance' },
]

const tooltipStyle = { borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }

export default function ReportsPage() {
  const [tab, setTab] = useState('workload')
  const loaders = {
    workload: reportsApi.workload,
    overdue: reportsApi.overdue,
    departments: reportsApi.departments,
    projects: reportsApi.projects,
    performance: reportsApi.performance,
  }
  const query = useQuery({ queryKey: ['reports', tab], queryFn: loaders[tab] })

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Live analytics computed from the database."
        actions={
          <Button variant="secondary" icon={Download} onClick={() => exportCsv(tab, query.data)} disabled={!query.data?.length}>
            Export CSV
          </Button>
        }
      />
      <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-6" />
      <QueryView query={query}>
        {(rows) => {
          if (tab === 'workload') return <WorkloadReport rows={rows} />
          if (tab === 'overdue') return <OverdueReport rows={rows} />
          if (tab === 'departments') return <DepartmentReport rows={rows} />
          if (tab === 'projects') return <ProjectReport rows={rows} />
          return <PerformanceReport rows={rows} />
        }}
      </QueryView>
    </div>
  )
}

function WorkloadReport({ rows }) {
  if (!rows.length) return <Card><EmptyState title="No active employees" /></Card>
  const chart = rows.map((r) => ({ name: r.full_name.split(' ')[0], workload: r.workload_percentage }))
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Workload vs. weekly capacity" description="Remaining effort on active tasks ÷ (daily capacity × 5)" />
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis unit="%" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, 'Workload']} cursor={{ fill: '#f1f5f9' }} />
              <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Capacity', fill: '#ef4444', fontSize: 11, position: 'insideTopRight' }} />
              <Bar dataKey="workload" fill="#039855" radius={[6, 6, 0, 0]} maxBarSize={44} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Active tasks</th>
                <th>Remaining / capacity</th>
                <th className="w-56">Workload</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.employee_id}>
                  <td>
                    <Link to={`/app/employees/${r.employee_id}`} className="flex items-center gap-2.5 font-semibold text-slate-900 hover:text-brand-700">
                      <Avatar name={r.full_name} src={r.avatar_url} size="xs" /> {r.full_name}
                    </Link>
                  </td>
                  <td className="text-slate-600">{r.department_name || '—'}</td>
                  <td className="tabular-nums">{r.active_tasks}</td>
                  <td className="whitespace-nowrap tabular-nums">
                    {hours(r.total_assigned_hours)} / {hours(r.weekly_capacity_hours)}
                  </td>
                  <td>
                    <ProgressBar value={r.workload_percentage} tone={workloadTone(r.workload_percentage)} showLabel />
                  </td>
                  <td>
                    <WorkloadBadge status={r.workload_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function OverdueReport({ rows }) {
  if (!rows.length) {
    return (
      <Card>
        <EmptyState icon={CheckCircle2} title="Nothing is overdue" description="Every open task is still within its deadline." />
      </Card>
    )
  }
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700">
        <AlertTriangle className="size-4" /> {rows.length} task{rows.length === 1 ? '' : 's'} past deadline
      </div>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Task</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Assignee</th>
              <th>Deadline</th>
              <th>Overdue by</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.task_id}>
                <td>
                  <Link to={`/app/tasks/${r.task_id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                    {r.task_title}
                  </Link>
                  <p className="text-xs text-slate-500">{r.project_name}</p>
                </td>
                <td>
                  <PriorityBadge priority={r.priority} />
                </td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td>{r.assigned_employee_name || <span className="text-slate-400">Unassigned</span>}</td>
                <td className="whitespace-nowrap text-slate-600">{formatDateTime(r.deadline)}</td>
                <td className="font-semibold whitespace-nowrap text-red-600">
                  {r.hours_overdue >= 48 ? `${Math.floor(r.hours_overdue / 24)} days` : `${r.hours_overdue} hours`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function DepartmentReport({ rows }) {
  const chart = rows.map((r) => ({ name: r.department_name, Capacity: r.weekly_capacity_hours, Assigned: r.total_assigned_hours }))
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Capacity vs. assigned effort" description="Weekly hours per department" />
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis unit="h" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Capacity" fill="#cbd5e1" radius={[6, 6, 0, 0]} maxBarSize={36} />
              <Bar dataKey="Assigned" fill="#039855" radius={[6, 6, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((r) => (
          <Card key={r.department_id}>
            <p className="font-semibold text-slate-900">{r.department_name}</p>
            <p className="mt-1 text-sm text-slate-500">
              {r.total_employees} employee{r.total_employees === 1 ? '' : 's'} · {r.active_tasks} active tasks
            </p>
            <p className="mt-4 text-2xl font-bold text-slate-900">{r.utilization_percentage ?? 0}%</p>
            <ProgressBar value={r.utilization_percentage ?? 0} tone={workloadTone(r.utilization_percentage ?? 0)} className="mt-2" />
            <p className="mt-2 text-xs text-slate-500">utilisation</p>
          </Card>
        ))}
      </div>
    </div>
  )
}

function ProjectReport({ rows }) {
  if (!rows.length) return <Card><EmptyState title="No active projects" /></Card>
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rows.map((r) => (
        <Card key={r.project_id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <Link to={`/app/projects/${r.project_id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                {r.project_name}
              </Link>
              <p className="text-sm text-slate-500">{r.department_name || 'No department'}</p>
            </div>
            <p className="text-2xl font-bold text-slate-900">{Math.round(r.progress_percentage)}%</p>
          </div>
          <ProgressBar value={r.progress_percentage} tone={r.progress_percentage === 100 ? 'green' : 'brand'} className="mt-4" />
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            {[
              ['Total', r.total_tasks, 'text-slate-900'],
              ['Done', r.completed_tasks, 'text-emerald-600'],
              ['Active', r.active_tasks, 'text-blue-600'],
              ['Overdue', r.overdue_tasks, r.overdue_tasks ? 'text-red-600' : 'text-slate-400'],
            ].map(([label, value, color]) => (
              <div key={label} className="rounded-lg bg-slate-50 py-2">
                <p className={`text-lg font-bold tabular-nums ${color}`}>{value ?? 0}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

function PerformanceReport({ rows }) {
  if (!rows.length) return <Card><EmptyState title="No data yet" /></Card>
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Department</th>
              <th>Completed</th>
              <th className="w-56">On-time rate</th>
              <th>Hours (7 days)</th>
              <th>Hours (total)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.employee_id}>
                <td>
                  <Link to={`/app/employees/${r.employee_id}`} className="flex items-center gap-2.5 font-semibold text-slate-900 hover:text-brand-700">
                    <Avatar name={r.full_name} src={r.avatar_url} size="xs" /> {r.full_name}
                  </Link>
                </td>
                <td className="text-slate-600">{r.department_name || '—'}</td>
                <td className="tabular-nums">
                  {r.completed_tasks} <span className="text-xs text-slate-400">({r.on_time_tasks} on time)</span>
                </td>
                <td>
                  {r.completed_tasks ? (
                    <ProgressBar value={r.on_time_rate} tone={r.on_time_rate >= 80 ? 'green' : r.on_time_rate >= 50 ? 'amber' : 'red'} showLabel />
                  ) : (
                    <span className="text-xs text-slate-400">No completed tasks</span>
                  )}
                </td>
                <td className="tabular-nums">{hours(r.hours_last_7_days)}</td>
                <td className="tabular-nums">{hours(r.total_hours_logged)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
