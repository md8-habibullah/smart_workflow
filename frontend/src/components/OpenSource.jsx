/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react'
import { ArrowUpRight, GitFork, Globe, Star } from 'lucide-react'
import { cn } from './ui'

export const REPO_URL = 'https://github.com/md8-habibullah/smart_workflow'
export const SITE_URL = 'https://allocate.habibullah.dev'
export const SITE_HOST = 'allocate.habibullah.dev'
export const DEPLOY_URL = `https://vercel.com/new/clone?repository-url=${encodeURIComponent(REPO_URL)}`

/** GitHub mark (lucide v1 no longer ships brand icons). */
export function GitHubIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={cn('size-4', className)}>
      <path d="M12 .5C5.73.5.5 5.73.5 12.02c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-1.96c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.53 11.53 0 0 0 23.5 12.02C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  )
}

const STARS_KEY = 'swta.github.stars'

/** Public star count from the GitHub API, cached for the session; silently absent on any failure. */
function useStarCount() {
  const [stars, setStars] = useState(() => {
    try {
      const cached = sessionStorage.getItem(STARS_KEY)
      return cached === null ? null : Number(cached)
    } catch {
      return null
    }
  })
  useEffect(() => {
    if (stars !== null) return undefined
    const controller = new AbortController()
    fetch('https://api.github.com/repos/md8-habibullah/smart_workflow', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((repo) => {
        if (typeof repo?.stargazers_count !== 'number') return
        setStars(repo.stargazers_count)
        try {
          sessionStorage.setItem(STARS_KEY, String(repo.stargazers_count))
        } catch {
          /* not cached */
        }
      })
      .catch(() => {})
    return () => controller.abort()
  }, [stars])
  return stars
}

/** Header pill: "GitHub · ★ n". `dark` for use on the green panels. */
export function GitHubButton({ dark = false, className }) {
  const stars = useStarCount()
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener"
      title="Free and open source: star or fork it on GitHub"
      className={cn(
        'inline-flex h-9 items-center overflow-hidden rounded-lg text-sm font-semibold ring-1 transition',
        dark ? 'text-white ring-white/20 hover:bg-white/10' : 'text-slate-700 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300',
        className,
      )}
    >
      <span className="flex items-center gap-2 px-3">
        <GitHubIcon />
        <span>Open source</span>
      </span>
      <span className={cn('flex h-full items-center gap-1 border-l px-2.5 tabular-nums', dark ? 'border-white/20' : 'border-slate-200 bg-slate-50')}>
        <Star className="size-3.5 fill-amber-400 text-amber-400" />
        {stars ? stars : 'Star'}
      </span>
    </a>
  )
}

/** Landing-page band: free to use, fork it, or deploy your own copy. */
export function OpenSourceSection() {
  return (
    <section className="px-4 pb-20 sm:px-6">
      <div className="mx-auto grid max-w-6xl items-center gap-8 rounded-3xl border border-slate-200 bg-slate-950 px-6 py-10 text-white sm:px-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-brand-300 uppercase">
            <GitHubIcon className="size-3.5" /> Free &amp; open source · ISC license
          </p>
          <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Use it, learn from it, make it yours.</h2>
          <p className="mt-3 max-w-xl text-slate-300">
            The whole system is on GitHub: React frontend, Express API and the allocation engine (a dependency-free scoring module you can drop
            into your own project). Fork it for your university project or deploy your own copy to Vercel in one click. It's totally free.
          </p>
          <p className="mt-4 flex items-center gap-2 text-sm text-slate-400">
            <Globe className="size-4" /> Live demo:{' '}
            <a href={SITE_URL} className="font-medium text-white hover:text-brand-300">
              {SITE_HOST}
            </a>
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener"
            className="flex items-center justify-between gap-3 rounded-xl bg-white px-5 py-3.5 font-semibold text-slate-900 transition hover:bg-brand-50"
          >
            <span className="flex items-center gap-2.5">
              <GitHubIcon className="size-5" /> View on GitHub
            </span>
            <ArrowUpRight className="size-4 text-slate-400" />
          </a>
          <a
            href={`${REPO_URL}/fork`}
            target="_blank"
            rel="noopener"
            className="flex items-center justify-between gap-3 rounded-xl bg-white/10 px-5 py-3.5 font-semibold ring-1 ring-white/15 transition hover:bg-white/15"
          >
            <span className="flex items-center gap-2.5">
              <GitFork className="size-5" /> Fork the repository
            </span>
            <ArrowUpRight className="size-4 text-slate-400" />
          </a>
          <a
            href={DEPLOY_URL}
            target="_blank"
            rel="noopener"
            className="flex items-center justify-between gap-3 rounded-xl bg-white/10 px-5 py-3.5 font-semibold ring-1 ring-white/15 transition hover:bg-white/15"
          >
            <span className="flex items-center gap-2.5">
              <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
                <path d="M12 2 24 22H0z" />
              </svg>
              Deploy your own on Vercel
            </span>
            <ArrowUpRight className="size-4 text-slate-400" />
          </a>
        </div>
      </div>
    </section>
  )
}
