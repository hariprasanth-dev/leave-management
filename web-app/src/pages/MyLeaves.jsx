import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi, leaveApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { PERMISSIONS } from '../auth/permissions'
import { ApplyLeaveForm } from '../components/ApplyLeaveForm'
import { LeaveStats } from '../components/LeaveStats'
import { ListSkeleton } from '../components/Skeleton'
import { canCancelLeave, leaveStatusLabel } from './dashboardUtils'
import './pages.css'

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PAGE_SIZE = 8

export function MyLeaves() {
  const { user, can } = useAuth()
  const canApply = can(PERMISSIONS.LEAVE_CREATE)
  const [searchParams, setSearchParams] = useSearchParams()
  const applyOpen = canApply && searchParams.get('apply') === '1'
  const [refreshKey, setRefreshKey] = useState(0)
  const [submitted, setSubmitted] = useState(null)
  const [leaves, setLeaves] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cancelId, setCancelId] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [policy, setPolicy] = useState(null)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])
  const selfRecord = policy?.requires_approval === false
  const applyLabel = selfRecord ? 'Record leave' : 'Apply leave'
  const cancelTarget = leaves.find((l) => l.id === cancelId)

  useEffect(() => {
    if (!canApply) return undefined
    let cancelled = false
    leaveApi
      .policy()
      .then((data) => {
        if (!cancelled) setPolicy(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [canApply])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    leaveApi
      .list({
        employeeId: user?.employee_id,
        status: status || undefined,
        q: query || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      .then((data) => {
        if (!cancelled) {
          setLeaves(data.items || [])
          setTotal(data.total || 0)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(authApi.errorMessage(err, 'Failed to load leaves'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.employee_id, status, query, page, refreshKey])

  function setApplyOpen(open) {
    const next = new URLSearchParams(searchParams)
    if (open) next.set('apply', '1')
    else next.delete('apply')
    setSearchParams(next, { replace: true })
  }

  function onApplied(created) {
    setApplyOpen(false)
    setSubmitted(created)
    setPage(1)
    setRefreshKey((k) => k + 1)
  }

  async function confirmCancel() {
    if (!cancelId) return
    setCancelling(true)
    try {
      const updated = await leaveApi.cancel(cancelId)
      setLeaves((prev) => prev.map((l) => (l.id === cancelId ? updated : l)))
      setCancelId(null)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setError(authApi.errorMessage(err, 'Failed to cancel leave'))
    } finally {
      setCancelling(false)
    }
  }

  function onSearch(e) {
    e.preventDefault()
    setPage(1)
    setQuery(searchInput.trim())
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>My leaves</h1>
          <p>
            {selfRecord
              ? 'Record your time off, keep track of it and see how you use your leave.'
              : 'Apply for leave, track your requests and see how you use your time off.'}
          </p>
        </div>
        {canApply && (
          <button type="button" className="btn primary" onClick={() => setApplyOpen(true)}>
            {applyLabel}
          </button>
        )}
      </header>

      {submitted && (
        <p className="banner success">
          {submitted.status === 'pending'
            ? `Leave request submitted for ${submitted.start_date} → ${submitted.end_date} (${submitted.days} day(s)). It is now pending approval.`
            : `Leave recorded for ${submitted.start_date} → ${submitted.end_date} (${submitted.days} day(s)). Your balance has been updated.`}
          <Link to={`/leaves/${submitted.id}`}>View request</Link>
          <button type="button" className="btn ghost" onClick={() => setSubmitted(null)}>
            Dismiss
          </button>
        </p>
      )}

      <LeaveStats refreshKey={refreshKey} selfRecord={selfRecord} />

      <div className="section-head">
        <h2>My requests</h2>
      </div>

      <form className="toolbar panel" onSubmit={onSearch}>
        <input
          type="search"
          placeholder="Search reason or status"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          value={status}
          onChange={(e) => {
            setPage(1)
            setStatus(e.target.value)
          }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button className="btn ghost" type="submit">
          Search
        </button>
      </form>

      {loading && <ListSkeleton rows={3} />}
      {error && <p className="banner error">{error}</p>}

      {!loading && !error && leaves.length === 0 && (
        <div className="empty-state panel">
          <h2>No leave requests</h2>
          <p className="muted">
            {selfRecord ? 'Record leave' : 'Apply for leave'} to see your history here.
          </p>
          {canApply && (
            <button type="button" className="btn primary" onClick={() => setApplyOpen(true)}>
              {applyLabel}
            </button>
          )}
        </div>
      )}

      {!loading && leaves.length > 0 && (
        <ul className="list panel">
          {leaves.map((leave) => (
            <li key={leave.id}>
              <div>
                <Link className="list-title" to={`/leaves/${leave.id}`}>
                  {leave.leave_type_name || leave.leave_type}
                </Link>
                <p className="muted">
                  {leave.start_date} → {leave.end_date} · {leave.days} day(s)
                </p>
                <p>{leave.reason}</p>
              </div>
              <div className="list-actions">
                <span className={`badge ${leave.status}`}>{leaveStatusLabel(leave)}</span>
                {canCancelLeave(leave) && (
                  <button type="button" className="btn ghost" onClick={() => setCancelId(leave.id)}>
                    Cancel
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {total > PAGE_SIZE && (
        <div className="pagination">
          <button
            type="button"
            className="btn ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span className="muted">
            Page {page} of {totalPages} · {total} total
          </span>
          <button
            type="button"
            className="btn ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      {applyOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setApplyOpen(false)}>
          <div
            className="modal modal-wide panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="apply-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="apply-title">{applyLabel}</h2>
            <p className="muted">
              {selfRecord
                ? "Weekends are not counted. There's no one above you to approve, so this leave is recorded straight away and deducted from your balance."
                : `Weekends are not counted. Your balance reduces only after ${policy?.approver_name || 'your manager'} approves.`}
            </p>
            <ApplyLeaveForm
              showBalances={false}
              submitLabel={selfRecord ? 'Record leave' : 'Submit request'}
              onSubmitted={onApplied}
              onCancel={() => setApplyOpen(false)}
            />
          </div>
        </div>
      )}

      {cancelId && (
        <div className="modal-backdrop" role="presentation" onClick={() => setCancelId(null)}>
          <div
            className="modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="cancel-title">Cancel leave request?</h2>
            <p className="muted">
              {cancelTarget?.status === 'approved'
                ? 'This recorded leave will be removed and the days go back to your balance.'
                : 'Only pending requests can be cancelled. Balance is not reduced.'}
            </p>
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setCancelId(null)}>
                Keep request
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={cancelling}
                onClick={() => void confirmCancel()}
              >
                {cancelling ? 'Cancelling…' : 'Confirm cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
