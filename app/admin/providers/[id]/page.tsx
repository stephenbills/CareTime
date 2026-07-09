'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function ProviderFormPage() {
  const params = useParams()
  const id = params?.id as string | undefined
  const isNew = !id || id === 'new'
  const router = useRouter()
  const supabase = createClient()

  const [data, setData] = useState({
    name: '', email: '', phone: '', abn: '',
    address_line1: '', suburb: '', state: 'NSW', postcode: '',
    client_charge_pct: '100', worker_pay_pct: '62',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(!isNew)

  useEffect(() => {
    if (!isNew && id) {
      supabase.from('providers').select('*').eq('id', id).single().then(({ data: p, error }) => {
        if (error) setError(error.message)
        if (p) setData({
          name: p.name || '', email: p.email || '', phone: p.phone || '', abn: p.abn || '',
          address_line1: p.address_line1 || '', suburb: p.suburb || '',
          state: p.state || 'NSW', postcode: p.postcode || '',
          client_charge_pct: p.client_charge_pct?.toString() || '100',
          worker_pay_pct: p.worker_pay_pct?.toString() || '62',
        })
        setLoading(false)
      })
    }
  }, [id])

  function set(field: string, value: string) {
    setData(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!data.name.trim()) { setError('Provider name is required'); return }
    if (!data.email.trim()) { setError('Email is required'); return }
    setSaving(true); setError('')

    const payload = {
      name: data.name.trim(),
      email: data.email.trim(),
      phone: data.phone || null,
      abn: data.abn || null,
      address_line1: data.address_line1 || null,
      suburb: data.suburb || null,
      state: data.state || null,
      postcode: data.postcode || null,
      client_charge_pct: parseFloat(data.client_charge_pct) || 100,
      worker_pay_pct: parseFloat(data.worker_pay_pct) || 62,
    }

    if (isNew) {
      const { error: err } = await supabase.from('providers').insert(payload)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('providers').update(payload).eq('id', id)
      if (err) { setError(err.message); setSaving(false); return }
    }

    router.push('/admin/providers')
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/providers" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={18} /></Link>
        <h1 className="text-2xl font-bold text-gray-900">{isNew ? 'Add Provider' : 'Edit Provider'}</h1>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Organisation Details</h2>
          {[
            { label: 'Organisation Name', field: 'name', required: true },
            { label: 'Email', field: 'email', type: 'email', required: true },
            { label: 'Phone', field: 'phone', type: 'tel' },
            { label: 'ABN', field: 'abn' },
          ].map(({ label, field, type, required }) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <input type={type || 'text'} value={(data as any)[field]}
                onChange={e => set(field, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Address</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input type="text" value={data.address_line1} onChange={e => set('address_line1', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Suburb</label>
              <input type="text" value={data.suburb} onChange={e => set('suburb', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <select value={data.state} onChange={e => set('state', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['ACT','NSW','NT','QLD','SA','TAS','VIC','WA'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
              <input type="text" value={data.postcode} onChange={e => set('postcode', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Default Rates</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Charge %</label>
              <input type="number" step="0.01" value={data.client_charge_pct} onChange={e => set('client_charge_pct', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Worker Pay %</label>
              <input type="number" step="0.01" value={data.worker_pay_pct} onChange={e => set('worker_pay_pct', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">⚠ {error}</div>}

        <div className="flex gap-3">
          <button type="submit" disabled={saving}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : isNew ? 'Create Provider' : 'Save Changes'}
          </button>
          <button type="button" onClick={() => router.push('/admin/providers')}
            className="px-5 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
        </div>
      </form>
    </div>
  )
}
