import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../api/client'
import './auth.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [fieldError, setFieldError] = useState(null)
  const [sentTo, setSentTo] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    const value = email.trim().toLowerCase()
    if (!EMAIL_RE.test(value)) {
      setFieldError('Enter your work email address')
      return
    }
    setFieldError(null)
    setSubmitting(true)
    try {
      await authApi.forgotPassword(value)
      setSentTo(value)
    } catch (err) {
      setError(authApi.errorMessage(err, 'Could not send a temporary password. Try again.'))
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
            <h1>{sentTo ? 'Check your email' : 'Forgot password'}</h1>
            <p>
              {sentTo
                ? 'A temporary password is on its way'
                : 'We’ll email you a temporary password to sign in'}
            </p>
          </div>
        </div>

        {sentTo ? (
          <div className="auth-sent" role="status">
            <p>
              If an active LeaveFlow account uses <strong>{sentTo}</strong>, we’ve sent it a temporary
              password.
            </p>
            <ol className="auth-steps">
              <li>Open the email from LeaveFlow and copy the temporary password.</li>
              <li>Sign in with your work email and that password. It works once and expires in 30 minutes.</li>
              <li>You’ll be taken straight to Settings to choose a new password.</li>
            </ol>
            <p className="auth-hint">
              Didn’t get it? Check spam, or wait a minute and request another. Your current password keeps
              working until you change it.
            </p>
            <Link className="btn primary auth-wide" to="/login">
              Back to sign in
            </Link>
            <button
              type="button"
              className="btn ghost auth-wide"
              onClick={() => {
                setSentTo(null)
                setEmail('')
              }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={onSubmit} noValidate>
            <label>
              Work email
              <input
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={255}
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(fieldError)}
                disabled={submitting}
              />
              {fieldError && <span className="field-error">{fieldError}</span>}
            </label>

            {error && (
              <p className="banner error" role="alert">
                {error}
              </p>
            )}

            <button className="btn primary auth-wide" type="submit" disabled={submitting}>
              {submitting ? 'Sending…' : 'Email me a temporary password'}
            </button>
            <p className="auth-hint">
              For employees and managers. The password goes only to the email on your LeaveFlow account.
            </p>
          </form>
        )}

        {!sentTo && (
          <p className="auth-footer">
            <Link to="/login">Back to sign in</Link>
          </p>
        )}
      </div>
    </div>
  )
}
