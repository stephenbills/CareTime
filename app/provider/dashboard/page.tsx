'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, UserCheck, Activity, Clock, UserX, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { notify } from '@/lib/email/notify'
import { useProviderId } from '@/lib/hooks/useProvider'

const STATUS_COLORS: Record<string, string> = {
  awaiting_acceptance: 'bg-yellow-100 text-yellow-800',
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  awaiting_client_approval: 'bg-orange-100 text-orange-800',
  awaiting_payment_approval: 'bg-indigo-100 text-indigo-800',
  ready_for_payment: 'bg-green-100 text-green-800',
  paid: 'bg-gray-100 text-gray-600',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
}

export default function DashboardPage() {
  const [stats, setStats] = useState({ clients: 0, workers: 0, activities: 0, pending: 0 })
  const [unassigned, setUnassigned] = useState<any[]>([])
  const [awaitingPayment, setAwaitingPayment] = useState<any[]>([])
  const [clientMap, setClientMap] = useState<Record<string, string>>({})
  const [workerMap, setWorkerMap] = useState<Record<string, string>>({})
  const [workerList, setWorkerList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const { providerId } = useProviderId()
  const supabase = createClient()

  useEffect(() => { if (providerId) load() }, [providerId])

  async function load() {
    if (!providerId) return
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [clientsRes, workersRes, activitiesRes, pendingRes, unassignedRes, paymentRes, clientsData, workersData] =
      await Promise.all([
        supabase.from('provider_clients').select('id', { count: 'exact' }).eq('provider_id', providerId).eq('active', true),
        supabase.from('provider_carers').select('carer_id', { count: 'exact' }).eq('provider_id', providerId).eq('active', true),
        supabase.from('activities').select('id', { count: 'exact' }).eq('provider_id', providerId).gte('created_at', monthStart),
        supabase.from('activities').select('id', { count: 'exact' }).eq('provider_id', providerId).eq('status', 'awaiting_client_approval'),
        supabase.from('activities').select('id, title, start_time, client_id')
          .eq('provider_id', providerId)
          .is('carer_id', null)
          .not('status', 'in', '("cancelled","rejected","paid")')
          .order('start_time'),
        supabase.from('activities').select('id, title, start_time, actual_end_time, client_id, carer_id')
          .eq('provider_id', providerId)
          .eq('status', 'awaiting_payment_approval')
          .order('actual_end_time'),
        supabase.from('provider_clients').select('client_id, clients(id, name)').eq('provider_id', providerId).eq('active', true),
        supabase.from('provider_carers').select('carer_id, carers(id, name)')
          .eq('provider_id', providerId).eq('active', true),
      ])

    setStats({
      clients: clientsRes.count ?? 0,
      workers: workersRes.count ?? 0,
      activities: activitiesRes.count ?? 0,
      pending: pendingRes.count ?? 0,
    })
    setUnassigned(unassignedRes.data || [])
    setAwaitingPayment(paymentRes.data || [])
    const cls = (clientsData.data || []).map((pc: any) => pc.clients).filter(Boolean)
    setClientMap(Object.fromEntries(cls.map((c: any) => [c.id, c.name])))
    const wks = (workersData.data || []).map((pc: any) => pc.carers).filter(Boolean)
    setWorkerMap(Object.fromEntries(wks.map((w: any) => [w.id, w.name])))
    setWorkerList(wks)
    setLoading(false)
  }

  async function handleApprovePayment(actId: string) {
    setApprovingId(actId)
    const act = awaitingPayment.find(a => a.id === actId)

    const { data: { user } } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('activities')
      .update({ status: 'ready_for_payment' }).eq('id', actId)
    if (err) { alert(`Failed to approve payment: ${err.message}`); setApprovingId(null); return }
    await supabase.from('activity_status_history').insert({
      activity_id: actId,
      from_status: 'awaiting_payment_approval',
      to_status: 'ready_for_payment',
      changed_by: user!.id,
    })

    // Notify worker
    if (act?.carer_id) {
      const { data: carer } = await supabase.from('carers').select('name, email').eq('id', act.carer_id).single()
      if (carer?.email) {
        notify('payment_approved', carer.email, {
          carerName: carer.name,
          activityTitle: act.title,
          activityId: actId,
        })
      }
    }

    // Remove from list immediately
    setAwaitingPayment(prev => prev.filter(a => a.id !== actId))
    setApprovingId(null)
  }

  async function handleAssignWorker(actId: string, carerId: string) {
    if (!carerId) return
    setAssigningId(actId)

    const { error: err } = await supabase.from('activities')
      .update({ carer_id: carerId, status: 'awaiting_acceptance' }).eq('id', actId)
    if (err) { alert(`Failed to assign worker: ${err.message}`); setAssigningId(null); return }

    const act = unassigned.find(a => a.id === actId)
    const { data: carer } = await supabase.from('carers').select('name, email').eq('id', carerId).single()
    if (carer?.email && act) {
      notify('activity_assigned', carer.email, {
        carerName: carer.name,
        activityTitle: act.title,
        clientName: clientMap[act.client_id] || '—',
        startTime: act.start_time ? new Date(act.start_time).toLocaleString('en-AU') : '—',
        endTime: '—',
        activityId: actId,
      })
    }

    // Remove from list immediately
    setUnassigned(prev => prev.filter(a => a.id !== actId))
    setAssigningId(null)
  }

  const cards = [
    { label: 'Active Clients', value: stats.clients, icon: Users, color: 'bg-blue-500', href: '/provider/clients' },
    { label: 'Active Workers', value: stats.workers, icon: UserCheck, color: 'bg-green-500', href: '/provider/carers' },
    { label: 'Activities This Month', value: stats.activities, icon: Activity, color: 'bg-purple-500', href: '/provider/calendar' },
    { label: 'Awaiting Client Approval', value: stats.pending, icon: Clock, color: 'bg-amber-500', href: '/provider/reports' },
  ]

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Welcome back</p>
      </div>

      {/* Alert banners */}
      <div className="space-y-3 mb-6">
        {unassigned.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserX size={18} className="text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  {unassigned.length} activit{unassigned.length !== 1 ? 'ies' : 'y'} with no Worker assigned
                </p>
                <p className="text-xs text-amber-600 mt-0.5">Assign a Worker below</p>
              </div>
            </div>
          </div>
        )}
        {awaitingPayment.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle size={18} className="text-indigo-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-indigo-900">
                  {awaitingPayment.length} shift{awaitingPayment.length !== 1 ? 's' : ''} awaiting your payment approval
                </p>
                <p className="text-xs text-indigo-600 mt-0.5">Approve below to mark ready for payment</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon, color, href }) => (
          <Link key={label} href={href}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:border-blue-200 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{label}</span>
              <div className={`${color} w-9 h-9 rounded-lg flex items-center justify-center`}>
                <Icon size={18} className="text-white" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Unassigned activities — inline assign */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Unassigned Activities</h2>
          {unassigned.length === 0 ? (
            <p className="text-sm text-gray-400">All activities have a Worker assigned.</p>
          ) : (
            <div className="space-y-2">
              {unassigned.slice(0, 8).map((act: any) => (
                <div key={act.id}
                  className="p-3 rounded-lg border border-amber-100 bg-amber-50">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{act.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {clientMap[act.client_id] || '—'} · {act.start_time ? formatDate(act.start_time) : '—'}
                      </p>
                    </div>
                  </div>
                  <select
                    onChange={e => handleAssignWorker(act.id, e.target.value)}
                    defaultValue=""
                    disabled={assigningId === act.id}
                    className="w-full border border-amber-200 bg-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50">
                    <option value="">{assigningId === act.id ? 'Assigning…' : 'Select a Worker to assign…'}</option>
                    {workerList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              ))}
              {unassigned.length > 8 && (
                <p className="text-xs text-gray-400 text-center pt-1">+{unassigned.length - 8} more</p>
              )}
            </div>
          )}
        </div>

        {/* Awaiting payment approval — inline approve */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Awaiting Payment Approval</h2>
          {awaitingPayment.length === 0 ? (
            <p className="text-sm text-gray-400">No shifts awaiting payment approval.</p>
          ) : (
            <div className="space-y-2">
              {awaitingPayment.slice(0, 8).map((act: any) => (
                <div key={act.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-indigo-100 bg-indigo-50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{act.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {clientMap[act.client_id] || '—'}
                      {act.carer_id ? ` · ${workerMap[act.carer_id] || '—'}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleApprovePayment(act.id)}
                    disabled={approvingId === act.id}
                    className="ml-3 flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex-shrink-0">
                    <CheckCircle size={12} />
                    {approvingId === act.id ? 'Approving…' : 'Approve'}
                  </button>
                </div>
              ))}
              {awaitingPayment.length > 8 && (
                <p className="text-xs text-gray-400 text-center pt-1">+{awaitingPayment.length - 8} more</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
