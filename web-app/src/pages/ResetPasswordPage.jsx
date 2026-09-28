import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/client'
import './auth.css'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const tokenFromQuery = useMemo(() => params.get('token') || '', [params])

  const [token, setToken] = useState(tokenFromQuery)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    const next = {}
    if (!token.trim()) next.token = 'Reset token is required'
    if (!password || password.length < 8) next.password = 'Password must be at least 8 characters'
    if (password !== confirm) next.confirm = 'Passwords do not match'
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length) return

    setSubmitting(true)
    try {
      await authApi.resetPassword(token.trim(), password)
      navigate('/login', { replace: true, state: { resetSuccess: true } })
    } catch (err) {
      setFormError(authApi.errorMessage(err, 'Reset failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h1>Reset password</h1>
            <p>Choose a new password for your account</p>
          </div>
        </div>

        <form className="auth-form" onSubmit={onSubmit} noValidate>
          {!tokenFromQuery && (
            <label>
              Reset token
              <input value={token} onChange={(e) => setToken(e.target.value)} />
              {errors.token && <span className="field-error">{errors.token}</span>}
            </label>
          )}

          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {errors.password && <span className="field-error">{errors.password}</span>}
          </label>

          <label>
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {errors.confirm && <span className="field-error">{errors.confirm}</span>}
          </label>

          {formError && <p className="banner error">{formError}</p>}

          <button className="btn primary" type="submit" disabled={submitting}>
            {submitting ? 'Updating…' : 'Update password'}
          </button>
        </form>

        <p className="auth-footer">
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
