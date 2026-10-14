import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Award,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  FolderKanban,
  Hourglass,
  ListTodo,
  Play,
  Plus,
  Target,
  Timer,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { dashboardApi } from '../../lib/endpoints'
import { PROFICIENCY_META, STATUS_META, hours, parseServerDate, timeAgo, workloadTone } from '../../lib/format'
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, ProgressBar, QueryView, Skeleton, StatCard, cn } from '../../components/ui'
import { PriorityBadge } from '../../components/badges'
import TaskCard from '../../components/TaskCard'
import TaskFormModal from '../../components/TaskFormModal'

const GREEN = '#039855'
const GREEN_SOFT = '#a6f4c5'
const STATUS_COLORS = {
  PENDING: '#94a3b8',
  ASSIGNED: '#3b82f6',
  IN_PROGRESS: '#f59e0b',
  REVIEW: '#8b5cf6',
  COMPLETED: GREEN,
  CANCELLED: '#ef4444',
}
const tooltipStyle = { borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 8px 24px rgb(15 23 42 / 0.08)' }

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}
const todayLabel = () =>
  new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
const dayLabel = (iso) => new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(parseServerDate(iso))
const weekdayLabel = (iso) => new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(parseServerDate(iso))

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-80" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 lg:col-span-2" />
        <Skeleton className="h-80" />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { isAdmin } = useAuth()
  const query = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get, refetchInterval: 60_000 })
  return (
    <QueryView query={query} loader={<DashboardSkeleton />}>
      {(data) => (isAdmin ? <AdminDashboard data={data} /> : <EmployeeDashboard data={data} />)}
    </QueryView>
  )
}

// =====================================================================  shared widgets

const ACTIVITY_STYLE = {
  CREATED: { icon: Plus, className: 'bg-slate-100 text-slate-600' },
  ASSIGNED: { icon: UserCheck, className: 'bg-blue-50 text-blue-600' },
  AUTO_ASSIGNED: { icon: UserCheck, className: 'bg-blue-50 text-blue-600' },
  REASSIGNED: { icon: Users, className: 'bg-blue-50 text-blue-600' },
  UNASSIGNED: { icon: Users, className: 'bg-slate-100 text-slate-600' },
  STATUS_CHANGED: { icon: CheckCircle2, className: 'bg-brand-50 text-brand-700' },
  WORK_LOGGED: { icon: Timer, className: 'bg-amber-50 text-amber-600' },
  UPDATED: { icon: Activity, className: 'bg-violet-50 text-violet-600' },
}

function ActivityFeed({ items }) {
  if (!items?.length) return <EmptyState icon={Activity} title="No activity yet" className="py-8" />
  return (
    <ol className="space-y-4">
      {items.map((a) => {
        const style = ACTIVITY_STYLE[a.action] || ACTIVITY_STYLE.CREATED
        return (
          <li key={a.id} className="flex gap-3">
            <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', style.className)}>
              <style.icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-700">
                <span className="font-semibold text-slate-900">{a.actor_name}</span> · {a.details}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                <Link to={`/app/tasks/${a.task_id}`} className="truncate font-medium hover:text-brand-700">
                  {a.task_title}
                </Link>
                <span>·</span>
                <span className="shrink-0">{timeAgo(a.created_at)}</span>
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function MiniStat({ icon: Icon, label, value, to }) {
  return (
    <Link to={to} className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 transition hover:bg-slate-50 lg:border-b-0">
      <Icon className="size-5 shrink-0 text-brand-600" />
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-500">{label}</p>
        <p className="text-lg font-bold text-slate-900 tabular-nums">{value}</p>
      </div>
    </Link>
  )
}

// =====================================================================  admin

const ATTENTION_META = {
  OVERDUE: { label: 'Overdue', tone: 'red', icon: AlertTriangle, className: 'bg-red-50 text-red-600' },
  AWAITING_REVIEW: { label: 'Needs review', tone: 'violet', icon: Eye, className: 'bg-violet-50 text-violet-600' },
  UNASSIGNED_PRIORITY: { label: 'Unassigned', tone: 'amber', icon: Hourglass, className: 'bg-amber-50 text-amber-600' },
}

function AdminDashboard({ data }) {
  const { displayName } = useAuth()
  const [creating, setCreating] = useState(false)
  const { kpis, tasksByStatus, topWorkload, needsAttention, trend, recentActivity, projectProgress } = data

  const trendData = trend.map((d) => ({ ...d, label: dayLabel(d.date) }))
  const statusTotal = Object.values(tasksByStatus).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-brand-700">
            <CalendarDays className="size-4" /> {todayLabel()}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {greeting()}, {displayName.split(' ')[0]}
          </h1>
          <p className="mt-1 text-slate-500">Here&apos;s the state of your team&apos;s work right now.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={Target} to="/app/tasks?status=PENDING">
            Allocate work
          </Button>
          <Button icon={Plus} onClick={() => setCreating(true)}>
            New task
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Active tasks" value={kpis.activeTasks} icon={ListTodo} tone="blue" hint={`${kpis.totalTasks} tasks in total`} to="/app/tasks" />
        <StatCard label="Waiting for allocation" value={kpis.unassignedTasks} icon={Hourglass} tone="amber" hint="Unassigned tasks" to="/app/tasks?status=PENDING" />
        <StatCard
          label="Overdue"
          value={kpis.overdueTasks}
          icon={AlertTriangle}
          tone={kpis.overdueTasks ? 'red' : 'green'}
          hint={kpis.overdueTasks ? 'Past their deadline' : 'Everything on schedule'}
          to="/app/tasks?overdue=true"
        />
        <StatCard
          label="Completed (14 days)"
          value={kpis.completedLast14Days}
          icon={CheckCircle2}
          tone="green"
          hint={`${kpis.completedTasks} completed overall`}
          to="/app/tasks?status=COMPLETED"
        />
      </div>

      <Card padded={false} className="grid grid-cols-2 overflow-hidden sm:grid-cols-3 lg:grid-cols-6 lg:divide-x lg:divide-slate-100">
        <MiniStat icon={Users} label="Active employees" value={kpis.activeEmployees} to="/app/employees" />
        <MiniStat icon={FolderKanban} label="Projects" value={kpis.activeProjects} to="/app/projects" />
        <MiniStat icon={Building2} label="Departments" value={kpis.totalDepartments} to="/app/departments" />
        <MiniStat icon={Award} label="Skills" value={kpis.totalSkills} to="/app/skills" />
        <MiniStat icon={Timer} label="Hours logged (14d)" value={hours(kpis.hoursLoggedLast14Days)} to="/app/reports" />
        <MiniStat icon={UserCheck} label="Pending approvals" value={kpis.pendingApprovals} to="/app/approvals" />
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Team output" description="Hours logged and tasks completed over the last 14 days" icon={TrendingUp} />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="hoursFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GREEN} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
                <YAxis yAxisId="h" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} unit="h" />
                <YAxis yAxisId="c" orientation="right" hide allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar yAxisId="c" dataKey="completed" name="Tasks completed" fill={GREEN_SOFT} radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Area yAxisId="h" type="monotone" dataKey="hours" name="Hours logged" stroke={GREEN} strokeWidth={2.5} fill="url(#hoursFill)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex gap-5 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-brand-600" /> Hours logged
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-brand-200" /> Tasks completed
            </span>
          </div>
        </Card>

        <Card>
          <CardHeader title="Needs attention" description="Act on these first" icon={AlertTriangle} />
          {needsAttention.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="All clear" description="Nothing overdue, waiting for review or urgently unassigned." className="py-8" />
          ) : (
            <ul className="-mx-2 space-y-1">
              {needsAttention.map((t) => {
                const meta = ATTENTION_META[t.reason]
                return (
                  <li key={t.id}>
                    <Link
                      to={t.reason === 'UNASSIGNED_PRIORITY' ? `/app/tasks/${t.id}/allocate` : `/app/tasks/${t.id}`}
                      className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition hover:bg-slate-50"
                    >
                      <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg', meta.className)}>
                        <meta.icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{t.title}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                          <PriorityBadge priority={t.priority} />
                          {t.assigned_employee_name && <span className="truncate">{t.assigned_employee_name}</span>}
                        </span>
                      </span>
                      <ArrowRight className="mt-2 size-4 shrink-0 text-slate-300" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Task pipeline" description={`${statusTotal} tasks by status`} icon={ListTodo} />
          <div className="mb-5 flex h-3 overflow-hidden rounded-full bg-slate-100">
            {Object.entries(tasksByStatus).map(([s, n]) =>
              n > 0 ? <div key={s} style={{ width: `${(n / statusTotal) * 100}%`, background: STATUS_COLORS[s] }} title={`${STATUS_META[s].label}: ${n}`} /> : null,
            )}
          </div>
          <ul className="space-y-2.5">
            {Object.entries(tasksByStatus).map(([s, n]) => (
              <li key={s}>
                <Link to={`/app/tasks?status=${s}`} className="flex items-center justify-between text-sm hover:text-brand-700">
                  <span className="flex items-center gap-2.5 text-slate-600">
                    <span className="size-2.5 rounded-full" style={{ background: STATUS_COLORS[s] }} />
                    {STATUS_META[s].label}
                  </span>
                  <span className="font-semibold text-slate-900 tabular-nums">{n}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Team workload"
            description="Remaining effort vs. weekly capacity"
            icon={Users}
            action={
              <Button variant="ghost" size="sm" iconRight={ArrowRight} to="/app/reports">
                Report
              </Button>
            }
          />
          {topWorkload.length === 0 ? (
            <EmptyState title="No active employees" className="py-8" />
          ) : (
            <div className="space-y-4">
              {topWorkload.map((w) => (
                <Link key={w.employee_id} to={`/app/employees/${w.employee_id}`} className="flex items-center gap-3 hover:opacity-80">
                  <Avatar name={w.full_name} src={w.avatar_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{w.full_name}</p>
                      <span className="text-xs font-semibold text-slate-600 tabular-nums">{Math.round(w.workload_percentage)}%</span>
                    </div>
                    <ProgressBar value={w.workload_percentage} tone={workloadTone(w.workload_percentage)} className="mt-1.5" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Project progress"
            icon={FolderKanban}
            action={
              <Button variant="ghost" size="sm" iconRight={ArrowRight} to="/app/projects">
                All
              </Button>
            }
          />
          {projectProgress.length === 0 ? (
            <EmptyState title="No projects" className="py-8" />
          ) : (
            <div className="space-y-4">
              {projectProgress.map((p) => (
                <Link key={p.project_id} to={`/app/projects/${p.project_id}`} className="block hover:opacity-80">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <p className="truncate font-semibold text-slate-900">{p.project_name}</p>
                    <span className="font-semibold text-slate-600 tabular-nums">{Math.round(p.progress_percentage)}%</span>
                  </div>
                  <ProgressBar value={p.progress_percentage} className="mt-1.5" />
                  <p className="mt-1 text-xs text-slate-500">
                    {p.completed_tasks}/{p.total_tasks} done
                    {p.overdue_tasks > 0 && <span className="font-semibold text-red-600"> · {p.overdue_tasks} overdue</span>}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent activity" description="Latest changes across all tasks" icon={Activity} />
          <ActivityFeed items={recentActivity} />
        </Card>
        <Card>
          <CardHeader
            title="Upcoming deadlines"
            description="Open tasks ordered by due date"
            icon={Clock}
            action={
              <Button variant="ghost" size="sm" iconRight={ArrowRight} to="/app/tasks">
                All tasks
              </Button>
            }
          />
          {data.upcomingDeadlines.length === 0 ? (
            <EmptyState title="Nothing due" className="py-8" />
          ) : (
            <div className="space-y-3">
              {data.upcomingDeadlines.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <TaskFormModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

// =====================================================================  employee

function WorkloadRing({ value }) {
  const pct = Math.max(0, Math.min(100, value))
  const r = 42
  const c = 2 * Math.PI * r
  const color = value > 100 ? '#f87171' : value >= 60 ? '#fbbf24' : '#6ce9a6'
  return (
    <div className="relative size-28 shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(255 255 255 / 0.15)" strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <span className="text-2xl font-bold tabular-nums">{value}%</span>
        <span className="text-[10px] tracking-wide text-brand-100/70 uppercase">booked</span>
      </div>
    </div>
  )
}

function EmployeeDashboard({ data }) {
  const { user, displayName } = useAuth()
  const { kpis, upcomingDeadlines, trend, recentActivity, skills, skillCount } = data
  const trendData = trend.map((d) => ({ ...d, label: weekdayLabel(d.date) }))

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 to-brand-950 text-white shadow-sm">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex items-center gap-4">
            <Avatar name={displayName} src={user?.avatarUrl} size="lg" className="ring-4 ring-white/15" />
            <div>
              <p className="text-sm text-brand-100/80">
                {greeting()} · {todayLabel()}
              </p>
              <h1 className="text-2xl font-bold">{displayName}</h1>
              <p className="text-sm text-brand-100/80">
                {user?.employee?.position} · {user?.employee?.departmentName || 'No department'} · {user?.employee?.code}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-5 rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
            <WorkloadRing value={kpis.workloadPercentage} />
            <div className="text-sm">
              <p className="font-semibold">Weekly workload</p>
              <p className="mt-1 text-brand-100/80">
                {hours(kpis.outstandingHours)} remaining
                <br />
                of {hours(kpis.weeklyCapacityHours)} capacity
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Not started" value={kpis.notStarted} icon={Play} tone="blue" hint="Assigned to you" to="/app/tasks?status=ASSIGNED" />
        <StatCard label="In progress" value={kpis.inProgress} icon={Timer} tone="amber" to="/app/tasks?status=IN_PROGRESS" />
        <StatCard label="In review" value={kpis.inReview} icon={Eye} tone="violet" to="/app/tasks?status=REVIEW" />
        <StatCard
          label="Overdue"
          value={kpis.overdueTasks}
          icon={AlertTriangle}
          tone={kpis.overdueTasks ? 'red' : 'green'}
          hint={kpis.overdueTasks ? 'Needs attention' : 'Nothing overdue'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Your hours this week"
            description={`${hours(kpis.hoursLoggedThisWeek)} logged in the last 7 days · ${hours(kpis.hoursLoggedToday)} today`}
            icon={Timer}
          />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} unit="h" allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} formatter={(v) => [`${v}h`, 'Logged']} />
                <Bar dataKey="hours" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {trendData.map((d, i) => (
                    <Cell key={d.date} fill={i === trendData.length - 1 ? GREEN : GREEN_SOFT} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="My skills"
            description={`${skillCount} skill${skillCount === 1 ? '' : 's'} on your profile`}
            icon={Award}
            action={
              <Button variant="ghost" size="sm" to="/app/profile">
                Edit
              </Button>
            }
          />
          {skills.length === 0 ? (
            <EmptyState
              icon={Award}
              title="No skills yet"
              description="Add skills so you get matched to the right tasks."
              className="py-6"
              action={
                <Button size="sm" to="/app/profile">
                  Add skills
                </Button>
              }
            />
          ) : (
            <ul className="space-y-3">
              {skills.map((s) => (
                <li key={s.skill_id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800">{s.skill_name}</span>
                    <span className="text-xs text-slate-500">{PROFICIENCY_META[s.proficiency_level].label}</span>
                  </div>
                  <ProgressBar value={s.numeric_score} className="mt-1" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Your upcoming work"
            description="Open tasks ordered by deadline"
            icon={ListTodo}
            action={
              <Button variant="ghost" size="sm" iconRight={ArrowRight} to="/app/tasks">
                All my tasks
              </Button>
            }
          />
          {upcomingDeadlines.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="You're all caught up" description="New assignments will show up here." className="py-8" />
          ) : (
            <div className="space-y-3">
              {upcomingDeadlines.map((t) => (
                <TaskCard key={t.id} task={t} showAssignee={false} />
              ))}
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Activity on your tasks" icon={Activity} />
          <ActivityFeed items={recentActivity} />
        </Card>
      </div>
    </div>
  )
}
