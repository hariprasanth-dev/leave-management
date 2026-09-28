import { PERMISSIONS } from './auth/permissions'

/** Primary app navigation — filtered by permission at render time. */
export const NAV_SECTIONS = [
  {
    id: 'main',
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: 'dashboard', end: true, crumb: 'Dashboard' },
    ],
  },
  {
    id: 'leave',
    label: 'Leave',
    items: [
      {
        to: '/leaves',
        label: 'My Leaves',
        icon: 'leaves',
        crumb: 'My Leaves',
        permission: PERMISSIONS.LEAVE_READ_OWN,
      },
      {
        to: '/approvals',
        label: 'Approvals',
        icon: 'approvals',
        crumb: 'Approvals',
        permission: PERMISSIONS.LEAVE_APPROVE,
      },
    ],
  },
  {
    id: 'org',
    label: 'Organization',
    items: [
      {
        to: '/employees',
        label: 'Employees',
        icon: 'employees',
        crumb: 'Employees',
        permission: PERMISSIONS.EMPLOYEE_READ,
      },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    items: [
      { to: '/profile', label: 'Profile', icon: 'profile', crumb: 'Profile' },
      { to: '/settings', label: 'Settings', icon: 'settings', crumb: 'Settings' },
    ],
  },
]

export const CRUMB_MAP = {
  '/': 'Dashboard',
  '/leaves': 'My Leaves',
  '/approvals': 'Approvals',
  '/employees': 'Employees',
  '/profile': 'Profile',
  '/settings': 'Settings',
  '/forbidden': 'Forbidden',
}

export function isNavItemVisible(item, can, role) {
  if (item.permission && !can(item.permission)) return false
  if (item.hideForRoles?.includes(role)) return false
  return true
}

export function flattenNav(can, role) {
  return NAV_SECTIONS.flatMap((section) =>
    section.items
      .filter((item) => isNavItemVisible(item, can, role))
      .map((item) => ({ ...item, section: section.label })),
  )
}
