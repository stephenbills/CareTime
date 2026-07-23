'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FileText, Loader2, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { useProviderId } from '@/lib/hooks/useProvider'
import { nextToOnFromChange, clampToOnToChange } from '@/lib/dateRange'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function calcDurationHours(act: any) {
  // Use actual times if set, otherwise scheduled times
  const startStr = act.actual_start_time || act.start_time
  const endStr = act.actual_end_time || act.end_time
  if (!startStr || !endStr) return 0
  const s = new Date(startStr)
  const e = new Date(endStr)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0
  let ms = e.getTime() - s.getTime()
  // Handle overnight: if end is before start, add 24 hours
  if (ms <= 0) ms += 24 * 60 * 60 * 1000
  return ms / 3600000
}


function lastMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 0)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

export default function GenerateInvoicesPage() {
  const range = lastMonthRange()
  const [periodStart, setPeriodStart] = useState(range.start)
  const [periodEnd, setPeriodEnd] = useState(range.end)
  const [clientId, setClientId] = useState('')
  const [clients, setClients] = useState<any[]>([])
  const [workers, setWorkers] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [reissuableCount, setReissuableCount] = useState(0)
  const [reissuing, setReissuing] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { providerId } = useProviderId()

  useEffect(() => {
    if (!providerId) return
    async function load() {
      const [{ data: clientLinks }, { data: workerLinks }] = await Promise.all([
        supabase.from('provider_clients')
          .select('client_id, clients(id, name)')
          .eq('provider_id', providerId).eq('active', true),
        supabase.from('provider_carers')
          .select('carer_id, carers(id, name)')
          .eq('provider_id', providerId),
      ])
      const cls = (clientLinks || []).map((l: any) => l.clients).filter(Boolean)
      const wks = (workerLinks || []).map((l: any) => l.carers).filter(Boolean)
      setClients(cls)
      setWorkers(Object.fromEntries(wks.map((w: any) => [w.id, w.name])))
    }
    load()
  }, [providerId])

  function handleFromChange(v: string) {
    setPeriodStart(v)
    setPeriodEnd(prev => nextToOnFromChange(v, prev))
  }
  function handleToChange(v: string) {
    setPeriodEnd(clampToOnToChange(v, periodStart))
  }

  async function checkReissuable() {
    if (!clientId) { setReissuableCount(0); return }
    const { data } = await supabase.from('activities')
      .select('invoice_id, invoices(status)')
      .eq('provider_id', providerId)
      .eq('client_id', clientId)
      .not('invoice_id', 'is', null)
      .gte('start_time', new Date(periodStart).toISOString())
      .lte('start_time', new Date(periodEnd + 'T23:59:59').toISOString())

    const nonPaidInvoiceIds = new Set(
      (data || [])
        .filter((a: any) => a.invoices?.status !== 'paid')
        .map((a: any) => a.invoice_id)
    )
    setReissuableCount(nonPaidInvoiceIds.size)
  }

  async function handleReissue() {
    setReissuing(true)
    setError('')

    const res = await fetch('/api/invoices/reissue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodStart, periodEnd, clientId }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Failed to reissue invoices')
      setReissuing(false)
      return
    }

    setReissuableCount(0)
    setReissuing(false)
    await handlePreview()
  }

  async function handlePreview() {
    setLoading(true)
    setError('')
    setPreview(null)
    checkReissuable()

    let query = supabase.from('activities')
      .select('*, clients(name), carers(name), ndis_line_items(line_item_number, description, unit_price)')
      // SECURITY: scoped to this provider — without this, a shared Worker/Client
      // linked to multiple Providers leaked the other Provider's activities into
      // this preview (the actual /api/invoices generation route was already scoped).
      .eq('provider_id', providerId)
      .gte('start_time', new Date(periodStart).toISOString())
      .lte('start_time', new Date(periodEnd + 'T23:59:59').toISOString())
      .is('invoice_id', null)
      .in('status', ['awaiting_payment_approval', 'ready_for_payment'])
      .order('start_time')

    if (clientId) query = query.eq('client_id', clientId)

    const { data, error: err } = await query
    if (err) { setError(err.message); setLoading(false); return }

    if (!data || data.length === 0) {
      setError('No billable activities found for this period. Activities must be approved by the Client and not yet invoiced.')
      setLoading(false)
      return
    }

    setPreview(data)
    setLoading(false)
  }

  async function handleGenerate() {
    setGenerating(true)
    setError('')

    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodStart, periodEnd, clientId: clientId || null }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Failed to generate invoices')
      setGenerating(false)
      return
    }

    setResult(data)
    setGenerating(false)
  }

  // Group preview by client
  const previewByClient: Record<string, { name: string; acts: any[] }> = {}
  if (preview) {
    for (const act of preview) {
      const cid = act.client_id
      if (!previewByClient[cid]) {
        previewByClient[cid] = { name: (act.clients as any)?.name || '—', acts: [] }
      }
      previewByClient[cid].acts.push(act)
    }
  }

  // Success screen
  if (result) {
    return (
      <div className="p-8 max-w-2xl">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText size={24} className="text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invoices Generated</h1>
          <p className="text-gray-500 text-sm mb-6">
            {result.invoiceCount} invoice{result.invoiceCount !== 1 ? 's' : ''} created and emailed to client{result.invoiceCount !== 1 ? 's' : ''}.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/provider/invoices"
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              View Invoices
            </Link>
            <button onClick={() => { setResult(null); setPreview(null) }}
              className="px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              Generate More
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/provider/invoices" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Generate Invoices</h1>
          <p className="text-gray-500 text-sm mt-0.5">Create invoices from approved activities <span className="text-gray-300 text-xs">v2</span></p>
        </div>
      </div>

      {/* Step 1: Select period and client */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Invoice Period</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
            <input type="date" value={periodStart} onChange={e => handleFromChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input type="date" value={periodEnd} onChange={e => handleToChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">All Clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <button onClick={handlePreview} disabled={loading}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {loading ? 'Loading…' : 'Preview Activities'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">⚠ {error}</div>
      )}

      {reissuableCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 flex items-center justify-between gap-3">
          <p className="text-sm text-amber-800">
            {reissuableCount} invoice{reissuableCount !== 1 ? 's' : ''} already generated for this Client in this range.
          </p>
          <button onClick={handleReissue} disabled={reissuing}
            className="flex items-center gap-1.5 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors flex-shrink-0">
            <RotateCcw size={14} />
            {reissuing ? 'Reissuing…' : 'Reissue & Regenerate'}
          </button>
        </div>
      )}

      {/* Step 2: Preview */}
      {preview && preview.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              Preview — {preview.length} activit{preview.length !== 1 ? 'ies' : 'y'} across {Object.keys(previewByClient).length} client{Object.keys(previewByClient).length !== 1 ? 's' : ''}
            </h2>
            <button onClick={handleGenerate} disabled={generating}
              className="flex items-center gap-2 bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
              {generating ? <><Loader2 size={14} className="animate-spin" /> Generating…</> : '✓ Generate & Email Invoices'}
            </button>
          </div>

          {Object.entries(previewByClient).map(([cid, { name, acts }]) => {
            const totalHours = acts.reduce((sum, a) => sum + calcDurationHours(a), 0)

            return (
              <div key={cid} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <p className="font-semibold text-gray-900 text-sm">{name}</p>
                  <p className="text-xs text-gray-500">{acts.length} activit{acts.length !== 1 ? 'ies' : 'y'} · {totalHours.toFixed(1)}h</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-50">
                      <th className="text-left py-2 px-4 text-xs font-medium text-gray-400">Date</th>
                      <th className="text-left py-2 px-4 text-xs font-medium text-gray-400">Activity</th>
                      <th className="text-left py-2 px-4 text-xs font-medium text-gray-400">Worker</th>
                      <th className="text-left py-2 px-4 text-xs font-medium text-gray-400">Time</th>
                      <th className="text-left py-2 px-4 text-xs font-medium text-gray-400">NDIS Item</th>
                      <th className="text-right py-2 px-4 text-xs font-medium text-gray-400">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acts.map((a: any) => {
                      const hrs = calcDurationHours(a).toFixed(1)
                      const ndis = a.ndis_line_items as any
                      return (
                        <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-4 text-gray-700">{formatDate(a.start_time)}</td>
                          <td className="py-2 px-4 text-gray-900 font-medium">{a.title}</td>
                          <td className="py-2 px-4 text-gray-600">{(a.carers as any)?.name || '—'}</td>
                          <td className="py-2 px-4 text-gray-500 text-xs">
                            {formatTime(a.start_time)} – {formatTime(a.end_time)}
                            {a.actual_start_time && (
                              <span className="block text-[10px] text-orange-400">
                                actual: {formatTime(a.actual_start_time)} – {formatTime(a.actual_end_time || a.end_time)}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-4 text-gray-500 text-xs truncate max-w-[160px]">
                            {ndis ? `${ndis.line_item_number}` : '—'}
                          </td>
                          <td className="py-2 px-4 text-gray-700 text-right">{hrs}h</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
