import { Link } from 'react-router-dom'
import './pages.css'

export function InAppNotFound() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Page not found</h1>
          <p>This module or route isn’t available.</p>
        </div>
        <Link className="btn primary" to="/">
          Go to dashboard
        </Link>
      </header>
      <section className="panel">
        <p className="muted">
          Check the sidebar for modules you can access, or return to the dashboard.
        </p>
      </section>
    </div>
  )
}
