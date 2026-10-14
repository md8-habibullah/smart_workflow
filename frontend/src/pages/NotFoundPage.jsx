import { Compass } from 'lucide-react'
import { Button } from '../components/ui'

export default function NotFoundPage({ inApp = false }) {
  return (
    <div className={inApp ? 'py-20' : 'flex min-h-screen items-center justify-center bg-slate-50 px-4'}>
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Compass className="size-7" />
        </div>
        <p className="mt-6 text-sm font-semibold text-brand-600">404</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-2 text-slate-500">The page you&apos;re looking for doesn&apos;t exist or was moved.</p>
        <Button to={inApp ? '/app' : '/'} className="mt-6">
          {inApp ? 'Back to dashboard' : 'Back to home'}
        </Button>
      </div>
    </div>
  )
}
