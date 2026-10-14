import { useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Columns3,
  Database,
  Eye,
  Gauge,
  LayoutDashboard,
  ListChecks,
  Lock,
  Menu,
  Search,
  ShieldCheck,
  Target,
  UserCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Button, cn } from '../../components/ui'
import Logo from '../../components/Logo'
import DemoAccounts from '../../components/DemoAccounts'

// ------------------------------------------------------------------ content

const NAV = [
  ['#how-it-works', 'How it works'],
  ['#tour', 'Product tour'],
  ['#features', 'Features'],
  ['#demo', 'Live demo'],
]

const STATS = [
  { value: '4-factor', label: 'explainable match score' },
  { value: '3 roles', label: 'super admin · admin · employee' },
  { value: '5 reports', label: 'live analytics with CSV export' },
  { value: '72 tests', label: 'automated API integration tests' },
]

const STEPS = [
  { icon: ClipboardList, title: 'Create the task', text: 'Set the project, effort, deadline and the skills (with minimum level) the work needs.' },
  { icon: Target, title: 'Get ranked candidates', text: 'Everyone is checked for eligibility, then scored on skills, workload, availability and deadline fit.' },
  { icon: UserCheck, title: 'Assign in one click', text: 'Pick the best match (or let the system auto-assign). The employee is notified instantly.' },
  { icon: ListChecks, title: 'Track to completion', text: 'Employees log time and submit for review; admins approve or request changes. Every step is audited.' },
]

const TOUR = [
  {
    key: 'dashboard',
    label: 'Admin dashboard',
    icon: LayoutDashboard,
    title: 'Everything that needs your attention, at a glance',
    points: ['Live KPIs for active, unassigned, overdue and completed work', '14-day team output trend', 'Needs-attention list: overdue, awaiting review, urgent & unassigned', 'Workload per person, project progress and an activity feed'],
  },
  {
    key: 'allocation',
    label: 'Smart allocation',
    icon: Target,
    title: 'Ranked, explainable recommendations',
    points: ['Score breakdown for every eligible candidate', 'Warnings when a deadline or weekly capacity is at risk', 'Ineligible people listed with the exact reason', 'Assign, reassign with a reason, or auto-assign the best match'],
  },
  {
    key: 'board',
    label: 'Task board',
    icon: Columns3,
    title: 'Kanban board with real workflow rules',
    points: ['Drag cards between columns to change status', 'Only allowed transitions are accepted (employees can’t approve their own work)', 'Overdue cards are flagged in red', 'Switch to a filterable list view and export to CSV'],
  },
  {
    key: 'task-detail',
    label: 'Task detail',
    icon: ClipboardList,
    title: 'One place for the whole story of a task',
    points: ['Next-step actions tailored to your role', 'Comments, time logs and a full history timeline', 'Estimated vs. logged vs. remaining effort', 'Required skills and previous assignees'],
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: BarChart3,
    title: 'Analytics computed live from the database',
    points: ['Employee workload vs. capacity', 'Overdue tasks and department utilisation', 'Project progress and on-time delivery rate', 'One-click CSV export of every report'],
  },
  {
    key: 'employee',
    label: 'Employee view',
    icon: Users,
    title: 'A focused workspace for every team member',
    points: ['Personal workload ring and hours logged this week', 'Upcoming work ordered by deadline', 'Keep your own skill profile up to date', 'Notifications for assignments, reviews and comments'],
  },
]

const FEATURES = [
  { icon: Target, title: 'Skill-based eligibility', text: 'Minimum proficiency per skill, plus members-only projects. Nobody gets work they can’t do.' },
  { icon: Gauge, title: 'Workload balancing', text: 'Remaining effort (estimate minus logged hours) against each person’s weekly capacity.' },
  { icon: CalendarClock, title: 'Deadline-aware', text: 'Checks the hours someone actually has free before the deadline, not just this week.' },
  { icon: ShieldCheck, title: 'Approval & roles', text: 'Self-registration needs admin approval. Access is enforced by the API, not just hidden in the UI.' },
  { icon: Bell, title: 'Notifications', text: 'Assignments, reviews, change requests and comments reach the right people automatically.' },
  { icon: Search, title: 'Quick search', text: 'Press Ctrl K anywhere to jump to any task, project, employee or page.' },
  { icon: Eye, title: 'Full audit trail', text: 'Every assignment, status change and logged hour is recorded with who and when.' },
  { icon: Database, title: 'Zero-setup database', text: 'Embedded SQLite with migrations and realistic demo data. Just run npm run dev.' },
]

const ROLES = [
  {
    icon: ShieldCheck,
    role: 'Super Admin',
    points: ['Everything an admin can do', 'Create admin accounts', 'Change roles of any user', 'Manage other super admins'],
  },
  {
    icon: UserCog,
    role: 'Admin',
    points: ['Create & edit tasks and projects', 'Allocate, reassign, approve work', 'Approve registrations, manage people', 'Departments, skills and reports'],
  },
  {
    icon: Users,
    role: 'Employee',
    points: ['See only their own tasks', 'Start work, log time, comment', 'Submit work for review', 'Maintain their skill profile'],
  },
]

const SEED = ['9 accounts across 3 roles (1 awaiting approval)', '4 departments and 11 skills', '3 projects, one of them members-only', '15 tasks in every status, incl. one overdue', 'Two weeks of time logs, comments and history']

// ------------------------------------------------------------------ pieces

function BrowserFrame({ src, alt, className }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15', className)}>
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-red-400" />
        <span className="size-2.5 rounded-full bg-amber-400" />
        <span className="size-2.5 rounded-full bg-emerald-400" />
        <span className="ml-3 flex flex-1 items-center gap-1.5 rounded-md bg-white px-3 py-1 text-xs text-slate-400 ring-1 ring-slate-200">
          <Lock className="size-3" /> smart-workforce.local/app
        </span>
      </div>
      <img src={src} alt={alt} className="block w-full" loading="lazy" width="1440" height="900" />
    </div>
  )
}

function SectionHeading({ eyebrow, title, text, center = true }) {
  return (
    <div className={cn('max-w-2xl', center && 'mx-auto text-center')}>
      <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
      {text && <p className="mt-4 text-lg text-slate-600">{text}</p>}
    </div>
  )
}

// ------------------------------------------------------------------ page

export default function LandingPage() {
  const { status } = useAuth()
  const signedIn = status === 'authenticated'
  const [tour, setTour] = useState(TOUR[0].key)
  const [menuOpen, setMenuOpen] = useState(false)
  const current = TOUR.find((t) => t.key === tour)

  return (
    <div className="min-h-screen bg-white text-slate-800">
      {/* ---------------- nav */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo subtitle={false} />
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 lg:flex">
            {NAV.map(([href, label]) => (
              <a key={href} href={href} className="transition hover:text-brand-700">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {signedIn ? (
              <Button to="/app" iconRight={ArrowRight}>
                Open dashboard
              </Button>
            ) : (
              <>
                <Button to="/login" variant="ghost" className="hidden sm:inline-flex">
                  Sign in
                </Button>
                <Button to="/register">Get started</Button>
              </>
            )}
            <button type="button" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="border-t border-slate-100 px-4 py-3 lg:hidden">
            {NAV.map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {label}
              </a>
            ))}
            {!signedIn && (
              <Link to="/login" className="block rounded-lg px-3 py-2.5 text-sm font-medium text-brand-700 hover:bg-slate-50">
                Sign in
              </Link>
            )}
          </nav>
        )}
      </header>

      {/* ---------------- hero */}
      <section
        className="relative border-b border-slate-100 bg-gradient-to-b from-brand-50/70 to-white"
        style={{ backgroundImage: 'radial-gradient(rgb(2 122 72 / 0.07) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      >
        <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-800 shadow-sm">
              <CheckCircle2 className="size-3.5 text-brand-600" /> Skill-based task allocation for teams
            </span>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
              Assign every task to the <span className="text-brand-700">right person</span>.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
              Smart Workforce matches work to people by skill, capacity and deadline, then tracks it through review to
              completion. No guesswork, no overloaded teammates.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {signedIn ? (
                <Button to="/app" size="lg" iconRight={ArrowRight}>
                  Go to your dashboard
                </Button>
              ) : (
                <>
                  <Button size="lg" iconRight={ArrowRight} onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}>
                    Try the live demo
                  </Button>
                  <Button to="/register" size="lg" variant="secondary">
                    Create an account
                  </Button>
                </>
              )}
            </div>
            {!signedIn && (
              <p className="mt-5 text-sm text-slate-500">
                Demo login: <code className="rounded bg-white px-1.5 py-0.5 font-semibold text-slate-800 ring-1 ring-slate-200">admin@smartworkflow.org</code> /{' '}
                <code className="rounded bg-white px-1.5 py-0.5 font-semibold text-slate-800 ring-1 ring-slate-200">password123</code>
              </p>
            )}
          </div>
          <div className="relative mx-auto mt-14 max-w-6xl">
            <BrowserFrame src="/screenshots/dashboard.jpg" alt="Admin dashboard with KPIs, output trend and needs-attention list" className="relative z-10 -mb-10 sm:-mb-24" />
          </div>
        </div>
      </section>

      {/* ---------------- stats */}
      <section className="border-b border-slate-100 bg-white pt-20 sm:pt-36">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 pb-14 sm:px-6 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-extrabold tracking-tight text-brand-700">{s.value}</p>
              <p className="mt-1 text-sm text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- how it works */}
      <section id="how-it-works" className="scroll-mt-20 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="How it works" title="From new task to approved work in four steps" />
          <ol className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="absolute -top-3 left-6 rounded-full bg-brand-700 px-2.5 py-0.5 text-xs font-bold text-white">Step {i + 1}</span>
                <div className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <s.icon className="size-5" />
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------- product tour */}
      <section id="tour" className="scroll-mt-20 border-y border-slate-100 bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading eyebrow="Product tour" title="See the real system" text="Every screen below is a live screenshot of the app running on its demo data." />
          <div className="mt-10 flex justify-center">
            <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200 scroll-thin" role="tablist">
              {TOUR.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tour === t.key}
                  onClick={() => setTour(t.key)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition',
                    tour === t.key ? 'bg-brand-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                  )}
                >
                  <t.icon className="size-4" /> {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-10 grid items-center gap-10 lg:grid-cols-[1fr_2.2fr]">
            <div>
              <h3 className="text-2xl font-bold tracking-tight text-slate-900">{current.title}</h3>
              <ul className="mt-6 space-y-3.5">
                {current.points.map((p) => (
                  <li key={p} className="flex gap-3 text-slate-700">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-600" /> {p}
                  </li>
                ))}
              </ul>
            </div>
            <BrowserFrame key={current.key} src={`/screenshots/${current.key}.jpg`} alt={current.title} className="animate-fade-in" />
          </div>
        </div>
      </section>

      {/* ---------------- scoring */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <SectionHeading
              center={false}
              eyebrow="The allocation score"
              title="Transparent maths, not a black box"
              text="First, hard filters remove anyone missing a required skill, below the minimum level, or outside a members-only project. Everyone left gets a 0 to 100 score:"
            />
            <ul className="mt-6 space-y-2 text-sm text-slate-700">
              {['Ineligible people are listed with the exact reason', 'Admins can override with an explicit, recorded force flag', 'Ties break on free capacity, then name'].map((t) => (
                <li key={t} className="flex gap-2">
                  <CheckCircle2 className="size-5 shrink-0 text-brand-600" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            {[
              { label: 'Skill match', value: 40, text: 'Depth of proficiency above the required minimum', icon: Target },
              { label: 'Workload balance', value: 25, text: 'Share of weekly capacity still free', icon: Gauge },
              { label: 'Availability', value: 20, text: 'Fewer parallel tasks scores higher', icon: Users },
              { label: 'Deadline fit', value: 15, text: 'Free hours before the deadline vs. effort', icon: CalendarClock },
            ].map((w) => (
              <div key={w.label} className="border-b border-slate-100 py-4 first:pt-0 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-semibold text-slate-900">
                    <w.icon className="size-4 text-brand-600" /> {w.label}
                  </span>
                  <span className="text-lg font-bold text-brand-700 tabular-nums">{w.value}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${w.value * 2.5}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">{w.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- features */}
      <section id="features" className="scroll-mt-20 border-t border-slate-100 bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Features" title="Everything a team lead needs" text="From registration approval to the final review, in one place." />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <f.icon className="size-5" />
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 grid gap-5 md:grid-cols-3">
            {ROLES.map((r) => (
              <div key={r.role} className="rounded-2xl bg-brand-950 p-6 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-white/10">
                    <r.icon className="size-5 text-brand-300" />
                  </div>
                  <h3 className="text-lg font-semibold">{r.role}</h3>
                </div>
                <ul className="mt-5 space-y-2.5 text-sm text-brand-50/80">
                  {r.points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-400" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- demo */}
      <section id="demo" className="scroll-mt-20 py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <SectionHeading
              center={false}
              eyebrow="Live demo"
              title="Sign in with one click"
              text="The database comes pre-loaded with a realistic team, so every screen has something to show. All accounts share one password."
            />
            <div className="mt-8 rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
              <p className="text-sm font-semibold text-brand-900">Included demo data</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {SEED.map((s) => (
                  <li key={s} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-600" /> {s}
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-6 text-sm text-slate-500">
              Tip: sign in as <strong>Admin</strong>, allocate “REST API for Task Allocation”, then sign in as the person you
              chose to start the work.
            </p>
          </div>
          <DemoAccounts />
        </div>
      </section>

      {/* ---------------- CTA */}
      <section className="px-4 pb-20 sm:px-6">
        <div
          className="mx-auto flex max-w-6xl flex-col items-center gap-6 overflow-hidden rounded-3xl bg-brand-800 px-6 py-14 text-center sm:px-12"
          style={{ backgroundImage: 'radial-gradient(rgb(255 255 255 / 0.08) 1px, transparent 1px)', backgroundSize: '22px 22px' }}
        >
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">Ready to balance your team&apos;s work?</h2>
          <p className="max-w-xl text-brand-100/90">Create an account and an administrator will approve you, or explore right now with a demo account.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button to={signedIn ? '/app' : '/login'} size="lg" variant="secondary" iconRight={ArrowRight}>
              {signedIn ? 'Open dashboard' : 'Sign in to the demo'}
            </Button>
            {!signedIn && (
              <Button to="/register" size="lg" className="bg-white/10 ring-1 ring-white/20 hover:bg-white/20">
                Create an account
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* ---------------- footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6">
          <Logo subtitle={false} />
          <p>Smart Workforce &amp; Task Allocation System · University project · {new Date().getFullYear()}</p>
          <div className="flex gap-5">
            <Link to="/login" className="hover:text-brand-700">
              Sign in
            </Link>
            <Link to="/register" className="hover:text-brand-700">
              Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
