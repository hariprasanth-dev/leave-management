import { Link } from 'react-router-dom'
import './auth.css'

/** Legacy email link route — password recovery uses a temporary password via forgot-password. */
export function ResetPasswordPage() {
  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h1>Password reset link</h1>
            <p>LeaveFlow no longer uses one-time reset links in email.</p>
          </div>
        </div>

        <div className="auth-sent" role="status">
          <p>
            Request a <strong>temporary password</strong> instead. Sign in with it once, then choose a new
            password in Settings.
          </p>
          <Link className="btn primary auth-wide" to="/forgot-password">
            Email me a temporary password
          </Link>
          <Link className="btn ghost auth-wide" to="/login">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
