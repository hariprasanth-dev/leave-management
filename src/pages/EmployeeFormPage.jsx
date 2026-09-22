import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { authApi, employeeApi } from '../api/client'
import './pages.css'

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

export function EmployeeFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [form, setForm] = useState(emptyForm)
  const [departments, setDepartments] = useState([])
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

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
          const emp = await employeeApi.get(id)
          if (cancelled) return
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
        } else if (deps[0]?.id) {
          setForm((prev) => ({ ...prev, department_id: deps[0].id }))
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
  }, [id, isEdit])

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function validate() {
    const next = {}
    if (!form.full_name.trim()) next.full_name = 'Full name is required'
    if (!isEdit) {
      if (!form.email.trim()) next.email = 'Email is required'
      if (!form.password || form.password.length < 8) {
        next.password = 'Password must be at least 8 characters'
      }
      if (!form.employee_code.trim()) next.employee_code = 'Employee code is required'
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
        const updated = await employeeApi.update(id, {
          full_name: form.full_name.trim(),
          department_id: form.department_id,
          manager_id: form.manager_id || null,
          hire_date: form.hire_date || null,
          role: form.role,
          is_active: form.is_active,
        })
        navigate(`/team/${updated.id}`)
      } else {
        const created = await employeeApi.create({
          email: form.email.trim(),
          full_name: form.full_name.trim(),
          password: form.password,
          department_id: form.department_id,
          employee_code: form.employee_code.trim(),
          manager_id: form.manager_id || null,
          hire_date: form.hire_date || null,
          role: form.role,
        })
        navigate(`/team/${created.id}`)
      }
    } catch (err) {
      setError(authApi.errorMessage(err, 'Failed to save employee'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{isEdit ? 'Edit employee' : 'Add employee'}</h1>
          <p>
            {isEdit
              ? 'Update profile, department, manager, and status.'
              : 'Creates a login account and default leave balances (Earned 12 + Sick 10).'}
          </p>
        </div>
        <Link className="btn ghost" to={isEdit ? `/team/${id}` : '/team'}>
          Cancel
        </Link>
      </header>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="banner error">{error}</p>}

      {!loading && (
        <form className="form-panel panel" onSubmit={onSubmit}>
          {!isEdit && (
            <>
              <label>
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  autoComplete="off"
                />
                {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
              </label>
              <label>
                Temporary password
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                  autoComplete="new-password"
                />
                {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
              </label>
              <label>
                Employee code
                <input
                  value={form.employee_code}
                  onChange={(e) => setField('employee_code', e.target.value)}
                />
                {fieldErrors.employee_code && (
                  <span className="field-error">{fieldErrors.employee_code}</span>
                )}
              </label>
            </>
          )}

          <label>
            Full name
            <input
              value={form.full_name}
              onChange={(e) => setField('full_name', e.target.value)}
            />
            {fieldErrors.full_name && <span className="field-error">{fieldErrors.full_name}</span>}
          </label>

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
            <select
              value={form.manager_id}
              onChange={(e) => setField('manager_id', e.target.value)}
            >
              <option value="">No manager</option>
              {managers
                .filter((m) => m.id !== id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.employee_code})
                  </option>
                ))}
            </select>
          </label>

          <label>
            Role
            <select value={form.role} onChange={(e) => setField('role', e.target.value)}>
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="hr">HR</option>
            </select>
          </label>

          <label>
            Hire date
            <input
              type="date"
              value={form.hire_date || ''}
              onChange={(e) => setField('hire_date', e.target.value)}
            />
          </label>

          {isEdit && (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setField('is_active', e.target.checked)}
              />
              Active
            </label>
          )}

          <div className="modal-actions">
            <button className="btn primary" type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create employee'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
