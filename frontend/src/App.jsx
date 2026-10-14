/**
 * Smart Workforce & Task Allocation System: React routes
 * @author MD. Habibullah Sharif <https://habibullah.dev> (https://github.com/md8-habibullah)
 */
import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { useAuth } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import { PageLoader } from './components/ui'
import LandingPage from './pages/public/LandingPage'
import LoginPage from './pages/public/LoginPage'
import RegisterPage from './pages/public/RegisterPage'
import ForgotPasswordPage from './pages/public/ForgotPasswordPage'
import ResetPasswordPage from './pages/public/ResetPasswordPage'
import NotFoundPage from './pages/NotFoundPage'

// Authenticated pages are code-split so the landing/login bundle stays small.
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'))
const TasksPage = lazy(() => import('./pages/tasks/TasksPage'))
const TaskDetailPage = lazy(() => import('./pages/tasks/TaskDetailPage'))
const AllocationPage = lazy(() => import('./pages/tasks/AllocationPage'))
const EmployeesPage = lazy(() => import('./pages/employees/EmployeesPage'))
const EmployeeDetailPage = lazy(() => import('./pages/employees/EmployeeDetailPage'))
const DepartmentsPage = lazy(() => import('./pages/departments/DepartmentsPage'))
const ProjectsPage = lazy(() => import('./pages/projects/ProjectsPage'))
const ProjectDetailPage = lazy(() => import('./pages/projects/ProjectDetailPage'))
const SkillsPage = lazy(() => import('./pages/skills/SkillsPage'))
const ApprovalsPage = lazy(() => import('./pages/admin/ApprovalsPage'))
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const EmailSettingsPage = lazy(() => import('./pages/settings/EmailSettingsPage'))

function RequireAuth({ children }) {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <PageLoader label="Restoring your session…" />
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

function RequireAdmin({ children }) {
  const { isAdmin } = useAuth()
  return isAdmin ? children : <Navigate to="/app" replace />
}

function RequireSuperAdmin({ children }) {
  const { isSuperAdmin } = useAuth()
  return isSuperAdmin ? children : <Navigate to="/app" replace />
}

function GuestOnly({ children }) {
  const { status } = useAuth()
  if (status === 'loading') return <PageLoader />
  if (status === 'authenticated') return <Navigate to="/app" replace />
  return children
}

const admin = (element) => <RequireAdmin>{element}</RequireAdmin>

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
      {/* Not guest-only: a reset link must work even if another account is signed in on this browser. */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route
          element={
            <Suspense fallback={<PageLoader />}>
              <OutletPassthrough />
            </Suspense>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="tasks/:id" element={<TaskDetailPage />} />
          <Route path="tasks/:id/allocate" element={admin(<AllocationPage />)} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="employees" element={admin(<EmployeesPage />)} />
          <Route path="employees/:id" element={admin(<EmployeeDetailPage />)} />
          <Route path="departments" element={admin(<DepartmentsPage />)} />
          <Route path="skills" element={admin(<SkillsPage />)} />
          <Route path="approvals" element={admin(<ApprovalsPage />)} />
          <Route path="reports" element={admin(<ReportsPage />)} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings/email" element={<RequireSuperAdmin><EmailSettingsPage /></RequireSuperAdmin>} />
          <Route path="*" element={<NotFoundPage inApp />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

function OutletPassthrough() {
  return <Outlet />
}
