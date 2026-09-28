import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Breadcrumbs } from './Breadcrumbs'
import { Notifications } from './Notifications'
import { ProfileMenu } from './ProfileMenu'
import { RouteSkeleton } from './Skeleton'
import { Sidebar } from './Sidebar'
import './Layout.css'

const MOBILE_QUERY = '(max-width: 900px)'

export function Layout({ children, crumbLabel, fill = false }) {
  const { user, can, bootstrapping } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches)

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY)
    function onChange(event) {
      setIsMobile(event.matches)
      if (!event.matches) setMobileOpen(false)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const compact = isMobile ? !mobileOpen : collapsed

  function toggleSidebar() {
    if (isMobile) setMobileOpen((v) => !v)
    else setCollapsed((v) => !v)
  }

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
        role={user?.role}
        compact={compact}
        mobileOpen={mobileOpen}
        onToggle={toggleSidebar}
        onNavigate={() => setMobileOpen(false)}
      />

      <div className="shell-main">
        <header className="app-header">
          <div className="header-left">
            <Breadcrumbs overrideLabel={crumbLabel} />
          </div>

          <div className="header-right">
            <Notifications />
            <ProfileMenu />
          </div>
        </header>

        <main className={`app-main${fill ? ' app-main-fill' : ''}`}>
          {bootstrapping ? <RouteSkeleton /> : (children ?? <Outlet />)}
        </main>
      </div>
    </div>
  )
}
