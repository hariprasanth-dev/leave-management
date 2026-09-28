import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { employeeApi, leaveApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { PERMISSIONS } from '../auth/permissions'
import { LogoutConfirm } from '../components/LogoutConfirm'
import { ProfileSkeleton } from '../components/Skeleton'
import { fmt, formatDate, initials, parseDate } from './dashboardUtils'
import './Dashboard.css'
import './Profile.css'
import './pages.css'

const PERMISSION_LABELS = {
  'leave:create': ['Apply for leave', 'Submit earned and sick leave requests'],
  'leave:read_own': ['View own leave', 'See your requests, balances and stats'],
  'leave:read_team': ['View team leave', "See your team's requests and balances"],
  'leave:approve': ['Approve leave', 'Approve or reject pending team requests'],
  'employee:read': ['View employees', 'Browse the employee directory'],
  'employee:manage': ['Manage employees', 'Add, edit and deactivate team members'],
  'admin:all': ['Full administration', 'Unrestricted access to LeaveFlow'],
}

function tenureMonths(hireDate) {
  const start = parseDate(hireDate)
  const now = new Date()
  let months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth()
  if (now.getDate() < start.getDate()) months -= 1
  return Math.max(months, 0)
}

function tenureShort(hireDate) {
  if (!hireDate) return '—'
  const months = tenureMonths(hireDate)
  if (months < 12) return `${months} mo`
  const years = Math.floor(months / 12)
  return `${years} yr${years === 1 ? '' : 's'}`
}

function tenure(hireDate) {
  if (!hireDate) return '—'
  const months = tenureMonths(hireDate)
  if (months < 1) return 'Less than a month'
  const years = Math.floor(months / 12)
  const rest = months % 12
  return [
    years && `${years} year${years === 1 ? '' : 's'}`,
    rest && `${rest} month${rest === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join(' ')
}

function Detail({ label, children }) {
  return (
    <div className="pf-detail">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

export function ProfilePage() {
  const { user, can } = useAuth()
  const [confirmLogout, setConfirmLogout] = useState(false)
  const closeConfirm = useCallback(() => setConfirmLogout(false), [])
  const isManager = can(PERMISSIONS.LEAVE_READ_TEAM)
  const [profile, setProfile] = useState(null)
  const [balances, setBalances] = useState([])
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      employeeApi.me().catch(() => null),
      leaveApi.balances().catch(() => []),
      isManager ? leaveApi.teamOverview().catch(() => null) : Promise.resolve(null),
    ]).then(([profileData, balanceData, overview]) => {
      if (cancelled) return
      setProfile(profileData)
      setBalances(balanceData)
      setTeam(overview?.members || [])
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [user?.employee_id, isManager])

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(user?.email || '')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  if (loading) return <ProfileSkeleton />

  const name = profile?.full_name || user?.full_name || ''
  const role = user?.role || 'employee'
  const permissions = user?.permissions || []
  const available = balances.reduce((sum, b) => sum + b.available, 0)
  const entitled = balances.reduce((sum, b) => sum + b.total, 0)
  const used = balances.reduce((sum, b) => sum + b.used, 0)

  return (
    <div className="page pf">
      <section className="pf-hero" aria-label="Profile summary">
        <span className="pf-avatar" aria-hidden="true">
          {initials(name)}
        </span>
        <div className="pf-hero-body">
          <h1>{name}</h1>
          <p className="pf-hero-sub">
            <span className="capitalize">{role}</span>
            {profile?.department && ` · ${profile.department}`}
          </p>
          <ul className="pf-chips">
            {profile?.employee_code && <li className="pf-chip-id">{profile.employee_code}</li>}
            <li className={profile?.is_active === false ? 'pf-chip-off' : 'pf-chip-on'}>
              {profile?.is_active === false ? 'Inactive' : 'Active'}
            </li>
            <li>{user?.email}</li>
          </ul>
        </div>
        <div className="pf-hero-stats">
          <div>
            <strong>{fmt(available)}</strong>
            <span>days available</span>
          </div>
          <div>
            <strong>{fmt(used)}</strong>
            <span>days taken</span>
          </div>
          <div>
            <strong>{tenureShort(profile?.hire_date)}</strong>
            <span>with the company</span>
          </div>
        </div>
      </section>

      <div className="pf-grid">
        <article className="panel pf-card">
          <h2>Work details</h2>
          <dl className="pf-details">
            <Detail label="Employee ID">
              {profile?.employee_code ? (
                <span className="pf-id">{profile.employee_code}</span>
              ) : (
                '—'
              )}
            </Detail>
            <Detail label="Department">{profile?.department || '—'}</Detail>
            <Detail label="Role">
              <span className="capitalize">{role}</span>
            </Detail>
            <Detail label="Reports to">{profile?.manager_name || 'No manager'}</Detail>
            <Detail label="Joined">
              {formatDate(profile?.hire_date, { day: 'numeric', month: 'long', year: 'numeric' })}
            </Detail>
            <Detail label="Time with company">{tenure(profile?.hire_date)}</Detail>
          </dl>
        </article>

        <article className="panel pf-card">
          <h2>Contact &amp; account</h2>
          <dl className="pf-details">
            <Detail label="Work email">
              <span className="pf-email">
                {user?.email}
                <button type="button" className="pf-copy" onClick={() => void copyEmail()}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </span>
            </Detail>
            <Detail label="Sign-in method">Email &amp; password</Detail>
            <Detail label="Account status">
              <span className={`badge ${profile?.is_active === false ? 'rejected' : 'approved'}`}>
                {profile?.is_active === false ? 'Inactive' : 'Active'}
              </span>
            </Detail>
            <Detail label="Session">Signed in on this device</Detail>
          </dl>
          <div className="pf-card-actions">
            <Link className="btn ghost" to="/settings">
              Settings
            </Link>
            <button type="button" className="btn ghost pf-signout" onClick={() => setConfirmLogout(true)}>
              Sign out
            </button>
          </div>
        </article>

        <article className="panel pf-card">
          <div className="panel-header">
            <h2>Leave this year</h2>
            <Link to="/leaves">My leaves</Link>
          </div>
          {balances.length === 0 ? (
            <p className="muted">No leave balances configured yet.</p>
          ) : (
            <>
              <p className="pf-leave-total">
                <strong>{fmt(available)}</strong> of {fmt(entitled)} days available
              </p>
              <ul className="dash-balances">
                {balances.map((b) => {
                  const usedPct = b.total ? (b.used / b.total) * 100 : 0
                  const pendingPct = b.total ? (b.pending / b.total) * 100 : 0
                  return (
                    <li key={b.leave_type}>
                      <div className="dash-balance-head">
                        <span>{b.name}</span>
                        <span>
                          <strong>{fmt(b.available)}</strong> / {fmt(b.total)} days
                        </span>
                      </div>
                      <span className="dash-bar" aria-hidden="true">
                        <span className="used" style={{ width: `${usedPct}%` }} />
                        <span className="pending" style={{ width: `${pendingPct}%` }} />
                      </span>
                      <p className="muted">
                        {fmt(b.used)} used · {fmt(b.pending)} pending
                      </p>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </article>

        <article className="panel pf-card">
          <h2>Access</h2>
          <p className="muted pf-card-intro">
            What your <span className="capitalize">{role}</span> role can do in LeaveFlow.
          </p>
          <ul className="pf-perms">
            {permissions.map((p) => {
              const [label, hint] = PERMISSION_LABELS[p] || [p, '']
              return (
                <li key={p}>
                  <span className="pf-check" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span>
                    <strong>{label}</strong>
                    {hint && <span className="muted">{hint}</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        </article>

        {isManager && (
          <article className="panel pf-card pf-wide">
            <div className="panel-header">
              <h2>
                My team <span className="pf-count">{team.length}</span>
              </h2>
              <Link to="/employees">All employees</Link>
            </div>
            {team.length === 0 ? (
              <p className="muted">No one reports to you yet.</p>
            ) : (
              <ul className="pf-team">
                {team.map((m) => (
                  <li key={m.employee_id}>
                    <Link to={`/employees/${m.employee_id}`} className="pf-team-link">
                      <span className="dash-person-avatar" aria-hidden="true">
                        {initials(m.full_name)}
                      </span>
                      <span className="pf-team-text">
                        <strong>{m.full_name}</strong>
                        <span className="muted">
                          {m.employee_code} · {m.department}
                        </span>
                      </span>
                    </Link>
                    {m.on_leave_until ? (
                      <span className="badge pending">
                        On leave · {formatDate(m.on_leave_until, { day: 'numeric', month: 'short' })}
                      </span>
                    ) : (
                      <span className="badge approved">Available</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </article>
        )}
      </div>
      {confirmLogout && <LogoutConfirm onCancel={closeConfirm} />}
    </div>
  )
}
