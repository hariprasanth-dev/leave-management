import { useAuth } from '../auth/AuthContext'
import { PERMISSIONS } from '../auth/permissions'
import { EmployeeDashboard } from './EmployeeDashboard'
import { ManagerDashboard } from './ManagerDashboard'

export function Dashboard() {
  const { can } = useAuth()
  return can(PERMISSIONS.LEAVE_READ_TEAM) ? <ManagerDashboard /> : <EmployeeDashboard />
}
