import { Link } from 'react-router-dom'
import './auth.css'

export function ForbiddenPage() {
  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h1>403 — Forbidden</h1>
            <p>You don’t have permission to view this page.</p>
          </div>
        </div>
        <div className="error-actions">
          <Link className="btn primary" to="/">
            Dashboard
          </Link>
          <Link className="btn ghost" to="/profile">
            View profile
          </Link>
        </div>
      </div>
    </div>
  )
}
