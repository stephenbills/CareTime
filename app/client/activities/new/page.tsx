'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notify } from '@/lib/email/notify'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DURATIONS = [
  { label: '30 min', value: 30 }, { label: '1 hour', value: 60 },
  { label: '1.5 hours', value: 90 }, { label: '2 hours', value: 120 },
  { label: '2.5 hours', value: 150 }, { label: '3 hours', value: 180 },
  { label: '4 hours', value: 240 }, { label: '5 hours', value: 300 },
  { label: '6 hours', value: 360 }, { label: '8 hours', value: 480 },
]

function toLocalInput(date?: Date) {
  const d = date || new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`
}

export default function ClientNewActivityPage() {
  // Core fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [carerId, setCarerId] = useState('')
  const [ndisItemId, setNdisItemId] = useState('')

  // One-off timing
  const [startTime, setStartTime] = useState(toLocalInput())
  const [endTime, setEndTime] = useState(toLocalInput(new Date(Date.now() + 2 * 60 * 60 * 1000)))

  // Recurrence
  const [isRecurring, setIsRecurring] = useState(false)
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([])
  const [recurStart, setRecurStart] = useState(new Date().toISOString().slice(0, 10))
  const [recurEnd, setRecurEnd] = useState('')
  const [recurTime, setRecurTime] = useState('09:00')
  const [durationMins, setDurationMins] = useState(120)

  // Locations
  const [pickupAddress, setPickupAddress] = useState('')
  const [dropoffAddress, setDropoffAddress] = useState('')
  const [venueAddress, setVenueAddress] = useState('')

  // State
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [clientId, setClientId] = useState<string | null>(null)
  const [providerId, setProviderId] = useState<string | null>(null)
  const [providerEmail, setProviderEmail] = useState<string | null>(null)
  const [providerName, setProviderName] = useState<string | null>(null)
  const [workers, setWorkers] = useState<any[]>([])
  const [ndisItems, setNdisItems] = useState<any[]>([])

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: client } = await supabase
        .from('clients').select('*, providers(id, name, email)').eq('user_id', user.id).maybeSingle()
      if (!client) return
      setClientId(client.id)

      const addr = [client.address_line1, client.suburb, client.state, client.postcode]
        .filter(Boolean).join(', ')
      if (addr) { setPickupAddress(addr); setDropoffAddress(addr) }

      const prov = (client as any).providers
      if (prov) {
        setProviderId(prov.id)
        setProviderEmail(prov.email)
        setProviderName(prov.name)

        // Load workers and NDIS items for this provider
        const [{ data: wks }, { data: ndis }] = await Promise.all([
          supabase.from('carers').select('id, name').eq('active', true).order('name'),
          supabase.from('ndis_line_items').select('id, line_item_number, description')
            .eq('provider_id', prov.id).eq('active', true),
        ])
        setWorkers(wks || [])
        setNdisItems(ndis || [])
      }
    }
    load()
  }, [])

  function toggleDay(day: number) {
    setDaysOfWeek(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    )
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!title.trim()) { setError('Activity title is required'); return }
    if (!clientId) { setError('Your profile is not set up. Contact your Provider.'); return }

    if (isRecurring) {
      if (daysOfWeek.length === 0) { setError('Select at least one day for the recurring schedule'); return }
      if (!recurStart) { setError('Start date is required'); return }
    } else {
      if (!startTime) { setError('Start time is required'); return }
      if (!endTime) { setError('End time is required'); return }
      if (new Date(startTime) >= new Date(endTime)) { setError('End time must be after start time'); return }
    }

    setSaving(true)

    if (isRecurring) {
      // Create a recurring schedule
      const { data: created, error: err } = await supabase.from('recurring_schedules').insert({
        title: title.trim(),
        description: description || null,
        provider_id: providerId,
        client_id: clientId,
        carer_id: carerId || null,
        ndis_line_item_id: ndisItemId || null,
        days_of_week: daysOfWeek,
        start_time: recurTime,
        duration_minutes: durationMins,
        valid_from: recurStart,
        valid_until: recurEnd || null,
        pickup_address: pickupAddress || null,
        dropoff_address: dropoffAddress || null,
        venue_address: venueAddress || null,
        active: true,
      }).select().single()

      if (err) { setError(err.message); setSaving(false); return }

      // Auto-generate first 4 weeks of activities
      if (created) {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const until = new Date(today); until.setDate(until.getDate() + 28)
        const validFrom = new Date(recurStart)
        const endDate = recurEnd ? new Date(Math.min(new Date(recurEnd).getTime(), until.getTime())) : until
        const current = new Date(today > validFrom ? today : validFrom)
        const activities: any[] = []

        while (current <= endDate) {
          if (daysOfWeek.includes(current.getDay())) {
            const [sh, sm] = recurTime.split(':').map(Number)
            const start = new Date(current); start.setHours(sh, sm, 0, 0)
            const end = new Date(start); end.setMinutes(end.getMinutes() + durationMins)
            activities.push({
              recurring_schedule_id: created.id,
              provider_id: providerId,
              client_id: clientId,
              carer_id: carerId || null,
              ndis_line_item_id: ndisItemId || null,
              title: title.trim(),
              description: description || null,
              status: 'awaiting_acceptance',
              start_time: start.toISOString(),
              end_time: end.toISOString(),
              pickup_address: pickupAddress || null,
              dropoff_address: dropoffAddress || null,
              venue_address: venueAddress || null,
            })
          }
          current.setDate(current.getDate() + 1)
        }

        if (activities.length > 0) {
          await supabase.from('activities').insert(activities)
        }
      }

      // Notify provider
      if (providerEmail) {
        notify('activity_changed', providerEmail, {
          recipientName: providerName || 'Provider',
          activityTitle: `${title} (recurring schedule)`,
          changedBy: 'a Client',
          activityId: created?.id || '',
          role: 'provider',
        })
      }
    } else {
      // Create a single activity
      const { data: created, error: err } = await supabase.from('activities').insert({
        title: title.trim(),
        description: description || null,
        status: 'awaiting_acceptance',
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        pickup_address: pickupAddress || null,
        dropoff_address: dropoffAddress || null,
        venue_address: venueAddress || null,
        client_id: clientId,
        carer_id: carerId || null,
        ndis_line_item_id: ndisItemId || null,
        provider_id: providerId,
      }).select().single()

      if (err) { setError(err.message); setSaving(false); return }

      if (created) {
        await supabase.from('activity_status_history').insert({
          activity_id: created.id,
          from_status: null,
          to_status: 'awaiting_acceptance',
        })

        if (providerEmail) {
          notify('activity_changed', providerEmail, {
            recipientName: providerName || 'Provider',
            activityTitle: title,
            changedBy: 'a Client',
            activityId: created.id,
            role: 'provider',
          })
        }
      }
    }

    setSaving(false)
    router.push('/client/calendar')
  }

  return (
    <div className="p-4 pb-8">
      <div className="flex items-center gap-3 pt-1 mb-5">
        <Link href="/client/calendar" className="p-1 text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Request Activity</h1>
          <p className="text-gray-400 text-xs mt-0.5">Your Provider will confirm the details</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">

        {/* Activity details */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm">Activity Details</h2>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Community outing, Doctor appointment"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={2} placeholder="Any details your Worker should know…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          {/* Optional worker */}
          {workers.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Preferred Worker <span className="text-gray-300">(optional)</span>
              </label>
              <select value={carerId} onChange={e => setCarerId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">No preference — Provider will assign</option>
                {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          )}

          {/* Optional NDIS line item */}
          {ndisItems.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Support Type <span className="text-gray-300">(optional)</span>
              </label>
              <select value={ndisItemId} onChange={e => setNdisItemId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">— Select support type —</option>
                {ndisItems.map(n => (
                  <option key={n.id} value={n.id}>
                    {n.line_item_number} — {n.description}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* One-off vs recurring toggle */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className="font-semibold text-gray-900 text-sm mb-3">Schedule Type</h2>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setIsRecurring(false)}
              className={`py-3 rounded-xl text-sm font-medium border transition-colors ${
                !isRecurring
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}>
              One-off
            </button>
            <button type="button" onClick={() => setIsRecurring(true)}
              className={`py-3 rounded-xl text-sm font-medium border transition-colors ${
                isRecurring
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}>
              Recurring
            </button>
          </div>
        </div>

        {/* One-off timing */}
        {!isRecurring && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
            <h2 className="font-semibold text-gray-900 text-sm">When</h2>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Start <span className="text-red-500">*</span>
              </label>
              <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                End <span className="text-red-500">*</span>
              </label>
              <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        )}

        {/* Recurring pattern */}
        {isRecurring && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
            <h2 className="font-semibold text-gray-900 text-sm">Recurrence Pattern</h2>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">
                Days <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map((day, i) => (
                  <button key={i} type="button" onClick={() => toggleDay(i)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                      daysOfWeek.includes(i)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200'
                    }`}>
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Start Time <span className="text-red-500">*</span>
                </label>
                <input type="time" value={recurTime} onChange={e => setRecurTime(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Duration</label>
                <select value={String(durationMins)} onChange={e => setDurationMins(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Starting From <span className="text-red-500">*</span>
                </label>
                <input type="date" value={recurStart} onChange={e => setRecurStart(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Until <span className="text-gray-300 text-[10px]">(blank = ongoing)</span>
                </label>
                <input type="date" value={recurEnd} onChange={e => setRecurEnd(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {daysOfWeek.length > 0 && (
              <div className="bg-blue-50 rounded-xl px-3 py-2.5 text-xs text-blue-700">
                Will generate shifts every{' '}
                {daysOfWeek.map(d => DAYS[d]).join(', ')} at{' '}
                {recurTime} for {DURATIONS.find(d => d.value === durationMins)?.label || `${durationMins}min`}
                {recurEnd ? ` until ${recurEnd}` : ' (ongoing)'}
              </div>
            )}
          </div>
        )}

        {/* Locations */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm">Locations</h2>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Pickup Address</label>
            <input type="text" value={pickupAddress} onChange={e => setPickupAddress(e.target.value)}
              placeholder="Where should the Worker pick you up?"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Venue / Activity Location</label>
            <input type="text" value={venueAddress} onChange={e => setVenueAddress(e.target.value)}
              placeholder="Optional — where is the activity?"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Drop-off Address</label>
            <input type="text" value={dropoffAddress} onChange={e => setDropoffAddress(e.target.value)}
              placeholder="Where should the Worker drop you off?"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl px-4 py-3">⚠ {error}</div>
        )}

        <button type="submit" disabled={saving}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl text-sm font-semibold disabled:opacity-50 active:bg-blue-700 transition-colors">
          {saving
            ? 'Sending Request…'
            : isRecurring
              ? 'Create Recurring Schedule'
              : 'Send Activity Request'}
        </button>
      </form>
    </div>
  )
}
