'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, FileText, Check, Eye } from 'lucide-react'
import Link from 'next/link'
import { useProviderId } from '@/lib/hooks/useProvider'

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [clients, setClients] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<'unpaid' | 'all'>('unpaid')
  const [search, setSearch] = useState('')
  const [marking, setMarking] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { providerId } = useProviderId()
  const supabase = createClient()

  useEffect(() => { if (providerId) load() }, [providerId])

  async function load() {
    if (!providerId) return
    const [{ data: invs }, { data: cls }] = await Promise.all([
      supabase.from('invoices').select('*').eq('provider_id', providerId).order('created_at', { ascending: false }),
      supabase.from('provider_clients').select('client_id, clients(id, name)').eq('provider_id', providerId).eq('active', true),
    ])
    setInvoices(invs || [])
    const clientList = (cls || []).map((pc: any) => pc.clients).filter(Boolean)
    setClients(Object.fromEntries(clientList.map((c: any) => [c.id, c.name])))
    setLoading(false)
  }

  async function markAsPaid(invoiceId: string) {
    setMarking(invoiceId)
    const { error: err } = await supabase.from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', invoiceId)
    if (err) { alert(`Failed to mark invoice as paid: ${err.message}`); setMarking(null); return }
    // Also update linked activities
    const { error: actErr } = await supabase.from('activities')
      .update({ status: 'paid' })
      .eq('invoice_id', invoiceId)
    if (actErr) console.error('Failed to update linked activities to paid:', actErr)
    await load()
    setMarking(null)
  }

  const filtered = invoices
    .filter(inv => filter === 'all' || inv.status !== 'paid')
    .filter(inv => {
      if (!search) return true
      const clientName = clients[inv.client_id] || ''
      return clientName.toLowerCase().includes(search.toLowerCase()) ||
        inv.invoice_number?.toLowerCase().includes(search.toLowerCase())
    })

  const totalUnpaid = invoices
    .filter(i => i.status !== 'paid')
    .reduce((sum, i) => sum + (i.total_amount || 0), 0)

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 text-sm mt-1">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/provider/invoices/generate"
          className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={15} /> Generate Invoices
        </Link>
      </div>

      {/* Unpaid summary */}
      {totalUnpaid > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {invoices.filter(i => i.status !== 'paid').length} unpaid invoice{invoices.filter(i => i.status !== 'paid').length !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-amber-600 mt-0.5">Total outstanding: ${totalUnpaid.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Tabs + search */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['unpaid', 'all'] as const).map(tab => (
            <button key={tab} onClick={() => setFilter(tab)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                filter === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>{tab === 'unpaid' ? 'Unpaid' : 'All'}</button>
          ))}
        </div>
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search invoices…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <FileText size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">
            {filter === 'unpaid' ? 'No unpaid invoices' : 'No invoices yet'}
          </p>
          <p className="text-gray-400 text-xs mt-1">Generate invoices from approved activities</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs">Invoice #</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs">Client</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs">Period</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500 text-xs">Hours</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500 text-xs">Amount</th>
                <th className="text-center py-3 px-4 font-medium text-gray-500 text-xs">Status</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 font-medium text-gray-900">{inv.invoice_number}</td>
                  <td className="py-3 px-4 text-gray-700">{clients[inv.client_id] || '—'}</td>
                  <td className="py-3 px-4 text-gray-500 text-xs">
                    {formatDate(inv.period_start)} – {formatDate(inv.period_end)}
                  </td>
                  <td className="py-3 px-4 text-gray-700 text-right">{inv.total_hours}h</td>
                  <td className="py-3 px-4 text-gray-900 text-right font-semibold">${inv.total_amount?.toFixed(2)}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLE[inv.status] || 'bg-gray-100 text-gray-500'}`}>
                      {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/provider/invoices/${inv.id}`}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="View invoice">
                        <Eye size={15} />
                      </Link>
                      {inv.status !== 'paid' && (
                        <button onClick={() => markAsPaid(inv.id)}
                          disabled={marking === inv.id}
                          title="Mark as paid"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50">
                          <Check size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
