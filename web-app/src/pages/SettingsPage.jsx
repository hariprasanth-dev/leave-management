import { useEffect, useState } from 'react'
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
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [compactNav, setCompactNav] = useState(false)
  const [saved, setSaved] = useState(false)

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
          <p>Personal preferences for your LeaveFlow workspace.</p>
        </div>
      </header>

      <form className="panel form settings-form" onSubmit={onSave}>
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
    </div>
  )
}
