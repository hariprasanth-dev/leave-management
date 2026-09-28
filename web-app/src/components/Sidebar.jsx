import { NavLink } from 'react-router-dom'
import { NAV_SECTIONS, isNavItemVisible } from '../navigation'
import { NavIcon } from './NavIcon'
import './Sidebar.css'

export function Sidebar({ can, role, compact, mobileOpen, onToggle, onNavigate }) {
  return (
    <aside
      className={`sidebar ${compact ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
      aria-label="Main navigation"
    >
      <div className="sidebar-brand">
        {!compact && (
          <>
            <span className="brand-mark" aria-hidden="true" />
            <div className="brand-text">
              <p className="brand-name">LeaveFlow</p>
              <p className="brand-tag">Leave management</p>
            </div>
          </>
        )}
        <button
          type="button"
          className="icon-btn sidebar-toggle"
          aria-label={compact ? 'Expand navigation' : 'Collapse navigation'}
          aria-expanded={!compact}
          title={compact ? 'Expand navigation' : 'Collapse navigation'}
          onClick={onToggle}
        >
          <span className="hamburger" aria-hidden="true" />
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter((item) => isNavItemVisible(item, can, role))
          if (!items.length) return null
          return (
            <div key={section.id} className="nav-section">
              {!compact && <p className="nav-section-label">{section.label}</p>}
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
                      <NavIcon name={item.icon} className="sidebar-link-icon" />
                      {!compact && <span>{item.label}</span>}
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
