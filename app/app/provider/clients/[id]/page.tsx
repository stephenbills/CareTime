'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { Field, TextArea, Section, SaveBar } from '@/components/FormFields'
import { ArrowLeft, ToggleLeft, ToggleRight, Mail } from 'lucide-react'
import Link from 'next/link'

const EMPTY = {
  name: '', email: '', phone: '', mobile: '',
  address_line1: '', address_line2: '', suburb: '', state: '', postcode: '',
  ndis_number: '', comments: '',
}

const EDITABLE_FIELDS = Object.keys(EMPTY)

export default function ClientDetailPage() {
  const [data, setData] = useState<Record<string, string>>(EMPTY)
  const [active, setActive] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [nominees, setNominees] = useState<any[]>([])
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const isNew = id === 'new'
  const supabase = createClient()

  useEffect(() => {
    if (isNew) { setLoading(false); return }
    async function load() {
      const { data: client } = await supabase.from('clients').select('*').eq('id', id).single()
      if (client) {
        // Only pull in the text fields this form manages — never system/relation columns.
        const next: Record<string, string> = { ...EMPTY }
        for (const key of EDITABLE_FIELDS) {
          const v = (client as any)[key]
          next[key] = v == null ? '' : String(v)
        }
        setData(next)
        setActive(client.active ?? true)
        setUserId(client.user_id || null)
      }
      const { data: noms } = await supabase
        .from('client_nominees')
        .select('nominees(id, name, email)')
        .eq('client_id', id)
      setNominees(noms?.map((n: any) => n.nominees).filter(Boolean) ?? [])
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
      phone: data.phone || null,
      mobile: data.mobile || null,
      address_line1: data.address_line1 || null,
      address_line2: data.address_line2 || null,
      suburb: data.suburb || null,
      state: data.state || null,
      postcode: data.postcode || null,
      ndis_number: data.ndis_number || null,
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
      const { data: { user } } = await supabase.auth.getUser()
      const { data: provider } = await supabase
        .from('providers').select('id').eq('user_id', user!.id).single()
      const { data: created, error: err } = await supabase
        .from('clients')
        .insert({ ...payload, provider_id: provider?.id })
        .select().single()
      if (err) { setError(err.message); setSaving(false); return }
      setSaving(false)
      if (created) router.push(`/provider/clients/${created.id}`)
    } else {
      // Check if email changed — if so, update Supabase auth too
      const { data: existing } = await supabase
        .from('clients').select('email, user_id').eq('id', id).single()

      const { error: err } = await supabase.from('clients').update(payload).eq('id', id)
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
      body: JSON.stringify({ email: data.email, name: data.name, role: 'client', recordId: id }),
    })
    const result = await res.json()

    if (!res.ok) {
      setError(result.error || 'Failed to send invitation')
    } else {
      setInviteMsg(`Invitation sent to ${data.email}`)
      const { data: updated } = await supabase
        .from('clients').select('user_id').eq('id', id).single()
      if (updated?.user_id) setUserId(updated.user_id)
      setTimeout(() => setInviteMsg(''), 4000)
    }
    setInviting(false)
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/provider/clients" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isNew ? 'Add Client' : data.name || 'Client Details'}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {isNew ? 'Enter client details below' : 'Edit client information'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Section title="Client Details">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Client Name" {...f('name')} required half />
            <Field label="NDIS Number" {...f('ndis_number')} required half />
            <Field label="Email Address" {...f('email')} type="email" required half />
            <Field label="Mobile Phone" {...f('mobile')} required half />
            <Field label="Home Phone" {...f('phone')} half />
            <div className="col-span-2 border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Address</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Address Line 1" {...f('address_line1')} />
                <Field label="Address Line 2 (Optional)" {...f('address_line2')} />
                <Field label="Suburb" {...f('suburb')} half />
                <Field label="State" {...f('state')} half />
                <Field label="Postcode" {...f('postcode')} half />
              </div>
            </div>
            <TextArea label="Comments" {...f('comments')} />
          </div>
        </Section>

        {!isNew && nominees.length > 0 && (
          <Section title="Nominees">
            <ul className="divide-y divide-gray-50">
              {nominees.map((n: any) => (
                <li key={n.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{n.name}</p>
                    <p className="text-xs text-gray-400">{n.email}</p>
                  </div>
                </li>
              ))}
            </ul>
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
                    ? 'This client has a login account. Resend invite if they need a new link.'
                    : 'Send an invitation so this client can log in to CareTime.'}
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
                <p className="text-sm font-medium text-gray-900">
                  {active ? 'Active' : 'Inactive'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {active ? 'Client can be scheduled for activities' : 'Client is deactivated and hidden from active lists'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActive(a => !a)}
                className="text-gray-400 hover:text-blue-600 transition-colors"
              >
                {active
                  ? <ToggleRight size={36} className="text-blue-600" />
                  : <ToggleLeft size={36} />}
              </button>
            </div>
          </Section>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">⚠ {error}</div>
        )}

        <SaveBar saving={saving} saved={saved} onCancel={() => router.push('/provider/clients')} />
      </form>
    </div>
  )
}
