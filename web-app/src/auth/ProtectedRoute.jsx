import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { PageSkeleton } from '../components/Skeleton'
import { useAuth } from './AuthContext'
import { hasAnyPermission, hasPermission } from './permissions'

export function ProtectedRoute() {
  const { isAuthenticated, bootstrapping } = useAuth()
  const location = useLocation()

  if (bootstrapping) {
    return (
      <div className="auth-boot">
        <PageSkeleton />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export function PublicOnlyRoute() {
  const { isAuthenticated, bootstrapping } = useAuth()

  if (bootstrapping) {
    return (
      <div className="auth-boot">
        <PageSkeleton />
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
    return <PageSkeleton />
  }

  const allowed = anyOf?.length
    ? hasAnyPermission(user, anyOf)
    : hasPermission(user, permission)

  if (!allowed) {
    return <Navigate to="/forbidden" replace />
  }

  return <Outlet />
}
