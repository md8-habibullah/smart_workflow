import { Link } from 'react-router'
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarClock,
  CheckCircle2,
  Gauge,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Workflow,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/ui'

const FEATURES = [
  {
    icon: Sparkles,
    title: 'Smart allocation',
    text: 'Every candidate is scored on skills, workload, availability and deadline fit. The best person floats to the top, with reasons.',
  },
  {
    icon: Gauge,
    title: 'Workload balancing',
    text: 'Remaining effort (estimate minus logged hours) against weekly capacity keeps anyone from silently drowning.',
  },
  {
    icon: Workflow,
    title: 'Clear task lifecycle',
    text: 'Assigned → In progress → Review → Completed, with role-checked transitions and a full audit trail.',
  },
  {
    icon: BarChart3,
    title: 'Live reports',
    text: 'Workload, overdue work, department utilisation, project progress and on-time delivery, computed live in SQL.',
  },
  {
    icon: ShieldCheck,
    title: 'Role-based access',
    text: 'Super admins, admins and employees each see exactly what they should. Registrations require approval.',
  },
  {
    icon: Bell,
    title: 'Notifications',
    text: 'Assignments, reviews, change requests and comments notify the right people automatically.',
  },
]

const WEIGHTS = [
  { label: 'Skill match', value: 40, color: 'bg-brand-500', icon: Target },
  { label: 'Workload balance', value: 25, color: 'bg-blue-500', icon: Gauge },
  { label: 'Availability', value: 20, color: 'bg-emerald-500', icon: Users },
  { label: 'Deadline fit', value: 15, color: 'bg-violet-500', icon: CalendarClock },
]

export default function LandingPage() {
  const { status } = useAuth()
  const signedIn = status === 'authenticated'

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700">
              <svg viewBox="0 0 32 32" className="size-5" aria-hidden="true">
                <path d="M7 21.5 13 15l4 4L25 10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-[15px] font-bold text-slate-900">Smart Workforce</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-900">Features</a>
            <a href="#allocation" className="hover:text-slate-900">How allocation works</a>
          </nav>
          <div className="flex items-center gap-2">
            {signedIn ? (
              <Button to="/app" iconRight={ArrowRight}>Open dashboard</Button>
            ) : (
              <>
                <Button to="/login" variant="ghost">Sign in</Button>
                <Button to="/register" className="hidden sm:inline-flex">Get started</Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(249,115,22,0.12),transparent_70%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-20 text-center sm:px-6 sm:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            <Sparkles className="size-3.5" /> Weighted, explainable task allocation
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
            Assign every task to the <span className="text-brand-600">right person</span>, every time.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            Smart Workforce matches tasks to people by skill, capacity and deadline, then tracks the work through review
            to completion. No guesswork, no overloaded teammates.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button to={signedIn ? '/app' : '/login'} size="lg" iconRight={ArrowRight}>
              {signedIn ? 'Go to dashboard' : 'Try the live demo'}
            </Button>
            {!signedIn && (
              <Button to="/register" size="lg" variant="secondary">
                Create an account
              </Button>
            )}
          </div>
          {!signedIn && (
            <p className="mt-4 text-sm text-slate-500">Demo login: admin@smartworkflow.org / password123</p>
          )}

          {/* Mock recommendation card */}
          <div className="mx-auto mt-16 max-w-3xl rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-2xl shadow-slate-900/10">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Recommendations</p>
                  <p className="font-semibold text-slate-900">REST API for Task Allocation</p>
                </div>
                <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-red-600/15">Critical</span>
              </div>
              <div className="mt-4 space-y-2.5">
                {[
                  { name: 'John Doe', role: 'Senior Backend Developer', score: 92 },
                  { name: 'Nusrat Jahan', role: 'Full-Stack Developer', score: 90 },
                ].map((c, i) => (
                  <div key={c.name} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                      {c.name.split(' ').map((p) => p[0]).join('')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.role}</p>
                    </div>
                    {i === 0 && <span className="hidden text-xs font-semibold text-emerald-600 sm:block">Best match</span>}
                    <span className="text-lg font-bold text-slate-900 tabular-nums">{c.score}</span>
                  </div>
                ))}
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white/60 p-3 opacity-70">
                  <span className="flex size-9 items-center justify-center rounded-full bg-slate-300 text-xs font-bold text-white">JS</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-700">Jane Smith</p>
                    <p className="text-xs text-red-600">Lacks required skill: Node.js</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">Ineligible</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-slate-100 bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Everything a team lead needs</h2>
            <p className="mt-3 text-slate-600">From registration approval to the final review, in one place.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <f.icon className="size-5" />
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Allocation */}
      <section id="allocation" className="py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">How the allocation score works</h2>
            <p className="mt-4 text-slate-600">
              First, hard filters remove anyone who can&apos;t do the job: missing skills, insufficient proficiency, or
              not a member of a restricted project. Everyone left gets a 0 to 100 score:
            </p>
            <ul className="mt-6 space-y-3 text-sm text-slate-700">
              {['Ineligible candidates are listed with the exact reason', 'Admins can override with an explicit force flag', 'Every assignment is recorded in the task history'].map((t) => (
                <li key={t} className="flex gap-2">
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-500" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {WEIGHTS.map((w) => (
              <div key={w.label} className="py-3">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-semibold text-slate-800">
                    <w.icon className="size-4 text-slate-400" /> {w.label}
                  </span>
                  <span className="font-bold text-slate-900 tabular-nums">{w.value}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${w.color}`} style={{ width: `${w.value * 2.5}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-500">
        Smart Workforce &amp; Task Allocation System · University project · {new Date().getFullYear()}
      </footer>
    </div>
  )
}
