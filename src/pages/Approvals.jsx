import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { approvalApi, authApi } from '../api/client'
import { PageSkeleton } from '../components/Skeleton'
import './pages.css'

export function Approvals() {
  const [tab, setTab] = useState('pending')
  const [pending, setPending] = useState([])
  const [processed, setProcessed] = useState([])
  const [processedTotal, setProcessedTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actingId, setActingId] = useState(null)

  async function load() {
    setLoading(true)
    try {
      if (tab === 'pending') {
        const data = await approvalApi.pending()
        setPending(data)
      } else {
        const data = await approvalApi.processed({ page, pageSize: 8 })
        setProcessed(data.items || [])
        setProcessedTotal(data.total || 0)
      }
      setError(null)
    } catch (err) {
      setError(authApi.errorMessage(err, 'Failed to load approvals'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [tab, page])

  async function decide(id, action) {
    setActingId(id)
    try {
      if (action === 'approve') await approvalApi.approve(id)
      else await approvalApi.reject(id)
      setPending((prev) => prev.filter((l) => l.id !== id))
    } catch (err) {
      setError(authApi.errorMessage(err, `Failed to ${action}`))
    } finally {
      setActingId(null)
    }
  }

  const rows = tab === 'pending' ? pending : processed

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Approvals</h1>
          <p>Review team leave requests and previously processed decisions.</p>
        </div>
      </header>

      <div className="tabs">
        <button
          type="button"
          className={tab === 'pending' ? 'tab active' : 'tab'}
          onClick={() => {
            setTab('pending')
            setPage(1)
          }}
        >
          Pending
        </button>
        <button
          type="button"
          className={tab === 'processed' ? 'tab active' : 'tab'}
          onClick={() => {
            setTab('processed')
            setPage(1)
          }}
        >
          Processed
        </button>
      </div>

      {loading && <PageSkeleton />}
      {error && <p className="banner error">{error}</p>}

      {!loading && rows.length === 0 && !error && (
        <div className="empty-state panel">
          <h2>{tab === 'pending' ? 'No pending requests' : 'No processed requests yet'}</h2>
          <p className="muted">
            {tab === 'pending'
              ? 'New employee leave requests will appear here.'
              : 'Approved and rejected requests will show up in this tab.'}
          </p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <ul className="list panel">
          {rows.map((leave) => (
            <li key={leave.id}>
              <div>
                <Link className="list-title" to={`/leaves/${leave.id}`}>
                  {leave.employee_name ?? leave.employee_id} · {leave.leave_type_name || leave.leave_type}
                </Link>
                <p className="muted">
                  {leave.start_date} → {leave.end_date} · {leave.days} day(s)
                </p>
                <p>{leave.reason}</p>
              </div>
              <div className="list-actions">
                <span className={`badge ${leave.status}`}>{leave.status}</span>
                {tab === 'pending' && (
                  <>
                    <button
                      type="button"
                      className="btn primary"
                      disabled={actingId === leave.id}
                      onClick={() => void decide(leave.id, 'approve')}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={actingId === leave.id}
                      onClick={() => void decide(leave.id, 'reject')}
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab === 'processed' && processedTotal > 8 && (
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
            Page {page} · {processedTotal} total
          </span>
          <button
            type="button"
            className="btn ghost"
            disabled={page * 8 >= processedTotal}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
