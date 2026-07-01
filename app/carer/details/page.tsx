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
  name: '', email: '', mobile: '', home_phone: '',
  address_line1: '', suburb: '', state: '', postcode: '',
  bank_bsb: '', bank_account_number: '',
}

export default function CarerDetails() {
  const [data, setData] = useState<Record<string, string>>(EMPTY)
  const [carerId, setCarerId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: carer } = await supabase
        .from('carers').select('*').eq('user_id', user.id).maybeSingle()
      if (carer) {
        setCarerId(carer.id)
        const next: Record<string, string> = { ...EMPTY }
        for (const key of Object.keys(EMPTY)) {
          next[key] = carer[key] == null ? '' : String(carer[key])
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
      mobile: data.mobile || null,
      home_phone: data.home_phone || null,
      address_line1: data.address_line1 || null,
      suburb: data.suburb || null,
      state: data.state || null,
      postcode: data.postcode || null,
      bank_bsb: data.bank_bsb || null,
      bank_account_number: data.bank_account_number || null,
    }

    if (!carerId) { setError('Profile not found. Contact your Provider.'); setSaving(false); return }

    const { error: err } = await supabase.from('carers').update(payload).eq('id', carerId)
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
          <Field label="Home Phone" value={data.home_phone} onChange={v => set('home_phone', v)} />
        </div>

        {/* Address */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm">Address</h2>
          <Field label="Address Line 1" value={data.address_line1} onChange={v => set('address_line1', v)} />
          <Field label="Suburb" value={data.suburb} onChange={v => set('suburb', v)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="State" value={data.state} onChange={v => set('state', v)} />
            <Field label="Postcode" value={data.postcode} onChange={v => set('postcode', v)} />
          </div>
        </div>

        {/* Bank */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm">Payment Details</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="BSB" value={data.bank_bsb} onChange={v => set('bank_bsb', v)} />
            <Field label="Account Number" value={data.bank_account_number} onChange={v => set('bank_account_number', v)} />
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
