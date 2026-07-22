'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { Field, TextArea, Section, ReadOnlyField, SaveBar } from '@/components/FormFields'
import { ArrowLeft, ToggleLeft, ToggleRight, Mail } from 'lucide-react'
import Link from 'next/link'
import { useProviderId } from '@/lib/hooks/useProvider'

const EMPTY_LINK = { notes: '', start_date: '', end_date: '' }

export default function ClientDetailPage() {
  const [client, setClient] = useState<any>(null)
  const [linkId, setLinkId] = useState<string | null>(null)
  const [link, setLink] = useState<Record<string, string>>(EMPTY_LINK)
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [nominees, setNominees] = useState<any[]>([])
  const [medicalInstructions, setMedicalInstructions] = useState<any[]>([])
  const [counters, setCounters] = useState<any[]>([])
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { providerId } = useProviderId()
  const supabase = createClient()

  useEffect(() => {
    if (id === 'new') { router.replace('/provider/clients/new'); return }
    if (!providerId) return
    async function load() {
      const { data: c } = await supabase.from('clients').select('*').eq('id', id).single()
      setClient(c)

      const { data: pc } = await supabase
        .from('provider_clients').select('*')
        .eq('provider_id', providerId).eq('client_id', id).maybeSingle()
      if (pc) {
        setLinkId(pc.id)
        setActive(pc.active ?? true)
        setLink({
          notes: pc.notes || '',
          start_date: pc.start_date || '',
          end_date: pc.end_date || '',
        })
      }

      const { data: noms } = await supabase
        .from('client_nominees')
        .select('nominees(id, name, email)')
        .eq('client_id', id)
      setNominees(noms?.map((n: any) => n.nominees).filter(Boolean) ?? [])

      const [{ data: mi }, { data: ctrs }] = await Promise.all([
        supabase.from('medical_instructions').select('id, title, instructions')
          .eq('client_id', id).eq('active', true).order('title'),
        supabase.from('client_counters').select('id, title')
          .eq('client_id', id).eq('active', true).order('title'),
      ])
      setMedicalInstructions(mi || [])
      setCounters(ctrs || [])

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
    if (!linkId) { setError('This client is not linked to your organisation'); return }
    setSaving(true)

    const payload = {
      active,
      notes: link.notes || null,
      start_date: link.start_date || null,
      end_date: link.end_date || null,
    }

    const { error: err } = await supabase.from('provider_clients').update(payload).eq('id', linkId)
    if (err) { setError(err.message); setSaving(false); return }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleInvite() {
    if (!client?.email) { setError('Email address is required to send an invitation'); return }
    setInviting(true)
    setInviteMsg('')
    setError('')

    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: client.email, name: client.name, role: 'client', recordId: id }),
    })
    const result = await res.json()

    if (!res.ok) {
      setError(result.error || 'Failed to send invitation')
    } else {
      setInviteMsg(`Invitation sent to ${client.email}`)
      const { data: updated } = await supabase
        .from('clients').select('user_id').eq('id', id).single()
      if (updated?.user_id) setClient((c: any) => ({ ...c, user_id: updated.user_id }))
      setTimeout(() => setInviteMsg(''), 4000)
    }
    setInviting(false)
  }

  if (loading || !client) return <div className="p-8 text-gray-400 text-sm">Loading…</div>

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/provider/clients" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{client.name || 'Client Details'}</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Personal details are managed by the client. You can edit your own notes below.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Section title="Personal Details">
          <div className="grid grid-cols-2 gap-4">
            <ReadOnlyField label="Client Name" value={client.name} />
            <ReadOnlyField label="NDIS Number" value={client.ndis_number} />
            <ReadOnlyField label="Email Address" value={client.email} />
            <ReadOnlyField label="Mobile Phone" value={client.mobile} />
            <ReadOnlyField label="Home Phone" value={client.phone} />
            <div className="col-span-2 border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Address</p>
              <div className="grid grid-cols-2 gap-4">
                <ReadOnlyField label="Address Line 1" value={client.address_line1} />
                <ReadOnlyField label="Address Line 2" value={client.address_line2} />
                <ReadOnlyField label="Suburb" value={client.suburb} />
                <ReadOnlyField label="State" value={client.state} />
                <ReadOnlyField label="Postcode" value={client.postcode} />
              </div>
            </div>
          </div>
        </Section>

        <Section title="Your Notes">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Date" {...f('start_date')} type="date" half />
            <Field label="End Date" {...f('end_date')} type="date" half />
            <TextArea label="Notes" {...f('notes')} />
          </div>
        </Section>

        {nominees.length > 0 && (
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

        {medicalInstructions.length > 0 && (
          <Section title="Medical Instructions">
            <p className="text-xs text-gray-400 -mt-2 mb-3">Managed by the client — attached to Activities for Workers to action</p>
            <ul className="divide-y divide-gray-50">
              {medicalInstructions.map((mi: any) => (
                <li key={mi.id} className="py-2.5">
                  <p className="text-sm font-medium text-gray-900">{mi.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{mi.instructions}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {counters.length > 0 && (
          <Section title="Counters">
            <p className="text-xs text-gray-400 -mt-2 mb-3">Managed by the client — tallied by Workers on every shift</p>
            <ul className="divide-y divide-gray-50">
              {counters.map((c: any) => (
                <li key={c.id} className="py-2.5">
                  <p className="text-sm font-medium text-gray-900">{c.title}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="App Access">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {client.user_id ? 'Invited' : 'Not yet invited'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {client.user_id
                  ? 'This client has a login account. Resend invite if they need a new link.'
                  : 'Send an invitation so this client can log in to CareTime.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleInvite}
              disabled={inviting || !client.email}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Mail size={14} />
              {inviting ? 'Sending…' : client.user_id ? 'Resend Invite' : 'Send Invite'}
            </button>
          </div>
          {inviteMsg && (
            <p className="text-green-600 text-sm mt-2">✓ {inviteMsg}</p>
          )}
        </Section>

        <Section title="Account Status">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {active ? 'Active' : 'Inactive'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {active
                  ? 'Client can be scheduled for activities with your organisation'
                  : 'Client is deactivated and hidden from your active lists'}
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

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">⚠ {error}</div>
        )}

        <SaveBar saving={saving} saved={saved} onCancel={() => router.push('/provider/clients')} />
      </form>
    </div>
  )
}
