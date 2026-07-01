'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { Field, TextArea, Section, SaveBar } from '@/components/FormFields'
import { ArrowLeft, ToggleLeft, ToggleRight, Star, Mail } from 'lucide-react'
import Link from 'next/link'

const EMPTY = {
  name: '', email: '', mobile: '', home_phone: '', work_phone: '',
  address_line1: '', suburb: '', state: '', postcode: '',
  car_registration: '', abn: '', bank_bsb: '', bank_account_number: '', comments: '',
}

const EDITABLE_FIELDS = Object.keys(EMPTY)

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
  const [data, setData] = useState<Record<string, string>>(EMPTY)
  const [active, setActive] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
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
  const isNew = id === 'new'
  const supabase = createClient()

  useEffect(() => {
    if (isNew) { setLoading(false); return }
    async function load() {
      const { data: carer } = await supabase.from('carers').select('*').eq('id', id).single()
      if (carer) {
        const next: Record<string, string> = { ...EMPTY }
        for (const key of EDITABLE_FIELDS) {
          const v = (carer as any)[key]
          next[key] = v == null ? '' : String(v)
        }
        setData(next)
        setActive(carer.active ?? true)
        setUserId(carer.user_id || null)
        setRatings({ client: carer.client_rating, provider: carer.provider_rating })
      }
      setLoading(false)
    }
    load()
  }, [id])

  const set = useCallback((field: string, value: string) => {
    setData(prev => ({ ...prev, [field]: value }))
  }, [])

  const f = (field: string) => ({
    value: data[field] ?? '',
    onChange: (v: string) => set(field, v),
  })

  function buildPayload() {
    return {
      name: data.name,
      email: data.email || null,
      mobile: data.mobile || null,
      home_phone: data.home_phone || null,
      work_phone: data.work_phone || null,
      address_line1: data.address_line1 || null,
      suburb: data.suburb || null,
      state: data.state || null,
      postcode: data.postcode || null,
      car_registration: data.car_registration || null,
      abn: data.abn || null,
      bank_bsb: data.bank_bsb || null,
      bank_account_number: data.bank_account_number || null,
      comments: data.comments || null,
      active,
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const payload = buildPayload()

    if (isNew) {
      const { data: created, error: err } = await supabase
        .from('carers').insert(payload).select().single()
      if (err) { setError(err.message); setSaving(false); return }
      setSaving(false)
      if (created) router.push(`/provider/carers/${created.id}`)
    } else {
      const { data: existing } = await supabase
        .from('carers').select('email, user_id').eq('id', id).single()
      const { error: err } = await supabase.from('carers').update(payload).eq('id', id)
      if (err) { setError(err.message); setSaving(false); return }

      if (existing?.user_id && existing?.email !== data.email && data.email) {
        await fetch('/api/update-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: existing.user_id, newEmail: data.email }),
        })
      }

      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  async function handleInvite() {
    if (!data.email) { setError('Email address is required to send an invitation'); return }
    setInviting(true)
    setInviteMsg('')
    setError('')

    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: data.email, name: data.name, role: 'carer', recordId: id }),
    })
    const result = await res.json()

    if (!res.ok) {
      setError(result.error || 'Failed to send invitation')
    } else {
      setInviteMsg(`Invitation sent to ${data.email}`)
      // Reload to pick up the new user_id if it was just linked
      const { data: updated } = await supabase
        .from('carers').select('user_id').eq('id', id).single()
      if (updated?.user_id) setUserId(updated.user_id)
      setTimeout(() => setInviteMsg(''), 4000)
    }
    setInviting(false)
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/provider/carers" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isNew ? 'Add Carer' : data.name || 'Carer Details'}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {isNew ? 'Enter carer details below' : 'Edit carer information'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Section title="Personal Details">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full Name" {...f('name')} required half />
            <Field label="Email Address" {...f('email')} type="email" required half />
            <Field label="Mobile Phone" {...f('mobile')} required half />
            <Field label="Home Phone" {...f('home_phone')} half />
            <Field label="Work Phone" {...f('work_phone')} half />
            <Field label="Car Registration" {...f('car_registration')} half />
            <div className="col-span-2 border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Address</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Address Line 1" {...f('address_line1')} />
                <Field label="Suburb" {...f('suburb')} half />
                <Field label="State" {...f('state')} half />
                <Field label="Postcode" {...f('postcode')} half />
              </div>
            </div>
            <TextArea label="Comments" {...f('comments')} />
          </div>
        </Section>

        <Section title="Payment Details">
          <div className="grid grid-cols-2 gap-4">
            <Field label="ABN (Optional)" {...f('abn')} half />
            <div className="col-span-1" />
            <Field label="BSB" {...f('bank_bsb')} required half />
            <Field label="Account Number" {...f('bank_account_number')} required half />
          </div>
        </Section>

        {!isNew && (
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
        )}

        {!isNew && (
          <Section title="App Access">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {userId ? 'Invited' : 'Not yet invited'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {userId
                    ? 'This carer has a login account. Resend invite if they need a new link.'
                    : 'Send an invitation so this carer can log in to CareTime.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleInvite}
                disabled={inviting || !data.email}
                className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Mail size={14} />
                {inviting ? 'Sending…' : userId ? 'Resend Invite' : 'Send Invite'}
              </button>
            </div>
            {inviteMsg && (
              <p className="text-green-600 text-sm mt-2">✓ {inviteMsg}</p>
            )}
          </Section>
        )}

        {!isNew && (
          <Section title="Account Status">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{active ? 'Active' : 'Inactive'}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {active ? 'Carer can be assigned to activities' : 'Carer is deactivated and hidden from active lists'}
                </p>
              </div>
              <button type="button" onClick={() => setActive(a => !a)}
                className="text-gray-400 hover:text-blue-600 transition-colors">
                {active ? <ToggleRight size={36} className="text-blue-600" /> : <ToggleLeft size={36} />}
              </button>
            </div>
          </Section>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">⚠ {error}</div>
        )}

        <SaveBar saving={saving} saved={saved} onCancel={() => router.push('/provider/carers')} />
      </form>
    </div>
  )
}
