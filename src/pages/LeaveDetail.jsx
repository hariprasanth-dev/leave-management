import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { authApi, leaveApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { PageSkeleton } from '../components/Skeleton'
import './pages.css'

export function LeaveDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [leave, setLeave] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    leaveApi
      .get(id)
      .then((data) => {
        if (!cancelled) {
          setLeave(data)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(authApi.errorMessage(err, 'Failed to load leave request'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const isOwner = leave && user?.employee_id === leave.employee_id

  async function onCancel() {
    setCancelling(true)
    try {
      const updated = await leaveApi.cancel(id)
      setLeave(updated)
      setConfirmCancel(false)
    } catch (err) {
      setError(authApi.errorMessage(err, 'Failed to cancel'))
    } finally {
      setCancelling(false)
    }
  }

  if (loading) return <PageSkeleton />

  if (error && !leave) {
    return (
      <div className="page">
        <p className="banner error">{error}</p>
        <button type="button" className="btn ghost" onClick={() => navigate('/leaves')}>
          Back to list
        </button>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{leave.leave_type_name || leave.leave_type}</h1>
          <p>Leave request details</p>
        </div>
        <Link className="btn ghost" to="/leaves">
          Back to list
        </Link>
      </header>

      {error && <p className="banner error">{error}</p>}

      <section className="panel">
        <dl className="detail-grid">
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`badge ${leave.status}`}>{leave.status}</span>
            </dd>
          </div>
          <div>
            <dt>Employee</dt>
            <dd>{leave.employee_name || leave.employee_id}</dd>
          </div>
          <div>
            <dt>Dates</dt>
            <dd>
              {leave.start_date} → {leave.end_date}
            </dd>
          </div>
          <div>
            <dt>Working days</dt>
            <dd>{leave.days}</dd>
          </div>
          <div>
            <dt>Reason</dt>
            <dd>{leave.reason}</dd>
          </div>
          <div>
            <dt>Submitted</dt>
            <dd>{new Date(leave.created_at).toLocaleString()}</dd>
          </div>
        </dl>

        {isOwner && leave.status === 'pending' && (
          <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
            {!confirmCancel ? (
              <button type="button" className="btn ghost" onClick={() => setConfirmCancel(true)}>
                Cancel request
              </button>
            ) : (
              <>
                <p className="muted">Confirm cancellation? Balance will not be reduced.</p>
                <button type="button" className="btn ghost" onClick={() => setConfirmCancel(false)}>
                  Keep
                </button>
                <button
                  type="button"
                  className="btn primary"
                  disabled={cancelling}
                  onClick={() => void onCancel()}
                >
                  {cancelling ? 'Cancelling…' : 'Confirm cancel'}
                </button>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
