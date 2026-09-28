import { useState } from 'react'
import { authApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'

function rulesFor(current, next, confirm, forced) {
  const rules = [
    { id: 'length', label: 'At least 8 characters', ok: next.length >= 8 },
    { id: 'mix', label: 'Includes a letter and a number', ok: /[A-Za-z]/.test(next) && /\d/.test(next) },
    { id: 'match', label: 'New passwords match', ok: next.length > 0 && next === confirm },
  ]
  if (!forced) {
    rules.push({
      id: 'different',
      label: 'Different from your current password',
      ok: next.length > 0 && next !== current,
    })
  }
  return rules
}

function PasswordInput({ label, value, onChange, autoComplete, show, error, name }) {
  return (
    <label>
      {label}
      <span className="password-field">
        <input
          type={show ? 'text' : 'password'}
          name={name}
          autoComplete={autoComplete}
          maxLength={128}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
        />
      </span>
      {error && <span className="field-error">{error}</span>}
    </label>
  )
}

export function ChangePasswordForm({ forced = false, onChanged }) {
  const { user, changePassword } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const rules = rulesFor(current, next, confirm, forced)

  async function onSubmit(e) {
    e.preventDefault()
    const nextErrors = {}
    if (!forced && !current) nextErrors.current = 'Enter your current password'
    if (!rules.find((r) => r.id === 'length').ok) nextErrors.next = 'Use at least 8 characters'
    else if (!rules.find((r) => r.id === 'mix').ok) nextErrors.next = 'Include a letter and a number'
    else if (next !== next.trim()) nextErrors.next = "Password can't start or end with a space"
    else if (!forced && next === current) nextErrors.next = 'Choose a password you are not using now'
    if (next !== confirm) nextErrors.confirm = 'Passwords do not match'
    setErrors(nextErrors)
    setFormError(null)
    if (Object.keys(nextErrors).length) return

    setSubmitting(true)
    try {
      await changePassword(forced ? null : current, next)
      setCurrent('')
      setNext('')
      setConfirm('')
      setShow(false)
      onChanged?.()
    } catch (err) {
      const status = err?.response?.status
      if (status === 400 && /current password/i.test(err.response?.data?.detail || '')) {
        setErrors({ current: 'Current password is incorrect' })
      } else {
        setFormError(authApi.errorMessage(err, 'Could not update your password'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="form password-form" onSubmit={onSubmit} noValidate>
      <input type="email" name="username" autoComplete="username" value={user?.email || ''} readOnly hidden />

      {!forced && (
        <PasswordInput
          label="Current password"
          name="current-password"
          autoComplete="current-password"
          value={current}
          onChange={setCurrent}
          show={show}
          error={errors.current}
        />
      )}
      <div className="form-row">
        <PasswordInput
          label="New password"
          name="new-password"
          autoComplete="new-password"
          value={next}
          onChange={setNext}
          show={show}
          error={errors.next}
        />
        <PasswordInput
          label="Confirm new password"
          name="confirm-password"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          show={show}
          error={errors.confirm}
        />
      </div>

      <label className="password-show">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
        Show passwords
      </label>

      <ul className="password-rules" aria-label="Password requirements">
        {rules.map((rule) => (
          <li key={rule.id} className={rule.ok ? 'ok' : ''}>
            <span className="password-rule-icon" aria-hidden="true">
              {rule.ok ? '✓' : '•'}
            </span>
            {rule.label}
            <span className="sr-only">{rule.ok ? ' (met)' : ' (not met)'}</span>
          </li>
        ))}
      </ul>

      {formError && (
        <p className="banner error" role="alert">
          {formError}
        </p>
      )}

      <div className="password-actions">
        <button className="btn primary" type="submit" disabled={submitting}>
          {submitting ? 'Updating…' : forced ? 'Set new password' : 'Update password'}
        </button>
        <span className="muted">You&apos;ll stay signed in here; other devices are signed out.</span>
      </div>
    </form>
  )
}
