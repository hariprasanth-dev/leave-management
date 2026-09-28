import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { approvalApi, authApi, employeeApi, leaveApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { PERMISSIONS } from '../auth/permissions'
import { MonthlyChart, TypeDonut } from '../components/LeaveStats'
import { DashboardSkeleton } from '../components/Skeleton'
import {
  fmt,
  formatDate,
  greeting,
  initials,
  leaveStatusLabel,
  parseDate,
  relativeLabel,
  waitingLabel,
} from './dashboardUtils'
import '../components/LeaveStats.css'
import './Dashboard.css'
import './pages.css'

const SHORT = { day: 'numeric', month: 'short' }
const TEAM_PREVIEW = 5

function Person({ name, code }) {
  return (
    <span className="dash-person">
      <span className="dash-person-avatar" aria-hidden="true">
        {initials(name)}
      </span>
      <span className="dash-person-text">
        <strong>{name}</strong>
        {code && <span className="dash-code">{code}</span>}
      </span>
    </span>
  )
}

export function ManagerDashboard() {
  const { user, can } = useAuth()
  const canManage = can(PERMISSIONS.EMPLOYEE_MANAGE)
  const [overview, setOverview] = useState(null)
  const [profile, setProfile] = useState(null)
  const [balances, setBalances] = useState([])
  const [policy, setPolicy] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actingId, setActingId] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [rejectComment, setRejectComment] = useState('')
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    try {
      const [overviewData, profileData, balanceData, policyData] = await Promise.all([
        leaveApi.teamOverview(),
        employeeApi.me().catch(() => null),
        leaveApi.balances().catch(() => []),
        leaveApi.policy().catch(() => null),
      ])
      setOverview(overviewData)
      setProfile(profileData)
      setBalances(balanceData)
      setPolicy(policyData)
      setError(null)
    } catch (err) {
      setError(authApi.errorMessage(err, 'Failed to load team overview'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function approve(leave) {
    setActingId(leave.id)
    try {
      await approvalApi.approve(leave.id)
      setNotice(
        `Approved ${leave.employee_name}'s ${leave.leave_type_name.toLowerCase()}. They've been notified by email.`,
      )
      await load()
    } catch (err) {
      setError(authApi.errorMessage(err, 'Failed to approve request'))
    } finally {
      setActingId(null)
    }
  }

  async function confirmReject() {
    if (!rejecting) return
    setActingId(rejecting.id)
    try {
      await approvalApi.reject(rejecting.id, rejectComment.trim() || undefined)
      setNotice(
        `Rejected ${rejecting.employee_name}'s ${rejecting.leave_type_name.toLowerCase()}. They've been notified by email.`,
      )
      setRejecting(null)
      setRejectComment('')
      await load()
    } catch (err) {
      setError(authApi.errorMessage(err, 'Failed to reject request'))
    } finally {
      setActingId(null)
    }
  }

  if (loading) return <DashboardSkeleton stats={5} />

  const name = profile?.full_name || user?.full_name || ''
  const codes = Object.fromEntries((overview?.members || []).map((m) => [m.employee_id, m.employee_code]))
  const teamLabel = overview?.scope === 'organization' ? 'Organization' : 'My team'
  const myAvailable = balances.reduce((sum, b) => sum + b.available, 0)
  const myEntitled = balances.reduce((sum, b) => sum + b.total, 0)

  const meta = [
    profile?.employee_code,
    profile?.department,
    overview &&
      `${overview.team_size} ${overview.scope === 'organization' ? 'employee' : 'direct report'}${overview.team_size === 1 ? '' : 's'}`,
    profile?.hire_date && `Joined ${formatDate(profile.hire_date, { month: 'short', year: 'numeric' })}`,
  ].filter(Boolean)

  const heroStats = overview
    ? [
        {
          label: 'Pending approvals',
          value: overview.pending_count,
          hint: overview.pending_count ? 'awaiting your decision' : 'all caught up',
          tone: overview.pending_count ? 'pending' : '',
        },
        { label: 'Team size', value: overview.team_size, hint: 'active members' },
        {
          label: 'Out today',
          value: overview.on_leave_today.length,
          hint: overview.on_leave_today.length
            ? overview.on_leave_today.map((l) => l.employee_name.split(' ')[0]).join(', ')
            : 'everyone available',
        },
        {
          label: 'Upcoming · 30 days',
          value: overview.upcoming.length,
          hint: overview.upcoming[0]
            ? `next: ${overview.upcoming[0].employee_name.split(' ')[0]}, ${formatDate(overview.upcoming[0].start_date, SHORT)}`
            : 'no leave planned',
        },
        { label: 'My available', value: fmt(myAvailable), hint: `of ${fmt(myEntitled)} days` },
      ]
    : []

  return (
    <div className="page dash">
      {error && <p className="banner error">{error}</p>}
      {notice && (
        <p className="banner success">
          {notice}
          <button type="button" className="btn ghost" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </p>
      )}

      <section className="dash-hero" aria-label="Manager summary">
        <div className="dash-hero-top">
          <div className="dash-identity">
            <span className="dash-avatar" aria-hidden="true">
              {initials(name)}
            </span>
            <div>
              <p className="dash-greeting">{greeting()},</p>
              <h1>{name}</h1>
              <ul className="dash-meta">
                {meta.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="dash-actions">
            <Link className="btn dash-btn-primary" to="/approvals">
              Review approvals{overview?.pending_count ? ` (${overview.pending_count})` : ''}
            </Link>
            <Link className="btn dash-btn-ghost" to="/leaves?apply=1">
              {policy?.requires_approval === false ? 'Record leave' : 'Apply leave'}
            </Link>
            {canManage && (
              <Link className="btn dash-btn-ghost" to="/employees?sheet=new">
                Add employee
              </Link>
            )}
          </div>
        </div>

        <div className="dash-hero-stats five">
          {heroStats.map((s) => (
            <div key={s.label} className={`dash-stat ${s.tone || ''}`}>
              <p className="dash-stat-label">{s.label}</p>
              <p className="dash-stat-value">{s.value}</p>
              <p className="dash-stat-hint" title={s.hint}>
                {s.hint}
              </p>
            </div>
          ))}
        </div>
      </section>

      {overview && (
        <>
          <div className="dash-grid">
            <article className="panel dash-card dash-wide">
              <div className="panel-header">
                <h2>
                  Pending approvals
                  {overview.pending_count > 0 && <span className="dash-count">{overview.pending_count}</span>}
                </h2>
                <Link to="/approvals">Open queue</Link>
              </div>
              {overview.pending.length === 0 ? (
                <p className="muted">No requests waiting — you&apos;re all caught up.</p>
              ) : (
                <ul className="dash-approvals">
                  {overview.pending.slice(0, 5).map((l) => (
                    <li key={l.id}>
                      <Person name={l.employee_name} code={codes[l.employee_id]} />
                      <div className="dash-approval-body">
                        <Link to={`/leaves/${l.id}`} className="list-title">
                          {l.leave_type_name} · {fmt(l.days)} day(s)
                        </Link>
                        <p className="muted">
                          {formatDate(l.start_date, SHORT)} → {formatDate(l.end_date)} ·{' '}
                          {waitingLabel(l.created_at)}
                        </p>
                        {l.reason && <p className="dash-reason">“{l.reason}”</p>}
                      </div>
                      <div className="dash-approval-actions">
                        <button
                          type="button"
                          className="btn primary"
                          disabled={actingId === l.id}
                          onClick={() => void approve(l)}
                        >
                          {actingId === l.id ? 'Saving…' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          disabled={actingId === l.id}
                          onClick={() => {
                            setRejecting(l)
                            setRejectComment('')
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="panel dash-card">
              <div className="panel-header">
                <h2>Who&apos;s out</h2>
              </div>
              <p className="dash-subhead">Today</p>
              {overview.on_leave_today.length === 0 ? (
                <p className="muted">Everyone on your team is available today.</p>
              ) : (
                <ul className="dash-out">
                  {overview.on_leave_today.map((l) => (
                    <li key={l.id}>
                      <Person name={l.employee_name} code={codes[l.employee_id]} />
                      <span className="dash-out-meta">
                        {l.leave_type_name}
                        <span className="muted">back after {formatDate(l.end_date, SHORT)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <p className="dash-subhead">Next 30 days</p>
              {overview.upcoming.length === 0 ? (
                <p className="muted">No upcoming team leave.</p>
              ) : (
                <ul className="dash-upcoming">
                  {overview.upcoming.slice(0, 5).map((l) => (
                    <li key={l.id}>
                      <Link to={`/leaves/${l.id}`} className="dash-date-chip">
                        <span>{formatDate(l.start_date, { month: 'short' })}</span>
                        <strong>{parseDate(l.start_date).getDate()}</strong>
                      </Link>
                      <div className="dash-upcoming-body">
                        <strong className="dash-upcoming-name">{l.employee_name}</strong>
                        <p className="muted">
                          {l.leave_type_name} · {fmt(l.days)} day(s) · {relativeLabel(l.start_date)}
                        </p>
                      </div>
                      <span className={`badge ${l.status}`}>{leaveStatusLabel(l)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="panel dash-card">
              <div className="panel-header">
                <h2>My leave</h2>
                <Link to="/leaves">My leaves</Link>
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

            <article className="panel dash-card dash-wide">
              <div className="panel-header">
                <h2>
                  {teamLabel}
                  {overview.members.length > 0 && (
                    <span className="dash-count">{overview.members.length}</span>
                  )}
                </h2>
                <Link to="/employees">View all</Link>
              </div>
              {overview.members.length === 0 ? (
                <div className="dash-empty">
                  <p className="muted">No one reports to you yet.</p>
                  {canManage && (
                    <Link className="btn ghost" to="/employees?sheet=new">
                      Add employee
                    </Link>
                  )}
                </div>
              ) : (
                <div className="dash-table-wrap">
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Status</th>
                        <th>Balance</th>
                        <th>Taken</th>
                        <th>Pending</th>
                        <th>Next leave</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.members.slice(0, TEAM_PREVIEW).map((m) => {
                        const pct = m.entitled_days ? (m.available_days / m.entitled_days) * 100 : 0
                        return (
                          <tr key={m.employee_id}>
                            <td>
                              <Link to={`/employees/${m.employee_id}`} className="dash-person-link">
                                <Person name={m.full_name} code={m.employee_code} />
                              </Link>
                            </td>
                            <td>
                              {m.on_leave_until ? (
                                <span className="badge pending">
                                  On leave · {formatDate(m.on_leave_until, SHORT)}
                                </span>
                              ) : (
                                <span className="badge approved">Available</span>
                              )}
                            </td>
                            <td>
                              <span className="dash-mini-balance">
                                <span className="dash-bar mini" aria-hidden="true">
                                  <span className="used" style={{ width: `${pct}%` }} />
                                </span>
                                {fmt(m.available_days)} / {fmt(m.entitled_days)}
                              </span>
                            </td>
                            <td>{fmt(m.taken_days)}</td>
                            <td>{fmt(m.pending_days)}</td>
                            <td>
                              {m.next_leave_start
                                ? `${formatDate(m.next_leave_start, SHORT)} · ${relativeLabel(m.next_leave_start)}`
                                : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div className="dash-table-foot">
                    <span className="muted">
                      Showing {Math.min(TEAM_PREVIEW, overview.members.length)} of {overview.members.length}{' '}
                      {overview.members.length === 1 ? 'person' : 'people'}
                    </span>
                    <Link className="btn ghost" to="/employees">
                      View all employees
                    </Link>
                  </div>
                </div>
              )}
            </article>
          </div>

          <div className="stats-grid">
            <MonthlyChart
              months={overview.monthly}
              year={overview.year}
              wide={false}
              title="Team leave trend"
              subtitle={`Working days your team is on leave per month in ${overview.year}`}
            />
            <TypeDonut
              types={overview.by_type}
              title="Team leave usage"
              subtitle="Approved days by leave type across the team"
            />
          </div>
        </>
      )}

      {rejecting && (
        <div className="modal-backdrop" role="presentation" onClick={() => setRejecting(null)}>
          <div
            className="modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="reject-title">Reject leave request?</h2>
            <p className="muted">
              {rejecting.employee_name} · {rejecting.leave_type_name} ·{' '}
              {formatDate(rejecting.start_date, SHORT)} → {formatDate(rejecting.end_date)}
            </p>
            <label className="dash-reject-label">
              Reason for the employee (optional)
              <textarea
                rows={3}
                maxLength={1000}
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                placeholder="e.g. Team deadline that week — can we move this?"
              />
              <span className="muted">Included in the email sent to their work address.</span>
            </label>
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setRejecting(null)}>
                Keep pending
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={actingId === rejecting.id}
                onClick={() => void confirmReject()}
              >
                {actingId === rejecting.id ? 'Rejecting…' : 'Reject request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
