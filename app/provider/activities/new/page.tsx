'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { Section, SaveBar } from '@/components/FormFields'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notify } from '@/lib/email/notify'

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

export default function ActivityPage() {
  const [data, setData] = useState<Record<string, string>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [clients, setClients] = useState<any[]>([])
  const [carers, setCarers] = useState<any[]>([])
  const [ndisItems, setNdisItems] = useState<any[]>([])
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params?.id as string
  const isNew = id === 'new' || !id
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const [{ data: cls }, { data: crs }, { data: ndis }] = await Promise.all([
        supabase.from('clients').select('id, name, email, address_line1, suburb, state, postcode').eq('active', true).order('name'),
        supabase.from('carers').select('id, name, email').eq('active', true).order('name'),
        supabase.from('ndis_line_items').select('id, line_item_number, description').eq('active', true),
      ])
      setClients(cls || [])
      setCarers(crs || [])
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
  }, [id])

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
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: provider } = await supabase
      .from('providers').select('id').eq('user_id', user!.id).maybeSingle()

    const payload = {
      title: data.title,
      description: data.description || null,
      status: data.status,
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

    if (isNew) {
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

        router.push('/provider/calendar')
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
        <Link href="/provider/calendar" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={18} />
        </Link>
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
            <Select label="Worker (Optional)" value={data.carer_id} onChange={v => set('carer_id', v)}
              options={carerOptions} half />
            <Select label="NDIS Line Item" value={data.ndis_line_item_id}
              onChange={v => set('ndis_line_item_id', v)} options={ndisOptions} />
            <Select label="Status" value={data.status} onChange={v => set('status', v)}
              options={STATUS_OPTIONS} required />
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

        <SaveBar saving={saving} saved={saved} onCancel={() => router.push('/provider/calendar')} />
      </form>
    </div>
  )
}
