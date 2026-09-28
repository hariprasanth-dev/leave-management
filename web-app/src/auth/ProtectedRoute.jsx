import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { AuthBootSkeleton, RouteSkeleton, ShellSkeleton } from '../components/Skeleton'
import { useAuth } from './AuthContext'
import { hasAnyPermission, hasPermission } from './permissions'

const PASSWORD_SETTINGS_PATH = '/settings'

export function ProtectedRoute() {
  const { isAuthenticated, bootstrapping, user } = useAuth()
  const location = useLocation()

  if (bootstrapping) return <ShellSkeleton />

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // Signed in with an emailed temporary password: nothing else until a new one is set.
  if (user?.must_change_password && location.pathname !== PASSWORD_SETTINGS_PATH) {
    return <Navigate to={PASSWORD_SETTINGS_PATH} replace />
  }

  return <Outlet />
}

export function PublicOnlyRoute() {
  const { isAuthenticated, bootstrapping } = useAuth()

  if (bootstrapping) {
    return (
      <div className="auth-boot">
        <AuthBootSkeleton />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

export function RequirePermission({ permission, anyOf }) {
  const { user, bootstrapping } = useAuth()

  if (bootstrapping) {
    return <RouteSkeleton />
  }

  const allowed = anyOf?.length
    ? hasAnyPermission(user, anyOf)
    : hasPermission(user, permission)

  if (!allowed) {
    return <Navigate to="/forbidden" replace />
  }

  return <Outlet />
}
