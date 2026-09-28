import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import './ProfileMenu.css'

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export function ProfileMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef(null)

  useEffect(() => {
    function onDocClick(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  async function onLogout() {
    setOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="profile-menu" ref={rootRef}>
      <button
        type="button"
        className="profile-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="avatar" aria-hidden="true">
          {initials(user?.full_name)}
        </span>
        <span className="profile-trigger-text">
          <span className="profile-name">{user?.full_name}</span>
          <span className="profile-role">{user?.role}</span>
        </span>
      </button>

      {open && (
        <div className="profile-dropdown" id={menuId} role="menu">
          <div className="profile-dropdown-head">
            <p className="profile-name">{user?.full_name}</p>
            <p className="profile-email">{user?.email}</p>
          </div>
          <Link role="menuitem" to="/profile" onClick={() => setOpen(false)}>
            Profile
          </Link>
          <Link role="menuitem" to="/settings" onClick={() => setOpen(false)}>
            Settings
          </Link>
          <button type="button" role="menuitem" className="danger" onClick={() => void onLogout()}>
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
