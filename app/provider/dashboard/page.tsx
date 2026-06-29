import { createClient } from '@/lib/supabase/server'
import { Users, UserCheck, Activity, Clock } from 'lucide-react'

async function getStats(supabase: any) {
  const [clients, carers, activities, pending] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact' }).eq('active', true),
    supabase.from('carers').select('id', { count: 'exact' }).eq('active', true),
    supabase.from('activities').select('id', { count: 'exact' })
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from('activities').select('id', { count: 'exact' })
      .eq('status', 'awaiting_client_approval'),
  ])
  return {
    clients: clients.count ?? 0,
    carers: carers.count ?? 0,
    activities: activities.count ?? 0,
    pending: pending.count ?? 0,
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const stats = await getStats(supabase)

  const cards = [
    { label: 'Active Clients', value: stats.clients, icon: Users, color: 'bg-blue-500' },
    { label: 'Active Carers', value: stats.carers, icon: UserCheck, color: 'bg-green-500' },
    { label: 'Activities This Month', value: stats.activities, icon: Activity, color: 'bg-purple-500' },
    { label: 'Awaiting Approval', value: stats.pending, icon: Clock, color: 'bg-amber-500' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Provider Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Welcome back, {user?.email}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{label}</span>
              <div className={`${color} w-9 h-9 rounded-lg flex items-center justify-center`}>
                <Icon size={18} className="text-white" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Recent Activities</h2>
          <p className="text-sm text-gray-400">No recent activities yet.</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Pending Approvals</h2>
          <p className="text-sm text-gray-400">No pending approvals.</p>
        </div>
      </div>
    </div>
  )
}
