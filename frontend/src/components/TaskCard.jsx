import { Link } from 'react-router'
import { Clock, FolderKanban, MessageSquare, User } from 'lucide-react'
import { Avatar, ProgressBar, cn } from './ui'
import { Deadline, PriorityBadge, StatusBadge } from './badges'
import { hours } from '../lib/format'

/** Compact clickable task row used by dashboards and lists. */
export default function TaskCard({ task, showAssignee = true, className }) {
  const done = task.status === 'COMPLETED' || task.status === 'CANCELLED'
  const progress = task.estimated_hours > 0 ? (task.logged_hours / task.estimated_hours) * 100 : 0

  return (
    <Link
      to={`/app/tasks/${task.id}`}
      className={cn(
        'group block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-200 hover:shadow-md',
        task.is_overdue ? 'border-l-4 border-l-red-400' : '',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        <span className="ml-auto">
          <Deadline value={task.deadline} overdue={Boolean(task.is_overdue)} done={done} className="text-xs" />
        </span>
      </div>
      <p className="mt-2.5 font-semibold text-slate-900 group-hover:text-brand-700">{task.title}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <FolderKanban className="size-3.5" /> {task.project_name}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3.5" /> {hours(task.logged_hours)} / {hours(task.estimated_hours)}
        </span>
        {task.comment_count > 0 && (
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="size-3.5" /> {task.comment_count}
          </span>
        )}
        {showAssignee && (
          <span className="inline-flex items-center gap-1.5">
            {task.assigned_employee_name ? (
              <>
                <Avatar name={task.assigned_employee_name} src={task.assigned_avatar_url} size="xs" />
                {task.assigned_employee_name}
              </>
            ) : (
              <>
                <User className="size-3.5" /> Unassigned
              </>
            )}
          </span>
        )}
      </div>
      {!done && task.logged_hours > 0 && <ProgressBar value={progress} className="mt-3" tone={progress > 100 ? 'red' : 'brand'} />}
    </Link>
  )
}
