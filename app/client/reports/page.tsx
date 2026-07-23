'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { addDays, nextToOnFromChange, clampToOnToChange } from '@/lib/dateRange'

const STATUS_COLORS: Record<string, string> = {
  awaiting_acceptance: 'bg-yellow-100 text-yellow-800',
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  awaiting_client_approval: 'bg-orange-100 text-orange-800',
  awaiting_payment_approval: 'bg-indigo-100 text-indigo-800',
  ready_for_payment: 'bg-green-100 text-green-800',
  paid: 'bg-gray-100 text-gray-600',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-400',
}
const STATUS_LABELS: Record<string, string> = {
  awaiting_acceptance: 'Awaiting Acceptance',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  awaiting_client_approval: 'Awaiting Your Approval',
  awaiting_payment_approval: 'Awaiting Payment Approval',
  ready_for_payment: 'Ready for Payment',
  paid: 'Paid',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })
}

// Same duration/cost formula as app/api/invoices/route.ts, so a Client sees
// the same numbers that end up on their actual invoice.
function calcDurationHours(act: any) {
  const startStr = act.actual_start_time || act.start_time
  const endStr = act.actual_end_time || act.end_time
  const s = new Date(startStr)
  const e = new Date(endStr)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0
  let ms = e.getTime() - s.getTime()
  if (ms <= 0) ms += 24 * 60 * 60 * 1000
  return Math.round((ms / 3600000) * 100) / 100
}

function calcCost(act: any) {
  const ndis = act.ndis_line_items
  const provider = act.providers
  const unitPrice = ndis?.unit_price || 0
  const clientPct = ndis?.client_charge_pct_override ?? provider?.client_charge_pct ?? 100
  const hours = calcDurationHours(act)
  return Math.round(((unitPrice * clientPct) / 100) * hours * 100) / 100
}

function calcGst(act: any, cost: number) {
  const gstRate = act.providers?.gst_rate ?? 10
  return Math.round(cost * (gstRate / 100) * 100) / 100
}

export default function ClientReportsPage() {
  const [dateFrom, setDateFrom] = useState(addDays(todayStr(), -7))
  const [dateTo, setDateTo] = useState(todayStr())
  const [activities, setActivities] = useState<any[]>([])
  const [multiProvider, setMultiProvider] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: client } = await supabase
      .from('clients').select('id').eq('user_id', user.id).maybeSingle()
    if (!client) { setLoading(false); return }

    const { data: links } = await supabase
      .from('provider_clients').select('provider_id').eq('client_id', client.id)
    setMultiProvider((links?.length || 0) > 1)

    const { data } = await supabase
      .from('activities')
      .select('*, carers(name), providers(name, client_charge_pct, gst_rate), ndis_line_items(line_item_number, description, unit_price, client_charge_pct_override)')
      .eq('client_id', client.id)
      .gte('start_time', new Date(dateFrom).toISOString())
      .lte('start_time', new Date(dateTo + 'T23:59:59').toISOString())
      .order('start_time', { ascending: false })

    setActivities(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [dateFrom, dateTo])

  function handleFromChange(v: string) {
    setDateFrom(v)
    setDateTo(prev => nextToOnFromChange(v, prev))
  }
  function handleToChange(v: string) {
    setDateTo(clampToOnToChange(v, dateFrom))
  }

  let subtotal = 0, gst = 0
  for (const act of activities) {
    const cost = calcCost(act)
    subtotal += cost
    gst += calcGst(act, cost)
  }
  subtotal = Math.round(subtotal * 100) / 100
  gst = Math.round(gst * 100) / 100
  const total = Math.round((subtotal + gst) * 100) / 100

  return (
    <div className="p-4 pb-8">
      <div className="flex items-center gap-3 pt-1 mb-5">
        <Link href="/client/details" className="p-1 text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-400 text-xs mt-0.5">Your shifts over a date range</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">From</label>
          <input type="date" value={dateFrom} onChange={e => handleFromChange(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">To</label>
          <input type="date" value={dateTo} onChange={e => handleToChange(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
      ) : activities.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No shifts in this range.</p>
      ) : (
        <>
          <div className="space-y-3 mb-4">
            {activities.map(act => {
              const startStr = act.actual_start_time || act.start_time
              const endStr = act.actual_end_time || act.end_time
              const ndis = act.ndis_line_items
              const cost = calcCost(act)
              return (
                <div key={act.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{formatDateDay(startStr)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatTime(startStr)} – {formatTime(endStr)}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_COLORS[act.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[act.status] || act.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{act.title}</p>
                  <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
                    <span>
                      {act.carers?.name || 'Unassigned'}
                      {multiProvider && act.providers?.name ? ` · ${act.providers.name}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                    <span className="text-xs text-gray-400 truncate mr-2">
                      {ndis ? `${ndis.line_item_number} — ${ndis.description}` : 'No NDIS item'}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 flex-shrink-0">${cost.toFixed(2)}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-700">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">GST</span>
              <span className="text-gray-700">${gst.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm font-semibold pt-1.5 border-t border-gray-50">
              <span className="text-gray-900">Total</span>
              <span className="text-gray-900">${total.toFixed(2)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
