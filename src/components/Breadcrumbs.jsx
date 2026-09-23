import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CRUMB_MAP } from '../navigation'
import './Breadcrumbs.css'

export function Breadcrumbs() {
  const { pathname } = useLocation()

    const crumbs = useMemo(() => {
    if (pathname === '/') {
      return [{ to: '/', label: 'Dashboard' }]
    }
    const parts = pathname.split('/').filter(Boolean)
    const items = [{ to: '/', label: 'Home' }]
    let path = ''
    for (const part of parts) {
      path += `/${part}`
      let label = CRUMB_MAP[path] || part.replace(/-/g, ' ')
      if (parts[0] === 'leaves' && parts.length === 2 && part === parts[1]) {
        label = 'Request detail'
      }
      if (parts[0] === 'employees' && parts.length === 2 && part === parts[1] && part !== 'new') {
        label = 'Employee'
      }
      if (parts[0] === 'employees' && parts.length === 3 && part === 'edit') {
        label = 'Edit'
      }
      items.push({ to: path, label })
    }
    return items
  }, [pathname])

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1
          return (
            <li key={crumb.to}>
              {isLast ? (
                <span aria-current="page">{crumb.label}</span>
              ) : (
                <Link to={crumb.to}>{crumb.label}</Link>
              )}
              {!isLast && <span className="crumb-sep" aria-hidden="true">/</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
