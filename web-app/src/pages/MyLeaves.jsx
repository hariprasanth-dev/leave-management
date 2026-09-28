import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi, leaveApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { PageSkeleton } from '../components/Skeleton'
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
  const { user } = useAuth()
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

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

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
  }, [user?.employee_id, status, query, page])

  async function confirmCancel() {
    if (!cancelId) return
    setCancelling(true)
    try {
      const updated = await leaveApi.cancel(cancelId)
      setLeaves((prev) => prev.map((l) => (l.id === cancelId ? updated : l)))
      setCancelId(null)
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
          <p>History of your leave requests and current status.</p>
        </div>
        <Link className="btn primary" to="/apply">
          Apply leave
        </Link>
      </header>

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

      {loading && <PageSkeleton />}
      {error && <p className="banner error">{error}</p>}

      {!loading && !error && leaves.length === 0 && (
        <div className="empty-state panel">
          <h2>No leave requests</h2>
          <p className="muted">Apply for leave to see your history here.</p>
          <Link className="btn primary" to="/apply">
            Apply leave
          </Link>
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
                <span className={`badge ${leave.status}`}>{leave.status}</span>
                {leave.status === 'pending' && (
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
            <p className="muted">Only pending requests can be cancelled. Balance is not reduced.</p>
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
