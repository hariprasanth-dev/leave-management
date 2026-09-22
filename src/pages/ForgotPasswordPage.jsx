import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../api/client'
import './auth.css'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [fieldError, setFieldError] = useState(null)
  const [message, setMessage] = useState(null)
  const [devToken, setDevToken] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setDevToken(null)
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFieldError('Enter a valid email')
      return
    }
    setFieldError(null)
    setSubmitting(true)
    try {
      const data = await authApi.forgotPassword(email.trim().toLowerCase())
      setMessage(data.message)
      if (data.reset_token) setDevToken(data.reset_token)
    } catch (err) {
      setError(authApi.errorMessage(err, 'Request failed'))
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
            <h1>Forgot password</h1>
            <p>We’ll send a reset link if the account exists</p>
          </div>
        </div>

        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            {fieldError && <span className="field-error">{fieldError}</span>}
          </label>

          {error && <p className="banner error">{error}</p>}
          {message && <p className="banner success">{message}</p>}
          {devToken && (
            <p className="banner success">
              Dev reset token ready —{' '}
              <Link to={`/reset-password?token=${encodeURIComponent(devToken)}`}>
                continue to reset
              </Link>
            </p>
          )}

          <button className="btn primary" type="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <p className="auth-footer">
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
