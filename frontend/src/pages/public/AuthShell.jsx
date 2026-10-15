import { CheckCircle2 } from 'lucide-react'
import Logo from '../../components/Logo'
import { GitHubIcon, REPO_URL } from '../../components/OpenSource'

const DOT_GRID = {
  backgroundImage: 'radial-gradient(rgb(255 255 255 / 0.08) 1px, transparent 1px)',
  backgroundSize: '22px 22px',
}

/** Split-screen frame shared by the login and registration pages. */
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-950 p-12 lg:flex" style={DOT_GRID}>
        <Logo dark />

        <div>
          <h2 className="text-4xl leading-tight font-bold text-white">
            The right task,
            <br />
            for the right person,
            <br />
            <span className="text-brand-300">at the right time.</span>
          </h2>
          <ul className="mt-8 space-y-3 text-brand-50/80">
            {['Skill-based, explainable recommendations', 'Live workload and capacity tracking', 'Review workflow with a full audit history'].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-brand-400" /> {t}
              </li>
            ))}
          </ul>

          {/* Small product preview */}
          <div className="mt-10 max-w-md rounded-2xl bg-white p-4 shadow-2xl shadow-black/30">
            <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Best match for “REST API for Task Allocation”</p>
            {[
              { n: 'John Doe', r: 'Senior Backend Developer', s: 92, w: 79 },
              { n: 'Nusrat Jahan', r: 'Full-Stack Developer', s: 90, w: 100 },
            ].map((c, i) => (
              <div key={c.n} className="mt-3 flex items-center gap-3">
                <span className={`flex size-8 items-center justify-center rounded-full text-[11px] font-bold text-white ${i ? 'bg-blue-500' : 'bg-brand-600'}`}>
                  {c.n.split(' ').map((p) => p[0]).join('')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{c.n}</p>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${c.s}%` }} />
                  </div>
                </div>
                <span className="text-lg font-bold text-brand-700 tabular-nums">{c.s}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-brand-100/50">
          Smart Workforce &amp; Task Allocation System
          <a href="https://habibullah.dev" rel="author" target="_blank" className="ml-2 text-xs text-brand-100/30 hover:text-brand-100/70">
            · by Habibullah
          </a>
          <a href={REPO_URL} target="_blank" rel="noopener" className="mt-2 flex w-fit items-center gap-1.5 text-xs text-brand-100/40 hover:text-brand-100/80">
            <GitHubIcon className="size-3.5" /> Free &amp; open source on GitHub
          </a>
        </p>
      </div>

      <div className="flex items-center justify-center bg-white px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <Logo className="mb-8 lg:hidden" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 text-slate-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-center text-sm text-slate-500">{footer}</div>}
        </div>
      </div>
    </div>
  )
}
