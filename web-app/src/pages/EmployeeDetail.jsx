import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { authApi, employeeApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { LOCKED_RECORD_REASON, PERMISSIONS, canEditEmployee } from '../auth/permissions'
import { EmployeeSheet } from '../components/EmployeeSheet'
import { DetailSkeleton } from '../components/Skeleton'
import './pages.css'

export function EmployeeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, can } = useAuth()
  const canManage = can(PERMISSIONS.EMPLOYEE_MANAGE)

  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loginHint, setLoginHint] = useState(location.state?.accountCreated ? location.state : null)
  const [saved, setSaved] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const editOpen = canManage && searchParams.get('edit') === '1'

  const setEditOpen = useCallback(
    (open) => setSearchParams(open ? { edit: '1' } : {}, { replace: true }),
    [setSearchParams],
  )
  const closeEdit = useCallback(() => setEditOpen(false), [setEditOpen])

  function onSaved(updated) {
    setEmployee(updated)
    setSaved(true)
    setEditOpen(false)
  }

  useEffect(() => {
    if (location.state?.accountCreated) {
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.pathname, location.state, navigate])

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

  if (loading) return <DetailSkeleton fields={8} />

  if (error && !employee) {
    return (
      <div className="page">
        <p className="banner error">{error}</p>
        <button type="button" className="btn ghost" onClick={() => navigate('/employees')}>
          Back to team
        </button>
      </div>
    )
  }

  const editable = canEditEmployee(user, employee)

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
          <Link className="btn ghost" to="/employees">
            Back
          </Link>
          {canManage &&
            (editable ? (
              <button type="button" className="btn primary" onClick={() => setEditOpen(true)}>
                Edit
              </button>
            ) : (
              <button type="button" className="btn primary" disabled title={LOCKED_RECORD_REASON}>
                Edit
              </button>
            ))}
        </div>
      </header>

      {loginHint?.accountCreated && (
        <p className="banner success">
          Account created. They can sign in with <strong>{loginHint.loginEmail || employee.email}</strong>{' '}
          and the temporary password you set.
          <button type="button" className="btn ghost" onClick={() => setLoginHint(null)}>
            Dismiss
          </button>
        </p>
      )}

      {saved && (
        <p className="banner success">
          Changes saved.
          <button type="button" className="btn ghost" onClick={() => setSaved(false)}>
            Dismiss
          </button>
        </p>
      )}

      {error && <p className="banner error">{error}</p>}

      <section className="detail-card panel">
        <dl className="detail-grid">
          <div>
            <dt>Login email</dt>
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
                {employee.is_active ? 'active (can sign in)' : 'inactive'}
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
                <Link to={`/employees/${employee.manager_id}`}>{employee.manager_name || 'View'}</Link>
              ) : (
                '—'
              )}
            </dd>
          </div>
        </dl>

        {canManage && employee.is_active && (
          <div className="modal-actions">
            <button
              type="button"
              className="btn ghost"
              disabled={busy || !editable}
              title={editable ? undefined : LOCKED_RECORD_REASON}
              onClick={() => void onDeactivate()}
            >
              {busy ? 'Deactivating…' : 'Deactivate employee'}
            </button>
          </div>
        )}
        {canManage && !editable && (
          <p className="locked-note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
              <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" strokeLinecap="round" />
            </svg>
            {LOCKED_RECORD_REASON}.
          </p>
        )}
      </section>

      {editOpen && (
        <EmployeeSheet employeeId={employee.id} onClose={closeEdit} onSaved={onSaved} />
      )}
    </div>
  )
}
