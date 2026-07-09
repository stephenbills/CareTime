'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { Section, SaveBar } from '@/components/FormFields'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notify } from '@/lib/email/notify'
import { useProviderId } from '@/lib/hooks/useProvider'
import RecurrencePicker from '@/components/RecurrencePicker'
import { RRule } from 'rrule'

const EMPTY = {
  title: '', description: '', status: 'awaiting_acceptance',
  start_time: '', end_time: '',
  pickup_address: '', dropoff_address: '', venue_address: '',
  client_id: '', carer_id: '', ndis_line_item_id: '',
  client_comments: '', rejection_reason: '',
}

function Field({ label, value, onChange, type = 'text', required = false, half = false, placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; required?: boolean; half?: boolean; placeholder?: string
}) {
  return (
    <div className={half ? 'col-span-1' : 'col-span-2'}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5"> *</span>}
      </label>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

function Select({ label, value, onChange, options, required = false, half = false }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
  required?: boolean; half?: boolean
}) {
  return (
    <div className={half ? 'col-span-1' : 'col-span-2'}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5"> *</span>}
      </label>
      <select
        value={value} onChange={e => onChange(e.target.value)} required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <option value="">— Select —</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function TextArea({ label, value, onChange, placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="col-span-2">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} rows={3}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
    </div>
  )
}

const STATUS_OPTIONS = [
  { value: 'awaiting_acceptance', label: 'Awaiting Acceptance' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'awaiting_client_approval', label: 'Awaiting Client Approval' },
  { value: 'awaiting_payment_approval', label: 'Awaiting Payment Approval' },
  { value: 'ready_for_payment', label: 'Ready for Payment' },
  { value: 'paid', label: 'Paid' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
]

function toLocalDateTimeInput(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true
  })
}

function generateOccurrences(rruleString: string, startDateTimeStr: string, durationMin: number) {
  const startDT = new Date(startDateTimeStr)
  const rule = RRule.fromString(rruleString)
  // Anchor the search window to the chosen start date, not "today" — otherwise a
  // future start date gets skipped in favour of this week's matching weekday,
  // or (if the start date is more than 4 weeks out) no occurrences are found at all.
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const chosenStart = new Date(startDT); chosenStart.setHours(0, 0, 0, 0)
  const searchStart = today > chosenStart ? today : chosenStart
  const until = new Date(searchStart); until.setDate(until.getDate() + 28)
  const occurrences = rule.between(searchStart, until, true)
  const sh = startDT.getHours(), sm = startDT.getMinutes()
  return occurrences.map(occ => {
    const start = new Date(occ); start.setHours(sh, sm, 0, 0)
    const end = new Date(start); end.setMinutes(end.getMinutes() + durationMin)
    return { start, end }
  })
}

export default function ActivityPage() {
  const [data, setData] = useState<Record<string, string>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [clients, setClients] = useState<any[]>([])
  const [carers, setCarers] = useState<any[]>([])
  const [ndisItems, setNdisItems] = useState<any[]>([])
  const [rruleStr, setRruleStr] = useState<string | null>(null)
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params?.id as string
  const isNew = id === 'new' || !id
  const supabase = createClient()
  const { providerId } = useProviderId()

  useEffect(() => {
    if (!providerId) return
    async function load() {
      const [{ data: clientLinks }, { data: carerLinks }, { data: ndis }] = await Promise.all([
        supabase.from('provider_clients')
          .select('client_id, clients(id, name, email, address_line1, suburb, state, postcode)')
          .eq('provider_id', providerId).eq('active', true),
        supabase.from('provider_carers')
          .select('carer_id, carers(id, name, email)')
          .eq('provider_id', providerId).eq('active', true),
        supabase.from('ndis_line_items').select('id, line_item_number, description').eq('active', true),
      ])
      setClients((clientLinks || []).map((l: any) => l.clients).filter(Boolean))
      setCarers((carerLinks || []).map((l: any) => l.carers).filter(Boolean))
      setNdisItems(ndis || [])

      if (!isNew) {
        const { data: act } = await supabase.from('activities').select('*').eq('id', id).single()
        if (act) {
          setData({
            ...EMPTY,
            ...Object.fromEntries(Object.entries(act).map(([k, v]) => [k, v == null ? '' : String(v)])),
            start_time: toLocalDateTimeInput(act.start_time),
            end_time: toLocalDateTimeInput(act.end_time),
          })
        }
      } else {
        const date = searchParams?.get('date')
        if (date) {
          setData(d => ({ ...d, start_time: `${date}T09:00`, end_time: `${date}T11:00` }))
        }
      }
      setLoading(false)
    }
    load()
  }, [id, providerId])

  const set = useCallback((field: string, value: string) => {
    setData(prev => ({ ...prev, [field]: value }))
  }, [])

  // When client changes, default pickup/dropoff to their address
  function handleClientChange(clientId: string) {
    set('client_id', clientId)
    if (clientId && isNew) {
      const client = clients.find(c => c.id === clientId)
      if (client?.address_line1) {
        const addr = [client.address_line1, client.suburb, client.state, client.postcode]
          .filter(Boolean).join(', ')
        set('pickup_address', addr)
        set('dropoff_address', addr)
      }
    }
  }

  function validate() {
    if (!data.title.trim()) return 'Activity title is required'
    if (!data.client_id) return 'Please select a client'
    if (!data.start_time) return 'Start time is required'
    if (!data.end_time) return 'End time is required'
    if (new Date(data.start_time) >= new Date(data.end_time)) return 'End time must be after start time'
    return ''
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const err = validate()
    if (err) { setError(err); return }
    // A recurring schedule only generates future shifts — a one-off activity can still
    // legitimately be logged in the past (e.g. recording a completed shift after the fact).
    if (isNew && rruleStr && new Date(data.start_time) < new Date()) {
      setError('Start date cannot be in the past for a recurring schedule')
      return
    }
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: provider } = await supabase
      .from('providers').select('id').eq('user_id', user!.id).maybeSingle()

    const payload = {
      title: data.title,
      description: data.description || null,
      // If no worker assigned, use awaiting_acceptance so Provider dashboard shows it as unassigned
      // If worker assigned, use awaiting_acceptance so Worker can accept
      status: data.status !== 'awaiting_acceptance'
        ? data.status
        : data.carer_id
          ? 'awaiting_acceptance'
          : 'awaiting_acceptance',
      start_time: new Date(data.start_time).toISOString(),
      end_time: new Date(data.end_time).toISOString(),
      pickup_address: data.pickup_address || null,
      dropoff_address: data.dropoff_address || null,
      venue_address: data.venue_address || null,
      client_id: data.client_id || null,
      carer_id: data.carer_id || null,
      ndis_line_item_id: data.ndis_line_item_id || null,
      provider_id: provider?.id || null,
    }

    const selectedClient = clients.find(c => c.id === data.client_id)
    const selectedCarer = carers.find(c => c.id === data.carer_id)

    if (isNew && rruleStr) {
      let daysOfWeek: number[] = []
      try {
        const rule = RRule.fromString(rruleStr)
        const byDay = rule.origOptions.byweekday
        if (byDay) {
          daysOfWeek = (byDay as any[]).map((d: any) => {
            const wd = typeof d === 'number' ? d : (d.weekday ?? d)
            return (wd + 1) % 7
          })
        }
      } catch {}

      const startDT = new Date(data.start_time)
      const durationMin = Math.round((new Date(data.end_time).getTime() - startDT.getTime()) / 60000)
      const startTimeStr = `${String(startDT.getHours()).padStart(2, '0')}:${String(startDT.getMinutes()).padStart(2, '0')}`

      const { data: created, error: err } = await supabase.from('recurring_schedules').insert({
        title: data.title,
        description: data.description || null,
        provider_id: provider?.id || null,
        client_id: data.client_id || null,
        carer_id: data.carer_id || null,
        ndis_line_item_id: data.ndis_line_item_id || null,
        rrule: rruleStr,
        days_of_week: daysOfWeek.length > 0 ? daysOfWeek : null,
        start_time: startTimeStr,
        duration_minutes: durationMin,
        valid_from: data.start_time.slice(0, 10),
        pickup_address: data.pickup_address || null,
        dropoff_address: data.dropoff_address || null,
        venue_address: data.venue_address || null,
        active: true,
      }).select().single()

      if (err) { setError(err.message); setSaving(false); return }

      if (created) {
        const occurrences = generateOccurrences(rruleStr, data.start_time, durationMin)
        if (occurrences.length > 0) {
          const { error: occErr } = await supabase.from('activities').insert(occurrences.map(({ start, end }) => ({
            recurring_schedule_id: created.id,
            provider_id: provider?.id || null,
            client_id: data.client_id || null,
            carer_id: data.carer_id || null,
            ndis_line_item_id: data.ndis_line_item_id || null,
            title: data.title,
            description: data.description || null,
            status: 'awaiting_acceptance',
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            pickup_address: data.pickup_address || null,
            dropoff_address: data.dropoff_address || null,
            venue_address: data.venue_address || null,
          })))
          if (occErr) { setError(`Schedule created, but failed to generate shifts: ${occErr.message}`); setSaving(false); return }
        }

        if (selectedCarer?.email) {
          notify('activity_assigned', selectedCarer.email, {
            carerName: selectedCarer.name,
            activityTitle: `${data.title} (recurring schedule)`,
            clientName: selectedClient?.name || '—',
            startTime: formatDateTime(data.start_time),
            endTime: formatDateTime(data.end_time),
            activityId: created.id,
          })
        }

        router.push('/provider/schedules')
      }
    } else if (isNew) {
      const { data: created, error: err } = await supabase
        .from('activities').insert(payload).select().single()
      if (err) { setError(err.message); setSaving(false); return }

      if (created) {
        await supabase.from('activity_status_history').insert({
          activity_id: created.id,
          from_status: null,
          to_status: payload.status,
          changed_by: user!.id,
        })

        if (selectedCarer?.email) {
          notify('activity_assigned', selectedCarer.email, {
            carerName: selectedCarer.name,
            activityTitle: payload.title,
            clientName: selectedClient?.name || '—',
            startTime: formatDateTime(payload.start_time),
            endTime: formatDateTime(payload.end_time),
            activityId: created.id,
          })
        }

        router.back()
      }
    } else {
      const { data: existing } = await supabase
        .from('activities').select('status').eq('id', id).single()
      const { error: err } = await supabase.from('activities').update(payload).eq('id', id)
      if (err) { setError(err.message); setSaving(false); return }

      const statusChanged = existing && existing.status !== payload.status

      if (statusChanged) {
        await supabase.from('activity_status_history').insert({
          activity_id: id,
          from_status: existing!.status,
          to_status: payload.status,
          changed_by: user!.id,
        })

        if (payload.status === 'scheduled' && selectedClient?.email) {
          notify('activity_accepted', selectedClient.email, {
            recipientName: selectedClient.name,
            carerName: selectedCarer?.name || 'The worker',
            activityTitle: payload.title,
            activityId: id,
            role: 'client',
          })
        }
        if (payload.status === 'awaiting_client_approval' && selectedClient?.email) {
          notify('shift_submitted', selectedClient.email, {
            recipientName: selectedClient.name,
            carerName: selectedCarer?.name || 'The worker',
            activityTitle: payload.title,
            startTime: formatDateTime(payload.start_time),
            endTime: formatDateTime(payload.end_time),
            totalCost: 'See activity for details',
            activityId: id,
          })
        }
        if (payload.status === 'awaiting_payment_approval' && selectedCarer?.email) {
          notify('shift_approved', selectedCarer.email, {
            recipientName: selectedCarer.name,
            clientName: selectedClient?.name || 'The client',
            activityTitle: payload.title,
            activityId: id,
          })
        }
        if (payload.status === 'ready_for_payment' && selectedCarer?.email) {
          notify('payment_approved', selectedCarer.email, {
            carerName: selectedCarer.name,
            activityTitle: payload.title,
            activityId: id,
          })
        }
        if (payload.status === 'rejected' && selectedCarer?.email) {
          notify('shift_rejected', selectedCarer.email, {
            recipientName: selectedCarer.name,
            clientName: selectedClient?.name || 'The client',
            activityTitle: payload.title,
            rejectionReason: data.client_comments || data.rejection_reason || '',
            activityId: id,
          })
        }
      } else if (selectedCarer?.email) {
        notify('activity_changed', selectedCarer.email, {
          recipientName: selectedCarer.name,
          activityTitle: payload.title,
          changedBy: 'the Provider',
          activityId: id,
        })
      }

      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>

  const clientOptions = clients.map(c => ({ value: c.id, label: c.name }))
  const carerOptions = carers.map(c => ({ value: c.id, label: c.name }))
  const ndisOptions = ndisItems.map(n => ({ value: n.id, label: `${n.line_item_number} — ${n.description}` }))

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isNew ? 'Add Activity' : data.title || 'Activity Details'}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {isNew ? 'Schedule a new care activity' : 'Edit activity details'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Section title="Activity Details">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Activity Title" value={data.title} onChange={v => set('title', v)} required />
            <Select label="Client" value={data.client_id} onChange={handleClientChange}
              options={clientOptions} required half />
            <Select label="Worker (optional — assign later if unknown)" value={data.carer_id} onChange={v => set('carer_id', v)}
              options={carerOptions} half />
            <Select label="NDIS Line Item" value={data.ndis_line_item_id}
              onChange={v => set('ndis_line_item_id', v)} options={ndisOptions} />
            {!(isNew && rruleStr) && (
              <Select label="Status" value={data.status} onChange={v => set('status', v)}
                options={STATUS_OPTIONS} required />
            )}
            <TextArea label="Description / Notes" value={data.description}
              onChange={v => set('description', v)} placeholder="Optional notes about this activity" />
          </div>
        </Section>

        <Section title="Timing">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Date & Time" value={data.start_time}
              onChange={v => set('start_time', v)} type="datetime-local" required half />
            <Field label="End Date & Time" value={data.end_time}
              onChange={v => set('end_time', v)} type="datetime-local" required half />
          </div>
        </Section>

        {isNew && (
          <Section title="Recurrence">
            <RecurrencePicker
              startDate={data.start_time ? new Date(data.start_time) : new Date()}
              onChange={str => setRruleStr(str)}
            />
          </Section>
        )}

        <Section title="Locations">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Pickup Address" value={data.pickup_address}
              onChange={v => set('pickup_address', v)} placeholder="e.g. 1 Neverland Ave, Kensington NSW 2033" />
            <Field label="Drop-off Address" value={data.dropoff_address}
              onChange={v => set('dropoff_address', v)} placeholder="Same as pickup if returning home" />
            <Field label="Venue / Activity Address" value={data.venue_address}
              onChange={v => set('venue_address', v)} placeholder="Optional — only if activity is at a separate location" />
          </div>
        </Section>

        {data.status === 'rejected' && (
          <Section title="Rejection Details">
            <TextArea label="Rejection Reason" value={data.client_comments}
              onChange={v => set('client_comments', v)} placeholder="Why was this shift rejected?" />
          </Section>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            ⚠ {error}
          </div>
        )}

        <SaveBar saving={saving} saved={saved} onCancel={() => router.back()} />
      </form>
    </div>
  )
}
