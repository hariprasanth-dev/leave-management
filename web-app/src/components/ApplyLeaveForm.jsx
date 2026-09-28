import { useEffect, useMemo, useState } from 'react'
import { authApi, leaveApi } from '../api/client'
import { FormSkeleton } from './Skeleton'

export function ApplyLeaveForm({
  onSubmitted,
  onCancel,
  showBalances = true,
  formClassName = 'form',
  submitLabel = 'Submit request',
}) {
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

  const [selection, setSelection] = useState(null)

  useEffect(() => {
    if (!startDate || !endDate || endDate < startDate) {
      setSelection(null)
      return undefined
    }
    let cancelled = false
    leaveApi
      .workingDays(startDate, endDate)
      .then((data) => {
        if (!cancelled) setSelection(data)
      })
      .catch(() => {
        if (!cancelled) setSelection(null)
      })
    return () => {
      cancelled = true
    }
  }, [startDate, endDate])

  const selectedBalance = useMemo(
    () => balances.find((b) => b.leave_type === leaveType),
    [balances, leaveType],
  )
  const overBalance = Boolean(selection && selectedBalance && selection.days > selectedBalance.available)

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
      onSubmitted?.(created)
    } catch (err) {
      setError(authApi.errorMessage(err, 'Failed to submit leave request'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <FormSkeleton rows={[1, 2, 'area']} label="Loading leave form" />

  return (
    <>
      {error && <p className="banner error">{error}</p>}

      {showBalances && (
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
      )}

      <form className={formClassName} onSubmit={onSubmit} noValidate>
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
              min={startDate || undefined}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            {fieldErrors.endDate && <span className="field-error">{fieldErrors.endDate}</span>}
          </label>
        </div>

        {selection && (
          <div
            className={`days-summary ${selection.days === 0 || overBalance ? 'warn' : ''}`}
            role="status"
            aria-live="polite"
          >
            <span className="days-summary-count">
              {selection.days === 0
                ? 'No working days selected'
                : `${selection.days} ${selection.days === 1 ? 'day' : 'days'} selected`}
            </span>
            <span className="days-summary-note">
              {selection.days === 0
                ? 'Weekends are not counted. Pick at least one weekday.'
                : overBalance
                  ? `More than your ${selectedBalance.available} available day(s) of ${selectedBalance.name}.`
                  : selection.calendar_days > selection.days
                    ? `${selection.calendar_days - selection.days} weekend day(s) in this range aren't counted.`
                    : 'Weekdays only (Mon–Fri).'}
            </span>
          </div>
        )}

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

        <div className="modal-actions">
          {onCancel && (
            <button type="button" className="btn ghost" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button className="btn primary" type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </>
  )
}
