'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const STATUS_COLORS: Record<string, string> = {
  awaiting_client_approval: 'bg-orange-100 text-orange-700',
  awaiting_payment_approval: 'bg-indigo-100 text-indigo-700',
  ready_for_payment: 'bg-green-100 text-green-700',
  paid: 'bg-gray-100 text-gray-600',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-400',
}
const STATUS_LABELS: Record<string, string> = {
  awaiting_client_approval: 'Awaiting Approval',
  awaiting_payment_approval: 'Awaiting Payment',
  ready_for_payment: 'Ready for Payment',
  paid: 'Paid',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export default function CarerHistory() {
  const [activities, setActivities] = useState<any[]>([])
  const [clients, setClients] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: carer } = await supabase
        .from('carers').select('id').eq('user_id', user.id).maybeSingle()
      if (!carer) { setLoading(false); return }

      const [{ data: acts }, { data: cls }] = await Promise.all([
        supabase.from('activities').select('*')
          .eq('carer_id', carer.id)
          .in('status', ['awaiting_client_approval', 'awaiting_payment_approval', 'ready_for_payment', 'paid', 'rejected', 'cancelled'])
          .order('start_time', { ascending: false }),
        supabase.from('clients').select('id, name'),
      ])
      setActivities(acts || [])
      setClients(Object.fromEntries((cls || []).map((c: any) => [c.id, c.name])))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-gray-400 text-sm">Loading…</div>
    </div>
  )

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-gray-900 pt-1">History</h1>

      {activities.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-gray-400 text-sm">No completed activities yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map(act => (
            <Link key={act.id} href={`/carer/activities/${act.id}`}
              className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-4 active:bg-gray-50">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="font-semibold text-gray-900 text-sm leading-tight">{act.title}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 font-medium ${STATUS_COLORS[act.status] || 'bg-gray-100 text-gray-500'}`}>
                  {STATUS_LABELS[act.status] || act.status}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {formatDate(act.start_time)} · {formatTime(act.start_time)} – {formatTime(act.end_time)}
              </p>
              {act.client_id && (
                <p className="text-xs text-gray-400 mt-0.5">{clients[act.client_id] || '—'}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
