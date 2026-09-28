export const PERMISSIONS = {
  LEAVE_CREATE: 'leave:create',
  LEAVE_READ_OWN: 'leave:read_own',
  LEAVE_READ_TEAM: 'leave:read_team',
  LEAVE_APPROVE: 'leave:approve',
  EMPLOYEE_READ: 'employee:read',
  EMPLOYEE_MANAGE: 'employee:manage',
  ADMIN_ALL: 'admin:all',
}

export function hasPermission(user, permission) {
  if (!user?.permissions?.length) return false
  return user.permissions.includes(PERMISSIONS.ADMIN_ALL) || user.permissions.includes(permission)
}

export function hasAnyPermission(user, permissions = []) {
  return permissions.some((p) => hasPermission(user, p))
}

export function hasRole(user, ...roles) {
  if (!user) return false
  const set = new Set([user.role, ...(user.roles || [])])
  return roles.some((r) => set.has(r))
}

export const LOCKED_RECORD_REASON = 'Manager records can only be changed by HR or an admin'

/** Managers may edit/deactivate employee-role records only; manager, HR and admin records are locked. */
export function canEditEmployee(user, employee) {
  if (!hasPermission(user, PERMISSIONS.EMPLOYEE_MANAGE) || !employee) return false
  return hasRole(user, 'hr', 'admin') || employee.role === 'employee'
}
