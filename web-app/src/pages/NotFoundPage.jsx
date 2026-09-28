import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Layout } from '../components/Layout'
import { getAccessToken } from '../api/client'
import { AuthBootSkeleton, ShellSkeleton } from '../components/Skeleton'
import { flattenNav } from '../navigation'
import './NotFound.css'

function NotFoundContent({ signedIn, suggestions = [] }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  function goBack() {
    if (window.history.length > 1) navigate(-1)
    else navigate(signedIn ? '/' : '/login', { replace: true })
  }

  return (
    <section className="nf-hero" aria-labelledby="nf-title">
      <p className="nf-code" aria-hidden="true">
        404
      </p>
      <h1 id="nf-title">Page not found</h1>
      <p className="nf-lead">
        We couldn’t find anything at{' '}
        <code className="nf-path" title={pathname}>
          {pathname}
        </code>
        . The link may be broken, or the page may have moved.
      </p>

      <div className="nf-actions">
        <button type="button" className="nf-btn ghost" onClick={goBack}>
          Go back
        </button>
        <Link className="nf-btn primary" to={signedIn ? '/' : '/login'} replace>
          {signedIn ? 'Go to dashboard' : 'Go to sign in'}
        </Link>
      </div>

      {suggestions.length > 0 && (
        <nav className="nf-suggest" aria-label="Pages you can open">
          <p>Or jump to</p>
          <ul>
            {suggestions.map((item) => (
              <li key={item.to}>
                <Link to={item.to}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </section>
  )
}

/** Catch-all route for any URL that isn't registered in App.jsx. */
export function NotFoundPage() {
  const { user, isAuthenticated, bootstrapping, can } = useAuth()

  useEffect(() => {
    const previous = document.title
    document.title = 'Page not found · LeaveFlow'
    return () => {
      document.title = previous
    }
  }, [])

  if (bootstrapping) {
    if (getAccessToken()) return <ShellSkeleton />
    return (
      <div className="auth-boot">
        <AuthBootSkeleton />
      </div>
    )
  }

  if (isAuthenticated) {
    const suggestions = flattenNav(can, user?.role)
      .filter((item) => item.to !== '/')
      .slice(0, 5)
    return (
      <Layout crumbLabel="Page not found" fill>
        <div className="nf-in-app">
          <NotFoundContent signedIn suggestions={suggestions} />
        </div>
      </Layout>
    )
  }

  // Header and sidebar need a session, so signed-out visitors get a full-screen version.
  return (
    <div className="nf-standalone">
      <header className="nf-standalone-bar">
        <Link to="/login" className="nf-brand">
          <span className="nf-brand-mark" aria-hidden="true" />
          LeaveFlow
        </Link>
        <Link to="/login" className="nf-btn ghost nf-bar-btn">
          Sign in
        </Link>
      </header>
      <div className="nf-in-app">
        <NotFoundContent signedIn={false} />
      </div>
    </div>
  )
}
