'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, ChevronRight, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react'
import Link from 'next/link'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number)
  const ampm = h < 12 ? 'am' : 'pm'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}:${String(m).padStart(2, '0')}${ampm}`
}

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<any[]>([])
  const [clients, setClients] = useState<Record<string, string>>({})
  const [workers, setWorkers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: scheds }, { data: cls }, { data: wks }] = await Promise.all([
      supabase.from('recurring_schedules').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name'),
      supabase.from('carers').select('id, name'),
    ])
    setSchedules(scheds || [])
    setClients(Object.fromEntries((cls || []).map((c: any) => [c.id, c.name])))
    setWorkers(Object.fromEntries((wks || []).map((w: any) => [w.id, w.name])))
    setLoading(false)
  }

  async function toggleActive(schedule: any) {
    await supabase.from('recurring_schedules')
      .update({ active: !schedule.active }).eq('id', schedule.id)
    load()
  }

  async function generateActivities(schedule: any) {
    setGenerating(schedule.id)
    // Generate 4 weeks of activities from today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const until = new Date(today)
    until.setDate(until.getDate() + 28)

    const validFrom = schedule.valid_from ? new Date(schedule.valid_from) : today
    const validUntil = schedule.valid_until ? new Date(schedule.valid_until) : until

    const endDate = validUntil < until ? validUntil : until

    const activities: any[] = []
    const current = new Date(today > validFrom ? today : validFrom)

    while (current <= endDate) {
      const dow = current.getDay()
      if (schedule.days_of_week.includes(dow)) {
        const [sh, sm] = schedule.start_time.split(':').map(Number)
        const start = new Date(current)
        start.setHours(sh, sm, 0, 0)
        const end = new Date(start)
        end.setMinutes(end.getMinutes() + schedule.duration_minutes)

        // Check if activity already exists for this date
        const { data: existing } = await supabase.from('activities')
          .select('id').eq('recurring_schedule_id', schedule.id)
          .gte('start_time', start.toISOString())
          .lte('start_time', new Date(start.getTime() + 60000).toISOString())

        if (!existing || existing.length === 0) {
          activities.push({
            recurring_schedule_id: schedule.id,
            provider_id: schedule.provider_id,
            client_id: schedule.client_id,
            carer_id: schedule.carer_id || null,
            ndis_line_item_id: schedule.ndis_line_item_id || null,
            title: schedule.title,
            description: schedule.description || null,
            status: schedule.carer_id ? 'awaiting_acceptance' : 'awaiting_acceptance',
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            pickup_address: schedule.pickup_address || null,
            dropoff_address: schedule.dropoff_address || null,
            venue_address: schedule.venue_address || null,
          })
        }
      }
      current.setDate(current.getDate() + 1)
    }

    if (activities.length > 0) {
      await supabase.from('activities').insert(activities)
    }

    setGenerating(null)
    alert(`Generated ${activities.length} new activit${activities.length !== 1 ? 'ies' : 'y'} for the next 4 weeks.`)
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recurring Schedules</h1>
          <p className="text-gray-500 text-sm mt-1">
            {schedules.length} schedule{schedules.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/provider/schedules/new"
          className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={15} /> New Schedule
        </Link>
      </div>

      {schedules.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <RefreshCw size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium text-sm">No recurring schedules yet</p>
          <p className="text-gray-400 text-xs mt-1">Create a schedule to automatically generate weekly shifts</p>
          <Link href="/provider/schedules/new"
            className="inline-block mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Create First Schedule
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map(s => (
            <div key={s.id} className={`bg-white rounded-xl border shadow-sm p-5 ${!s.active ? 'opacity-60' : 'border-gray-100'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link href={`/provider/schedules/${s.id}`}
                      className="font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                      {s.title}
                    </Link>
                    {!s.active && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
                    <span>{clients[s.client_id] || '—'}</span>
                    {s.carer_id && <span>Worker: {workers[s.carer_id] || '—'}</span>}
                    <span className="text-blue-600 font-medium">
                      {(s.days_of_week as number[]).sort().map(d => DAYS[d]).join(', ')}
                    </span>
                    <span>{formatTime(s.start_time)} · {formatDuration(s.duration_minutes)}</span>
                    <span>From {formatDate(s.valid_from)}{s.valid_until ? ` to ${formatDate(s.valid_until)}` : ' (ongoing)'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => generateActivities(s)}
                    disabled={!s.active || generating === s.id}
                    title="Generate activities for next 4 weeks"
                    className="flex items-center gap-1.5 text-xs bg-green-50 text-green-700 hover:bg-green-100 px-3 py-1.5 rounded-lg disabled:opacity-40 transition-colors font-medium">
                    <RefreshCw size={12} className={generating === s.id ? 'animate-spin' : ''} />
                    {generating === s.id ? 'Generating…' : 'Generate'}
                  </button>
                  <button onClick={() => toggleActive(s)} title={s.active ? 'Deactivate' : 'Activate'}>
                    {s.active
                      ? <ToggleRight size={28} className="text-blue-600" />
                      : <ToggleLeft size={28} className="text-gray-300" />}
                  </button>
                  <Link href={`/provider/schedules/${s.id}`}>
                    <ChevronRight size={16} className="text-gray-300" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
