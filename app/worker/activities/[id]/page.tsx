'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, MapPin, Clock, CheckCircle, XCircle, Play, Square, DollarSign, MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { notify } from '@/lib/email/notify'
import { RRule } from 'rrule'

const STATUS_COLORS: Record<string, string> = {
  awaiting_acceptance: 'bg-yellow-100 text-yellow-800',
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  awaiting_client_approval: 'bg-orange-100 text-orange-800',
  awaiting_payment_approval: 'bg-indigo-100 text-indigo-800',
  ready_for_payment: 'bg-green-100 text-green-800',
  paid: 'bg-gray-100 text-gray-600',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-400',
}

const STATUS_LABELS: Record<string, string> = {
  awaiting_acceptance: 'Awaiting Your Acceptance',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  awaiting_client_approval: 'Awaiting Client Approval',
  awaiting_payment_approval: 'Awaiting Payment Approval',
  ready_for_payment: 'Ready for Payment',
  paid: 'Paid',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

function toLocalInput(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true
  })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export default function CarerActivityPage() {
  const [activity, setActivity] = useState<any>(null)
  const [client, setClient] = useState<any>(null)
  const [provider, setProvider] = useState<any>(null)
  const [recurrenceText, setRecurrenceText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState('')
  const [comments, setComments] = useState('')
  const [mileage, setMileage] = useState('')
  const [expenses, setExpenses] = useState('')
  const [actualStart, setActualStart] = useState('')
  const [actualEnd, setActualEnd] = useState('')
  const [showSubmitForm, setShowSubmitForm] = useState(false)
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const supabase = createClient()

  async function load() {
    const { data: act } = await supabase.from('activities').select('*').eq('id', id).single()
    if (!act) { setLoading(false); return }
    setActivity(act)
    setComments(act.carer_comments || '')
    setMileage(act.mileage != null ? String(act.mileage) : '')
    setExpenses(act.expenses != null ? String(act.expenses) : '')

    const [{ data: cl }, { data: prov }] = await Promise.all([
      act.client_id ? supabase.from('clients').select('id, name, email').eq('id', act.client_id).single() : Promise.resolve({ data: null }),
      act.provider_id ? supabase.from('providers').select('id, name, email').eq('id', act.provider_id).single() : Promise.resolve({ data: null }),
    ])
    setClient(cl)
    setProvider(prov)

    if (act.recurring_schedule_id) {
      const { data: schedule } = await supabase
        .from('recurring_schedules').select('rrule').eq('id', act.recurring_schedule_id).maybeSingle()
      if (schedule?.rrule) {
        try { setRecurrenceText(RRule.fromString(schedule.rrule).toText()) } catch { setRecurrenceText(null) }
      }
    } else {
      setRecurrenceText(null)
    }

    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function updateStatus(newStatus: string, extraFields: Record<string, any> = {}) {
    setActing(true)
    setError('')
    const { error: err } = await supabase.from('activities')
      .update({ status: newStatus, ...extraFields })
      .eq('id', id)
    if (err) { setError(err.message); setActing(false); return }

    // Log status history
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('activity_status_history').insert({
      activity_id: id,
      from_status: activity.status,
      to_status: newStatus,
      changed_by: user!.id,
    })

    await load()
    setActing(false)
  }

  async function handleAccept() {
    await updateStatus('scheduled')
    if (client?.email) {
      notify('activity_accepted', client.email, {
        recipientName: client.name,
        carerName: activity?.carer_name || 'Your worker',
        activityTitle: activity?.title,
        activityId: id,
        role: 'client',
      })
    }
  }

  async function handleDecline() {
    await updateStatus('awaiting_acceptance')
    if (provider?.email) {
      notify('activity_declined', provider.email, {
        recipientName: provider.name,
        carerName: 'Your worker',
        activityTitle: activity?.title,
        activityId: id,
        role: 'provider',
      })
    }
    router.push('/worker/dashboard')
  }

  async function handleStartShift() {
    await updateStatus('in_progress', {
      actual_start_time: new Date().toISOString(),
    })
  }

  async function handleEndShift() {
    // Pre-fill times so Worker can override if submitting late
    setActualStart(toLocalInput(activity.actual_start_time || activity.start_time))
    setActualEnd(toLocalInput(new Date().toISOString()))
    setShowSubmitForm(true)
  }

  async function handleSubmit() {
    if (!comments.trim()) { setError('Please add comments before submitting'); return }
    if (!actualStart) { setError('Please enter the actual start time'); return }
    if (!actualEnd) { setError('Please enter the actual end time'); return }
    if (new Date(actualStart) >= new Date(actualEnd)) { setError('End time must be after start time'); return }

    await updateStatus('awaiting_client_approval', {
      actual_start_time: new Date(actualStart).toISOString(),
      actual_end_time: new Date(actualEnd).toISOString(),
      carer_comments: comments,
      mileage: mileage ? parseFloat(mileage) : null,
      expenses: expenses ? parseFloat(expenses) : null,
    })
    setShowSubmitForm(false)

    // Notify client and provider
    const recipients = [client?.email, provider?.email].filter(Boolean)
    for (const email of recipients) {
      notify('shift_submitted', email, {
        recipientName: email === client?.email ? client?.name : provider?.name,
        carerName: 'Your worker',
        activityTitle: activity?.title,
        startTime: formatDateTime(actualStart),
        endTime: formatDateTime(actualEnd),
        totalCost: 'See activity for details',
        activityId: id,
        role: email === client?.email ? 'client' : 'provider',
      })
    }
  }

  function openMap(address: string) {
    const encoded = encodeURIComponent(address)
    window.open(`https://maps.google.com/?q=${encoded}`, '_blank')
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-gray-400 text-sm">Loading…</div>
    </div>
  )

  if (!activity) return (
    <div className="p-4 text-center text-gray-400 text-sm">Activity not found.</div>
  )

  const status = activity.status

  return (
    <div className="p-4 space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <Link href="/worker/calendar" className="p-1 text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-bold text-gray-900 flex-1 leading-tight">{activity.title}</h1>
      </div>

      {/* Status badge */}
      <div className="flex gap-2">
        <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${STATUS_COLORS[status]}`}>
          {STATUS_LABELS[status]}
        </span>
        {activity.recurring_schedule_id && (
          <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full font-medium">
            Recurring
          </span>
        )}
      </div>

      {/* Accept / Decline buttons */}
      {status === 'awaiting_acceptance' && (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={handleDecline} disabled={acting}
            className="flex items-center justify-center gap-2 bg-red-50 text-red-700 border border-red-200 py-3.5 rounded-2xl text-sm font-semibold active:bg-red-100 transition-colors disabled:opacity-50">
            <XCircle size={18} /> Decline
          </button>
          <button onClick={handleAccept} disabled={acting}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white py-3.5 rounded-2xl text-sm font-semibold active:bg-blue-700 transition-colors disabled:opacity-50">
            <CheckCircle size={18} /> Accept
          </button>
        </div>
      )}

      {/* Start Shift */}
      {status === 'scheduled' && (
        <button onClick={handleStartShift} disabled={acting}
          className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-4 rounded-2xl text-base font-semibold active:bg-green-700 transition-colors shadow-sm disabled:opacity-50">
          <Play size={20} fill="white" /> Start Shift
        </button>
      )}

      {/* End Shift */}
      {status === 'in_progress' && !showSubmitForm && (
        <div className="space-y-3">
          {activity.actual_start_time && (
            <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-sm text-green-800">
              ✓ Shift started at {formatTime(activity.actual_start_time)}
            </div>
          )}
          <button onClick={handleEndShift} disabled={acting}
            className="w-full flex items-center justify-center gap-2 bg-red-600 text-white py-4 rounded-2xl text-base font-semibold active:bg-red-700 transition-colors shadow-sm disabled:opacity-50">
            <Square size={20} fill="white" /> End Shift & Submit
          </button>
        </div>
      )}

      {/* Submit form */}
      {showSubmitForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-900">Submit Shift Details</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Actual Start <span className="text-red-500">*</span>
              </label>
              <input type="datetime-local" value={actualStart}
                onChange={e => setActualStart(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Actual End <span className="text-red-500">*</span>
              </label>
              <input type="datetime-local" value={actualEnd}
                onChange={e => setActualEnd(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Comments <span className="text-red-500">*</span></label>
            <textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              rows={3}
              placeholder="What happened during this shift?"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Mileage (km)</label>
              <input type="number" step="0.1" value={mileage}
                onChange={e => setMileage(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Expenses ($)</label>
              <input type="number" step="0.01" value={expenses}
                onChange={e => setExpenses(e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {error && <p className="text-red-600 text-sm">⚠ {error}</p>}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button onClick={() => setShowSubmitForm(false)}
              className="py-3 rounded-2xl text-sm font-medium text-gray-600 border border-gray-200 active:bg-gray-50">
              Back
            </button>
            <button onClick={handleSubmit} disabled={acting}
              className="py-3 rounded-2xl text-sm font-semibold bg-blue-600 text-white active:bg-blue-700 disabled:opacity-50">
              {acting ? 'Submitting…' : 'Submit Shift'}
            </button>
          </div>
        </div>
      )}

      {/* Post-submission info */}
      {(status === 'awaiting_client_approval' || status === 'awaiting_payment_approval' || status === 'paid') && (
        <div className={`rounded-2xl p-4 text-sm ${
          status === 'paid' ? 'bg-green-50 border border-green-200 text-green-800' :
          'bg-blue-50 border border-blue-200 text-blue-800'
        }`}>
          {status === 'awaiting_client_approval' && '⏳ Shift submitted. Waiting for client approval.'}
          {status === 'awaiting_payment_approval' && '✓ Client approved. Awaiting payment processing.'}
          {status === 'paid' && '✓ Payment has been processed for this shift.'}
        </div>
      )}

      {status === 'rejected' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-800">
          ✗ This shift was rejected.
          {activity.rejection_reason && (
            <p className="mt-1 text-red-700">Reason: {activity.rejection_reason}</p>
          )}
        </div>
      )}

      {/* Activity details card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 text-sm">Activity Details</h2>

        <div className="flex items-start gap-2 text-sm text-gray-600">
          <Clock size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
          <div>
            <p>{formatDateTime(activity.start_time)}</p>
            <p className="text-gray-400 text-xs">to {formatTime(activity.end_time)}</p>
          </div>
        </div>

        {client && (
          <div className="text-sm text-gray-600">
            <span className="text-gray-400 text-xs block mb-0.5">Client</span>
            <span className="font-medium">{client.name}</span>
          </div>
        )}

        {provider && (
          <div className="text-sm text-gray-600">
            <span className="text-gray-400 text-xs block mb-0.5">Provider</span>
            <span className="font-medium">{provider.name}</span>
          </div>
        )}

        {recurrenceText && (
          <div className="text-sm text-gray-600">
            <span className="text-gray-400 text-xs block mb-0.5">Recurrence</span>
            <span className="font-medium">{recurrenceText}</span>
          </div>
        )}

        {activity.description && (
          <div className="text-sm text-gray-600">
            <span className="text-gray-400 text-xs block mb-0.5">Description</span>
            <p>{activity.description}</p>
          </div>
        )}
      </div>

      {/* Locations */}
      {(activity.pickup_address || activity.dropoff_address || activity.venue_address) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <h2 className="font-semibold text-gray-900 text-sm">Locations</h2>

          {activity.pickup_address && (
            <button onClick={() => openMap(activity.pickup_address)}
              className="w-full flex items-start gap-3 text-left p-3 rounded-xl bg-gray-50 active:bg-gray-100 transition-colors">
              <MapPin size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Pickup</p>
                <p className="text-sm text-blue-600 font-medium">{activity.pickup_address}</p>
              </div>
            </button>
          )}

          {activity.venue_address && (
            <button onClick={() => openMap(activity.venue_address)}
              className="w-full flex items-start gap-3 text-left p-3 rounded-xl bg-gray-50 active:bg-gray-100 transition-colors">
              <MapPin size={16} className="text-purple-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Venue</p>
                <p className="text-sm text-blue-600 font-medium">{activity.venue_address}</p>
              </div>
            </button>
          )}

          {activity.dropoff_address && (
            <button onClick={() => openMap(activity.dropoff_address)}
              className="w-full flex items-start gap-3 text-left p-3 rounded-xl bg-gray-50 active:bg-gray-100 transition-colors">
              <MapPin size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Drop-off</p>
                <p className="text-sm text-blue-600 font-medium">{activity.dropoff_address}</p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Shift summary (if completed) */}
      {activity.actual_start_time && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
          <h2 className="font-semibold text-gray-900 text-sm">Shift Summary</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-gray-400">Started</p>
              <p className="font-medium">{formatTime(activity.actual_start_time)}</p>
            </div>
            {activity.actual_end_time && (
              <div>
                <p className="text-xs text-gray-400">Ended</p>
                <p className="font-medium">{formatTime(activity.actual_end_time)}</p>
              </div>
            )}
            {activity.mileage && (
              <div>
                <p className="text-xs text-gray-400">Mileage</p>
                <p className="font-medium">{activity.mileage} km</p>
              </div>
            )}
            {activity.expenses && (
              <div>
                <p className="text-xs text-gray-400">Expenses</p>
                <p className="font-medium">${Number(activity.expenses).toFixed(2)}</p>
              </div>
            )}
          </div>
          {activity.carer_comments && (
            <div className="pt-1">
              <p className="text-xs text-gray-400 mb-0.5">Your Comments</p>
              <p className="text-sm text-gray-600">{activity.carer_comments}</p>
            </div>
          )}
        </div>
      )}

      {error && !showSubmitForm && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl px-4 py-3">⚠ {error}</div>
      )}
    </div>
  )
}
