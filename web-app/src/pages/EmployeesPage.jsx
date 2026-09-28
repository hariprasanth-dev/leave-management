import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi, employeeApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { PERMISSIONS } from '../auth/permissions'
import { PageSkeleton } from '../components/Skeleton'
import './pages.css'

const PAGE_SIZE = 8

export function EmployeesPage() {
  const { user, can } = useAuth()
  const canManage = can(PERMISSIONS.EMPLOYEE_MANAGE)

  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [departmentId, setDepartmentId] = useState('')
  const [activeFilter, setActiveFilter] = useState('active')
  const [query, setQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deactivateId, setDeactivateId] = useState(null)
  const [busy, setBusy] = useState(false)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  useEffect(() => {
    employeeApi
      .departments()
      .then(setDepartments)
      .catch(() => setDepartments([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const isActive =
      activeFilter === 'all' ? null : activeFilter === 'active'
    employeeApi
      .list({
        departmentId: departmentId || undefined,
        isActive,
        q: query || undefined,
        page,
        pageSize: PAGE_SIZE,
        scope: canManage ? undefined : 'team',
      })
      .then((data) => {
        if (cancelled) return
        setEmployees(data.items || [])
        setTotal(data.total || 0)
        setError(null)
      })
      .catch((err) => {
        if (!cancelled) setError(authApi.errorMessage(err, 'Failed to load team'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [departmentId, activeFilter, query, page, canManage])

  function onSearch(e) {
    e.preventDefault()
    setPage(1)
    setQuery(searchInput.trim())
  }

  async function confirmDeactivate() {
    if (!deactivateId) return
    setBusy(true)
    try {
      await employeeApi.deactivate(deactivateId)
      setEmployees((prev) => prev.filter((e) => e.id !== deactivateId))
      setTotal((t) => Math.max(0, t - 1))
      setDeactivateId(null)
    } catch (err) {
      setError(authApi.errorMessage(err, 'Failed to deactivate employee'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{canManage ? 'Employees' : 'My team'}</h1>
          <p>
            {canManage
              ? 'Create, update, and deactivate organization employees.'
              : user?.role === 'manager'
                ? 'Direct reports in your organization.'
                : 'Employees you are allowed to view.'}
          </p>
        </div>
        {canManage && (
          <Link className="btn primary" to="/employees/new">
            Add employee
          </Link>
        )}
      </header>

      <form className="toolbar panel" onSubmit={onSearch}>
        <input
          type="search"
          placeholder="Search name, email, or code"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          value={departmentId}
          onChange={(e) => {
            setPage(1)
            setDepartmentId(e.target.value)
          }}
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={activeFilter}
          onChange={(e) => {
            setPage(1)
            setActiveFilter(e.target.value)
          }}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All statuses</option>
        </select>
        <button className="btn ghost" type="submit">
          Search
        </button>
      </form>

      {loading && <PageSkeleton />}
      {error && <p className="banner error">{error}</p>}

      {!loading && !error && employees.length === 0 && (
        <div className="empty-state panel">
          <h2>No employees found</h2>
          <p className="muted">Try another search or add a new employee.</p>
          {canManage && (
            <Link className="btn primary" to="/employees/new">
              Add employee
            </Link>
          )}
        </div>
      )}

      {!loading && employees.length > 0 && (
        <ul className="list panel">
          {employees.map((emp) => (
            <li key={emp.id}>
              <div>
                <Link className="list-title" to={`/employees/${emp.id}`}>
                  {emp.full_name}
                </Link>
                <p className="muted">
                  {emp.employee_code} · {emp.department} · {emp.role} · {emp.email}
                </p>
                {emp.manager_name && <p className="muted">Manager: {emp.manager_name}</p>}
              </div>
              <div className="list-actions">
                <span className={`badge ${emp.is_active ? 'approved' : 'cancelled'}`}>
                  {emp.is_active ? 'active' : 'inactive'}
                </span>
                {canManage && (
                  <Link className="btn ghost" to={`/employees/${emp.id}/edit`}>
                    Edit
                  </Link>
                )}
                {canManage && emp.is_active && (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setDeactivateId(emp.id)}
                  >
                    Deactivate
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

      {deactivateId && (
        <div className="modal-backdrop" role="presentation" onClick={() => setDeactivateId(null)}>
          <div
            className="modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deactivate-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="deactivate-title">Deactivate employee?</h2>
            <p className="muted">
              Soft-delete only — leave history is kept. The user will no longer be able to sign in.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setDeactivateId(null)}>
                Keep active
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={busy}
                onClick={() => void confirmDeactivate()}
              >
                {busy ? 'Deactivating…' : 'Confirm deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
