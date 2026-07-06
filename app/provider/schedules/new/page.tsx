'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import RecurrencePicker from '@/components/RecurrencePicker'

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

function Field({ label, value, onChange, type = 'text', required = false, placeholder = '' }: any) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  )
}

function Select({ label, value, onChange, options, required = false }: any) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select value={value} onChange={e => onChange(e.target.value)} required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
        <option value="">— Select —</option>
        {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export default function ScheduleFormPage() {
  const params = useParams()
  const id = params?.id as string | undefined
  const isNew = !id || id === 'new'
  const router = useRouter()
  const supabase = createClient()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [clientId, setClientId] = useState('')
  const [carerId, setCarerId] = useState('')
  const [ndisItemId, setNdisItemId] = useState('')
  const [rruleStr, setRruleStr] = useState<string | null>(null)
  const [rruleDesc, setRruleDesc] = useState('Does not repeat')
  const [startTime, setStartTime] = useState('09:00')
  const [durationMins, setDurationMins] = useState(120)
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10))
  const [validUntil, setValidUntil] = useState('')
  const [pickupAddress, setPickupAddress] = useState('')
  const [dropoffAddress, setDropoffAddress] = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [initialRRule, setInitialRRule] = useState<string | null>(null)

  const [clients, setClients] = useState<any[]>([])
  const [workers, setWorkers] = useState<any[]>([])
  const [ndisItems, setNdisItems] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: cls }, { data: wks }, { data: ndis }] = await Promise.all([
        supabase.from('clients').select('id, name, address_line1, suburb, state, postcode').eq('active', true).order('name'),
        supabase.from('carers').select('id, name').eq('active', true).order('name'),
        supabase.from('ndis_line_items').select('id, line_item_number, description').eq('active', true),
      ])
      setClients(cls || [])
      setWorkers(wks || [])
      setNdisItems(ndis || [])

      if (!isNew && id) {
        const { data: s } = await supabase.from('recurring_schedules').select('*').eq('id', id).single()
        if (s) {
          setTitle(s.title)
          setDescription(s.description || '')
          setClientId(s.client_id || '')
          setCarerId(s.carer_id || '')
          setNdisItemId(s.ndis_line_item_id || '')
          setStartTime(s.start_time?.slice(0, 5) || '09:00')
          setDurationMins(s.duration_minutes || 120)
          setValidFrom(s.valid_from || '')
          setValidUntil(s.valid_until || '')
          setPickupAddress(s.pickup_address || '')
          setDropoffAddress(s.dropoff_address || '')
          setVenueAddress(s.venue_address || '')
          if (s.rrule) {
            setRruleStr(s.rrule)
            setInitialRRule(s.rrule)
          }
        }
      }
      setLoading(false)
    }
    load()
  }, [id])

  function handleClientChange(cid: string) {
    setClientId(cid)
    const client = clients.find(c => c.id === cid)
    if (client?.address_line1 && isNew) {
      const addr = [client.address_line1, client.suburb, client.state, client.postcode].filter(Boolean).join(', ')
      setPickupAddress(addr)
      setDropoffAddress(addr)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!title.trim()) { setError('Title is required'); return }
    if (!clientId) { setError('Client is required'); return }
    if (!rruleStr) { setError('Set a recurrence pattern'); return }
    if (!validFrom) { setError('Start date is required'); return }

    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: provider } = await supabase
      .from('providers').select('id').eq('user_id', user!.id).maybeSingle()

    const payload = {
      title: title.trim(),
      description: description || null,
      provider_id: provider?.id,
      client_id: clientId,
      carer_id: carerId || null,
      ndis_line_item_id: ndisItemId || null,
      rrule: rruleStr,
      days_of_week: null as number[] | null,
      start_time: startTime,
      duration_minutes: durationMins,
      valid_from: validFrom,
      valid_until: validUntil || null,
      pickup_address: pickupAddress || null,
      dropoff_address: dropoffAddress || null,
      venue_address: venueAddress || null,
    }

    if (isNew) {
      const { error: err } = await supabase.from('recurring_schedules').insert(payload)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('recurring_schedules').update(payload).eq('id', id)
      if (err) { setError(err.message); setSaving(false); return }
    }

    setSaving(false)
    router.push('/provider/schedules')
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>

  const clientOptions = clients.map(c => ({ value: c.id, label: c.name }))
  const workerOptions = workers.map(c => ({ value: c.id, label: c.name }))
  const ndisOptions = ndisItems.map(n => ({ value: n.id, label: `${n.line_item_number} — ${n.description}` }))

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/provider/schedules" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isNew ? 'New Recurring Schedule' : 'Edit Schedule'}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {isNew ? 'Define a repeating shift pattern' : 'Update this schedule'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* Details */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Schedule Details</h2>
          <Field label="Title" value={title} onChange={setTitle} required placeholder="e.g. Tuesday Morning Support" />
          <Select label="Client" value={clientId} onChange={handleClientChange} options={clientOptions} required />
          <Select label="Worker (optional — leave blank to assign later)" value={carerId} onChange={setCarerId} options={workerOptions} />
          <Select label="NDIS Line Item" value={ndisItemId} onChange={setNdisItemId} options={ndisOptions} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              placeholder="Optional notes about this recurring shift"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>

        {/* Recurrence */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Recurrence Pattern</h2>
          <RecurrencePicker
            startDate={validFrom ? new Date(validFrom) : new Date()}
            onChange={(str, desc) => { setRruleStr(str); setRruleDesc(desc) }}
            initialRRule={initialRRule}
          />
          {rruleStr && (
            <div className="bg-blue-50 rounded-lg px-3 py-2 text-sm text-blue-700">
              {rruleDesc}
            </div>
          )}
        </div>

        {/* Shift time */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Shift Time</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time <span className="text-red-500">*</span></label>
              <select value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {TIME_OPTS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration <span className="text-red-500">*</span></label>
              <select value={String(durationMins)} onChange={e => setDurationMins(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Schedule Start Date" value={validFrom} onChange={setValidFrom} type="date" required />
            <Field label="End Date (blank = ongoing)" value={validUntil} onChange={setValidUntil} type="date" />
          </div>
        </div>

        {/* Locations */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Locations</h2>
          <Field label="Pickup Address" value={pickupAddress} onChange={setPickupAddress} placeholder="Default pickup for each shift" />
          <Field label="Venue / Activity Address" value={venueAddress} onChange={setVenueAddress} placeholder="Optional" />
          <Field label="Drop-off Address" value={dropoffAddress} onChange={setDropoffAddress} placeholder="Default drop-off for each shift" />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">⚠ {error}</div>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : isNew ? 'Create Schedule' : 'Save Changes'}
          </button>
          <button type="button" onClick={() => router.push('/provider/schedules')}
            className="px-5 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
