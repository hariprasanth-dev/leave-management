export function parseDate(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDate(iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return iso ? parseDate(iso).toLocaleDateString('en-GB', opts) : '—'
}

export function todayStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function daysUntil(iso) {
  return Math.round((parseDate(iso) - todayStart()) / 86_400_000)
}

export function relativeLabel(iso) {
  const n = daysUntil(iso)
  if (n <= 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n < 7) return `In ${n} days`
  if (n < 14) return 'Next week'
  return `In ${Math.round(n / 7)} weeks`
}

export function waitingLabel(isoDateTime) {
  const n = -daysUntil(isoDateTime)
  if (n <= 0) return 'Applied today'
  if (n === 1) return 'Waiting 1 day'
  return `Waiting ${n} days`
}

export function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

export function fmt(n) {
  return Number.isInteger(n) ? String(n) : Number(n).toFixed(1)
}

export function leaveStatusLabel(leave) {
  return leave.self_recorded && leave.status === 'approved' ? 'recorded' : leave.status
}

/** Mirrors the backend rule: pending requests, or self-recorded leave that hasn't started yet. */
export function canCancelLeave(leave) {
  if (leave.status === 'pending') return true
  return leave.status === 'approved' && leave.self_recorded && daysUntil(leave.start_date) > 0
}
