import { Link } from 'react-router-dom'
import './auth.css'

export function NotFoundPage() {
  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h1>404 — Page not found</h1>
            <p>That route doesn’t exist in LeaveFlow.</p>
          </div>
        </div>
        <p className="auth-footer">
          <Link to="/">Back to dashboard</Link>
        </p>
      </div>
    </div>
  )
}
