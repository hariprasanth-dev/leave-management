import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi, employeeApi, leaveApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { DashboardSkeleton } from '../components/Skeleton'
import {
  fmt,
  formatDate,
  greeting,
  initials,
  parseDate,
  relativeLabel,
  todayStart,
} from './dashboardUtils'
import './Dashboard.css'
import './pages.css'

export function EmployeeDashboard() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [balances, setBalances] = useState([])
  const [stats, setStats] = useState(null)
  const [leaves, setLeaves] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      employeeApi.me().catch(() => null),
      leaveApi.balances(),
      leaveApi.stats(),
      leaveApi.list({ employeeId: user?.employee_id, page: 1, pageSize: 50 }),
    ])
      .then(([profileData, balanceData, statsData, leaveData]) => {
        if (cancelled) return
        setProfile(profileData)
        setBalances(balanceData)
        setStats(statsData)
        setLeaves(leaveData.items || [])
        setError(null)
      })
      .catch((err) => {
        if (!cancelled) setError(authApi.errorMessage(err, 'Failed to load your dashboard'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.employee_id])

  const { upcoming, onLeaveToday, pending } = useMemo(() => {
    const today = todayStart()
    const active = leaves.filter((l) => l.status === 'approved' || l.status === 'pending')
    return {
      upcoming: active
        .filter((l) => parseDate(l.end_date) >= today)
        .sort((a, b) => a.start_date.localeCompare(b.start_date)),
      onLeaveToday: active.find(
        (l) =>
          l.status === 'approved' &&
          parseDate(l.start_date) <= today &&
          parseDate(l.end_date) >= today,
      ),
      pending: leaves.filter((l) => l.status === 'pending'),
    }
  }, [leaves])

  if (loading) return <DashboardSkeleton />

  const available = balances.reduce((sum, b) => sum + b.available, 0)
  const entitled = balances.reduce((sum, b) => sum + b.total, 0)
  const nextLeave = upcoming[0]
  const name = profile?.full_name || user?.full_name || ''
  const recent = leaves.slice(0, 5)

  const meta = [
    profile?.employee_code,
    profile?.department,
    profile?.manager_name && `Reports to ${profile.manager_name}`,
    profile?.hire_date && `Joined ${formatDate(profile.hire_date, { month: 'short', year: 'numeric' })}`,
  ].filter(Boolean)

  const heroStats = [
    { label: 'Available to apply', value: fmt(available), hint: `of ${fmt(entitled)} days this year` },
    { label: 'Taken this year', value: fmt(stats?.approved_days ?? 0), hint: 'approved working days' },
    {
      label: 'Awaiting approval',
      value: pending.length,
      hint: pending.length
        ? `${fmt(stats?.pending_days ?? 0)} day(s) with ${profile?.manager_name || 'your manager'}`
        : 'nothing pending',
      tone: pending.length ? 'pending' : '',
    },
    {
      label: 'Next leave',
      value: nextLeave ? formatDate(nextLeave.start_date, { day: 'numeric', month: 'short' }) : '—',
      hint: nextLeave ? relativeLabel(nextLeave.start_date) : 'none planned',
      small: true,
    },
  ]

  return (
    <div className="page dash">
      {error && <p className="banner error">{error}</p>}

      <section className="dash-hero" aria-label="My summary">
        <div className="dash-hero-top">
          <div className="dash-identity">
            <span className="dash-avatar" aria-hidden="true">
              {initials(name)}
            </span>
            <div>
              <p className="dash-greeting">{greeting()},</p>
              <h1>{name}</h1>
              {meta.length > 0 && (
                <ul className="dash-meta">
                  {meta.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="dash-actions">
            <Link className="btn dash-btn-primary" to="/leaves?apply=1">
              Apply leave
            </Link>
            <Link className="btn dash-btn-ghost" to="/leaves">
              My leaves
            </Link>
          </div>
        </div>

        {onLeaveToday && (
          <p className="dash-notice">
            You are on {onLeaveToday.leave_type_name} today — until{' '}
            {formatDate(onLeaveToday.end_date, { day: 'numeric', month: 'short' })}.
          </p>
        )}

        <div className="dash-hero-stats">
          {heroStats.map((s) => (
            <div key={s.label} className={`dash-stat ${s.tone || ''}`}>
              <p className="dash-stat-label">{s.label}</p>
              <p className={`dash-stat-value ${s.small ? 'small' : ''}`}>{s.value}</p>
              <p className="dash-stat-hint">{s.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="dash-grid">
        <article className="panel dash-card">
          <div className="panel-header">
            <h2>Leave balances</h2>
            <Link to="/leaves">Stats</Link>
          </div>
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
                    {fmt(b.used)} used · {fmt(b.pending)} pending · {fmt(b.available)} available
                  </p>
                </li>
              )
            })}
          </ul>
        </article>

        <article className="panel dash-card">
          <div className="panel-header">
            <h2>Upcoming leave</h2>
            <Link to="/leaves">View all</Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="dash-empty">
              <p className="muted">No upcoming leave planned.</p>
              <Link className="btn ghost" to="/leaves?apply=1">
                Plan time off
              </Link>
            </div>
          ) : (
            <ul className="dash-upcoming">
              {upcoming.slice(0, 4).map((l) => (
                <li key={l.id}>
                  <Link to={`/leaves/${l.id}`} className="dash-date-chip">
                    <span>{formatDate(l.start_date, { month: 'short' })}</span>
                    <strong>{parseDate(l.start_date).getDate()}</strong>
                  </Link>
                  <div className="dash-upcoming-body">
                    <Link to={`/leaves/${l.id}`} className="list-title">
                      {l.leave_type_name}
                    </Link>
                    <p className="muted">
                      {formatDate(l.start_date, { day: 'numeric', month: 'short' })} →{' '}
                      {formatDate(l.end_date, { day: 'numeric', month: 'short' })} · {fmt(l.days)} day(s) ·{' '}
                      {relativeLabel(l.start_date)}
                    </p>
                  </div>
                  <span className={`badge ${l.status}`}>{l.status}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="panel dash-card dash-wide">
          <div className="panel-header">
            <h2>Recent requests</h2>
            <Link to="/leaves">View all</Link>
          </div>
          {recent.length === 0 ? (
            <p className="muted">No leave requests yet — your requests will show up here.</p>
          ) : (
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Applied</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <Link to={`/leaves/${l.id}`}>{l.leave_type_name}</Link>
                    </td>
                    <td>
                      {formatDate(l.start_date, { day: 'numeric', month: 'short' })} →{' '}
                      {formatDate(l.end_date)}
                    </td>
                    <td>{fmt(l.days)}</td>
                    <td>{formatDate(l.created_at.slice(0, 10))}</td>
                    <td>
                      <span className={`badge ${l.status}`}>{l.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      </div>
    </div>
  )
}
