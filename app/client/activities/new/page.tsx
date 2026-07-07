'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notify } from '@/lib/email/notify'
import RecurrencePicker from '@/components/RecurrencePicker'
import { RRule } from 'rrule'
import { Suspense } from 'react'

const DURATIONS = [
  { label: '30 min', value: 30 }, { label: '1 hour', value: 60 },
  { label: '1.5 hours', value: 90 }, { label: '2 hours', value: 120 },
  { label: '2.5 hours', value: 150 }, { label: '3 hours', value: 180 },
  { label: '3.5 hours', value: 210 }, { label: '4 hours', value: 240 },
  { label: '4.5 hours', value: 270 }, { label: '5 hours', value: 300 },
  { label: '5.5 hours', value: 330 }, { label: '6 hours', value: 360 },
  { label: '6.5 hours', value: 390 }, { label: '7 hours', value: 420 },
  { label: '7.5 hours', value: 450 }, { label: '8 hours', value: 480 },
  { label: '10 hours', value: 600 }, { label: '12 hours', value: 720 },
]

// Generate time options in 15-min increments
function timeOptions() {
  const opts = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const val = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
      const ampm = h < 12 ? 'AM' : 'PM'
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
      const label = `${hour12}:${String(m).padStart(2,'0')} ${ampm}`
      opts.push({ value: val, label })
    }
  }
  return opts
}
const TIME_OPTS = timeOptions()

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function ClientNewActivityInner() {
  const searchParams = useSearchParams()
  const dateParam = searchParams?.get('date')
  const defaultDate = dateParam || todayStr()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [carerId, setCarerId] = useState('')
  const [ndisItemId, setNdisItemId] = useState('')

  // One-off timing — separate date and time fields
  const [startDate, setStartDate] = useState(defaultDate)
  const [startTimeVal, setStartTimeVal] = useState('09:00')
  const [endDate, setEndDate] = useState(defaultDate)
  const [endTimeVal, setEndTimeVal] = useState('11:00')

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
        .from('clients').select('*').eq('user_id', user.id).maybeSingle()
      if (!client) return
      setClientId(client.id)

      const addr = [client.address_line1, client.suburb, client.state, client.postcode]
        .filter(Boolean).join(', ')
      if (addr) { setPickupAddress(addr); setDropoffAddress(addr) }

      // Load provider details
      if (client.provider_id) {
        const { data: prov } = await supabase
          .from('providers').select('id, name, email').eq('id', client.provider_id).maybeSingle()
        if (prov) {
          setProviderId(prov.id)
          setProviderEmail(prov.email)
          setProviderName(prov.name)
        }
      }

      // Load workers and NDIS items independently — always show even if no provider link
      const [{ data: wks }, { data: ndis }] = await Promise.all([
        supabase.from('carers').select('id, name').eq('active', true).order('name'),
        client.provider_id
          ? supabase.from('ndis_line_items').select('id, line_item_number, description')
              .eq('provider_id', client.provider_id).eq('active', true)
          : supabase.from('ndis_line_items').select('id, line_item_number, description')
              .eq('active', true),
      ])
      setWorkers(wks || [])
      setNdisItems(ndis || [])
    }
    load()
  }, [])

  const isRecurring = rruleStr !== null

  // Auto-set end date when start time > end time (overnight)
  function handleStartTimeChange(val: string) {
    setStartTimeVal(val)
    if (val > endTimeVal && startDate === endDate) {
      // If new start is after end on same day, assume overnight — push end to next day
      const nextDay = new Date(startDate)
      nextDay.setDate(nextDay.getDate() + 1)
      setEndDate(nextDay.toISOString().slice(0, 10))
    }
  }

  function buildDateTime(dateStr: string, timeStr: string) {
    return new Date(`${dateStr}T${timeStr}:00`)
  }

  function generateOccurrences(rruleString: string, startTimeStr: string, durationMin: number) {
    const rule = RRule.fromString(rruleString)
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const until = new Date(now); until.setDate(until.getDate() + 28)
    const occurrences = rule.between(now, until, true)
    const [sh, sm] = startTimeStr.split(':').map(Number)
    return occurrences.map(occ => {
      const start = new Date(occ); start.setHours(sh, sm, 0, 0)
      const end = new Date(start); end.setMinutes(end.getMinutes() + durationMin)
      return { start, end }
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!title.trim()) { setError('Activity title is required'); return }
    if (!clientId) { setError('Your profile is not set up. Contact your Provider.'); return }

    if (!isRecurring) {
      if (!startDate || !startTimeVal) { setError('Start date and time are required'); return }
      if (!endDate || !endTimeVal) { setError('End date and time are required'); return }
      const s = buildDateTime(startDate, startTimeVal)
      const en = buildDateTime(endDate, endTimeVal)
      if (s >= en) { setError('End must be after start'); return }
    }

    setSaving(true)

    if (isRecurring) {
      let daysOfWeek: number[] = []
      try {
        const rule = RRule.fromString(rruleStr!)
        const byDay = rule.origOptions.byweekday
        if (byDay) {
          daysOfWeek = (byDay as any[]).map((d: any) => {
            const wd = typeof d === 'number' ? d : (d.weekday ?? d)
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

      if (created) {
        const occurrences = generateOccurrences(rruleStr!, recurTime, durationMins)
        if (occurrences.length > 0) {
          await supabase.from('activities').insert(occurrences.map(({ start, end }) => ({
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
          })))
        }
        if (providerEmail) {
          notify('activity_changed', providerEmail, {
            recipientName: providerName || 'Provider',
            activityTitle: `${title} (recurring schedule)`,
            changedBy: 'a Client',
            activityId: created.id,
            role: 'provider',
          })
        }
      }
    } else {
      const s = buildDateTime(startDate, startTimeVal)
      const en = buildDateTime(endDate, endTimeVal)

      const { data: created, error: err } = await supabase.from('activities').insert({
        title: title.trim(),
        description: description || null,
        status: 'awaiting_acceptance',
        start_time: s.toISOString(),
        end_time: en.toISOString(),
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

          {/* Worker — always show */}
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

          {/* NDIS item — always show */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              NDIS Support Type <span className="text-gray-300">(optional)</span>
            </label>
            <select value={ndisItemId} onChange={e => setNdisItemId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">— Select support type —</option>
              {ndisItems.map(n => (
                <option key={n.id} value={n.id}>{n.line_item_number} — {n.description}</option>
              ))}
            </select>
            {ndisItems.length === 0 && (
              <p className="text-xs text-gray-300 mt-1">No NDIS items configured by your Provider yet</p>
            )}
          </div>
        </div>

        {/* Recurrence */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <h2 className="font-semibold text-gray-900 text-sm">Recurrence</h2>
          <RecurrencePicker
            startDate={startDate ? new Date(startDate) : new Date()}
            onChange={(str, desc) => { setRruleStr(str); setRruleDesc(desc) }}
          />
          {isRecurring && (
            <div className="bg-blue-50 rounded-xl px-3 py-2 text-xs text-blue-700">
              {rruleDesc}
            </div>
          )}
        </div>

        {/* Timing — one-off uses date + time dropdowns, recurring uses time + duration */}
        {!isRecurring ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
            <h2 className="font-semibold text-gray-900 text-sm">When</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Start Date</label>
                <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (!endDate || endDate < e.target.value) setEndDate(e.target.value) }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Start Time</label>
                <select value={startTimeVal} onChange={e => handleStartTimeChange(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {TIME_OPTS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">End Date</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">End Time</label>
                <select value={endTimeVal} onChange={e => setEndTimeVal(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {TIME_OPTS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            {startDate === endDate && startTimeVal > endTimeVal && (
              <p className="text-xs text-amber-600">⚠ End time is before start time — set the end date to the next day for an overnight shift.</p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
            <h2 className="font-semibold text-gray-900 text-sm">Shift Time</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Start Time</label>
                <select value={recurTime} onChange={e => setRecurTime(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {TIME_OPTS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
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

export default function ClientNewActivityPage() {
  return (
    <Suspense fallback={<div className="p-4 text-gray-400 text-sm">Loading…</div>}>
      <ClientNewActivityInner />
    </Suspense>
  )
}
