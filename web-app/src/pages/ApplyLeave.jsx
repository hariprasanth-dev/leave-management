import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi, leaveApi } from '../api/client'
import './pages.css'

export function ApplyLeave() {
  const navigate = useNavigate()
  const [types, setTypes] = useState([])
  const [balances, setBalances] = useState([])
  const [leaveType, setLeaveType] = useState('earned')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    let cancelled = false
    Promise.all([leaveApi.types(), leaveApi.balances()])
      .then(([typeData, balanceData]) => {
        if (cancelled) return
        setTypes(typeData)
        setBalances(balanceData)
        if (typeData[0]?.code) setLeaveType(typeData[0].code)
      })
      .catch((err) => {
        if (!cancelled) setError(authApi.errorMessage(err, 'Failed to load leave policy'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selectedBalance = useMemo(
    () => balances.find((b) => b.leave_type === leaveType),
    [balances, leaveType],
  )

  function validate() {
    const next = {}
    if (!leaveType) next.leaveType = 'Choose a leave type'
    if (!startDate) next.startDate = 'Start date is required'
    if (!endDate) next.endDate = 'End date is required'
    if (startDate && endDate && endDate < startDate) {
      next.endDate = 'End date must be on or after start date'
    }
    if (!reason.trim() || reason.trim().length < 3) {
      next.reason = 'Reason must be at least 3 characters'
    }
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setError(null)
    try {
      const created = await leaveApi.create({
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
      })
      navigate(`/leaves/${created.id}`)
    } catch (err) {
      setError(authApi.errorMessage(err, 'Failed to submit leave request'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Apply leave</h1>
          <p>Earned Leave (12) and Sick Leave (10). Balance reduces only after approval.</p>
        </div>
      </header>

      {loading && <p className="muted">Loading policy…</p>}
      {error && <p className="banner error">{error}</p>}

      {!loading && (
        <>
          <section className="balance-grid" aria-label="Available balances">
            {balances.map((b) => (
              <article key={b.leave_type} className="balance-card">
                <h2>{b.name}</h2>
                <p className="balance-value">{b.available}</p>
                <p className="muted">
                  {b.remaining} remaining · {b.pending} pending · {b.used} used of {b.total}
                </p>
              </article>
            ))}
          </section>

          <form className="form panel" onSubmit={onSubmit} noValidate>
            <label>
              Leave type
              <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                {types.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name} ({t.days_per_year}/year)
                  </option>
                ))}
              </select>
              {fieldErrors.leaveType && <span className="field-error">{fieldErrors.leaveType}</span>}
              {selectedBalance && (
                <span className="muted">Available to apply: {selectedBalance.available} day(s)</span>
              )}
            </label>

            <div className="form-row">
              <label>
                Start date
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                {fieldErrors.startDate && <span className="field-error">{fieldErrors.startDate}</span>}
              </label>
              <label>
                End date
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                {fieldErrors.endDate && <span className="field-error">{fieldErrors.endDate}</span>}
              </label>
            </div>

            <label>
              Reason
              <textarea
                required
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Brief reason for leave"
              />
              {fieldErrors.reason && <span className="field-error">{fieldErrors.reason}</span>}
            </label>

            <button className="btn primary" type="submit" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit request'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
