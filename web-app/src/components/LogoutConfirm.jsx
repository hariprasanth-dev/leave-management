import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import '../pages/pages.css'

/** Confirmation dialog shown before signing out; performs the logout on confirm. */
export function LogoutConfirm({ onCancel }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const cancelRef = useRef(null)

  useEffect(() => {
    cancelRef.current?.focus()
    function onKey(e) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  async function confirm() {
    setBusy(true)
    await logout()
    navigate('/login', { replace: true })
  }

  return createPortal(
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        aria-describedby="logout-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="logout-title">Log out of LeaveFlow?</h2>
        <p id="logout-desc" className="muted">
          You&apos;ll need to sign in again with your email and password to continue.
        </p>
        <div className="modal-actions">
          <button ref={cancelRef} type="button" className="btn ghost" onClick={onCancel}>
            Stay signed in
          </button>
          <button type="button" className="btn danger" disabled={busy} onClick={() => void confirm()}>
            {busy ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
