import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { PERMISSIONS } from './auth/permissions'
import { ProtectedRoute, PublicOnlyRoute, RequirePermission } from './auth/ProtectedRoute'
import { Layout } from './components/Layout'
import { ApplyLeave } from './pages/ApplyLeave'
import { Approvals } from './pages/Approvals'
import { Dashboard } from './pages/Dashboard'
import { EmployeeDetail } from './pages/EmployeeDetail'
import { EmployeeFormPage } from './pages/EmployeeFormPage'
import { ForbiddenPage } from './pages/ForbiddenPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LoginPage } from './pages/LoginPage'
import { LeaveDetail } from './pages/LeaveDetail'
import { MyLeaves } from './pages/MyLeaves'
import { InAppNotFound } from './pages/InAppNotFound'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProfilePage } from './pages/ProfilePage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { SettingsPage } from './pages/SettingsPage'
import { TeamPage } from './pages/TeamPage'
import './pages/auth.css'
import './pages/pages.css'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>

          <Route path="/forbidden" element={<ForbiddenPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route element={<RequirePermission permission={PERMISSIONS.LEAVE_READ_OWN} />}>
                <Route path="leaves" element={<MyLeaves />} />
                <Route path="leaves/:id" element={<LeaveDetail />} />
              </Route>
              <Route element={<RequirePermission permission={PERMISSIONS.LEAVE_CREATE} />}>
                <Route path="apply" element={<ApplyLeave />} />
              </Route>
              <Route element={<RequirePermission permission={PERMISSIONS.LEAVE_APPROVE} />}>
                <Route path="approvals" element={<Approvals />} />
              </Route>
              <Route element={<RequirePermission permission={PERMISSIONS.EMPLOYEE_MANAGE} />}>
                <Route path="team/new" element={<EmployeeFormPage />} />
                <Route path="team/:id/edit" element={<EmployeeFormPage />} />
              </Route>
              <Route element={<RequirePermission permission={PERMISSIONS.EMPLOYEE_READ} />}>
                <Route path="team" element={<TeamPage />} />
                <Route path="team/:id" element={<EmployeeDetail />} />
              </Route>
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<InAppNotFound />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
