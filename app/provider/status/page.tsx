'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { useProviderId } from '@/lib/hooks/useProvider'

const STATUSES = [
  { value: 'awaiting_acceptance', label: 'Awaiting Acceptance', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { value: 'scheduled', label: 'Scheduled', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { value: 'awaiting_client_approval', label: 'Awaiting Client Approval', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'awaiting_payment_approval', label: 'Awaiting Payment Approval', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  { value: 'ready_for_payment', label: 'Ready for Payment', color: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'paid', label: 'Paid', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-800 border-red-200' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-100 text-gray-400 border-gray-200' },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export default function StatusPage() {
  const [activities, setActivities] = useState<any[]>([])
  const [clients, setClients] = useState<Record<string, string>>({})
  const [workers, setWorkers] = useState<Record<string, string>>({})
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')
  const [changingId, setChangingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { providerId } = useProviderId()
  const supabase = createClient()

  useEffect(() => { if (providerId) load() }, [providerId])

  async function load() {
    if (!providerId) return
    const [{ data: acts }, { data: cls }, { data: wks }] = await Promise.all([
      supabase.from('activities').select('*').eq('provider_id', providerId).order('start_time', { ascending: false }).limit(200),
      supabase.from('provider_clients').select('client_id, clients(id, name)').eq('provider_id', providerId).eq('active', true),
      supabase.from('provider_carers').select('carer_id, carers(id, name)').eq('provider_id', providerId),
    ])
    setActivities(acts || [])
    const clientList = (cls || []).map((pc: any) => pc.clients).filter(Boolean)
    setClients(Object.fromEntries(clientList.map((c: any) => [c.id, c.name])))
    const workers = (wks || []).map((pc: any) => pc.carers).filter(Boolean)
    setWorkers(Object.fromEntries(workers.map((w: any) => [w.id, w.name])))
    setLoading(false)
  }

  async function changeStatus(actId: string, newStatus: string) {
    setChangingId(actId)
    const act = activities.find(a => a.id === actId)
    const { data: { user } } = await supabase.auth.getUser()

    const { error: err } = await supabase.from('activities').update({ status: newStatus }).eq('id', actId)
    if (err) { alert(`Failed to change status: ${err.message}`); setChangingId(null); return }

    await supabase.from('activity_status_history').insert({
      activity_id: actId,
      from_status: act?.status,
      to_status: newStatus,
      changed_by: user!.id,
    })

    setActivities(prev => prev.map(a => a.id === actId ? { ...a, status: newStatus } : a))
    setChangingId(null)
  }

  const filtered = activities.filter(a => {
    if (filterStatus && a.status !== filterStatus) return false
    if (search) {
      const s = search.toLowerCase()
      const clientName = clients[a.client_id] || ''
      const workerName = workers[a.carer_id] || ''
      return a.title?.toLowerCase().includes(s) ||
        clientName.toLowerCase().includes(s) ||
        workerName.toLowerCase().includes(s)
    }
    return true
  })

  // Group by status for summary
  const statusCounts: Record<string, number> = {}
  activities.forEach(a => { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1 })

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Activity Status</h1>
        <p className="text-gray-500 text-sm mt-1">View and manage the status of all activities</p>
      </div>

      {/* Status summary chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setFilterStatus('')}
          className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
            !filterStatus ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
          }`}>
          All ({activities.length})
        </button>
        {STATUSES.map(s => {
          const count = statusCounts[s.value] || 0
          if (count === 0) return null
          return (
            <button key={s.value} onClick={() => setFilterStatus(filterStatus === s.value ? '' : s.value)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                filterStatus === s.value ? 'ring-2 ring-offset-1 ring-blue-400 ' : ''
              }${s.color}`}>
              {s.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Search activities, clients, workers…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs">Date</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs">Activity</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs">Client</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs">Worker</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs">Time</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-sm">No activities found</td></tr>
            ) : filtered.map(act => {
              const statusDef = STATUSES.find(s => s.value === act.status)
              return (
                <tr key={act.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-700 text-xs">{formatDate(act.start_time)}</td>
                  <td className="py-3 px-4">
                    <Link href={`/provider/activities/${act.id}`} className="text-gray-900 font-medium hover:text-blue-600">
                      {act.title}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{clients[act.client_id] || '—'}</td>
                  <td className="py-3 px-4 text-gray-600">{workers[act.carer_id] || '—'}</td>
                  <td className="py-3 px-4 text-gray-500 text-xs">
                    {formatTime(act.start_time)} – {formatTime(act.end_time)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="relative inline-block">
                      <select
                        value={act.status}
                        onChange={e => changeStatus(act.id, e.target.value)}
                        disabled={changingId === act.id}
                        className={`text-xs px-2 py-1 rounded-full border font-medium appearance-none pr-6 cursor-pointer disabled:opacity-50 ${statusDef?.color || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        {STATUSES.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
