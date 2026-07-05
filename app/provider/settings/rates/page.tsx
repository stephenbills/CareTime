'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Info } from 'lucide-react'
import Link from 'next/link'

export default function RatesPage() {
  const [clientPct, setClientPct] = useState('100.00')
  const [workerPct, setWorkerPct] = useState('62.00')
  const [overrides, setOverrides] = useState<any[]>([])
  const [ndisItems, setNdisItems] = useState<any[]>([])
  const [providerId, setProviderId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: provider } = await supabase
        .from('providers').select('id, client_charge_pct, worker_pay_pct').eq('user_id', user.id).maybeSingle()
      if (provider) {
        setProviderId(provider.id)
        setClientPct(provider.client_charge_pct?.toString() || '100.00')
        setWorkerPct(provider.worker_pay_pct?.toString() || '62.00')

        const { data: items } = await supabase
          .from('ndis_line_items')
          .select('id, line_item_number, description, unit_price, client_charge_pct_override, worker_pay_pct_override')
          .eq('provider_id', provider.id)
          .eq('active', true)
          .order('line_item_number')
        setNdisItems(items || [])
        setOverrides(
          (items || [])
            .filter((i: any) => i.client_charge_pct_override != null || i.worker_pay_pct_override != null)
            .map((i: any) => ({
              id: i.id,
              clientPct: i.client_charge_pct_override?.toString() || '',
              workerPct: i.worker_pay_pct_override?.toString() || '',
            }))
        )
      }
    }
    load()
  }, [])

  function getOverride(id: string) {
    return overrides.find(o => o.id === id) || { clientPct: '', workerPct: '' }
  }
  function setOverride(id: string, field: 'clientPct' | 'workerPct', value: string) {
    setOverrides(prev => {
      const existing = prev.find(o => o.id === id)
      if (existing) return prev.map(o => o.id === id ? { ...o, [field]: value } : o)
      return [...prev, { id, clientPct: '', workerPct: '', [field]: value }]
    })
  }

  function effectiveRate(unitPrice: number, pct: string) {
    const p = parseFloat(pct)
    if (isNaN(p) || !unitPrice) return '—'
    return `$${(unitPrice * p / 100).toFixed(2)}/hr`
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!providerId) return
    setError('')
    setSaving(true)

    const { error: err } = await supabase.from('providers').update({
      client_charge_pct: parseFloat(clientPct),
      worker_pay_pct: parseFloat(workerPct),
    }).eq('id', providerId)

    if (err) { setError(err.message); setSaving(false); return }

    // Save overrides
    for (const ov of overrides) {
      await supabase.from('ndis_line_items').update({
        client_charge_pct_override: ov.clientPct ? parseFloat(ov.clientPct) : null,
        worker_pay_pct_override: ov.workerPct ? parseFloat(ov.workerPct) : null,
      }).eq('id', ov.id)
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  // Example calculation using a typical NDIS rate
  const exampleRate = 67.56
  const clientRate = (exampleRate * parseFloat(clientPct || '100') / 100).toFixed(2)
  const workerRate = (exampleRate * parseFloat(workerPct || '62') / 100).toFixed(2)
  const margin = (parseFloat(clientRate) - parseFloat(workerRate)).toFixed(2)

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/provider/settings" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing Rates</h1>
          <p className="text-gray-500 text-sm mt-0.5">Set how NDIS rates apply to clients and workers</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* How it works */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="flex gap-2">
            <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">How NDIS billing rates work</p>
              <p className="text-blue-700">The NDIA sets a maximum price per support item. You charge the client a percentage of that price, and pay your workers a percentage. The difference is your margin for admin, insurance, and overhead.</p>
            </div>
          </div>
        </div>

        {/* Rate percentages */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Default Rates</h2>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Charge Rate
              </label>
              <div className="relative">
                <input type="number" step="0.01" min="0" max="100"
                  value={clientPct} onChange={e => setClientPct(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">% of NDIS price charged to Client</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Worker Pay Rate
              </label>
              <div className="relative">
                <input type="number" step="0.01" min="0" max="100"
                  value={workerPct} onChange={e => setWorkerPct(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">% of NDIS price paid to Worker</p>
            </div>
          </div>

          {/* Live example */}
          <div className="bg-gray-50 rounded-lg p-4 text-sm">
            <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Example — Standard Weekday Support (${exampleRate}/hr NDIS price)</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">${clientRate}</p>
                <p className="text-xs text-gray-400">Charged to Client</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">${workerRate}</p>
                <p className="text-xs text-gray-400">Paid to Worker</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-green-600">${margin}</p>
                <p className="text-xs text-gray-400">Your Margin</p>
              </div>
            </div>
          </div>
        </div>

        {/* Per-item overrides */}
        {ndisItems.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Per-Item Overrides</h2>
            <p className="text-xs text-gray-400 mb-4">
              Leave blank to use the default rates above. Set a specific percentage to override for a particular support item.
            </p>
            <div className="space-y-3">
              {ndisItems.map(item => {
                const ov = getOverride(item.id)
                const clientEff = ov.clientPct || clientPct
                const workerEff = ov.workerPct || workerPct
                return (
                  <div key={item.id} className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-5">
                      <p className="text-xs font-medium text-gray-700 truncate">{item.line_item_number}</p>
                      <p className="text-xs text-gray-400 truncate">{item.description}</p>
                    </div>
                    <div className="col-span-2">
                      <div className="relative">
                        <input type="number" step="0.01" min="0" max="100"
                          value={ov.clientPct}
                          onChange={e => setOverride(item.id, 'clientPct', e.target.value)}
                          placeholder={clientPct}
                          className="w-full border border-gray-200 rounded px-2 py-1 pr-5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-300 text-xs">%</span>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="relative">
                        <input type="number" step="0.01" min="0" max="100"
                          value={ov.workerPct}
                          onChange={e => setOverride(item.id, 'workerPct', e.target.value)}
                          placeholder={workerPct}
                          className="w-full border border-gray-200 rounded px-2 py-1 pr-5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-300 text-xs">%</span>
                      </div>
                    </div>
                    <div className="col-span-3 text-right">
                      {item.unit_price && (
                        <p className="text-xs text-gray-400">
                          {effectiveRate(item.unit_price, clientEff)} client · {effectiveRate(item.unit_price, workerEff)} worker
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
              <div className="grid grid-cols-12 gap-3 text-xs text-gray-400 pt-1 border-t border-gray-50">
                <div className="col-span-5" />
                <div className="col-span-2 text-center">Client %</div>
                <div className="col-span-2 text-center">Worker %</div>
                <div className="col-span-3" />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">⚠ {error}</div>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : 'Save Rates'}
          </button>
          {saved && <span className="text-green-600 text-sm">✓ Saved</span>}
        </div>
      </form>
    </div>
  )
}
