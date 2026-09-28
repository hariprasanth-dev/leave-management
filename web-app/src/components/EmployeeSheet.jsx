import { useEffect, useRef, useState } from 'react'
import { authApi, employeeApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { LOCKED_RECORD_REASON, canEditEmployee, hasRole } from '../auth/permissions'
import '../pages/pages.css'
import { FormSkeleton } from './Skeleton'
import './EmployeeSheet.css'

const emptyForm = {
  email: '',
  full_name: '',
  password: '',
  department_id: '',
  employee_code: '',
  manager_id: '',
  hire_date: '',
  role: 'employee',
  is_active: true,
}

const FORM_ID = 'employee-sheet-form'

/**
 * Right-hand side sheet for adding (no employeeId) or editing an employee.
 * onSaved(employee, { created, loginEmail }) fires after the backend confirms the save.
 */
export function EmployeeSheet({ employeeId, onClose, onSaved }) {
  const isEdit = Boolean(employeeId)
  const { user } = useAuth()
  const isElevated = hasRole(user, 'hr', 'admin')
  const isManagerOnly = hasRole(user, 'manager') && !isElevated
  const panelRef = useRef(null)

  const [form, setForm] = useState(emptyForm)
  const [departments, setDepartments] = useState([])
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [deps, mgrList] = await Promise.all([
          employeeApi.departments(),
          employeeApi.list({ page: 1, pageSize: 100, isActive: true }),
        ])
        if (cancelled) return
        setDepartments(deps)
        setManagers(mgrList.items || [])

        if (isEdit) {
          const emp = await employeeApi.get(employeeId)
          if (cancelled) return
          setLocked(!canEditEmployee(user, emp))
          setForm({
            email: emp.email,
            full_name: emp.full_name,
            password: '',
            department_id: emp.department_id || '',
            employee_code: emp.employee_code || '',
            manager_id: emp.manager_id || '',
            hire_date: emp.hire_date || '',
            role: emp.role || 'employee',
            is_active: emp.is_active,
          })
        } else {
          const nextCode = await employeeApi.nextCode().catch(() => '')
          if (cancelled) return
          setForm({
            ...emptyForm,
            employee_code: nextCode,
            department_id: deps[0]?.id || '',
            manager_id: isManagerOnly && user?.employee_id ? user.employee_id : '',
          })
        }
        setError(null)
      } catch (err) {
        if (!cancelled) setError(authApi.errorMessage(err, 'Failed to load form'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [employeeId, isEdit, isManagerOnly, user])

  useEffect(() => {
    if (!loading) panelRef.current?.querySelector('input:not([disabled]), select')?.focus()
  }, [loading])

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function validate() {
    const next = {}
    if (!form.full_name.trim()) next.full_name = 'Full name is required'
    if (!isEdit) {
      if (!form.email.trim()) next.email = 'Email is required'
      if (!form.password || form.password.length < 8) {
        next.password = 'Password must be at least 8 characters (used for login)'
      }
    }
    if (!form.department_id) next.department_id = 'Department is required'
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setError(null)
    try {
      if (isEdit) {
        const updated = await employeeApi.update(employeeId, {
          full_name: form.full_name.trim(),
          department_id: form.department_id,
          manager_id: form.manager_id || null,
          hire_date: form.hire_date || null,
          role: isManagerOnly ? 'employee' : form.role,
          is_active: form.is_active,
        })
        onSaved(updated, { created: false })
      } else {
        const email = form.email.trim().toLowerCase()
        const created = await employeeApi.create({
          email,
          full_name: form.full_name.trim(),
          password: form.password,
          department_id: form.department_id,
          manager_id: form.manager_id || null,
          hire_date: form.hire_date || null,
          role: isManagerOnly ? 'employee' : form.role,
        })
        onSaved(created, { created: true, loginEmail: email })
      }
    } catch (err) {
      setError(authApi.errorMessage(err, 'Failed to save employee'))
    } finally {
      setSubmitting(false)
    }
  }

  const showForm = !loading && !(isEdit && locked)

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <aside
        ref={panelRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet-header">
          <div>
            <h2 id="employee-sheet-title">{isEdit ? 'Edit employee' : 'Add employee'}</h2>
            <p className="muted">
              {isEdit
                ? 'Update profile, department, manager and status.'
                : 'Creates a login account. Share the email and temporary password so they can sign in.'}
            </p>
          </div>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="sheet-body">
          {loading && <FormSkeleton rows={[1, 1, 2, 1, 2, 2]} actions={false} label="Loading employee" />}
          {error && <p className="banner error">{error}</p>}

          {!loading && isEdit && locked && (
            <div className="empty-state">
              <h3>This record can&apos;t be changed</h3>
              <p className="muted">
                {form.full_name} has the {form.role} role. {LOCKED_RECORD_REASON}.
              </p>
            </div>
          )}

          {showForm && (
            <form id={FORM_ID} className="form-panel sheet-form" onSubmit={onSubmit} noValidate>
              {!isEdit && (
                <section className="sheet-section">
                  <h3 className="sheet-section-title">Login account</h3>
                  <label>
                    Work email (login)
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setField('email', e.target.value)}
                      autoComplete="off"
                      placeholder="name@company.com"
                    />
                    {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
                  </label>
                  <label>
                    Temporary password (login)
                    <div className="password-row">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={(e) => setField('password', e.target.value)}
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                      />
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <span className="muted">
                      The employee signs in at the login page with this email and password.
                    </span>
                    {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
                  </label>
                </section>
              )}

              <section className="sheet-section">
                <h3 className="sheet-section-title">Profile</h3>
                {isEdit ? (
                  <div className="sheet-identity">
                    <span className="sheet-code">{form.employee_code}</span>
                    <span className="muted">{form.email}</span>
                  </div>
                ) : (
                  <label>
                    Employee ID
                    <input value={form.employee_code || 'Assigned on save'} disabled readOnly />
                    <span className="muted">Assigned automatically in the company format (ST-01, ST-02…).</span>
                  </label>
                )}
                <label>
                  Full name
                  <input value={form.full_name} onChange={(e) => setField('full_name', e.target.value)} />
                  {fieldErrors.full_name && <span className="field-error">{fieldErrors.full_name}</span>}
                </label>
                <label>
                  Hire date
                  <input
                    type="date"
                    value={form.hire_date || ''}
                    onChange={(e) => setField('hire_date', e.target.value)}
                  />
                </label>
              </section>

              <section className="sheet-section">
                <h3 className="sheet-section-title">Work</h3>
                <label>
                  Department
                  <select
                    value={form.department_id}
                    onChange={(e) => setField('department_id', e.target.value)}
                  >
                    <option value="">Select department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.department_id && (
                    <span className="field-error">{fieldErrors.department_id}</span>
                  )}
                </label>
                <label>
                  Manager
                  <select value={form.manager_id} onChange={(e) => setField('manager_id', e.target.value)}>
                    <option value="">No manager</option>
                    {managers
                      .filter((m) => m.id !== employeeId)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name} ({m.employee_code})
                        </option>
                      ))}
                  </select>
                  {isManagerOnly && (
                    <span className="muted">Defaults to you so they appear on your team.</span>
                  )}
                </label>
                {isElevated ? (
                  <label>
                    Role
                    <select value={form.role} onChange={(e) => setField('role', e.target.value)}>
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="hr">HR</option>
                    </select>
                  </label>
                ) : (
                  <label>
                    Role
                    <input value="Employee" disabled readOnly />
                    <span className="muted">Managers create employee login accounts only.</span>
                  </label>
                )}
                {isEdit && (
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setField('is_active', e.target.checked)}
                    />
                    Active (can sign in)
                  </label>
                )}
              </section>
            </form>
          )}
        </div>

        <footer className="sheet-footer">
          <button type="button" className="btn ghost" onClick={onClose}>
            {showForm ? 'Cancel' : 'Close'}
          </button>
          {showForm && (
            <button className="btn primary" type="submit" form={FORM_ID} disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create employee account'}
            </button>
          )}
        </footer>
      </aside>
    </div>
  )
}
