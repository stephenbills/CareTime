'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notify } from '@/lib/email/notify'
import RecurrencePicker from '@/components/RecurrencePicker'
import SearchableSelect from '@/components/SearchableSelect'
import { RRule } from 'rrule'
import { Suspense } from 'react'

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

// Minutes from start to end, rolling over to the next day if end <= start
function shiftDurationMinutes(startTimeStr: string, endTimeStr: string) {
  const [sh, sm] = startTimeStr.split(':').map(Number)
  const [eh, em] = endTimeStr.split(':').map(Number)
  const startMins = sh * 60 + sm
  const endMins = eh * 60 + em
  const diff = endMins - startMins
  return diff <= 0 ? diff + 24 * 60 : diff
}

function ClientNewActivityInner() {
  const searchParams = useSearchParams()
  const dateParam = searchParams?.get('date')
  const defaultDate = dateParam || todayStr()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [carerId, setCarerId] = useState('')
  const [ndisItemId, setNdisItemId] = useState('')

  // Shift Time — start date/time + end time; overnight is auto-detected
  const [startDate, setStartDate] = useState(defaultDate)
  const [startTimeVal, setStartTimeVal] = useState('09:00')
  const [endTimeVal, setEndTimeVal] = useState('11:00')

  // Recurrence
  const [rruleStr, setRruleStr] = useState<string | null>(null)

  // Locations
  const [pickupAddress, setPickupAddress] = useState('')
  const [dropoffAddress, setDropoffAddress] = useState('')
  const [venueAddress, setVenueAddress] = useState('')

  // State
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [clientId, setClientId] = useState<string | null>(null)
  const [providers, setProviders] = useState<{ id: string; name: string; email: string | null }[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState<string>('')
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

      const { data: links } = await supabase
        .from('provider_clients')
        .select('provider_id, providers(id, name, email)')
        .eq('client_id', client.id).eq('active', true)
      const provs = (links || []).map((l: any) => l.providers).filter(Boolean)
      setProviders(provs)
      if (provs.length > 0) setSelectedProviderId(provs[0].id)
    }
    load()
  }, [])

  // Scope Preferred Worker + NDIS Support Type to the selected Provider
  useEffect(() => {
    async function loadScoped() {
      if (selectedProviderId) {
        const [{ data: workerLinks }, { data: ndis }] = await Promise.all([
          supabase.from('provider_carers')
            .select('carer_id, carers(id, name)')
            .eq('provider_id', selectedProviderId).eq('active', true),
          supabase.from('ndis_line_items').select('id, line_item_number, description')
            .eq('provider_id', selectedProviderId).eq('active', true),
        ])
        const workerList = (workerLinks || []).map((l: any) => l.carers).filter(Boolean)
        workerList.sort((a: any, b: any) => a.name.localeCompare(b.name))
        setWorkers(workerList)
        setNdisItems(ndis || [])
      } else {
        // No linked Provider yet — fall back to an unscoped list rather than showing nothing
        const [{ data: wks }, { data: ndis }] = await Promise.all([
          supabase.from('carers').select('id, name').eq('active', true).order('name'),
          supabase.from('ndis_line_items').select('id, line_item_number, description').eq('active', true),
        ])
        setWorkers(wks || [])
        setNdisItems(ndis || [])
      }
    }
    loadScoped()
  }, [selectedProviderId])

  const isRecurring = rruleStr !== null
  const selectedProvider = providers.find(p => p.id === selectedProviderId)

  function buildDateTime(dateStr: string, timeStr: string) {
    return new Date(`${dateStr}T${timeStr}:00`)
  }

  function generateOccurrences(rruleString: string, startDateStr: string, startTimeStr: string, durationMin: number) {
    const rule = RRule.fromString(rruleString)
    // Anchor the search window to the chosen start date, not "today" — otherwise a
    // future start date gets skipped in favour of this week's matching weekday,
    // or (if the start date is more than 4 weeks out) no occurrences are found at all.
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const chosenStart = new Date(`${startDateStr}T00:00:00`)
    const searchStart = today > chosenStart ? today : chosenStart
    const until = new Date(searchStart); until.setDate(until.getDate() + 28)
    const occurrences = rule.between(searchStart, until, true)
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
    if (!startDate || !startTimeVal || !endTimeVal) { setError('Start date and shift time are required'); return }
    if (startDate < todayStr()) { setError('Start date cannot be in the past'); return }

    setSaving(true)
    const durationMin = shiftDurationMinutes(startTimeVal, endTimeVal)
    const providerId = selectedProviderId || null
    const providerEmail = selectedProvider?.email || null
    const providerName = selectedProvider?.name || null

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
        start_time: startTimeVal,
        duration_minutes: durationMin,
        valid_from: startDate,
        pickup_address: pickupAddress || null,
        dropoff_address: dropoffAddress || null,
        venue_address: venueAddress || null,
        active: true,
      }).select().single()

      if (err) { setError(err.message); setSaving(false); return }

      if (created) {
        const occurrences = generateOccurrences(rruleStr!, startDate, startTimeVal, durationMin)
        if (occurrences.length > 0) {
          const { error: occErr } = await supabase.from('activities').insert(occurrences.map(({ start, end }) => ({
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
          if (occErr) { setError(`Schedule created, but failed to generate shifts: ${occErr.message}`); setSaving(false); return }
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
      const en = new Date(s.getTime() + durationMin * 60000)

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
    router.push(`/client/calendar?date=${startDate}`)
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

          {/* Provider — dropdown if linked to more than one, otherwise just the name */}
          {providers.length > 1 ? (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Provider</label>
              <select value={selectedProviderId} onChange={e => setSelectedProviderId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          ) : providers.length === 1 ? (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Provider</label>
              <p className="text-sm font-medium text-gray-900">{providers[0].name}</p>
            </div>
          ) : (
            <p className="text-xs text-amber-600">You are not yet linked to a Provider. Contact your Provider for an invite.</p>
          )}

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
            <SearchableSelect
              value={ndisItemId}
              onChange={setNdisItemId}
              placeholder="— Select support type —"
              emptyText="No matching support types"
              options={ndisItems.map(n => ({
                value: n.id,
                label: `${n.line_item_number} — ${n.description}`,
                searchText: `${n.line_item_number} ${n.description}`,
              }))}
            />
            {ndisItems.length === 0 && (
              <p className="text-xs text-gray-300 mt-1">No NDIS items configured by your Provider yet</p>
            )}
          </div>
        </div>

        {/* Shift Time */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm">Shift Time</h2>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Start Time</label>
              <select value={startTimeVal} onChange={e => setStartTimeVal(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {TIME_OPTS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">End Time</label>
              <select value={endTimeVal} onChange={e => setEndTimeVal(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {TIME_OPTS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          {endTimeVal <= startTimeVal && (
            <p className="text-xs text-amber-600">⚠ End time is before start time — this will be treated as an overnight shift ending the next day.</p>
          )}
        </div>

        {/* Recurrence */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <h2 className="font-semibold text-gray-900 text-sm">Recurrence</h2>
          <RecurrencePicker
            startDate={startDate ? new Date(startDate) : new Date()}
            onChange={str => setRruleStr(str)}
          />
        </div>

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
