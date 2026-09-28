import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ChangePasswordForm } from '../components/ChangePasswordForm'
import './pages.css'

const STORAGE_KEY = 'leaveflow.settings'

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

export function SettingsPage() {
  const { user } = useAuth()
  const forced = Boolean(user?.must_change_password)
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [compactNav, setCompactNav] = useState(false)
  const [saved, setSaved] = useState(false)
  const [passwordChanged, setPasswordChanged] = useState(null)

  useEffect(() => {
    const stored = loadSettings()
    if (typeof stored.emailAlerts === 'boolean') setEmailAlerts(stored.emailAlerts)
    if (typeof stored.compactNav === 'boolean') setCompactNav(stored.compactNav)
  }, [])

  function onSave(e) {
    e.preventDefault()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ emailAlerts, compactNav }),
    )
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Manage your password and personal preferences.</p>
        </div>
      </header>

      {forced && (
        <p className="banner warn" role="alert">
          You signed in with a temporary password. Choose a new password to keep using LeaveFlow.
        </p>
      )}

      <section className="panel settings-card" id="password" aria-labelledby="password-title">
        <div className="settings-card-head">
          <span className="settings-card-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" />
              <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" strokeLinecap="round" />
              <circle cx="12" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <div>
            <h2 id="password-title">{forced ? 'Set a new password' : 'Change password'}</h2>
            <p className="muted">
              {forced
                ? 'Your temporary password has been used. Pick a password only you know.'
                : `Signed in as ${user?.email ?? ''}. Forgot your current password? Sign out and use “Forgot password” on the sign-in page.`}
            </p>
          </div>
        </div>

        {passwordChanged && (
          <p className="banner success" role="status">
            {passwordChanged === 'forced'
              ? 'Your new password is set. You can use LeaveFlow as usual now.'
              : 'Password updated. Other devices have been signed out.'}
            {passwordChanged === 'forced' && <Link to="/">Go to dashboard</Link>}
          </p>
        )}

        <ChangePasswordForm forced={forced} onChanged={() => setPasswordChanged(forced ? 'forced' : 'normal')} />
      </section>

      {!forced && (
        <section className="panel settings-card" aria-labelledby="prefs-title">
          <div className="settings-card-head">
            <div>
              <h2 id="prefs-title">Preferences</h2>
              <p className="muted">Saved in this browser only.</p>
            </div>
          </div>

          <form className="form settings-form" onSubmit={onSave}>
            <label className="toggle-row">
              <span>
                <strong>Email alerts</strong>
                <span className="muted">Get notified about leave decisions</span>
              </span>
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
              />
            </label>

            <label className="toggle-row">
              <span>
                <strong>Compact navigation preference</strong>
                <span className="muted">Remember that you prefer a denser sidebar</span>
              </span>
              <input
                type="checkbox"
                checked={compactNav}
                onChange={(e) => setCompactNav(e.target.checked)}
              />
            </label>

            {saved && <p className="banner success">Settings saved locally.</p>}

            <button className="btn primary" type="submit">
              Save settings
            </button>
          </form>
        </section>
      )}
    </div>
  )
}
