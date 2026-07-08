'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

function Field({ label, value, onChange, type = 'text', required = false }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        required={required}
        className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
    </div>
  )
}

const EMPTY = {
  name: '', email: '', phone: '', mobile: '',
  address_line1: '', address_line2: '', suburb: '', state: '', postcode: '',
  ndis_number: '',
}

export default function ClientDetails() {
  const [data, setData] = useState<Record<string, string>>(EMPTY)
  const [clientId, setClientId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: client } = await supabase
        .from('clients').select('*').eq('user_id', user.id).maybeSingle()
      if (client) {
        setClientId(client.id)
        const next: Record<string, string> = { ...EMPTY }
        for (const key of Object.keys(EMPTY)) {
          next[key] = client[key] == null ? '' : String(client[key])
        }
        setData(next)
      }
      setLoading(false)
    }
    load()
  }, [])

  const set = (field: string, value: string) =>
    setData(prev => ({ ...prev, [field]: value }))

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    const payload = {
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
    }

    if (!clientId) { setError('Profile not found. Contact your Provider.'); setSaving(false); return }

    const { error: err } = await supabase.from('clients').update(payload).eq('id', clientId)
    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-gray-400 text-sm">Loading…</div>
    </div>
  )

  return (
    <div className="p-4 pb-8">
      <h1 className="text-xl font-bold text-gray-900 pt-1 mb-5">My Details</h1>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Personal */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm">Personal Details</h2>
          <Field label="Full Name" value={data.name} onChange={v => set('name', v)} required />
          <Field label="Email Address" value={data.email} onChange={v => set('email', v)} type="email" required />
          <Field label="Mobile Phone" value={data.mobile} onChange={v => set('mobile', v)} required />
          <Field label="Home Phone" value={data.phone} onChange={v => set('phone', v)} />
          <Field label="NDIS Number" value={data.ndis_number} onChange={v => set('ndis_number', v)} />
        </div>

        {/* Address */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm">Address</h2>
          <Field label="Address Line 1" value={data.address_line1} onChange={v => set('address_line1', v)} />
          <Field label="Address Line 2" value={data.address_line2} onChange={v => set('address_line2', v)} />
          <Field label="Suburb" value={data.suburb} onChange={v => set('suburb', v)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="State" value={data.state} onChange={v => set('state', v)} />
            <Field label="Postcode" value={data.postcode} onChange={v => set('postcode', v)} />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl px-4 py-3">⚠ {error}</div>
        )}

        <button type="submit" disabled={saving}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl text-sm font-semibold disabled:opacity-50 active:bg-blue-700 transition-colors">
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}
