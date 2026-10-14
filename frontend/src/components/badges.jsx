import { CalendarClock } from 'lucide-react'
import { Badge, cn } from './ui'
import {
  PRIORITY_META,
  PROFICIENCY_META,
  ROLE_META,
  STATUS_META,
  WORKLOAD_META,
  formatDate,
  formatDateTime,
  parseServerDate,
  timeAgo,
} from '../lib/format'

export function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, tone: 'slate' }
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  )
}

export function PriorityBadge({ priority }) {
  const meta = PRIORITY_META[priority] || { label: priority, tone: 'slate' }
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}

export function RoleBadge({ role }) {
  const meta = ROLE_META[role] || { label: role, tone: 'slate' }
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}

export function ProficiencyBadge({ level }) {
  const meta = PROFICIENCY_META[level] || { label: level, tone: 'slate' }
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}

export function WorkloadBadge({ status }) {
  const meta = WORKLOAD_META[status] || { label: status, tone: 'slate' }
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  )
}

export function ApprovalBadge({ status }) {
  const tone = { APPROVED: 'green', PENDING: 'amber', REJECTED: 'red' }[status] || 'slate'
  return <Badge tone={tone}>{status?.charAt(0) + status?.slice(1).toLowerCase()}</Badge>
}

/** Deadline with relative time; red when overdue on an open task. */
export function Deadline({ value, overdue, done, className }) {
  const date = parseServerDate(value)
  const isOverdue = overdue ?? (!done && date && date.getTime() < Date.now())
  return (
    <span
      title={formatDateTime(value)}
      className={cn('inline-flex items-center gap-1.5 text-sm', isOverdue ? 'font-semibold text-red-600' : 'text-slate-600', className)}
    >
      <CalendarClock className="size-3.5 shrink-0" />
      {isOverdue ? `Overdue · ${timeAgo(value)}` : done ? formatDate(value) : timeAgo(value)}
    </span>
  )
}
