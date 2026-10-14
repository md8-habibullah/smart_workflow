import { Lock } from 'lucide-react'
import { Button } from '../components/ui'

/** 403: signed in, but this page is for another role. */
export default function ForbiddenPage({ requirement = 'an administrator' }) {
  return (
    <div className="py-20">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <Lock className="size-7" />
        </div>
        <p className="mt-6 text-sm font-semibold text-amber-600">403</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">You don&apos;t have access</h1>
        <p className="mt-2 text-slate-500">
          This page is only available to {requirement}. If you think you should have access, ask an administrator.
        </p>
        <Button to="/app" className="mt-6">
          Back to dashboard
        </Button>
      </div>
    </div>
  )
}
