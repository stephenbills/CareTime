import { createClient } from '@/lib/supabase/server'
import { Users, UserCheck, Activity, Clock, AlertTriangle, UserX, CheckCircle } from 'lucide-react'
import Link from 'next/link'

async function getStats(supabase: any) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [clients, workers, activities, pending, unassigned, awaitingPayment, recent] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact' }).eq('active', true),
    supabase.from('carers').select('id', { count: 'exact' }).eq('active', true),
    supabase.from('activities').select('id', { count: 'exact' }).gte('created_at', monthStart),
    supabase.from('activities').select('id', { count: 'exact' }).eq('status', 'awaiting_client_approval'),
    supabase.from('activities').select('id, title, start_time, client_id')
      .is('carer_id', null)
      .not('status', 'in', '("cancelled","rejected","paid")')
      .order('start_time'),
    supabase.from('activities').select('id, title, start_time, actual_end_time, client_id, carer_id', { count: 'exact' })
      .eq('status', 'awaiting_payment_approval')
      .order('actual_end_time'),
    supabase.from('activities').select('id, title, start_time, status, client_id, carer_id')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return {
    clients: clients.count ?? 0,
    workers: workers.count ?? 0,
    activities: activities.count ?? 0,
    pending: pending.count ?? 0,
    unassigned: unassigned.data || [],
    awaitingPayment: awaitingPayment.data || [],
    recent: recent.data || [],
  }
}

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const stats = await getStats(supabase)

  // Load client and worker names for activity lists
  const [{ data: clients }, { data: workers }] = await Promise.all([
    supabase.from('clients').select('id, name'),
    supabase.from('carers').select('id, name'),
  ])
  const clientMap: Record<string, string> = Object.fromEntries((clients || []).map((c: any) => [c.id, c.name]))
  const workerMap: Record<string, string> = Object.fromEntries((workers || []).map((w: any) => [w.id, w.name]))

  const cards = [
    { label: 'Active Clients', value: stats.clients, icon: Users, color: 'bg-blue-500', href: '/provider/clients' },
    { label: 'Active Workers', value: stats.workers, icon: UserCheck, color: 'bg-green-500', href: '/provider/carers' },
    { label: 'Activities This Month', value: stats.activities, icon: Activity, color: 'bg-purple-500', href: '/provider/calendar' },
    { label: 'Awaiting Client Approval', value: stats.pending, icon: Clock, color: 'bg-amber-500', href: '/provider/reports' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Welcome back</p>
      </div>

      {/* Alert banners */}
      <div className="space-y-3 mb-6">
        {stats.unassigned.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserX size={18} className="text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  {stats.unassigned.length} activit{stats.unassigned.length !== 1 ? 'ies' : 'y'} with no Worker assigned
                </p>
                <p className="text-xs text-amber-600 mt-0.5">These activities need a Worker before they can proceed</p>
              </div>
            </div>
            <Link href="/provider/calendar"
              className="text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
              View Calendar →
            </Link>
          </div>
        )}

        {stats.awaitingPayment.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle size={18} className="text-indigo-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-indigo-900">
                  {stats.awaitingPayment.length} shift{stats.awaitingPayment.length !== 1 ? 's' : ''} awaiting your payment approval
                </p>
                <p className="text-xs text-indigo-600 mt-0.5">Client approved — ready for you to process</p>
              </div>
            </div>
            <Link href="/provider/reports"
              className="text-xs font-semibold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
              View Reports →
            </Link>
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
        {/* Unassigned activities */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Unassigned Activities</h2>
          {stats.unassigned.length === 0 ? (
            <p className="text-sm text-gray-400">All activities have a Worker assigned.</p>
          ) : (
            <div className="space-y-2">
              {stats.unassigned.slice(0, 5).map((act: any) => (
                <Link key={act.id} href={`/provider/activities/${act.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-amber-100 bg-amber-50 hover:bg-amber-100 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{act.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {clientMap[act.client_id] || '—'} · {act.start_time ? formatDate(act.start_time) : '—'}
                    </p>
                  </div>
                  <span className="text-xs text-amber-700 font-medium">Assign →</span>
                </Link>
              ))}
              {stats.unassigned.length > 5 && (
                <p className="text-xs text-gray-400 text-center pt-1">+{stats.unassigned.length - 5} more</p>
              )}
            </div>
          )}
        </div>

        {/* Awaiting payment approval */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Awaiting Payment Approval</h2>
          {stats.awaitingPayment.length === 0 ? (
            <p className="text-sm text-gray-400">No shifts awaiting payment approval.</p>
          ) : (
            <div className="space-y-2">
              {(stats.awaitingPayment as any[]).slice(0, 5).map((act: any) => (
                <Link key={act.id} href={`/provider/activities/${act.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-indigo-100 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{act.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {clientMap[act.client_id] || '—'}
                      {act.carer_id ? ` · ${workerMap[act.carer_id] || '—'}` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-indigo-700 font-medium">Approve →</span>
                </Link>
              ))}
              {stats.awaitingPayment.length > 5 && (
                <p className="text-xs text-gray-400 text-center pt-1">+{stats.awaitingPayment.length - 5} more</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
