'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Clock, CheckCircle, ChevronRight, Calendar } from 'lucide-react'
import Link from 'next/link'

const STATUS_COLORS: Record<string, string> = {
  awaiting_acceptance: 'bg-yellow-100 text-yellow-800',
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  awaiting_client_approval: 'bg-orange-100 text-orange-800',
  awaiting_payment_approval: 'bg-indigo-100 text-indigo-800',
  ready_for_payment: 'bg-green-100 text-green-800',
  paid: 'bg-gray-100 text-gray-600',
  rejected: 'bg-red-100 text-red-800',
}

const STATUS_LABELS: Record<string, string> = {
  awaiting_acceptance: 'Awaiting Acceptance',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  awaiting_client_approval: 'Needs Your Approval',
  awaiting_payment_approval: 'Approved',
  ready_for_payment: 'Ready for Payment',
  paid: 'Paid',
  rejected: 'Rejected',
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}
function getTimeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

export default function ClientDashboard() {
  const [client, setClient] = useState<any>(null)
  const [pendingApproval, setPendingApproval] = useState<any[]>([])
  const [upcoming, setUpcoming] = useState<any[]>([])
  const [workers, setWorkers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: clientData } = await supabase
        .from('clients').select('*').eq('user_id', user.id).maybeSingle()
      setClient(clientData)
      if (!clientData) { setLoading(false); return }

      const now = new Date()
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()
      const futureEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString()

      const [{ data: pending }, { data: future }, { data: wks }] = await Promise.all([
        supabase.from('activities').select('*')
          .eq('client_id', clientData.id)
          .eq('status', 'awaiting_client_approval')
          .order('actual_end_time', { ascending: true }),
        supabase.from('activities').select('*')
          .eq('client_id', clientData.id)
          .in('status', ['awaiting_acceptance', 'scheduled', 'in_progress'])
          .gte('start_time', now.toISOString())
          .lte('start_time', futureEnd)
          .order('start_time')
          .limit(10),
        supabase.from('carers').select('id, name'),
      ])

      setPendingApproval(pending || [])
      setUpcoming(future || [])
      setWorkers(Object.fromEntries((wks || []).map((w: any) => [w.id, w.name])))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-gray-400 text-sm">Loading…</div>
    </div>
  )

  if (!client) return (
    <div className="p-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        Your profile hasn't been set up yet. Please contact your Provider.
      </div>
    </div>
  )

  return (
    <div className="p-4 space-y-5">
      <div className="pt-1">
        <p className="text-gray-400 text-xs">Good {getTimeOfDay()}</p>
        <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
      </div>

      {/* Pending approvals — show prominently */}
      {pendingApproval.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-semibold text-gray-700">Needs Your Approval</h2>
            <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {pendingApproval.length}
            </span>
          </div>
          <div className="space-y-2">
            {pendingApproval.map(act => (
              <Link key={act.id} href={`/client/activities/${act.id}`}
                className="block bg-orange-50 border border-orange-200 rounded-2xl p-4 active:bg-orange-100 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="font-semibold text-gray-900 text-sm leading-tight">{act.title}</p>
                  <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 font-medium">
                    Needs Approval
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {act.actual_start_time ? formatDate(act.actual_start_time) : formatDate(act.start_time)} ·{' '}
                  {act.actual_start_time ? formatTime(act.actual_start_time) : formatTime(act.start_time)}
                  {act.actual_end_time ? ` – ${formatTime(act.actual_end_time)}` : ''}
                </p>
                {act.carer_id && (
                  <p className="text-xs text-gray-400 mt-0.5">Worker: {workers[act.carer_id] || '—'}</p>
                )}
                <div className="mt-3">
                  <span className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-xl font-medium">
                    Review & Approve →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Upcoming Activities</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {upcoming.map(act => (
              <Link key={act.id} href={`/client/activities/${act.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{act.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(act.start_time)} · {formatTime(act.start_time)}
                  </p>
                  {act.carer_id && (
                    <p className="text-xs text-gray-300 mt-0.5">{workers[act.carer_id] || '—'}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[act.status] || 'bg-gray-100 text-gray-500'}`}>
                    {STATUS_LABELS[act.status] || act.status}
                  </span>
                  <ChevronRight size={15} className="text-gray-300" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {pendingApproval.length === 0 && upcoming.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <Calendar size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No upcoming activities.</p>
        </div>
      )}
    </div>
  )
}
