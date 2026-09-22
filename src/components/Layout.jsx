import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Breadcrumbs } from './Breadcrumbs'
import { Notifications } from './Notifications'
import { ProfileMenu } from './ProfileMenu'
import { PageSkeleton } from './Skeleton'
import { Sidebar } from './Sidebar'
import './Layout.css'

export function Layout() {
  const { can, bootstrapping } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    function onResize() {
      if (window.innerWidth > 900) setMobileOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div className={`app-shell ${mobileOpen ? 'drawer-open' : ''}`}>
      {mobileOpen && (
        <button
          type="button"
          className="shell-backdrop"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        can={can}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onNavigate={() => setMobileOpen(false)}
      />

      <div className="shell-main">
        <header className="app-header">
          <div className="header-left">
            <button
              type="button"
              className="icon-btn mobile-only"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <span className="hamburger" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-btn desktop-only"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setCollapsed((v) => !v)}
            >
              <span className="collapse-icon" aria-hidden="true" />
            </button>
            <p className="header-title">Workspace</p>
          </div>

          <div className="header-right">
            <Notifications />
            <ProfileMenu />
          </div>
        </header>

        <main className="app-main">
          <Breadcrumbs />
          {bootstrapping ? <PageSkeleton /> : <Outlet />}
        </main>
      </div>
    </div>
  )
}
