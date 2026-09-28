import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { approvalApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { PERMISSIONS } from '../auth/permissions'
import './Notifications.css'

export function Notifications() {
  const { can, user } = useAuth()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const menuId = useId()
  const rootRef = useRef(null)

  useEffect(() => {
    function onDocClick(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false

    async function load() {
      setLoading(true)
      const next = [
        {
          id: 'welcome',
          title: 'Welcome to LeaveFlow',
          body: 'Your workspace shell is ready.',
          to: '/',
        },
      ]

      if (can(PERMISSIONS.LEAVE_APPROVE)) {
        try {
          const pending = await approvalApi.pending()
          if (pending.length) {
            next.unshift({
              id: 'pending',
              title: `${pending.length} leave request${pending.length === 1 ? '' : 's'} awaiting approval`,
              body: 'Open the approvals queue to review.',
              to: '/approvals',
            })
          }
        } catch {
          // ignore notification fetch errors
        }
      }

      if (!cancelled) {
        setItems(next)
        setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [open, user?.permissions, can])

  const unread = items.length

  return (
    <div className="notifications" ref={rootRef}>
      <button
        type="button"
        className="notify-trigger"
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm6-6V11a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
        {unread > 0 && <span className="notify-dot" aria-hidden="true" />}
      </button>

      {open && (
        <div className="notify-panel" id={menuId} role="dialog" aria-label="Notifications">
          <div className="notify-head">
            <h2>Notifications</h2>
          </div>
          {loading ? (
            <p className="notify-empty">Loading…</p>
          ) : items.length === 0 ? (
            <p className="notify-empty">You’re all caught up.</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <Link to={item.to} onClick={() => setOpen(false)}>
                    <strong>{item.title}</strong>
                    <span>{item.body}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
