import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BarChart3,
  Bell,
  BellOff,
  Building2,
  CheckCheck,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Mail,
  Menu,
  Search,
  Award,
  UserCheck,
  UserCircle,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { dashboardApi, notificationsApi } from '../../lib/endpoints'
import { timeAgo } from '../../lib/format'
import { Avatar, IconButton, Spinner, cn } from '../ui'
import { RoleBadge } from '../badges'
import Logo, { LogoMark } from '../Logo'
import CommandPalette, { useCommandPalette } from '../CommandPalette'
import { useSidebar } from './useSidebar'

const ADMIN_NAV = [
  { section: 'Overview' },
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/tasks', label: 'Tasks', icon: ListTodo },
  { to: '/app/projects', label: 'Projects', icon: FolderKanban },
  { section: 'People' },
  { to: '/app/employees', label: 'Employees', icon: Users },
  { to: '/app/departments', label: 'Departments', icon: Building2 },
  { to: '/app/skills', label: 'Skills', icon: Award },
  { to: '/app/approvals', label: 'Users & Approvals', icon: UserCheck, badgeKey: 'pending' },
  { section: 'Insights' },
  { to: '/app/reports', label: 'Reports', icon: BarChart3 },
]

const SUPER_ADMIN_NAV = [...ADMIN_NAV, { section: 'System' }, { to: '/app/settings/email', label: 'E-mail settings', icon: Mail }]

const EMPLOYEE_NAV = [
  { section: 'Workspace' },
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/tasks', label: 'My Tasks', icon: ListTodo },
  { to: '/app/projects', label: 'Projects', icon: FolderKanban },
  { section: 'Account' },
  { to: '/app/profile', label: 'Profile & Skills', icon: UserCircle },
]

const Brand = ({ dark }) => <Logo to="/app" dark={dark} />

function Sidebar({ onNavigate, collapsed = false, onToggle }) {
  const { isAdmin, isSuperAdmin } = useAuth()
  const nav = isSuperAdmin ? SUPER_ADMIN_NAV : isAdmin ? ADMIN_NAV : EMPLOYEE_NAV
  const { data: dashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.get,
    enabled: isAdmin,
  })
  const badges = { pending: dashboard?.kpis?.pendingApprovals }

  return (
    <div className="flex h-full flex-col bg-brand-950">
      <div className={cn('flex h-16 shrink-0 items-center', collapsed ? 'justify-center' : 'px-5')}>
        {collapsed ? (
          <Link to="/app" aria-label="Smart Workforce home">
            <LogoMark />
          </Link>
        ) : (
          <Brand dark />
        )}
      </div>
      <nav className={cn('flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto py-4 scroll-thin', collapsed ? 'px-2.5' : 'px-3')}>
        {nav.map((item) =>
          item.section ? (
            collapsed ? (
              <div key={item.section} className="mx-2 my-3 h-px bg-white/10 first:mt-0" aria-hidden="true" />
            ) : (
              <p key={item.section} className="truncate px-3 pt-5 pb-2 text-[11px] font-semibold tracking-wider text-brand-300/50 uppercase first:pt-0">
                {item.section}
              </p>
            )
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              aria-label={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors',
                  collapsed ? 'justify-center px-0' : 'px-3',
                  isActive ? 'bg-white/10 text-white ring-1 ring-white/5' : 'text-brand-50/70 hover:bg-white/5 hover:text-white',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn('size-[18px] shrink-0', isActive ? 'text-brand-300' : 'text-brand-100/50 group-hover:text-brand-100')} />
                  {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                  {item.badgeKey && badges[item.badgeKey] > 0 &&
                    (collapsed ? (
                      <span className="absolute top-1 right-1.5 size-2 rounded-full bg-amber-400 ring-2 ring-brand-950" />
                    ) : (
                      <span className="rounded-full bg-amber-400 px-2 py-0.5 text-amber-950 text-[11px] font-bold tabular-nums">
                        {badges[item.badgeKey]}
                      </span>
                    ))}
                </>
              )}
            </NavLink>
          ),
        )}
      </nav>
      {onToggle ? (
        <div className={cn('border-t border-white/10', collapsed ? 'p-2.5' : 'p-3')}>
          <button
            type="button"
            onClick={onToggle}
            title={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg py-2 text-sm font-medium text-brand-50/60 transition hover:bg-white/5 hover:text-white',
              collapsed ? 'justify-center' : 'px-3',
            )}
          >
            {collapsed ? <ChevronsRight className="size-[18px]" /> : <ChevronsLeft className="size-[18px]" />}
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Collapse</span>
                <kbd className="rounded border border-white/15 px-1.5 text-[10px] text-brand-100/50">Ctrl B</kbd>
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="border-t border-white/10 p-4">
          <p className="text-[11px] leading-relaxed text-brand-100/40">Skill-based allocation · workload balancing · deadline-aware scoring</p>
        </div>
      )}
    </div>
  )
}

function useClickOutside(ref, onOutside, active) {
  useEffect(() => {
    if (!active) return undefined
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onOutside()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, onOutside, active])
}

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  useClickOutside(ref, () => setOpen(false), open)

  const { data, isPending } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list({ limit: 20 }),
    refetchInterval: 30_000,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  const markAll = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: invalidate })
  const markOne = useMutation({ mutationFn: notificationsApi.markRead, onSuccess: invalidate })

  const unread = data?.unreadCount ?? 0
  const items = data?.items ?? []

  const openItem = (n) => {
    if (!n.is_read) markOne.mutate(n.id)
    setOpen(false)
    if (n.type?.startsWith('TASK') || n.type === 'COMMENT') navigate('/app/tasks')
    else if (n.type === 'REGISTRATION') navigate('/app/approvals')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex size-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 flex min-w-[18px] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(92vw,380px)] animate-pop-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="font-semibold text-slate-900">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                <CheckCheck className="size-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto scroll-thin">
            {isPending ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-sm text-slate-500">
                <BellOff className="size-6 text-slate-300" />
                You&apos;re all caught up
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openItem(n)}
                  className={cn(
                    'flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50',
                    !n.is_read && 'bg-brand-50/40',
                  )}
                >
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.is_read ? 'bg-transparent' : 'bg-brand-500')} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900">{n.title}</span>
                    <span className="block text-sm text-slate-600">{n.message}</span>
                    <span className="mt-1 block text-xs text-slate-400">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
          <Link
            to="/app/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-100 py-2.5 text-center text-sm font-semibold text-brand-600 hover:bg-slate-50"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  )
}

function UserMenu() {
  const { user, displayName, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false), open)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 transition hover:bg-slate-100"
      >
        <Avatar name={displayName} src={user?.avatarUrl} size="sm" />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-[160px] truncate text-sm font-semibold text-slate-900">{displayName}</span>
          <span className="block text-xs text-slate-500">{user?.employee?.position || user?.role}</span>
        </span>
        <ChevronDown className="hidden size-4 text-slate-400 sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 animate-pop-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
            <div className="mt-2">
              <RoleBadge role={user?.role} />
            </div>
          </div>
          <div className="p-1.5">
            <Link
              to="/app/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <UserCircle className="size-4" /> My profile
            </Link>
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AppLayout() {
  const location = useLocation()
  // The drawer remembers which path it was opened on, so navigating closes it automatically.
  const [drawerPath, setDrawerPath] = useState(null)
  const mobileOpen = drawerPath === location.pathname
  const [paletteOpen, setPaletteOpen] = useCommandPalette()
  const setMobileOpen = (open) => setDrawerPath(open ? location.pathname : null)
  const sidebar = useSidebar()

  return (
    <div className="min-h-screen bg-slate-50" style={{ '--sidebar-w': `${sidebar.width}px` }}>
      {/* Desktop sidebar: resizable, collapsible, remembered in localStorage */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-w)] lg:block',
          !sidebar.dragging && 'transition-[width] duration-200 ease-out',
        )}
      >
        <Sidebar collapsed={sidebar.collapsed} onToggle={sidebar.toggle} />
        <div
          {...sidebar.handleProps}
          className="group absolute inset-y-0 -right-1.5 z-10 w-3 cursor-col-resize outline-none"
        >
          <span
            className={cn(
              'absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors',
              sidebar.dragging ? 'bg-brand-400' : 'bg-transparent group-hover:bg-brand-400/70 group-focus-visible:bg-brand-400',
            )}
          />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-slate-900/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 animate-pop-in shadow-2xl">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
            <IconButton
              icon={X}
              label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="absolute top-3.5 -right-12 bg-white text-slate-700"
            />
          </aside>
        </div>
      )}

      <div className={cn('lg:pl-[var(--sidebar-w)]', !sidebar.dragging && 'transition-[padding] duration-200 ease-out')}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur sm:px-6">
          <IconButton icon={Menu} label="Open menu" onClick={() => setMobileOpen(true)} className="lg:hidden" />
          <div className="lg:hidden">
            <Brand />
          </div>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="ml-auto flex h-10 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 transition hover:border-slate-300 hover:bg-white sm:w-72 lg:ml-0"
            aria-label="Search"
          >
            <Search className="size-4" />
            <span className="hidden flex-1 text-left sm:block">Search anything…</span>
            <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 text-[11px] font-medium sm:block">Ctrl K</kbd>
          </button>
          <div className="hidden flex-1 lg:block" />
          <NotificationBell />
          <UserMenu />
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      </div>
    </div>
  )
}
