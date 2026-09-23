import { PERMISSIONS } from './auth/permissions'

/** Primary app navigation — filtered by permission at render time. */
export const NAV_SECTIONS = [
  {
    id: 'main',
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', end: true, crumb: 'Dashboard' },
    ],
  },
  {
    id: 'leave',
    label: 'Leave',
    items: [
      {
        to: '/leaves',
        label: 'My Leaves',
        crumb: 'My Leaves',
        permission: PERMISSIONS.LEAVE_READ_OWN,
      },
      {
        to: '/apply',
        label: 'Apply Leave',
        crumb: 'Apply Leave',
        permission: PERMISSIONS.LEAVE_CREATE,
      },
      {
        to: '/approvals',
        label: 'Approvals',
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
        crumb: 'Employees',
        permission: PERMISSIONS.EMPLOYEE_READ,
      },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    items: [
      { to: '/profile', label: 'Profile', crumb: 'Profile' },
      { to: '/settings', label: 'Settings', crumb: 'Settings' },
    ],
  },
]

export const CRUMB_MAP = {
  '/': 'Dashboard',
  '/leaves': 'My Leaves',
  '/apply': 'Apply Leave',
  '/approvals': 'Approvals',
  '/employees': 'Employees',
  '/employees/new': 'Add employee',
  '/profile': 'Profile',
  '/settings': 'Settings',
  '/forbidden': 'Forbidden',
}

export function flattenNav(can) {
  return NAV_SECTIONS.flatMap((section) =>
    section.items
      .filter((item) => !item.permission || can(item.permission))
      .map((item) => ({ ...item, section: section.label })),
  )
}
