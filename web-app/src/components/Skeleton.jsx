import { useLocation } from 'react-router-dom'
import '../pages/pages.css'
import '../pages/Dashboard.css'
import '../pages/Profile.css'
import './LeaveStats.css'
import './Skeleton.css'

export function Skeleton({ width = '100%', height = '1rem', radius = '0.45rem', className = '', light = false }) {
  const classes = ['skeleton', light && 'skeleton-light', className].filter(Boolean).join(' ')
  return <span className={classes} style={{ width, height, borderRadius: radius }} aria-hidden="true" />
}

const pick = (list, i) => list[i % list.length]
const range = (n) => Array.from({ length: n }, (_, i) => i)

function Busy({ label, className = '', children }) {
  return (
    <div className={className} aria-busy="true" aria-live="polite" aria-label={label} role="status">
      {children}
    </div>
  )
}

export function PageHeaderSkeleton({ action = true }) {
  return (
    <header className="page-header">
      <div className="sk-stack sk-header-text">
        <Skeleton width="60%" height="2rem" radius="0.55rem" />
        <Skeleton width="90%" height="0.85rem" />
      </div>
      {action && <Skeleton width="8rem" height="2.4rem" radius="0.6rem" />}
    </header>
  )
}

function PanelHeadSkeleton() {
  return (
    <div className="panel-header">
      <Skeleton width="9rem" height="1.05rem" />
      <Skeleton width="4.5rem" height="0.8rem" />
    </div>
  )
}

/** Avatar + two lines + trailing pill: people, requests, activity. */
export function RowsSkeleton({ rows = 4, avatar = true, trailing = true }) {
  const main = ['46%', '38%', '52%', '42%']
  const sub = ['62%', '70%', '55%', '66%']
  return (
    <ul className="sk-rows">
      {range(rows).map((i) => (
        <li key={i}>
          {avatar && <Skeleton width="2.25rem" height="2.25rem" radius="0.7rem" />}
          <div className="sk-stack sk-grow">
            <Skeleton width={pick(main, i)} height="0.85rem" />
            <Skeleton width={pick(sub, i)} height="0.7rem" />
          </div>
          {trailing && <Skeleton width="4.25rem" height="1.4rem" radius="999px" />}
        </li>
      ))}
    </ul>
  )
}

/** Mirrors the `.list` rows used by My leaves and Approvals. */
export function ListSkeleton({ rows = 3, actions = 1 }) {
  const title = ['32%', '40%', '28%', '36%']
  const reason = ['64%', '48%', '72%', '56%']
  return (
    <Busy label="Loading requests">
      <ul className="list panel">
        {range(rows).map((i) => (
          <li key={i}>
            <div className="sk-stack sk-grow">
              <Skeleton width={pick(title, i)} height="1rem" />
              <Skeleton width="44%" height="0.75rem" />
              <Skeleton width={pick(reason, i)} height="0.75rem" />
            </div>
            <div className="list-actions">
              <Skeleton width="4.5rem" height="1.5rem" radius="999px" />
              {range(actions).map((a) => (
                <Skeleton key={a} width="5rem" height="2.2rem" radius="0.55rem" />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </Busy>
  )
}

export function StatsSkeleton() {
  const bars = [30, 55, 20, 70, 45, 85, 35, 60, 25, 50, 40, 65]
  return (
    <Busy label="Loading leave stats" className="sk-stats">
      <div className="stats-kpis">
        {range(4).map((i) => (
          <div key={i} className="stats-kpi sk-stack">
            <Skeleton width="55%" height="0.7rem" />
            <Skeleton width="38%" height="1.9rem" radius="0.5rem" />
            <Skeleton width="70%" height="0.7rem" />
          </div>
        ))}
      </div>
      <div className="stats-grid">
        <article className="panel chart-card chart-wide">
          <div className="sk-stack">
            <Skeleton width="11rem" height="1rem" />
            <Skeleton width="16rem" height="0.75rem" />
          </div>
          <div className="sk-bars">
            {bars.map((h, i) => (
              <div key={i} className="sk-bar">
                <Skeleton height={`${h}%`} radius="0.4rem 0.4rem 0.15rem 0.15rem" />
                <Skeleton width="70%" height="0.6rem" />
              </div>
            ))}
          </div>
        </article>
        <article className="panel chart-card">
          <div className="sk-stack">
            <Skeleton width="9rem" height="1rem" />
            <Skeleton width="13rem" height="0.75rem" />
          </div>
          <div className="sk-stack sk-gap-lg">
            {[62, 40, 75, 30, 50].map((w, i) => (
              <div key={i} className="sk-week">
                <Skeleton width="2.2rem" height="0.7rem" />
                <Skeleton width={`${w}%`} height="0.7rem" radius="999px" />
              </div>
            ))}
          </div>
        </article>
        <article className="panel chart-card">
          <div className="sk-stack">
            <Skeleton width="9rem" height="1rem" />
            <Skeleton width="12rem" height="0.75rem" />
          </div>
          <div className="sk-donut">
            <Skeleton width="8rem" height="8rem" radius="999px" />
            <div className="sk-stack sk-grow sk-gap-lg">
              <Skeleton width="80%" height="0.8rem" />
              <Skeleton width="100%" height="0.5rem" radius="999px" />
              <Skeleton width="65%" height="0.8rem" />
              <Skeleton width="100%" height="0.5rem" radius="999px" />
            </div>
          </div>
        </article>
      </div>
    </Busy>
  )
}

export function DashboardSkeleton({ stats = 4 }) {
  return (
    <Busy label="Loading dashboard" className="page dash">
      <section className="dash-hero">
        <div className="dash-hero-top">
          <div className="dash-identity">
            <Skeleton light width="3.6rem" height="3.6rem" radius="1rem" />
            <div className="sk-stack sk-hero-name">
              <Skeleton light width="35%" height="0.8rem" />
              <Skeleton light width="90%" height="1.9rem" radius="0.5rem" />
              <Skeleton light width="75%" height="0.75rem" />
            </div>
          </div>
          <div className="dash-actions">
            <Skeleton light width="9rem" height="2.4rem" radius="0.6rem" />
            <Skeleton light width="7rem" height="2.4rem" radius="0.6rem" />
          </div>
        </div>
        <div className={`dash-hero-stats${stats === 5 ? ' five' : ''}`}>
          {range(stats).map((i) => (
            <div key={i} className="dash-stat sk-stack">
              <Skeleton light width="65%" height="0.65rem" />
              <Skeleton light width="40%" height="1.6rem" radius="0.45rem" />
              <Skeleton light width="80%" height="0.65rem" />
            </div>
          ))}
        </div>
      </section>

      <div className="dash-grid">
        <article className="panel dash-card dash-wide">
          <PanelHeadSkeleton />
          <RowsSkeleton rows={3} />
        </article>
        <article className="panel dash-card">
          <PanelHeadSkeleton />
          <RowsSkeleton rows={3} trailing={false} />
        </article>
        <article className="panel dash-card">
          <PanelHeadSkeleton />
          <RowsSkeleton rows={3} avatar={false} />
        </article>
      </div>
    </Busy>
  )
}

export function DetailSkeleton({ fields = 6 }) {
  const values = ['55%', '70%', '45%', '80%', '60%', '50%']
  return (
    <Busy label="Loading details" className="page">
      <PageHeaderSkeleton />
      <section className="panel">
        <dl className="detail-grid">
          {range(fields).map((i) => (
            <div key={i} className="sk-stack">
              <dt>
                <Skeleton width="40%" height="0.65rem" />
              </dt>
              <dd>
                <Skeleton width={pick(values, i)} height="1rem" />
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </Busy>
  )
}

export function ProfileSkeleton() {
  return (
    <Busy label="Loading profile" className="page pf">
      <section className="pf-hero">
        <Skeleton light width="5.5rem" height="5.5rem" radius="1.4rem" />
        <div className="pf-hero-body sk-stack">
          <Skeleton light width="55%" height="2rem" radius="0.5rem" />
          <Skeleton light width="30%" height="0.85rem" />
          <div className="sk-inline">
            <Skeleton light width="3.8rem" height="1.4rem" radius="999px" />
            <Skeleton light width="3.8rem" height="1.4rem" radius="999px" />
            <Skeleton light width="9rem" height="1.4rem" radius="999px" />
          </div>
        </div>
        <div className="pf-hero-stats">
          {range(3).map((i) => (
            <div key={i} className="sk-stack sk-center">
              <Skeleton light width="2.6rem" height="1.5rem" radius="0.4rem" />
              <Skeleton light width="5rem" height="0.65rem" />
            </div>
          ))}
        </div>
      </section>
      <div className="pf-grid">
        {range(4).map((card) => (
          <article key={card} className="panel pf-card">
            <Skeleton width="8rem" height="1.05rem" />
            <div className="sk-details">
              {range(4).map((i) => (
                <div key={i}>
                  <Skeleton width="38%" height="0.75rem" />
                  <Skeleton width={pick(['50%', '42%', '58%'], i + card)} height="0.85rem" />
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </Busy>
  )
}

/** `rows`: each entry is a column count, or 'area' for a textarea. */
export function FormSkeleton({ rows = [1, 1, 1, 1], actions = true, label = 'Loading form' }) {
  return (
    <Busy label={label} className="sk-form">
      {rows.map((row, i) => (
        <div key={i} className={`sk-form-row cols-${row === 'area' ? 1 : row}`}>
          {range(row === 'area' ? 1 : row).map((c) => (
            <div key={c} className="sk-stack">
              <Skeleton width={pick(['30%', '42%', '36%'], i + c)} height="0.75rem" />
              <Skeleton height={row === 'area' ? '5.5rem' : '2.6rem'} radius="0.55rem" />
            </div>
          ))}
        </div>
      ))}
      {actions && (
        <div className="sk-form-actions">
          <Skeleton width="5.5rem" height="2.4rem" radius="0.6rem" />
          <Skeleton width="8rem" height="2.4rem" radius="0.6rem" />
        </div>
      )}
    </Busy>
  )
}

function TablePageSkeleton() {
  return (
    <Busy label="Loading table" className="page">
      <PageHeaderSkeleton />
      <section className="panel sk-table">
        <div className="sk-inline">
          <Skeleton width="16rem" height="2.3rem" radius="0.55rem" />
          <Skeleton width="8rem" height="2.3rem" radius="0.55rem" />
          <Skeleton width="8rem" height="2.3rem" radius="0.55rem" />
        </div>
        <RowsSkeleton rows={6} />
      </section>
    </Busy>
  )
}

function ListPageSkeleton({ tabs = false }) {
  return (
    <Busy label="Loading page" className="page">
      <PageHeaderSkeleton action={!tabs} />
      {tabs && (
        <div className="sk-inline">
          <Skeleton width="5.5rem" height="2.2rem" radius="0.6rem" />
          <Skeleton width="6.5rem" height="2.2rem" radius="0.6rem" />
        </div>
      )}
      <ListSkeleton rows={3} actions={tabs ? 2 : 1} />
    </Busy>
  )
}

export function PageSkeleton() {
  return (
    <Busy label="Loading content" className="page">
      <PageHeaderSkeleton />
      <div className="sk-cards">
        {range(3).map((i) => (
          <div key={i} className="panel sk-stack">
            <Skeleton width="45%" height="0.7rem" />
            <Skeleton width="30%" height="1.7rem" radius="0.45rem" />
            <Skeleton width="65%" height="0.7rem" />
          </div>
        ))}
      </div>
      <section className="panel">
        <PanelHeadSkeleton />
        <RowsSkeleton rows={3} />
      </section>
    </Busy>
  )
}

/** Picks the skeleton that looks like the page being opened (used while auth bootstraps). */
export function RouteSkeleton() {
  const { pathname } = useLocation()
  if (pathname === '/') return <DashboardSkeleton />
  if (pathname.startsWith('/profile')) return <ProfileSkeleton />
  if (/^\/(leaves|employees)\/[^/]+/.test(pathname)) return <DetailSkeleton />
  if (pathname.startsWith('/employees')) return <TablePageSkeleton />
  if (pathname.startsWith('/approvals')) return <ListPageSkeleton tabs />
  if (pathname.startsWith('/leaves')) return <ListPageSkeleton />
  return <PageSkeleton />
}

/** Sidebar + header + page, shown before the signed-in layout can render. */
export function ShellSkeleton() {
  return (
    <div className="sk-shell">
      <aside className="sk-shell-side" aria-hidden="true">
        <div className="sk-shell-brand">
          <Skeleton width="2.25rem" height="2.25rem" radius="0.7rem" />
          <Skeleton width="6rem" height="1rem" />
        </div>
        {range(5).map((i) => (
          <div key={i} className="sk-shell-nav">
            <Skeleton width="1.25rem" height="1.25rem" radius="0.4rem" />
            <Skeleton width={pick(['60%', '45%', '70%', '52%'], i)} height="0.8rem" />
          </div>
        ))}
      </aside>
      <div className="sk-shell-main">
        <div className="sk-shell-head" aria-hidden="true">
          <Skeleton width="10rem" height="0.9rem" />
          <div className="sk-inline">
            <Skeleton width="2.4rem" height="2.4rem" radius="0.65rem" />
            <Skeleton width="2.4rem" height="2.4rem" radius="999px" />
          </div>
        </div>
        <div className="app-main">
          <RouteSkeleton />
        </div>
      </div>
    </div>
  )
}

export function AuthBootSkeleton() {
  return (
    <div className="sk-auth panel">
      <Skeleton width="3rem" height="3rem" radius="0.9rem" />
      <Skeleton width="60%" height="1.4rem" radius="0.45rem" />
      <FormSkeleton rows={[1, 1]} actions={false} label="Loading sign in" />
      <Skeleton height="2.6rem" radius="0.6rem" />
    </div>
  )
}
