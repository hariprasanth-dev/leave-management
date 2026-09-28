import { NavLink } from 'react-router-dom'
import { NAV_SECTIONS } from '../navigation'
import './Sidebar.css'

export function Sidebar({ can, collapsed, mobileOpen, onNavigate }) {
  return (
    <aside
      className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
      aria-label="Main navigation"
    >
      <div className="sidebar-brand">
        <span className="brand-mark" aria-hidden="true" />
        {!collapsed && (
          <div>
            <p className="brand-name">LeaveFlow</p>
            <p className="brand-tag">Leave management</p>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter(
            (item) => !item.permission || can(item.permission),
          )
          if (!items.length) return null
          return (
            <div key={section.id} className="nav-section">
              {!collapsed && <p className="nav-section-label">{section.label}</p>}
              <ul>
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      title={item.label}
                      className={({ isActive }) =>
                        isActive ? 'sidebar-link active' : 'sidebar-link'
                      }
                      onClick={onNavigate}
                    >
                      <span className="sidebar-link-dot" aria-hidden="true" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
