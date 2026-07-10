'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Check, Printer } from 'lucide-react'
import Link from 'next/link'

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export default function InvoiceDetailPage() {
  const { id } = useParams() as { id: string }
  const [invoice, setInvoice] = useState<any>(null)
  const [lineItems, setLineItems] = useState<any[]>([])
  const [clientName, setClientName] = useState('')
  const [providerName, setProviderName] = useState('')
  const [provider, setProvider] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: inv } = await supabase.from('invoices').select('*').eq('id', id).single()
      if (!inv) { setLoading(false); return }
      setInvoice(inv)

      const [{ data: items }, { data: client }, { data: prov }] = await Promise.all([
        supabase.from('invoice_line_items').select('*').eq('invoice_id', id).order('activity_date'),
        supabase.from('clients').select('name, email').eq('id', inv.client_id).single(),
        supabase.from('providers')
          .select('name, bank_name, bank_account_name, bank_bsb, bank_account_number, invoice_days_due')
          .eq('id', inv.provider_id).single(),
      ])
      setLineItems(items || [])
      setClientName(client?.name || '—')
      setProviderName(prov?.name || '—')
      setProvider(prov || null)
      setLoading(false)
    }
    load()
  }, [id])

  async function markAsPaid() {
    setMarking(true)
    const { error: err } = await supabase.from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', id)
    if (err) { alert(`Failed to mark invoice as paid: ${err.message}`); setMarking(false); return }
    const { error: actErr } = await supabase.from('activities')
      .update({ status: 'paid' })
      .eq('invoice_id', id)
    if (actErr) console.error('Failed to update linked activities to paid:', actErr)
    setInvoice((prev: any) => ({ ...prev, status: 'paid', paid_at: new Date().toISOString() }))
    setMarking(false)
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>
  if (!invoice) return <div className="p-8 text-red-500 text-sm">Invoice not found</div>

  const margin = (invoice.total_amount || 0) - (invoice.total_worker_cost || 0)

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/provider/invoices" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{invoice.invoice_number}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLE[invoice.status]}`}>
                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-0.5">
              {clientName} · {formatDate(invoice.period_start)} – {formatDate(invoice.period_end)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <Printer size={14} /> Print
          </button>
          {invoice.status !== 'paid' && (
            <button onClick={markAsPaid} disabled={marking}
              className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
              <Check size={14} /> {marking ? 'Marking…' : 'Mark as Paid'}
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Total Amount</p>
          <p className="text-2xl font-bold text-gray-900">${invoice.total_amount?.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Total Hours</p>
          <p className="text-2xl font-bold text-gray-900">{invoice.total_hours}h</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Worker Cost</p>
          <p className="text-2xl font-bold text-gray-900">${invoice.total_worker_cost?.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Your Margin</p>
          <p className="text-2xl font-bold text-green-600">${margin.toFixed(2)}</p>
        </div>
      </div>

      {/* Invoice header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase mb-1">From</p>
            <p className="font-semibold text-gray-900">{providerName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase mb-1">To</p>
            <p className="font-semibold text-gray-900">{clientName}</p>
          </div>
        </div>
        {invoice.sent_at && (
          <p className="text-xs text-gray-400 mt-4">Emailed {formatDate(invoice.sent_at)}</p>
        )}
        {invoice.sent_at && provider?.invoice_days_due != null && invoice.status !== 'paid' && (
          <p className="text-xs text-gray-400 mt-1">
            Payment due {formatDate(new Date(new Date(invoice.sent_at).getTime() + provider.invoice_days_due * 86400000).toISOString())}
          </p>
        )}
        {invoice.paid_at && (
          <p className="text-xs text-green-600 mt-1">Paid {formatDate(invoice.paid_at)}</p>
        )}
      </div>

      {/* Line items */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs">Date</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs">Activity</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs">Worker</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs">Time</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs">NDIS Item</th>
              <th className="text-right py-3 px-4 font-medium text-gray-500 text-xs">Hours</th>
              <th className="text-right py-3 px-4 font-medium text-gray-500 text-xs">Rate</th>
              <th className="text-right py-3 px-4 font-medium text-gray-500 text-xs">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map(li => (
              <tr key={li.id} className="border-b border-gray-50">
                <td className="py-3 px-4 text-gray-700">{formatDate(li.activity_date)}</td>
                <td className="py-3 px-4 text-gray-900 font-medium">{li.activity_title}</td>
                <td className="py-3 px-4 text-gray-600">{li.worker_name}</td>
                <td className="py-3 px-4 text-gray-500 text-xs">
                  {li.start_time ? formatTime(li.start_time) : '—'} – {li.end_time ? formatTime(li.end_time) : '—'}
                </td>
                <td className="py-3 px-4 text-gray-500 text-xs">{li.ndis_line_item_number || '—'}</td>
                <td className="py-3 px-4 text-gray-700 text-right">{li.duration_hours}h</td>
                <td className="py-3 px-4 text-gray-500 text-right text-xs">
                  ${li.ndis_unit_price?.toFixed(2)} × {li.client_charge_pct}%
                </td>
                <td className="py-3 px-4 text-gray-900 text-right font-semibold">${li.charge_amount?.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {invoice.subtotal_amount != null ? (
              <>
                <tr className="border-t border-gray-200">
                  <td colSpan={5} className="py-2 px-4 text-gray-500">Subtotal</td>
                  <td className="py-2 px-4 text-right text-gray-500">{invoice.total_hours}h</td>
                  <td className="py-2 px-4"></td>
                  <td className="py-2 px-4 text-right text-gray-700">${invoice.subtotal_amount?.toFixed(2)}</td>
                </tr>
                <tr>
                  <td colSpan={7} className="py-2 px-4 text-right text-gray-500">GST</td>
                  <td className="py-2 px-4 text-right text-gray-700">${invoice.gst_amount?.toFixed(2)}</td>
                </tr>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={7} className="py-3 px-4 text-right font-bold text-gray-900">TOTAL</td>
                  <td className="py-3 px-4 text-right font-bold text-gray-900">${invoice.total_amount?.toFixed(2)}</td>
                </tr>
              </>
            ) : (
              <tr className="bg-gray-50 border-t border-gray-200">
                <td colSpan={5} className="py-3 px-4 font-bold text-gray-900">Total</td>
                <td className="py-3 px-4 text-right font-bold text-gray-900">{invoice.total_hours}h</td>
                <td className="py-3 px-4"></td>
                <td className="py-3 px-4 text-right font-bold text-gray-900">${invoice.total_amount?.toFixed(2)}</td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      {/* Payment details */}
      {(provider?.bank_name || provider?.bank_account_name || provider?.bank_bsb || provider?.bank_account_number || provider?.invoice_days_due) && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mt-6 max-w-sm">
          <p className="text-xs text-gray-400 font-medium uppercase mb-3">Payment Details</p>
          <div className="space-y-1.5 text-sm">
            {provider?.bank_name && (
              <p className="text-gray-700"><span className="text-gray-400">Bank:</span> {provider.bank_name}</p>
            )}
            {provider?.bank_account_name && (
              <p className="text-gray-700"><span className="text-gray-400">Account Name:</span> {provider.bank_account_name}</p>
            )}
            {provider?.bank_bsb && (
              <p className="text-gray-700"><span className="text-gray-400">BSB:</span> {provider.bank_bsb}</p>
            )}
            {provider?.bank_account_number && (
              <p className="text-gray-700"><span className="text-gray-400">Account No:</span> {provider.bank_account_number}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
