import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { approvalApi, healthApi, leaveApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { PERMISSIONS } from '../auth/permissions'
import './pages.css'

export function Dashboard() {
  const { user, can } = useAuth()
  const isManagerView = can(PERMISSIONS.LEAVE_APPROVE)
  const [balances, setBalances] = useState([])
  const [recent, setRecent] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [apiStatus, setApiStatus] = useState('checking')
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        await healthApi.check()
        if (!cancelled) setApiStatus('up')
      } catch {
        if (!cancelled) setApiStatus('down')
      }

      try {
        const ownId = user?.employee_id
        const [balanceData, leaveData] = await Promise.all([
          leaveApi.balances(),
          leaveApi.list({
            employeeId: ownId,
            page: 1,
            pageSize: 5,
          }),
        ])
        if (!cancelled) {
          setBalances(balanceData)
          setRecent(leaveData.items || [])
          setError(null)
        }

        if (can(PERMISSIONS.LEAVE_APPROVE)) {
          const pending = await approvalApi.pending()
          if (!cancelled) setPendingCount(pending.length)
        }
      } catch (err) {
        if (!cancelled) {
          const status = err?.response?.status
          if (status === 403) setError('Forbidden — you lack permission for this data')
          else setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user?.employee_id, user?.permissions])

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>
            {isManagerView ? 'Manager dashboard' : 'My dashboard'}
            {user?.full_name ? ` · ${user.full_name.split(' ')[0]}` : ''}
          </h1>
          <p>
            {isManagerView
              ? 'Review team leave and track your own balances.'
              : 'Overview of your leave balances and recent requests.'}
          </p>
        </div>
        {can(PERMISSIONS.LEAVE_CREATE) && (
          <Link className="btn primary" to="/apply">
            Apply leave
          </Link>
        )}
      </header>

      <p className={`status-pill ${apiStatus}`}>
        Role: {user?.role} · API:{' '}
        {apiStatus === 'checking' ? 'checking…' : apiStatus === 'up' ? 'online' : 'offline'}
      </p>

      {isManagerView && (
        <section className="panel">
          <div className="panel-header">
            <h2>Pending approvals</h2>
            <Link to="/approvals">Open queue</Link>
          </div>
          <p className="balance-value" style={{ fontSize: '1.75rem' }}>
            {pendingCount}
          </p>
          <p className="muted">Requests waiting for your decision.</p>
        </section>
      )}

      {error && <p className="banner error">{error}</p>}

      <section className="balance-grid" aria-label="Leave balances">
        {balances.length === 0 && !error && (
          <p className="muted">No balance data yet.</p>
        )}
        {balances.map((b) => (
          <article key={b.leave_type} className="balance-card">
            <h2>{b.name || b.leave_type}</h2>
            <p className="balance-value">{b.remaining}</p>
            <p className="muted">
              {b.used} used · {b.pending} pending · {b.total} entitled
            </p>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>My recent requests</h2>
          <Link to="/leaves">View all</Link>
        </div>
        {recent.length === 0 ? (
          <p className="muted">No leave requests yet.</p>
        ) : (
          <ul className="list">
            {recent.map((leave) => (
              <li key={leave.id}>
                <Link className="list-title" to={`/leaves/${leave.id}`}>
                  {leave.leave_type_name || leave.leave_type}
                </Link>
                <span className="muted">
                  {leave.start_date} → {leave.end_date}
                </span>
                <span className={`badge ${leave.status}`}>{leave.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
