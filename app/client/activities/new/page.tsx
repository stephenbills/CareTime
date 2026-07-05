'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notify } from '@/lib/email/notify'
import RecurrencePicker from '@/components/RecurrencePicker'
import { RRule } from 'rrule'

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
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [carerId, setCarerId] = useState('')
  const [ndisItemId, setNdisItemId] = useState('')

  // One-off timing
  const [startTime, setStartTime] = useState(toLocalInput())
  const [endTime, setEndTime] = useState(toLocalInput(new Date(Date.now() + 2 * 60 * 60 * 1000)))

  // Recurrence
  const [rruleStr, setRruleStr] = useState<string | null>(null)
  const [rruleDesc, setRruleDesc] = useState('Does not repeat')
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

  const isRecurring = rruleStr !== null

  function generateOccurrences(rruleString: string, startTimeStr: string, durationMin: number) {
    const rule = RRule.fromString(rruleString)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const until = new Date(now)
    until.setDate(until.getDate() + 28)

    // Get occurrences for the next 4 weeks
    const occurrences = rule.between(now, until, true)
    const [sh, sm] = startTimeStr.split(':').map(Number)

    return occurrences.map(occ => {
      const start = new Date(occ)
      start.setHours(sh, sm, 0, 0)
      const end = new Date(start)
      end.setMinutes(end.getMinutes() + durationMin)
      return { start, end }
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!title.trim()) { setError('Activity title is required'); return }
    if (!clientId) { setError('Your profile is not set up. Contact your Provider.'); return }

    if (!isRecurring) {
      if (!startTime) { setError('Start time is required'); return }
      if (!endTime) { setError('End time is required'); return }
      if (new Date(startTime) >= new Date(endTime)) { setError('End time must be after start time'); return }
    }

    setSaving(true)

    if (isRecurring) {
      // Extract days_of_week from rrule for backwards compat
      let daysOfWeek: number[] = []
      try {
        const rule = RRule.fromString(rruleStr!)
        const byDay = rule.origOptions.byweekday
        if (byDay) {
          daysOfWeek = (byDay as any[]).map((d: any) => {
            const wd = typeof d === 'number' ? d : (d.weekday ?? d)
            // rrule uses 0=Mon, we need 0=Sun
            return (wd + 1) % 7
          })
        }
      } catch {}

      const { data: created, error: err } = await supabase.from('recurring_schedules').insert({
        title: title.trim(),
        description: description || null,
        provider_id: providerId,
        client_id: clientId,
        carer_id: carerId || null,
        ndis_line_item_id: ndisItemId || null,
        rrule: rruleStr,
        days_of_week: daysOfWeek.length > 0 ? daysOfWeek : null,
        start_time: recurTime,
        duration_minutes: durationMins,
        valid_from: new Date().toISOString().slice(0, 10),
        pickup_address: pickupAddress || null,
        dropoff_address: dropoffAddress || null,
        venue_address: venueAddress || null,
        active: true,
      }).select().single()

      if (err) { setError(err.message); setSaving(false); return }

      // Generate first 4 weeks of activities
      if (created) {
        const occurrences = generateOccurrences(rruleStr!, recurTime, durationMins)
        if (occurrences.length > 0) {
          const activities = occurrences.map(({ start, end }) => ({
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
          }))
          await supabase.from('activities').insert(activities)
        }
      }

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
      // One-off activity
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

      if (created && providerEmail) {
        notify('activity_changed', providerEmail, {
          recipientName: providerName || 'Provider',
          activityTitle: title,
          changedBy: 'a Client',
          activityId: created.id,
          role: 'provider',
        })
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
          {ndisItems.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Support Type <span className="text-gray-300">(optional)</span>
              </label>
              <select value={ndisItemId} onChange={e => setNdisItemId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">— Select support type —</option>
                {ndisItems.map(n => <option key={n.id} value={n.id}>{n.line_item_number} — {n.description}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Recurrence */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm">Recurrence</h2>
          <RecurrencePicker
            startDate={startTime ? new Date(startTime) : new Date()}
            onChange={(str, desc) => { setRruleStr(str); setRruleDesc(desc) }}
          />
          {isRecurring && (
            <div className="bg-blue-50 rounded-xl px-3 py-2 text-xs text-blue-700">
              {rruleDesc}
            </div>
          )}
        </div>

        {/* Timing */}
        {!isRecurring ? (
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
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
            <h2 className="font-semibold text-gray-900 text-sm">Shift Time</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Start Time</label>
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
          </div>
        )}

        {/* Locations */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm">Locations</h2>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Pickup Address</label>
            <input type="text" value={pickupAddress} onChange={e => setPickupAddress(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Venue / Activity Location</label>
            <input type="text" value={venueAddress} onChange={e => setVenueAddress(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Drop-off Address</label>
            <input type="text" value={dropoffAddress} onChange={e => setDropoffAddress(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl px-4 py-3">⚠ {error}</div>
        )}

        <button type="submit" disabled={saving}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl text-sm font-semibold disabled:opacity-50 active:bg-blue-700 transition-colors">
          {saving ? 'Sending Request…' : isRecurring ? 'Create Recurring Schedule' : 'Send Activity Request'}
        </button>
      </form>
    </div>
  )
}
