import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import './auth.css'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(email, password) {
  const errors = {}
  if (!email.trim()) errors.email = 'Email is required'
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Enter a valid email'
  if (!password) errors.password = 'Password is required'
  return errors
}

function loginErrorMessage(err) {
  const status = err?.response?.status
  if (!err?.response) return 'Unable to reach the server. Check your connection and try again.'
  if (status === 429) return err.response.data?.detail || 'Too many attempts. Please wait and try again.'
  if (status === 401 || status === 422) return 'Invalid email or password.'
  if (status === 405) {
    return 'API routing error (405). On Vercel, set Root Directory to the repository root (.), not web-app, then redeploy. See VERCEL_DEPLOY.md.'
  }
  if (status === 500 || status === 502) {
    return 'The API is not ready. Stop and re-run web-api\\scripts\\start-local.bat (it applies DB migrations), then try again.'
  }
  return 'Sign-in failed. Please try again.'
}

function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
}

function BrandLogo() {
  return (
    <svg className="brand-logo" viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="lf-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5eead4" />
          <stop offset="1" stopColor="#a5b4fc" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="12" fill="rgba(255,255,255,0.12)" />
      <rect x="11" y="13" width="26" height="23" rx="5" fill="none" stroke="url(#lf-logo)" strokeWidth="2.5" />
      <path d="M11 20h26" stroke="url(#lf-logo)" strokeWidth="2.5" />
      <path d="M18 10v6M30 10v6" stroke="url(#lf-logo)" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M17 28.5l4.5 4 9-9"
        fill="none"
        stroke="#fff"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [lockedUntil, setLockedUntil] = useState(null)
  const [now, setNow] = useState(() => Date.now())

  const lockRemaining = lockedUntil ? lockedUntil - now : 0
  const locked = lockRemaining > 0

  useEffect(() => {
    if (!lockedUntil) return undefined
    const timer = setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= lockedUntil) {
        setLockedUntil(null)
        setFormError(null)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [lockedUntil])

  function onPasswordKey(e) {
    setCapsLock(Boolean(e.getModifierState?.('CapsLock')))
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (submitting || locked) return

    const nextErrors = validate(email, password)
    setErrors(nextErrors)
    setFormError(null)
    if (Object.keys(nextErrors).length) return

    setSubmitting(true)
    try {
      await login(email.trim().toLowerCase(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setPassword('')
      setFormError(loginErrorMessage(err))
      if (err?.response?.status === 429) {
        const retryAfter = Number(err.response.headers?.['retry-after']) || 60
        setNow(Date.now())
        setLockedUntil(Date.now() + retryAfter * 1000)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-shell">
      <aside className="login-brand" aria-label="LeaveFlow">
        <div className="login-brand-top">
          <BrandLogo />
          <span className="login-wordmark">LeaveFlow</span>
        </div>

        <div className="login-brand-copy">
          <h1>Time off, handled.</h1>
          <p>
            Apply, approve, and track leave in one place — with balances that stay accurate for
            every employee and manager.
          </p>
          <ul className="login-features">
            <li>
              <span className="feature-dot" aria-hidden="true" />
              Real-time Earned &amp; Sick leave balances
            </li>
            <li>
              <span className="feature-dot" aria-hidden="true" />
              One-click manager approvals
            </li>
            <li>
              <span className="feature-dot" aria-hidden="true" />
              Role-based access for every team
            </li>
          </ul>
        </div>

        <p className="login-brand-foot">© {new Date().getFullYear()} LeaveFlow</p>
      </aside>

      <main className="login-main">
        <div className="login-card">
          <div className="login-mobile-brand">
            <BrandLogo />
            <span>LeaveFlow</span>
          </div>

          <header className="login-head">
            <h2>Welcome back</h2>
            <p>Sign in with your work account</p>
          </header>

          <form className="auth-form" onSubmit={onSubmit} noValidate>
            <label>
              Work email
              <input
                type="email"
                name="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={255}
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(errors.email)}
                disabled={submitting || locked}
              />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </label>

            <label>
              Password
              <span className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  maxLength={128}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={onPasswordKey}
                  onKeyUp={onPasswordKey}
                  aria-invalid={Boolean(errors.password)}
                  disabled={submitting || locked}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </span>
              {capsLock && <span className="field-warn">Caps Lock is on</span>}
              {errors.password && <span className="field-error">{errors.password}</span>}
            </label>
            <div className="forgot-row">
              <Link to="/forgot-password" className="label-link">
                Forgot password?
              </Link>
            </div>

            {formError && (
              <p className="banner error" role="alert">
                {formError}
                {locked && <strong className="lock-timer"> ({formatCountdown(lockRemaining)})</strong>}
              </p>
            )}

            <button className="btn primary login-submit" type="submit" disabled={submitting || locked}>
              {submitting ? 'Verifying…' : locked ? 'Temporarily locked' : 'Sign in'}
            </button>
          </form>

          <p className="login-security">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Protected sign-in. Repeated failed attempts lock the account temporarily.
          </p>
        </div>
      </main>
    </div>
  )
}
