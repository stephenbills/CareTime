'use client'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Field, TextArea, Section, SaveBar } from '@/components/FormFields'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const EMPTY = {
  name: '', email: '', phone: '', mobile: '',
  address_line1: '', address_line2: '', suburb: '', state: '', postcode: '',
  ndis_number: '', comments: '',
}

export default function NewClientPage() {
  const [data, setData] = useState<Record<string, string>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const set = useCallback((field: string, value: string) => {
    setData(prev => ({ ...prev, [field]: value }))
  }, [])

  const f = (field: string) => ({ value: data[field] ?? '', onChange: (v: string) => set(field, v) })

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!data.email.trim()) { setError('Email is required to send the invitation'); return }
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const { data: provider } = await supabase
      .from('providers').select('id').eq('user_id', user!.id).single()

    // Check if a client with this email already exists
    const { data: existing } = await supabase
      .from('clients').select('id, name').eq('email', data.email.trim()).maybeSingle()

    let clientId: string

    if (existing) {
      // Client already exists — just link to this provider
      clientId = existing.id

      // Check if already linked
      const { data: link } = await supabase
        .from('provider_clients')
        .select('id')
        .eq('provider_id', provider!.id)
        .eq('client_id', clientId)
        .maybeSingle()

      if (link) {
        setError(`${existing.name} is already linked to your organisation`)
        setSaving(false)
        return
      }

      await supabase.from('provider_clients').insert({
        provider_id: provider!.id,
        client_id: clientId,
        active: true,
        notes: data.comments || null,
      })
    } else {
      // Create new client record
      const payload = {
        name: data.name, email: data.email || null, phone: data.phone || null,
        mobile: data.mobile || null, address_line1: data.address_line1 || null,
        address_line2: data.address_line2 || null, suburb: data.suburb || null,
        state: data.state || null, postcode: data.postcode || null,
        ndis_number: data.ndis_number || null, provider_id: provider?.id,
      }

      const { data: created, error: err } = await supabase
        .from('clients').insert(payload).select().single()
      if (err) { setError(err.message); setSaving(false); return }

      clientId = created.id

      // Create junction table entry — provider-specific notes live here, not on clients.comments
      if (provider?.id) {
        await supabase.from('provider_clients').insert({
          provider_id: provider.id,
          client_id: clientId,
          active: true,
          notes: data.comments || null,
        })
      }

      // Send invite for new clients only
      await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, name: data.name, role: 'client', recordId: clientId }),
      })
    }

    setSaving(false)
    router.push(`/provider/clients/${clientId}`)
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/provider/clients" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add Client</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            An invitation email will be sent to the client to set their password
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
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">⚠ {error}</div>
        )}
        <SaveBar saving={saving} saved={false} onCancel={() => router.push('/provider/clients')} />
      </form>
    </div>
  )
}
