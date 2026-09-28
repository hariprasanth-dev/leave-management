import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { notificationApi } from '../api/client'
import { Skeleton } from './Skeleton'
import './Notifications.css'

const POLL_MS = 30000

const KIND_META = {
  leave_submitted: { tone: 'pending', label: 'New request' },
  leave_approved: { tone: 'approved', label: 'Approved' },
  leave_rejected: { tone: 'rejected', label: 'Rejected' },
  leave_cancelled: { tone: 'cancelled', label: 'Cancelled' },
}

function KindIcon({ tone }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }
  if (tone === 'approved') {
    return (
      <svg {...common}>
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    )
  }
  if (tone === 'rejected') {
    return (
      <svg {...common}>
        <path d="M7 7l10 10M17 7L7 17" />
      </svg>
    )
  }
  if (tone === 'cancelled') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M8.5 15.5l7-7" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 1.8" />
    </svg>
  )
}

function timeAgo(iso) {
  const then = new Date(iso)
  const secs = Math.max(0, (Date.now() - then.getTime()) / 1000)
  if (secs < 60) return 'Just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  if (secs < 172800) return 'Yesterday'
  if (secs < 604800) return `${Math.floor(secs / 86400)}d ago`
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function Notifications() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [status, setStatus] = useState('loading')
  const menuId = useId()
  const rootRef = useRef(null)
  const location = useLocation()

  const refresh = useCallback(async () => {
    try {
      const data = await notificationApi.list()
      setItems(data.items)
      setUnread(data.unread_count)
      setStatus('ready')
    } catch {
      setStatus((prev) => (prev === 'ready' ? prev : 'error'))
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, location.pathname])

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const timer = window.setInterval(tick, POLL_MS)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', tick)
    }
  }, [refresh])

  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

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

  function openItem(item) {
    setOpen(false)
    if (item.is_read) return
    setItems((list) => list.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)))
    setUnread((n) => Math.max(0, n - 1))
    notificationApi.markRead(item.id).catch(() => void refresh())
  }

  async function markAll() {
    setItems((list) => list.map((n) => ({ ...n, is_read: true })))
    setUnread(0)
    try {
      await notificationApi.markAllRead()
    } catch {
      void refresh()
    }
  }

  const badge = unread > 9 ? '9+' : String(unread)

  return (
    <div className="notifications" ref={rootRef}>
      <button
        type="button"
        className="notify-trigger"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
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
        {unread > 0 && (
          <span className="notify-badge" aria-hidden="true">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div className="notify-panel" id={menuId} role="dialog" aria-label="Notifications">
          <div className="notify-head">
            <div>
              <h2>Notifications</h2>
              <p>{unread ? `${unread} unread` : 'You’re all caught up'}</p>
            </div>
            <button type="button" className="notify-mark" onClick={markAll} disabled={!unread}>
              Mark all as read
            </button>
          </div>

          {status === 'loading' ? (
            <ul className="notify-list" aria-busy="true" aria-label="Loading notifications">
              {[0, 1, 2].map((i) => (
                <li key={i} className="notify-skel">
                  <Skeleton width={32} height={32} radius={999} />
                  <div>
                    <Skeleton width="75%" height={12} />
                    <Skeleton width="55%" height={10} />
                  </div>
                </li>
              ))}
            </ul>
          ) : status === 'error' ? (
            <div className="notify-empty">
              <p>Couldn’t load notifications.</p>
              <button type="button" className="notify-mark" onClick={() => void refresh()}>
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="notify-empty">
              <span className="notify-empty-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm6-6V11a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <p>No notifications yet.</p>
              <span>Leave requests and decisions will show up here.</span>
            </div>
          ) : (
            <ul className="notify-list">
              {items.map((item) => {
                const meta = KIND_META[item.kind] ?? { tone: 'pending', label: 'Update' }
                return (
                  <li key={item.id}>
                    <Link
                      to={item.link || '/'}
                      className={item.is_read ? 'notify-item' : 'notify-item unread'}
                      onClick={() => openItem(item)}
                    >
                      <span className={`notify-icon ${meta.tone}`}>
                        <KindIcon tone={meta.tone} />
                      </span>
                      <span className="notify-text">
                        <strong>{item.title}</strong>
                        {item.body && <span className="notify-body">{item.body}</span>}
                        <span className="notify-meta">
                          {meta.label} · <time dateTime={item.created_at}>{timeAgo(item.created_at)}</time>
                        </span>
                      </span>
                      {!item.is_read && <span className="notify-unread-dot" aria-label="Unread" />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
