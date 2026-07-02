'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Clock, MapPin, Star } from 'lucide-react'
import Link from 'next/link'
import { notify } from '@/lib/email/notify'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true
  })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function duration(start: string, end: string) {
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`
}

export default function ClientActivityPage() {
  const [activity, setActivity] = useState<any>(null)
  const [worker, setWorker] = useState<any>(null)
  const [provider, setProvider] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState('')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comments, setComments] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const supabase = createClient()

  async function load() {
    const { data: act } = await supabase.from('activities').select('*').eq('id', id).single()
    if (!act) { setLoading(false); return }
    setActivity(act)
    setRating(act.client_rating || 0)
    setComments(act.client_comments || '')
    setRejectionReason(act.rejection_reason || '')

    const [{ data: wk }, { data: prov }] = await Promise.all([
      act.carer_id ? supabase.from('carers').select('id, name, email').eq('id', act.carer_id).single() : Promise.resolve({ data: null }),
      act.provider_id ? supabase.from('providers').select('id, name, email').eq('id', act.provider_id).single() : Promise.resolve({ data: null }),
    ])
    setWorker(wk)
    setProvider(prov)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function handleApprove() {
    if (rating === 0) { setError('Please give a rating before approving'); return }
    setActing(true)
    setError('')

    const { error: err } = await supabase.from('activities').update({
      status: 'awaiting_payment_approval',
      client_rating: rating,
      client_comments: comments || null,
    }).eq('id', id)

    if (err) { setError(err.message); setActing(false); return }

    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('activity_status_history').insert({
      activity_id: id,
      from_status: 'awaiting_client_approval',
      to_status: 'awaiting_payment_approval',
      changed_by: user!.id,
    })

    // Notify worker and provider
    if (worker?.email) {
      notify('shift_approved', worker.email, {
        recipientName: worker.name,
        clientName: activity.client_name || 'The client',
        activityTitle: activity.title,
        activityId: id,
      })
    }
    if (provider?.email) {
      notify('shift_approved', provider.email, {
        recipientName: provider.name,
        clientName: activity.client_name || 'The client',
        activityTitle: activity.title,
        activityId: id,
      })
    }

    await load()
    setActing(false)
  }

  async function handleReject() {
    if (!rejectionReason.trim()) { setError('Please provide a reason for rejection'); return }
    setActing(true)
    setError('')

    const { error: err } = await supabase.from('activities').update({
      status: 'rejected',
      rejection_reason: rejectionReason,
      client_comments: comments || null,
    }).eq('id', id)

    if (err) { setError(err.message); setActing(false); return }

    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('activity_status_history').insert({
      activity_id: id,
      from_status: 'awaiting_client_approval',
      to_status: 'rejected',
      changed_by: user!.id,
    })

    // Notify worker and provider
    const recipients = [
      worker?.email ? { email: worker.email, name: worker.name } : null,
      provider?.email ? { email: provider.email, name: provider.name } : null,
    ].filter(Boolean) as { email: string; name: string }[]

    for (const r of recipients) {
      notify('shift_rejected', r.email, {
        recipientName: r.name,
        clientName: 'The client',
        activityTitle: activity.title,
        rejectionReason,
        activityId: id,
      })
    }

    setShowRejectForm(false)
    await load()
    setActing(false)
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
  const canApprove = status === 'awaiting_client_approval'

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="flex items-center gap-3 pt-1">
        <Link href="/client/dashboard" className="p-1 text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-bold text-gray-900 flex-1 leading-tight">{activity.title}</h1>
      </div>

      {/* Approval action */}
      {canApprove && !showRejectForm && (
        <div className="bg-white rounded-2xl border border-orange-200 shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-900">Review This Shift</h2>

          {/* Star rating */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">
              Rate your Worker <span className="text-red-500">*</span>
            </p>
            <div className="flex gap-2">
              {[1,2,3,4,5].map(i => (
                <button key={i} type="button"
                  onClick={() => setRating(i)}
                  onMouseEnter={() => setHoverRating(i)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform active:scale-110">
                  <Star size={36}
                    className={`transition-colors ${
                      i <= (hoverRating || rating)
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-gray-200 fill-gray-200'
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
              </p>
            )}
          </div>

          {/* Optional comments */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Comments (optional)
            </label>
            <textarea value={comments} onChange={e => setComments(e.target.value)}
              rows={2} placeholder="Any feedback about this shift?"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          {error && <p className="text-red-600 text-sm">⚠ {error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { setShowRejectForm(true); setError('') }}
              className="py-3 rounded-2xl text-sm font-semibold border border-red-200 text-red-600 active:bg-red-50">
              Reject
            </button>
            <button onClick={handleApprove} disabled={acting}
              className="py-3 rounded-2xl text-sm font-semibold bg-blue-600 text-white active:bg-blue-700 disabled:opacity-50">
              {acting ? 'Approving…' : 'Approve ✓'}
            </button>
          </div>
        </div>
      )}

      {/* Reject form */}
      {showRejectForm && (
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-900">Reject This Shift</h2>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Reason for rejection <span className="text-red-500">*</span>
            </label>
            <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
              rows={3} placeholder="Please explain why you are rejecting this shift…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
          </div>
          {error && <p className="text-red-600 text-sm">⚠ {error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { setShowRejectForm(false); setError('') }}
              className="py-3 rounded-2xl text-sm font-medium border border-gray-200 text-gray-600">
              Back
            </button>
            <button onClick={handleReject} disabled={acting}
              className="py-3 rounded-2xl text-sm font-semibold bg-red-600 text-white active:bg-red-700 disabled:opacity-50">
              {acting ? 'Rejecting…' : 'Confirm Reject'}
            </button>
          </div>
        </div>
      )}

      {/* Status messages */}
      {status === 'awaiting_payment_approval' && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-green-800">
          ✓ You approved this shift. Thank you for your feedback!
          {activity.client_rating > 0 && (
            <div className="flex items-center gap-1 mt-2">
              {[1,2,3,4,5].map(i => (
                <Star key={i} size={14} className={i <= activity.client_rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'} />
              ))}
            </div>
          )}
        </div>
      )}
      {status === 'paid' && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm text-gray-600">
          ✓ This shift has been paid.
        </div>
      )}
      {status === 'rejected' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-800">
          ✗ You rejected this shift.
          {activity.rejection_reason && (
            <p className="mt-1 text-red-600">Reason: {activity.rejection_reason}</p>
          )}
        </div>
      )}

      {/* Shift details */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 text-sm">Shift Details</h2>

        <div className="flex items-start gap-2 text-sm text-gray-600">
          <Clock size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">
              {activity.actual_start_time
                ? formatDateTime(activity.actual_start_time)
                : formatDateTime(activity.start_time)}
            </p>
            <p className="text-gray-400 text-xs">
              to {activity.actual_end_time
                ? formatTime(activity.actual_end_time)
                : formatTime(activity.end_time)}
              {activity.actual_start_time && activity.actual_end_time && (
                <span className="ml-1">· {duration(activity.actual_start_time, activity.actual_end_time)}</span>
              )}
            </p>
          </div>
        </div>

        {worker && (
          <div className="text-sm text-gray-600">
            <span className="text-gray-400 text-xs block mb-0.5">Support Worker</span>
            <span className="font-medium">{worker.name}</span>
          </div>
        )}

        {activity.description && (
          <div className="text-sm text-gray-600">
            <span className="text-gray-400 text-xs block mb-0.5">Description</span>
            <p>{activity.description}</p>
          </div>
        )}

        {activity.carer_comments && (
          <div className="text-sm text-gray-600">
            <span className="text-gray-400 text-xs block mb-0.5">Worker's Comments</span>
            <p className="italic">{activity.carer_comments}</p>
          </div>
        )}

        {(activity.mileage || activity.expenses) && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-50">
            {activity.mileage && (
              <div>
                <p className="text-xs text-gray-400">Mileage</p>
                <p className="text-sm font-medium">{activity.mileage} km</p>
              </div>
            )}
            {activity.expenses && (
              <div>
                <p className="text-xs text-gray-400">Expenses</p>
                <p className="text-sm font-medium">${Number(activity.expenses).toFixed(2)}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Locations */}
      {(activity.pickup_address || activity.dropoff_address) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
          <h2 className="font-semibold text-gray-900 text-sm">Locations</h2>
          {activity.pickup_address && (
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <MapPin size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Pickup</p>
                <p>{activity.pickup_address}</p>
              </div>
            </div>
          )}
          {activity.dropoff_address && (
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <MapPin size={14} className="text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Drop-off</p>
                <p>{activity.dropoff_address}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
