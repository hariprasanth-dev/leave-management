import { useAuth } from '../auth/AuthContext'
import './pages.css'

export function ProfilePage() {
  const { user } = useAuth()

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Profile</h1>
          <p>Your account identity and role in LeaveFlow.</p>
        </div>
      </header>

      <section className="panel profile-card">
        <div className="profile-card-head">
          <span className="profile-avatar-lg" aria-hidden="true">
            {(user?.full_name || '?')
              .split(' ')
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase())
              .join('')}
          </span>
          <div>
            <h2>{user?.full_name}</h2>
            <p className="muted">{user?.email}</p>
          </div>
        </div>

        <dl className="detail-grid">
          <div>
            <dt>Role</dt>
            <dd className="capitalize">{user?.role}</dd>
          </div>
          <div>
            <dt>Roles</dt>
            <dd>{(user?.roles || []).join(', ') || user?.role}</dd>
          </div>
          <div>
            <dt>Employee ID</dt>
            <dd className="mono">{user?.employee_id || '—'}</dd>
          </div>
          <div>
            <dt>Permissions</dt>
            <dd>
              <ul className="perm-list">
                {(user?.permissions || []).map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
