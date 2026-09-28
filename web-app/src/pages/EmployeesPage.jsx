import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi, employeeApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { LOCKED_RECORD_REASON, PERMISSIONS, canEditEmployee } from '../auth/permissions'
import { EmployeeSheet } from '../components/EmployeeSheet'
import { formatDate, initials } from './dashboardUtils'
import './pages.css'
import './EmployeesPage.css'

const PAGE_SIZES = [10, 25, 50]

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'employee', label: 'Employee' },
  { value: 'manager', label: 'Manager' },
  { value: 'hr', label: 'HR' },
]

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const COLUMNS = [
  { key: 'name', label: 'Employee', sortable: true },
  { key: 'code', label: 'ID', sortable: true },
  { key: 'department', label: 'Department', sortable: true },
  { key: 'role', label: 'Role', sortable: true },
  { key: 'manager', label: 'Manager', sortable: true, className: 'emp-col-optional' },
  { key: 'hire_date', label: 'Hire date', sortable: true, className: 'emp-col-optional' },
  { key: 'status', label: 'Status', sortable: true },
]

const ROLE_LABELS = { employee: 'Employee', manager: 'Manager', hr: 'HR', admin: 'Admin' }

function SortIcon({ direction }) {
  return (
    <svg className={`emp-sort-icon ${direction || ''}`} viewBox="0 0 12 16" aria-hidden="true">
      <path className="up" d="M6 2l4 5H2z" />
      <path className="down" d="M6 14l-4-5h8z" />
    </svg>
  )
}

function Icon({ name }) {
  const paths = {
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4.5 4.5" strokeLinecap="round" />
      </>
    ),
    edit: <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" strokeLinejoin="round" />,
    power: (
      <>
        <path d="M12 3v8" strokeLinecap="round" />
        <path d="M7 6.5a7 7 0 1 0 10 0" strokeLinecap="round" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
        <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" strokeLinecap="round" />
      </>
    ),
    x: <path d="M7 7l10 10M17 7L7 17" strokeLinecap="round" />,
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

export function EmployeesPage() {
  const { user, can } = useAuth()
  const navigate = useNavigate()
  const canManage = can(PERMISSIONS.EMPLOYEE_MANAGE)

  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState({ active: 0, inactive: 0 })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const [departmentId, setDepartmentId] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('active')
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: 'code', order: 'asc' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deactivating, setDeactivating] = useState(null)
  const [busy, setBusy] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [notice, setNotice] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const sheet = canManage ? searchParams.get('sheet') : null

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const filtersActive = Boolean(query || departmentId || role || status !== 'active')
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total)

  useEffect(() => {
    employeeApi
      .departments()
      .then(setDepartments)
      .catch(() => setDepartments([]))
  }, [])

  useEffect(() => {
    const next = searchInput.trim()
    if (next === query) return undefined
    const handle = setTimeout(() => {
      setQuery(next)
      setPage(1)
    }, 300)
    return () => clearTimeout(handle)
  }, [searchInput, query])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    employeeApi
      .list({
        departmentId: departmentId || undefined,
        isActive: status === 'all' ? null : status === 'active',
        role: role || undefined,
        q: query || undefined,
        sort: sort.key,
        order: sort.order,
        page,
        pageSize,
        scope: canManage ? undefined : 'team',
      })
      .then((data) => {
        if (cancelled) return
        setEmployees(data.items || [])
        setTotal(data.total || 0)
        setCounts({ active: 0, inactive: 0, ...data.status_counts })
        setError(null)
      })
      .catch((err) => {
        if (!cancelled) setError(authApi.errorMessage(err, 'Failed to load employees'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [departmentId, status, role, query, sort, page, pageSize, canManage, refreshKey])

  const setSheet = useCallback(
    (value) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value) next.set('sheet', value)
          else next.delete('sheet')
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const closeSheet = useCallback(() => setSheet(null), [setSheet])

  function onSaved(emp, { created, loginEmail }) {
    setSheet(null)
    setNotice({ emp, created, loginEmail })
    setRefreshKey((k) => k + 1)
  }

  function toggleSort(key) {
    setPage(1)
    setSort((prev) =>
      prev.key === key ? { key, order: prev.order === 'asc' ? 'desc' : 'asc' } : { key, order: 'asc' },
    )
  }

  function changeFilter(setter) {
    return (value) => {
      setPage(1)
      setter(value)
    }
  }

  function clearFilters() {
    setSearchInput('')
    setQuery('')
    setDepartmentId('')
    setRole('')
    setStatus('active')
    setPage(1)
  }

  async function confirmDeactivate() {
    if (!deactivating) return
    setBusy(true)
    try {
      await employeeApi.deactivate(deactivating.id)
      setNotice({ emp: deactivating, deactivated: true })
      setDeactivating(null)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setError(authApi.errorMessage(err, 'Failed to deactivate employee'))
    } finally {
      setBusy(false)
    }
  }

  const pageNumbers = useMemo(() => {
    const start = Math.max(1, Math.min(page - 2, totalPages - 4))
    return Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i)
  }, [page, totalPages])

  const statusCount = {
    all: counts.active + counts.inactive,
    active: counts.active,
    inactive: counts.inactive,
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{canManage ? 'Employees' : 'My team'}</h1>
          <p>
            {canManage
              ? 'Search, filter and manage the people who sign in to LeaveFlow.'
              : user?.role === 'manager'
                ? 'Direct reports in your organization.'
                : 'Employees you are allowed to view.'}
          </p>
        </div>
        {canManage && (
          <button type="button" className="btn primary" onClick={() => setSheet('new')}>
            Add employee
          </button>
        )}
      </header>

      {notice && (
        <p className="banner success">
          {notice.created ? (
            <>
              Account created for {notice.emp.full_name} ({notice.emp.employee_code}). They can sign in
              with <strong>{notice.loginEmail}</strong> and the temporary password you set.
            </>
          ) : notice.deactivated ? (
            <>{notice.emp.full_name} was deactivated and can no longer sign in.</>
          ) : (
            <>Changes to {notice.emp.full_name} saved.</>
          )}
          <Link to={`/employees/${notice.emp.id}`}>View profile</Link>
          <button type="button" className="btn ghost" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </p>
      )}

      <section className="panel emp-card">
        <div className="emp-toolbar">
          <div className="emp-tabs" role="tablist" aria-label="Status">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={status === t.value}
                className={`emp-tab ${status === t.value ? 'active' : ''}`}
                onClick={() => changeFilter(setStatus)(t.value)}
              >
                {t.label}
                <span className="emp-tab-count">{statusCount[t.value]}</span>
              </button>
            ))}
          </div>

          <div className="emp-filters">
            <label className="emp-search">
              <Icon name="search" />
              <input
                type="search"
                placeholder="Search name, email or ID"
                aria-label="Search employees"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </label>
            <select
              aria-label="Department"
              value={departmentId}
              onChange={(e) => changeFilter(setDepartmentId)(e.target.value)}
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select aria-label="Role" value={role} onChange={(e) => changeFilter(setRole)(e.target.value)}>
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="emp-sort-mobile"
              aria-label="Sort by"
              value={`${sort.key}:${sort.order}`}
              onChange={(e) => {
                const [key, order] = e.target.value.split(':')
                setPage(1)
                setSort({ key, order })
              }}
            >
              {COLUMNS.flatMap((col) => [
                <option key={`${col.key}:asc`} value={`${col.key}:asc`}>
                  Sort: {col.label} (A→Z)
                </option>,
                <option key={`${col.key}:desc`} value={`${col.key}:desc`}>
                  Sort: {col.label} (Z→A)
                </option>,
              ])}
            </select>
            {filtersActive && (
              <button type="button" className="emp-clear" onClick={clearFilters}>
                <Icon name="x" />
                Clear
              </button>
            )}
          </div>
        </div>

        {error && <p className="banner error emp-error">{error}</p>}

        <div className={`emp-table-wrap ${loading ? 'is-loading' : ''}`}>
          <table className="emp-table">
            <thead>
              <tr>
                {COLUMNS.map((col) => {
                  const active = sort.key === col.key
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      className={col.className}
                      aria-sort={active ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <button
                        type="button"
                        className={`emp-sort ${active ? 'active' : ''}`}
                        onClick={() => toggleSort(col.key)}
                      >
                        {col.label}
                        <SortIcon direction={active ? sort.order : null} />
                      </button>
                    </th>
                  )
                })}
                {canManage && (
                  <th scope="col" className="emp-col-actions">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading && employees.length === 0 &&
                Array.from({ length: 4 }, (_, i) => (
                  <tr key={`sk-${i}`} className="emp-skeleton-row">
                    {COLUMNS.map((col) => (
                      <td key={col.key} className={col.className}>
                        <span className="skeleton emp-skeleton" />
                      </td>
                    ))}
                    {canManage && <td />}
                  </tr>
                ))}

              {!loading && employees.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + (canManage ? 1 : 0)}>
                    <div className="emp-empty">
                      <h2>No employees match</h2>
                      <p className="muted">
                        {filtersActive
                          ? 'Try a different search or clear the filters.'
                          : 'Add your first employee to get started.'}
                      </p>
                      {filtersActive ? (
                        <button type="button" className="btn ghost" onClick={clearFilters}>
                          Clear filters
                        </button>
                      ) : (
                        canManage && (
                          <button type="button" className="btn primary" onClick={() => setSheet('new')}>
                            Add employee
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {employees.map((emp) => {
                const editable = canEditEmployee(user, emp)
                return (
                  <tr key={emp.id} className="emp-row" onClick={() => navigate(`/employees/${emp.id}`)}>
                    <td>
                      <div className="emp-person">
                        <span className={`emp-avatar role-${emp.role}`} aria-hidden="true">
                          {initials(emp.full_name)}
                        </span>
                        <span className="emp-person-text">
                          <Link
                            to={`/employees/${emp.id}`}
                            className="emp-name"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {emp.full_name}
                          </Link>
                          <span className="emp-email">{emp.email}</span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="emp-code">{emp.employee_code || '—'}</span>
                    </td>
                    <td className="emp-cell-dept">{emp.department || '—'}</td>
                    <td>
                      <span className={`emp-role role-${emp.role}`}>{ROLE_LABELS[emp.role] || emp.role}</span>
                    </td>
                    <td className="emp-col-optional">{emp.manager_name || <span className="muted">—</span>}</td>
                    <td className="emp-col-optional">
                      {emp.hire_date ? formatDate(emp.hire_date) : <span className="muted">—</span>}
                    </td>
                    <td>
                      <span className={`emp-status ${emp.is_active ? 'active' : 'inactive'}`}>
                        {emp.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canManage && (
                      <td className="emp-col-actions" onClick={(e) => e.stopPropagation()}>
                        {editable ? (
                          <div className="emp-actions">
                            <button
                              type="button"
                              className="emp-icon-btn"
                              title="Edit"
                              aria-label={`Edit ${emp.full_name}`}
                              onClick={() => setSheet(emp.id)}
                            >
                              <Icon name="edit" />
                            </button>
                            {emp.is_active && (
                              <button
                                type="button"
                                className="emp-icon-btn danger"
                                title="Deactivate"
                                aria-label={`Deactivate ${emp.full_name}`}
                                onClick={() => setDeactivating(emp)}
                              >
                                <Icon name="power" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="emp-locked" title={LOCKED_RECORD_REASON}>
                            <Icon name="lock" />
                            Locked
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <footer className="emp-footer">
          <span className="muted">
            {total === 0 ? 'No results' : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
          </span>
          <div className="emp-pager">
            <label className="emp-page-size">
              Rows
              <select
                value={pageSize}
                onChange={(e) => {
                  setPage(1)
                  setPageSize(Number(e.target.value))
                }}
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="emp-page-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Previous page"
            >
              ‹
            </button>
            {pageNumbers.map((n) => (
              <button
                key={n}
                type="button"
                className={`emp-page-btn ${n === page ? 'active' : ''}`}
                aria-current={n === page ? 'page' : undefined}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className="emp-page-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        </footer>
      </section>

      {deactivating && (
        <div className="modal-backdrop" role="presentation" onClick={() => setDeactivating(null)}>
          <div
            className="modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deactivate-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="deactivate-title">Deactivate {deactivating.full_name}?</h2>
            <p className="muted">
              Soft-delete only — leave history is kept. They will no longer be able to sign in.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setDeactivating(null)}>
                Keep active
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={busy}
                onClick={() => void confirmDeactivate()}
              >
                {busy ? 'Deactivating…' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {sheet && (
        <EmployeeSheet
          key={sheet}
          employeeId={sheet === 'new' ? null : sheet}
          onClose={closeSheet}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
