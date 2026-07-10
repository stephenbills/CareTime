'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Clock, ChevronRight, MapPin, Calendar } from 'lucide-react'
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
  cancelled: 'bg-gray-100 text-gray-400',
}

const STATUS_LABELS: Record<string, string> = {
  awaiting_acceptance: 'Awaiting Acceptance',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  awaiting_client_approval: 'Awaiting Client Approval',
  awaiting_payment_approval: 'Awaiting Payment Approval',
  ready_for_payment: 'Ready for Payment',
  paid: 'Paid',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function CarerDashboard() {
  const [worker, setCarer] = useState<any>(null)
  const [todayActs, setTodayActs] = useState<any[]>([])
  const [awaitingList, setAwaitingList] = useState<any[]>([])
  const [upcoming, setUpcoming] = useState<any[]>([])
  const [clients, setClients] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get worker record
      const { data: carerData } = await supabase
        .from('carers').select('*').eq('user_id', user.id).maybeSingle()
      setCarer(carerData)

      if (!carerData) { setLoading(false); return }

      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()
      const futureEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString()

      const [{ data: today }, { data: upcomingScheduled }, { data: awaiting }, { data: cls }] = await Promise.all([
        supabase.from('activities').select('*')
          .eq('carer_id', carerData.id)
          .gte('start_time', todayStart)
          .lte('start_time', todayEnd)
          .order('start_time'),
        supabase.from('activities').select('*')
          .eq('carer_id', carerData.id)
          .gt('start_time', todayEnd)
          .lte('start_time', futureEnd)
          .eq('status', 'scheduled')
          .order('start_time')
          .limit(5),
        supabase.from('activities').select('*')
          .eq('carer_id', carerData.id)
          .eq('status', 'awaiting_acceptance')
          .gte('start_time', todayStart)
          .order('start_time'),
        supabase.from('clients').select('id, name'),
      ])

      // Collapse a recurring schedule's occurrences down to a single (earliest) entry —
      // accepting one occurrence accepts the whole series, so listing every future
      // occurrence separately just shows the same appointment over and over.
      const seenSchedules = new Set<string>()
      const dedupedAwaiting = (awaiting || []).filter((a: any) => {
        if (!a.recurring_schedule_id) return true
        if (seenSchedules.has(a.recurring_schedule_id)) return false
        seenSchedules.add(a.recurring_schedule_id)
        return true
      })

      setTodayActs(today || [])
      setUpcoming(upcomingScheduled || [])
      setAwaitingList(dedupedAwaiting)
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

  if (!worker) return (
    <div className="p-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        Your Worker profile hasn't been set up yet. Please contact your Provider.
      </div>
    </div>
  )

  return (
    <div className="p-4 space-y-5">
      {/* Welcome */}
      <div className="pt-1">
        <p className="text-gray-400 text-xs">Good {getTimeOfDay()}</p>
        <h1 className="text-xl font-bold text-gray-900">{worker.name}</h1>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">Today</p>
          <p className="text-3xl font-bold text-gray-900">{todayActs.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">activit{todayActs.length !== 1 ? 'ies' : 'y'}</p>
        </div>
        <div className={`rounded-2xl border p-4 shadow-sm ${awaitingList.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-100'}`}>
          <p className={`text-xs mb-1 ${awaitingList.length > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>Awaiting</p>
          <p className={`text-3xl font-bold ${awaitingList.length > 0 ? 'text-yellow-700' : 'text-gray-900'}`}>{awaitingList.length}</p>
          <p className={`text-xs mt-0.5 ${awaitingList.length > 0 ? 'text-yellow-600' : 'text-gray-500'}`}>acceptance</p>
        </div>
      </div>

      {/* Awaiting Acceptance */}
      {awaitingList.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Awaiting Acceptance</h2>
          <div className="bg-white rounded-2xl border border-yellow-200 shadow-sm divide-y divide-gray-50">
            {awaitingList.map(act => (
              <Link key={act.id} href={`/worker/activities/${act.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{act.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(act.start_time)} · {formatTime(act.start_time)}
                    {act.client_id && ` · ${clients[act.client_id] || '—'}`}
                  </p>
                </div>
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Today's activities */}
      {todayActs.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Today's Activities</h2>
          <div className="space-y-2">
            {todayActs.map(act => (
              <Link key={act.id} href={`/worker/activities/${act.id}`}
                className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-blue-200 active:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold text-gray-900 text-sm leading-tight">{act.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${STATUS_COLORS[act.status]}`}>
                    {STATUS_LABELS[act.status]}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {formatTime(act.start_time)} – {formatTime(act.end_time)}
                  </span>
                  {act.client_id && (
                    <span className="text-gray-400">· {clients[act.client_id] || '—'}</span>
                  )}
                </div>
                {act.pickup_address && (
                  <div className="flex items-start gap-1 mt-1.5 text-xs text-gray-400">
                    <MapPin size={11} className="mt-0.5 flex-shrink-0" />
                    <span className="truncate">{act.pickup_address}</span>
                  </div>
                )}
                {act.status === 'awaiting_acceptance' && (
                  <div className="mt-3 flex gap-2">
                    <span className="flex-1 bg-blue-600 text-white text-xs font-medium py-2 rounded-xl text-center">
                      View & Accept
                    </span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Upcoming</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {upcoming.map(act => (
              <Link key={act.id} href={`/worker/activities/${act.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{act.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(act.start_time)} · {formatTime(act.start_time)}
                  </p>
                </div>
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {todayActs.length === 0 && upcoming.length === 0 && awaitingList.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <Calendar size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No activities scheduled.</p>
        </div>
      )}
    </div>
  )
}

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
