/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BarChart3, Bell, Building2, CornerDownLeft, FolderKanban, LayoutDashboard, ListTodo, Mail, Search, UserCheck, UserCircle, Users, Award } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { employeesApi, projectsApi, tasksApi } from '../lib/endpoints'
import { STATUS_META } from '../lib/format'
import { Avatar, Spinner, cn } from './ui'

const PAGES = [
  { label: 'Dashboard', to: '/app', icon: LayoutDashboard },
  { label: 'Tasks', to: '/app/tasks', icon: ListTodo },
  { label: 'Task board (Kanban)', to: '/app/tasks?view=board', icon: ListTodo },
  { label: 'Task list', to: '/app/tasks?view=list', icon: ListTodo },
  { label: 'Projects', to: '/app/projects', icon: FolderKanban },
  { label: 'Employees', to: '/app/employees', icon: Users, admin: true },
  { label: 'Departments', to: '/app/departments', icon: Building2, admin: true },
  { label: 'Skills', to: '/app/skills', icon: Award, admin: true },
  { label: 'Users & approvals', to: '/app/approvals', icon: UserCheck, admin: true },
  { label: 'Reports', to: '/app/reports', icon: BarChart3, admin: true },
  { label: 'E-mail settings', to: '/app/settings/email', icon: Mail, superAdmin: true },
  { label: 'Notifications', to: '/app/notifications', icon: Bell },
  { label: 'My profile', to: '/app/profile', icon: UserCircle },
]

/** Opens with Ctrl/⌘+K or the header search button. */
export function useCommandPalette() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return [open, setOpen]
}

export default function CommandPalette({ open, onClose }) {
  if (!open) return null
  return createPortal(<Palette onClose={onClose} />, document.body)
}

function Palette({ onClose }) {
  const { isAdmin, isSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const [term, setTerm] = useState('')
  const [active, setActive] = useState(0)

  const tasks = useQuery({ queryKey: ['tasks', {}], queryFn: () => tasksApi.list({}) })
  const projects = useQuery({ queryKey: ['projects'], queryFn: () => projectsApi.list() })
  const employees = useQuery({ queryKey: ['employees', { status: 'ALL' }], queryFn: () => employeesApi.list({ status: 'ALL' }), enabled: isAdmin })
  const loading = tasks.isPending || projects.isPending || (isAdmin && employees.isPending)

  useEffect(() => {
    inputRef.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const results = useMemo(() => {
    const q = term.trim().toLowerCase()
    const match = (...fields) => !q || fields.some((f) => String(f ?? '').toLowerCase().includes(q))
    const out = []
    PAGES.filter((p) => (!p.admin || isAdmin) && (!p.superAdmin || isSuperAdmin) && match(p.label)).forEach((p) =>
      out.push({ key: `page-${p.to}`, group: 'Pages', label: p.label, to: p.to, icon: p.icon }),
    )
    ;(tasks.data || [])
      .filter((t) => match(t.title, t.project_name, t.assigned_employee_name))
      .slice(0, q ? 8 : 4)
      .forEach((t) =>
        out.push({ key: `task-${t.id}`, group: 'Tasks', label: t.title, hint: `${STATUS_META[t.status].label} · ${t.project_name}`, to: `/app/tasks/${t.id}`, icon: ListTodo }),
      )
    ;(projects.data || [])
      .filter((p) => match(p.name, p.department_name))
      .slice(0, q ? 5 : 3)
      .forEach((p) => out.push({ key: `project-${p.id}`, group: 'Projects', label: p.name, hint: p.department_name, to: `/app/projects/${p.id}`, icon: FolderKanban }))
    if (isAdmin) {
      ;(employees.data || [])
        .filter((e) => match(e.full_name, e.employee_code, e.email, e.job_position))
        .slice(0, q ? 6 : 3)
        .forEach((e) => out.push({ key: `emp-${e.id}`, group: 'Employees', label: e.full_name, hint: `${e.employee_code} · ${e.job_position}`, to: `/app/employees/${e.id}`, person: e.full_name }))
    }
    return out
  }, [term, tasks.data, projects.data, employees.data, isAdmin, isSuperAdmin])

  const go = (item) => {
    if (!item) return
    onClose()
    navigate(item.to)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(results.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(results[active])
    }
  }

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  let lastGroup = null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/50" onClick={onClose} />
      <div className="relative w-full max-w-xl animate-pop-in overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <Search className="size-5 text-slate-400" />
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => {
              setTerm(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
            placeholder={isAdmin ? 'Search tasks, projects, employees or pages…' : 'Search your tasks, projects or pages…'}
            className="h-14 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
          />
          {loading && <Spinner className="size-4" />}
          <kbd className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">Esc</kbd>
        </div>
        <ul ref={listRef} className="max-h-[50vh] overflow-y-auto p-2 scroll-thin">
          {results.length === 0 && !loading && <li className="px-3 py-10 text-center text-sm text-slate-500">No results for “{term}”</li>}
          {results.map((r, i) => {
            const header = r.group !== lastGroup ? r.group : null
            lastGroup = r.group
            return (
              <li key={r.key}>
                {header && <p className="px-3 pt-3 pb-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{header}</p>}
                <button
                  type="button"
                  data-index={i}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(r)}
                  className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left', i === active ? 'bg-brand-50 text-brand-900' : 'text-slate-700')}
                >
                  {r.person ? <Avatar name={r.person} size="xs" /> : <r.icon className={cn('size-4 shrink-0', i === active ? 'text-brand-600' : 'text-slate-400')} />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.label}</span>
                    {r.hint && <span className="block truncate text-xs text-slate-500">{r.hint}</span>}
                  </span>
                  {i === active ? <CornerDownLeft className="size-4 text-brand-600" /> : <ArrowRight className="size-4 text-transparent" />}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="flex items-center gap-4 border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
          <span>↑↓ to navigate</span>
          <span>↵ to open</span>
          <span>Ctrl K to toggle</span>
        </div>
      </div>
    </div>
  )
}
