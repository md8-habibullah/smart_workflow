import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BellOff, CheckCheck, Trash2 } from 'lucide-react'
import { notificationsApi } from '../lib/endpoints'
import { formatDateTime, timeAgo } from '../lib/format'
import { Button, Card, EmptyState, IconButton, PageHeader, QueryView, Tabs, cn } from '../components/ui'

export default function NotificationsPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('all')
  const query = useQuery({
    queryKey: ['notifications', 'page', filter],
    queryFn: () => notificationsApi.list({ limit: 200, unreadOnly: filter === 'unread' ? 'true' : undefined }),
  })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] })

  const markAll = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: invalidate })
  const markOne = useMutation({ mutationFn: notificationsApi.markRead, onSuccess: invalidate })
  const remove = useMutation({ mutationFn: notificationsApi.remove, onSuccess: invalidate })

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        description="Assignments, reviews and updates that involve you."
        actions={
          <Button variant="secondary" icon={CheckCheck} onClick={() => markAll.mutate()} disabled={!query.data?.unreadCount} loading={markAll.isPending}>
            Mark all read
          </Button>
        }
      />
      <Tabs
        tabs={[
          { value: 'all', label: 'All' },
          { value: 'unread', label: 'Unread', count: query.data?.unreadCount },
        ]}
        value={filter}
        onChange={setFilter}
        className="mb-5 w-fit"
      />
      <QueryView query={query}>
        {({ items }) =>
          items.length === 0 ? (
            <Card>
              <EmptyState icon={BellOff} title="No notifications" description="You're all caught up." />
            </Card>
          ) : (
            <Card padded={false} className="divide-y divide-slate-100 overflow-hidden">
              {items.map((n) => (
                <div key={n.id} className={cn('group flex gap-4 px-5 py-4', !n.is_read && 'bg-brand-50/40')}>
                  <span className={cn('mt-2 size-2 shrink-0 rounded-full', n.is_read ? 'bg-slate-200' : 'bg-brand-500')} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{n.title}</p>
                    <p className="text-sm text-slate-600">{n.message}</p>
                    <p className="mt-1 text-xs text-slate-400" title={formatDateTime(n.created_at)}>
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-start gap-1">
                    {!n.is_read && (
                      <Button size="xs" variant="ghost" onClick={() => markOne.mutate(n.id)}>
                        Mark read
                      </Button>
                    )}
                    <IconButton icon={Trash2} label="Delete" variant="danger" onClick={() => remove.mutate(n.id)} className="opacity-0 group-hover:opacity-100" />
                  </div>
                </div>
              ))}
            </Card>
          )
        }
      </QueryView>
    </div>
  )
}
