'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { notify } from '@/lib/email/notify'
import Link from 'next/link'
import { Pill, ListOrdered, ChevronRight } from 'lucide-react'

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

type Provider = { id: string; name: string; email: string | null }

export default function ClientDetails() {
  const [data, setData] = useState<Record<string, string>>(EMPTY)
  const [clientId, setClientId] = useState<string | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNotifyModal, setShowNotifyModal] = useState(false)
  const [notifyMode, setNotifyMode] = useState<'all' | 'selected'>('all')
  const [selectedProviderIds, setSelectedProviderIds] = useState<Set<string>>(new Set())
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

        const { data: links } = await supabase
          .from('provider_clients')
          .select('provider_id, providers(id, name, email)')
          .eq('client_id', client.id).eq('active', true)
        setProviders((links || []).map((l: any) => l.providers).filter(Boolean))
      }
      setLoading(false)
    }
    load()
  }, [])

  const set = (field: string, value: string) =>
    setData(prev => ({ ...prev, [field]: value }))

  function toggleProvider(id: string) {
    setSelectedProviderIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function chooseSelected() {
    setNotifyMode('selected')
    setSelectedProviderIds(new Set(providers.map(p => p.id)))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!clientId) { setError('Profile not found. Contact your Provider.'); return }

    if (providers.length > 1) {
      setNotifyMode('all')
      setShowNotifyModal(true)
      return
    }

    await performSave(providers)
  }

  async function performSave(providersToNotify: Provider[]) {
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

    const { error: err } = await supabase.from('clients').update(payload).eq('id', clientId!)
    if (err) { setError(err.message); setSaving(false); return }

    for (const p of providersToNotify) {
      if (p.email) {
        notify('details_updated', p.email, {
          recipientName: p.name,
          personName: data.name,
          personId: clientId,
          role: 'client',
          profileUrl: `${window.location.origin}/provider/clients/${clientId}`,
        })
      }
    }

    setSaving(false)
    setSaved(true)
    setShowNotifyModal(false)
    setTimeout(() => setSaved(false), 2500)
  }

  function handleConfirmNotify() {
    const toNotify = notifyMode === 'all'
      ? providers
      : providers.filter(p => selectedProviderIds.has(p.id))
    performSave(toNotify)
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

      <div className="mt-5 bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden">
        <Link href="/client/medical-instructions" className="flex items-center gap-3 px-4 py-3.5">
          <Pill size={18} className="text-gray-400 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-900 flex-1">Medical Instructions</span>
          <ChevronRight size={16} className="text-gray-300" />
        </Link>
        <Link href="/client/counters" className="flex items-center gap-3 px-4 py-3.5">
          <ListOrdered size={18} className="text-gray-400 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-900 flex-1">Counters</span>
          <ChevronRight size={16} className="text-gray-300" />
        </Link>
      </div>

      {showNotifyModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6 space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Notify your Providers?</h2>
              <p className="text-sm text-gray-600">
                You're linked to multiple Providers. Who should be notified about this update?
              </p>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" checked={notifyMode === 'all'} onChange={() => setNotifyMode('all')}
                    className="w-4 h-4 accent-blue-600" />
                  <span className="text-sm text-gray-700">All Providers</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" checked={notifyMode === 'selected'} onChange={chooseSelected}
                    className="w-4 h-4 accent-blue-600" />
                  <span className="text-sm text-gray-700">Selected Providers</span>
                </label>
                {notifyMode === 'selected' && (
                  <div className="space-y-2 pl-7">
                    {providers.map(p => (
                      <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={selectedProviderIds.has(p.id)}
                          onChange={() => toggleProvider(p.id)}
                          className="w-4 h-4 accent-blue-600 rounded" />
                        <span className="text-sm text-gray-700">{p.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
              <button type="button" onClick={() => setShowNotifyModal(false)}
                className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleConfirmNotify} disabled={saving}
                className="px-5 py-2 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : 'Save & Notify'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
