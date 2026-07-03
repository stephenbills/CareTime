'use client'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

const DAYS_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7) // 7am–8pm
const HOUR_PX = 56

const STATUS_BLOCK: Record<string, string> = {
  awaiting_acceptance: 'bg-yellow-400 text-yellow-900',
  scheduled: 'bg-blue-500 text-white',
  in_progress: 'bg-purple-500 text-white',
  awaiting_client_approval: 'bg-orange-400 text-white',
  awaiting_payment_approval: 'bg-indigo-400 text-white',
  ready_for_payment: 'bg-green-500 text-white',
  paid: 'bg-gray-200 text-gray-600',
  rejected: 'bg-red-400 text-white',
  cancelled: 'bg-gray-100 text-gray-400',
}

function startOfWeek(date: Date) {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

function activityPosition(act: any) {
  const start = new Date(act.start_time)
  const end = new Date(act.end_time)
  const startHour = start.getHours() + start.getMinutes() / 60
  const endHour = end.getHours() + end.getMinutes() / 60
  const topPx = (Math.max(7, startHour) - 7) * HOUR_PX
  const heightPx = Math.max((Math.min(21, endHour) - Math.max(7, startHour)) * HOUR_PX, 20)
  return { topPx, heightPx }
}

interface Props {
  activities: any[]
  // labelField: what to show as the primary label in each block
  // 'worker' = show worker name, 'client' = show client name, 'title' = show activity title
  labelField?: 'worker' | 'client' | 'title'
  workers?: Record<string, string>
  clients?: Record<string, string>
  activityLinkBase?: string // e.g. '/provider/activities' or '/worker/activities'
  initialWeek?: Date
}

export default function WeekView({
  activities,
  labelField = 'title',
  workers = {},
  clients = {},
  activityLinkBase = '/provider/activities',
  initialWeek,
}: Props) {
  const today = new Date()
  const [weekStart, setWeekStart] = useState(startOfWeek(initialWeek || today))

  function prevWeek() {
    const ws = new Date(weekStart); ws.setDate(ws.getDate() - 7); setWeekStart(ws)
  }
  function nextWeek() {
    const ws = new Date(weekStart); ws.setDate(ws.getDate() + 7); setWeekStart(ws)
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d
  })

  function weekRangeLabel() {
    const end = new Date(weekStart); end.setDate(end.getDate() + 6)
    if (weekStart.getMonth() === end.getMonth())
      return `${weekStart.getDate()}–${end.getDate()} ${MONTHS[weekStart.getMonth()]} ${weekStart.getFullYear()}`
    return `${weekStart.getDate()} ${MONTHS[weekStart.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
  }

  function getLabel(act: any) {
    if (labelField === 'worker') {
      const name = workers[act.carer_id] || ''
      return name.split(' ')[0] || act.title
    }
    if (labelField === 'client') {
      const name = clients[act.client_id] || ''
      return name.split(' ')[0] || act.title
    }
    return act.title
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <button onClick={prevWeek} className="p-1.5 rounded-lg hover:bg-gray-50 active:bg-gray-100">
          <ChevronLeft size={18} className="text-gray-500" />
        </button>
        <span className="font-semibold text-gray-900 text-xs">{weekRangeLabel()}</span>
        <button onClick={nextWeek} className="p-1.5 rounded-lg hover:bg-gray-50 active:bg-gray-100">
          <ChevronRight size={18} className="text-gray-500" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-8 border-b border-gray-100">
        <div className="w-10" />
        {weekDays.map((d, i) => {
          const isToday = d.toDateString() === today.toDateString()
          return (
            <div key={i} className="py-2 text-center">
              <p className="text-xs text-gray-400">{DAYS_FULL[d.getDay()]}</p>
              <p className={`text-sm font-semibold mt-0.5 w-7 h-7 rounded-full flex items-center justify-center mx-auto ${
                isToday ? 'bg-blue-600 text-white' : 'text-gray-700'
              }`}>{d.getDate()}</p>
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      <div className="overflow-y-auto" style={{ maxHeight: '65vh' }}>
        <div className="relative grid grid-cols-8">
          {/* Grid lines */}
          <div className="col-span-8 absolute inset-0 pointer-events-none">
            {HOURS.map(h => (
              <div key={h} style={{ height: HOUR_PX }} className="grid grid-cols-8 border-b border-gray-50">
                <div className="flex items-start justify-end pr-2 pt-1">
                  <span className="text-xs text-gray-300">
                    {h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h-12}pm`}
                  </span>
                </div>
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="border-l border-gray-50" />
                ))}
              </div>
            ))}
          </div>

          {/* Activity blocks */}
          <div className="w-10" style={{ height: HOUR_PX * HOURS.length }} />
          {weekDays.map((day, di) => {
            const dayActs = activities.filter(a => {
              const d = new Date(a.start_time)
              return d.toDateString() === day.toDateString()
            })
            const isToday = day.toDateString() === today.toDateString()
            return (
              <div key={di}
                className={`relative ${isToday ? 'bg-blue-50/30' : ''}`}
                style={{ height: HOUR_PX * HOURS.length }}>
                {dayActs.map(act => {
                  const { topPx, heightPx } = activityPosition(act)
                  const label = getLabel(act)
                  return (
                    <Link key={act.id}
                      href={`${activityLinkBase}/${act.id}`}
                      className={`absolute left-0.5 right-0.5 rounded-md px-1 py-0.5 overflow-hidden text-xs font-medium leading-tight ${STATUS_BLOCK[act.status] || 'bg-blue-500 text-white'}`}
                      style={{ top: topPx, height: heightPx }}>
                      <span className="block truncate">{label}</span>
                      {heightPx > 32 && (
                        <span className="block truncate opacity-80 text-[10px]">{act.title}</span>
                      )}
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
