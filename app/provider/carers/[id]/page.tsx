'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { Field, TextArea, Section, ReadOnlyField, SaveBar } from '@/components/FormFields'
import { ArrowLeft, ToggleLeft, ToggleRight, Star, Mail } from 'lucide-react'
import Link from 'next/link'
import { useProviderId } from '@/lib/hooks/useProvider'

const EMPTY_LINK = { notes: '', start_date: '', end_date: '' }

function StarRating({ value }: { value: number | null }) {
  if (!value) return <span className="text-gray-400 text-sm">No ratings yet</span>
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={14} className={i <= Math.round(value) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'} />
      ))}
      <span className="text-sm text-gray-500 ml-1">{value.toFixed(1)}</span>
    </div>
  )
}

export default function CarerDetailPage() {
  const [worker, setWorker] = useState<any>(null)
  const [linkId, setLinkId] = useState<string | null>(null)
  const [link, setLink] = useState<Record<string, string>>(EMPTY_LINK)
  const [active, setActive] = useState(true)
  const [ratings, setRatings] = useState({ client: null as number | null, provider: null as number | null })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { providerId } = useProviderId()
  const supabase = createClient()

  useEffect(() => {
    if (id === 'new') { router.replace('/provider/carers/new'); return }
    if (!providerId) return
    async function load() {
      const { data: w } = await supabase.from('carers').select('*').eq('id', id).single()
      setWorker(w)
      if (w) setRatings({ client: w.client_rating, provider: w.provider_rating })

      const { data: pc } = await supabase
        .from('provider_carers').select('*')
        .eq('provider_id', providerId).eq('carer_id', id).maybeSingle()
      if (pc) {
        setLinkId(pc.id)
        setActive(pc.active ?? true)
        setLink({
          notes: pc.notes || '',
          start_date: pc.start_date || '',
          end_date: pc.end_date || '',
        })
      }
      setLoading(false)
    }
    load()
  }, [id, providerId])

  const set = useCallback((field: string, value: string) => {
    setLink(prev => ({ ...prev, [field]: value }))
  }, [])

  const f = (field: string) => ({
    value: link[field] ?? '',
    onChange: (v: string) => set(field, v),
  })

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!linkId) { setError('This worker is not linked to your organisation'); return }
    setSaving(true)

    const payload = {
      active,
      notes: link.notes || null,
      start_date: link.start_date || null,
      end_date: link.end_date || null,
    }

    const { error: err } = await supabase.from('provider_carers').update(payload).eq('id', linkId)
    if (err) { setError(err.message); setSaving(false); return }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleInvite() {
    if (!worker?.email) { setError('Email address is required to send an invitation'); return }
    setInviting(true)
    setInviteMsg('')
    setError('')

    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: worker.email, name: worker.name, role: 'worker', recordId: id }),
    })
    const result = await res.json()

    if (!res.ok) {
      setError(result.error || 'Failed to send invitation')
    } else {
      setInviteMsg(`Invitation sent to ${worker.email}`)
      const { data: updated } = await supabase
        .from('carers').select('user_id').eq('id', id).single()
      if (updated?.user_id) setWorker((w: any) => ({ ...w, user_id: updated.user_id }))
      setTimeout(() => setInviteMsg(''), 4000)
    }
    setInviting(false)
  }

  if (loading || !worker) return <div className="p-8 text-gray-400 text-sm">Loading…</div>

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/provider/carers" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{worker.name || 'Worker Details'}</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Personal details are managed by the worker. You can edit your own notes below.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Section title="Personal Details">
          <div className="grid grid-cols-2 gap-4">
            <ReadOnlyField label="Full Name" value={worker.name} />
            <ReadOnlyField label="Email Address" value={worker.email} />
            <ReadOnlyField label="Mobile Phone" value={worker.mobile} />
            <ReadOnlyField label="Home Phone" value={worker.home_phone} />
            <ReadOnlyField label="Work Phone" value={worker.work_phone} />
            <ReadOnlyField label="Car Registration" value={worker.car_registration} />
            <div className="col-span-2 border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Address</p>
              <div className="grid grid-cols-2 gap-4">
                <ReadOnlyField label="Address Line 1" value={worker.address_line1} />
                <ReadOnlyField label="Suburb" value={worker.suburb} />
                <ReadOnlyField label="State" value={worker.state} />
                <ReadOnlyField label="Postcode" value={worker.postcode} />
              </div>
            </div>
          </div>
        </Section>

        <Section title="Payment Details">
          <div className="grid grid-cols-2 gap-4">
            <ReadOnlyField label="ABN" value={worker.abn} />
            <div className="col-span-1" />
            <ReadOnlyField label="BSB" value={worker.bank_bsb} />
            <ReadOnlyField label="Account Number" value={worker.bank_account_number} />
          </div>
        </Section>

        <Section title="Your Notes">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Date" {...f('start_date')} type="date" half />
            <Field label="End Date" {...f('end_date')} type="date" half />
            <TextArea label="Notes" {...f('notes')} />
          </div>
        </Section>

        <Section title="Ratings">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Client Rating</p>
              <StarRating value={ratings.client} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Provider Rating</p>
              <StarRating value={ratings.provider} />
            </div>
          </div>
        </Section>

        <Section title="App Access">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {worker.user_id ? 'Invited' : 'Not yet invited'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {worker.user_id
                  ? 'This worker has a login account. Resend invite if they need a new link.'
                  : 'Send an invitation so this worker can log in to CareTime.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleInvite}
              disabled={inviting || !worker.email}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Mail size={14} />
              {inviting ? 'Sending…' : worker.user_id ? 'Resend Invite' : 'Send Invite'}
            </button>
          </div>
          {inviteMsg && (
            <p className="text-green-600 text-sm mt-2">✓ {inviteMsg}</p>
          )}
        </Section>

        <Section title="Account Status">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{active ? 'Active' : 'Inactive'}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {active ? 'Worker can be assigned to activities with your organisation' : 'Worker is deactivated and hidden from your active lists'}
              </p>
            </div>
            <button type="button" onClick={() => setActive(a => !a)}
              className="text-gray-400 hover:text-blue-600 transition-colors">
              {active ? <ToggleRight size={36} className="text-blue-600" /> : <ToggleLeft size={36} />}
            </button>
          </div>
        </Section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">⚠ {error}</div>
        )}

        <SaveBar saving={saving} saved={saved} onCancel={() => router.push('/provider/carers')} />
      </form>
    </div>
  )
}
