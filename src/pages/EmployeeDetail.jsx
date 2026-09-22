import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { authApi, employeeApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { PERMISSIONS } from '../auth/permissions'
import { PageSkeleton } from '../components/Skeleton'
import './pages.css'

export function EmployeeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { can } = useAuth()
  const canManage = can(PERMISSIONS.EMPLOYEE_MANAGE)

  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    employeeApi
      .get(id)
      .then((data) => {
        if (!cancelled) {
          setEmployee(data)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(authApi.errorMessage(err, 'Failed to load employee'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  async function onDeactivate() {
    if (!employee?.is_active) return
    setBusy(true)
    try {
      const updated = await employeeApi.deactivate(employee.id)
      setEmployee(updated)
    } catch (err) {
      setError(authApi.errorMessage(err, 'Failed to deactivate'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <PageSkeleton />
      </div>
    )
  }

  if (error && !employee) {
    return (
      <div className="page">
        <p className="banner error">{error}</p>
        <button type="button" className="btn ghost" onClick={() => navigate('/team')}>
          Back to team
        </button>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{employee.full_name}</h1>
          <p>
            {employee.employee_code} · {employee.department}
          </p>
        </div>
        <div className="list-actions">
          <Link className="btn ghost" to="/team">
            Back
          </Link>
          {canManage && (
            <Link className="btn primary" to={`/team/${employee.id}/edit`}>
              Edit
            </Link>
          )}
        </div>
      </header>

      {error && <p className="banner error">{error}</p>}

      <section className="detail-card panel">
        <dl className="detail-grid">
          <div>
            <dt>Email</dt>
            <dd>{employee.email}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{employee.role}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`badge ${employee.is_active ? 'approved' : 'cancelled'}`}>
                {employee.is_active ? 'active' : 'inactive'}
              </span>
            </dd>
          </div>
          <div>
            <dt>Hire date</dt>
            <dd>{employee.hire_date || '—'}</dd>
          </div>
          <div>
            <dt>Manager</dt>
            <dd>
              {employee.manager_id ? (
                <Link to={`/team/${employee.manager_id}`}>{employee.manager_name || 'View'}</Link>
              ) : (
                '—'
              )}
            </dd>
          </div>
        </dl>

        {canManage && employee.is_active && (
          <div className="modal-actions">
            <button type="button" className="btn ghost" disabled={busy} onClick={() => void onDeactivate()}>
              {busy ? 'Deactivating…' : 'Deactivate employee'}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
