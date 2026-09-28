import { useEffect, useMemo, useState } from 'react'
import { authApi, leaveApi } from '../api/client'
import { StatsSkeleton } from './Skeleton'
import './LeaveStats.css'

const TYPE_COLORS = ['#0f766e', '#4f46e5', '#0891b2', '#db2777']

function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/** Chart ceiling divisible by 4, so the quarter gridlines land on whole days. */
function niceMax(value) {
  const step = value <= 20 ? 4 : 20
  return Math.max(Math.ceil(value / step) * step, 4)
}

function Kpis({ stats, selfRecord }) {
  const entitled = stats.by_type.reduce((sum, t) => sum + t.entitled, 0)
  const left = Math.max(entitled - stats.approved_days - stats.pending_days, 0)
  const counts = stats.request_counts
  const requests = Object.values(counts).reduce((a, b) => a + b, 0)
  const tiles = [
    { label: 'Days taken', value: fmt(stats.approved_days), hint: `of ${fmt(entitled)} entitled` },
    selfRecord
      ? { label: 'Approval', value: 'Not needed', hint: 'your leave is recorded straight away' }
      : { label: 'Pending approval', value: fmt(stats.pending_days), hint: 'days awaiting manager', tone: 'pending' },
    { label: 'Days left', value: fmt(left), hint: selfRecord ? 'available to take' : 'available to apply' },
    {
      label: selfRecord ? 'Entries' : 'Requests',
      value: requests,
      hint: selfRecord
        ? `${counts.approved || 0} recorded · ${counts.cancelled || 0} cancelled`
        : `${counts.approved || 0} approved · ${counts.rejected || 0} rejected`,
    },
  ]
  return (
    <div className="stats-kpis">
      {tiles.map((t) => (
        <article key={t.label} className={`stats-kpi ${t.tone || ''}`}>
          <p className="stats-kpi-label">{t.label}</p>
          <p className="stats-kpi-value">{t.value}</p>
          <p className="muted">{t.hint}</p>
        </article>
      ))}
    </div>
  )
}

function Legend() {
  return (
    <div className="chart-legend" aria-hidden="true">
      <span><i className="swatch approved" /> Approved</span>
      <span><i className="swatch pending" /> Pending</span>
    </div>
  )
}

export function MonthlyChart({ months, year, title = 'Monthly stats', subtitle, wide = true }) {
  const max = niceMax(Math.max(...months.map((m) => m.approved + m.pending), 0))
  const ticks = [max, max * 0.75, max * 0.5, max * 0.25, 0]
  const now = new Date()
  const currentMonth = now.getFullYear() === year ? now.getMonth() + 1 : null

  return (
    <article className={`panel chart-card${wide ? ' chart-wide' : ''}`}>
      <header className="chart-head">
        <div>
          <h3>{title}</h3>
          <p className="muted">{subtitle || `Working days on leave per month in ${year}`}</p>
        </div>
        <Legend />
      </header>
      <div className="month-chart" role="img" aria-label={`Leave days per month in ${year}`}>
        <div className="month-axis">
          {ticks.map((t) => (
            <span key={t}>{fmt(t)}</span>
          ))}
        </div>
        <div className="month-plot">
          <div className="month-grid" aria-hidden="true">
            {ticks.map((t) => (
              <span key={t} />
            ))}
          </div>
          {months.map((m) => {
            const total = m.approved + m.pending
            return (
              <div
                key={m.key}
                className={`month-col ${m.key === currentMonth ? 'current' : ''}`}
                title={`${m.label}: ${fmt(m.approved)} approved, ${fmt(m.pending)} pending`}
              >
                <div className="month-bar">
                  {total > 0 && (
                    <span className="month-stack" style={{ height: `${(total / max) * 100}%` }}>
                      <span className="month-value">{fmt(total)}</span>
                      {m.pending > 0 && <span className="seg pending" style={{ flex: m.pending }} />}
                      {m.approved > 0 && <span className="seg approved" style={{ flex: m.approved }} />}
                    </span>
                  )}
                </div>
                <span className="month-label">{m.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </article>
  )
}

const WEEKDAY_NAMES = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' }

function WeeklyPattern({ days }) {
  const max = Math.max(...days.map((d) => d.approved + d.pending), 0)
  const busiest = max > 0 ? days.filter((d) => d.approved + d.pending === max) : []
  const busiestKeys = new Set(busiest.map((d) => d.key))
  const busiestText = busiest.map((d) => `${WEEKDAY_NAMES[d.label] || d.label}s`).join(' and ')

  return (
    <article className="panel chart-card">
      <header className="chart-head">
        <div>
          <h3>Weekly pattern</h3>
          <p className="muted">
            {busiest.length
              ? `You take the most leave on ${busiestText}`
              : 'Which weekdays you take off'}
          </p>
        </div>
      </header>
      <ul className="week-chart">
        {days.map((d) => {
          const total = d.approved + d.pending
          const scale = max || 1
          return (
            <li key={d.key} className={busiestKeys.has(d.key) ? 'busiest' : ''}>
              <span className="week-label">{d.label}</span>
              <span
                className="week-track"
                title={`${d.label}: ${fmt(d.approved)} approved, ${fmt(d.pending)} pending`}
              >
                <span className="seg approved" style={{ width: `${(d.approved / scale) * 100}%` }} />
                <span className="seg pending" style={{ width: `${(d.pending / scale) * 100}%` }} />
              </span>
              <span className="week-value">{fmt(total)}</span>
            </li>
          )
        })}
      </ul>
      <Legend />
    </article>
  )
}

export function TypeDonut({
  types,
  title = 'Consumed leave types',
  subtitle = 'Approved days by leave type',
}) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const consumed = types.reduce((sum, t) => sum + t.approved, 0)
  let offset = 0

  return (
    <article className="panel chart-card">
      <header className="chart-head">
        <div>
          <h3>{title}</h3>
          <p className="muted">{subtitle}</p>
        </div>
      </header>
      <div className="donut-wrap">
        <svg className="donut" viewBox="0 0 140 140" role="img" aria-label={`${fmt(consumed)} days consumed`}>
          <circle className="donut-track" cx="70" cy="70" r={radius} />
          {consumed > 0 &&
            types.map((t, i) => {
              const length = (t.approved / consumed) * circumference
              const segment = (
                <circle
                  key={t.leave_type}
                  cx="70"
                  cy="70"
                  r={radius}
                  stroke={TYPE_COLORS[i % TYPE_COLORS.length]}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                  className="donut-seg"
                />
              )
              offset += length
              return segment
            })}
          <text x="70" y="68" className="donut-total">{fmt(consumed)}</text>
          <text x="70" y="86" className="donut-caption">days used</text>
        </svg>

        <ul className="type-legend">
          {types.map((t, i) => {
            const color = TYPE_COLORS[i % TYPE_COLORS.length]
            const usedPct = t.entitled ? Math.min((t.approved / t.entitled) * 100, 100) : 0
            const pendingPct = t.entitled
              ? Math.min((t.pending / t.entitled) * 100, 100 - usedPct)
              : 0
            return (
              <li key={t.leave_type}>
                <div className="type-legend-head">
                  <span>
                    <i className="swatch" style={{ background: color }} /> {t.name}
                  </span>
                  <strong>
                    {fmt(t.approved)}/{fmt(t.entitled)}
                  </strong>
                </div>
                <span className="type-track">
                  <span style={{ width: `${usedPct}%`, background: color }} />
                  <span className="pending" style={{ width: `${pendingPct}%` }} />
                </span>
                <p className="muted">
                  {fmt(t.remaining)} left{t.pending ? ` · ${fmt(t.pending)} pending` : ''}
                </p>
              </li>
            )
          })}
        </ul>
      </div>
    </article>
  )
}

export function LeaveStats({ refreshKey = 0, selfRecord = false }) {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    leaveApi
      .stats({ year })
      .then((data) => {
        if (!cancelled) {
          setStats(data)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(authApi.errorMessage(err, 'Failed to load leave stats'))
      })
    return () => {
      cancelled = true
    }
  }, [year, refreshKey])

  const hasData = useMemo(
    () => Boolean(stats && stats.approved_days + stats.pending_days > 0),
    [stats],
  )

  return (
    <section className="stats-section" aria-labelledby="stats-title">
      <div className="stats-head">
        <div>
          <h2 id="stats-title">My leave stats</h2>
          <p className="muted">
            {hasData || !stats
              ? 'Approved and pending leave, counted in working days.'
              : `No approved or pending leave in ${year} yet — charts fill in as you apply.`}
          </p>
        </div>
        {stats && (
          <select
            className="stats-year"
            aria-label="Stats year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {stats.available_years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <p className="banner error">{error}</p>}
      {!stats && !error && <StatsSkeleton />}

      {stats && (
        <>
          <Kpis stats={stats} selfRecord={selfRecord} />
          <div className="stats-grid">
            <MonthlyChart months={stats.monthly} year={stats.year} />
            <WeeklyPattern days={stats.weekday} />
            <TypeDonut types={stats.by_type} />
          </div>
        </>
      )}
    </section>
  )
}
