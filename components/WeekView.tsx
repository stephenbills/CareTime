'use client'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

const DAYS_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// Full 24 hours
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const HOUR_PX = 48

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

function hourLabel(h: number) {
  if (h === 0) return '12am'
  if (h === 12) return '12pm'
  return h < 12 ? `${h}am` : `${h - 12}pm`
}

interface ActivityBlock {
  act: any
  dayIndex: number  // which column (0-6)
  topPx: number
  heightPx: number
  label: string
}

interface Props {
  activities: any[]
  labelField?: 'worker' | 'client' | 'title'
  workers?: Record<string, string>
  clients?: Record<string, string>
  activityLinkBase?: string
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
    const clientName = clients[act.client_id] || ''
    const workerName = workers[act.carer_id] || ''
    const clientFirst = clientName.split(' ')[0]
    const workerFirst = workerName.split(' ')[0]

    if (labelField === 'worker') {
      return workerFirst || act.title
    }
    if (labelField === 'client') {
      // Show "Client · Worker" if both available
      if (clientFirst && workerFirst) return `${clientFirst} · ${workerFirst}`
      return clientFirst || act.title
    }
    return act.title
  }

  // Build activity blocks — handling overnight shifts by splitting across days
  function buildBlocks(): ActivityBlock[] {
    const blocks: ActivityBlock[] = []

    for (const act of activities) {
      const start = new Date(act.start_time)
      const end = new Date(act.end_time)
      const label = getLabel(act)

      for (let di = 0; di < 7; di++) {
        const day = weekDays[di]
        const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999)

        // Does this activity overlap with this day?
        if (end <= dayStart || start > dayEnd) continue

        // Clamp to this day's bounds
        const blockStart = start < dayStart ? dayStart : start
        const blockEnd = end > dayEnd ? dayEnd : end

        const startHour = blockStart.getHours() + blockStart.getMinutes() / 60
        const endHour = blockEnd.getHours() + blockEnd.getMinutes() / 60 +
          (blockEnd >= dayEnd ? 0 : 0) // include full last hour if overnight

        // If activity started previous day, show from top of this day
        const topPx = (start < dayStart ? 0 : startHour) * HOUR_PX
        const heightPx = Math.max(
          (start < dayStart ? endHour : endHour - startHour) * HOUR_PX,
          24
        )

        blocks.push({ act, dayIndex: di, topPx, heightPx, label })
      }
    }

    return blocks
  }

  const blocks = buildBlocks()

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
      <div className="grid border-b border-gray-100" style={{ gridTemplateColumns: '40px repeat(7, 1fr)' }}>
        <div />
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
      <div className="overflow-y-auto" style={{ maxHeight: '70vh' }}>
        <div className="relative" style={{ gridTemplateColumns: '40px repeat(7, 1fr)', display: 'grid' }}>

          {/* Hour labels column */}
          <div style={{ height: HOUR_PX * 24 }}>
            {HOURS.map(h => (
              <div key={h} style={{ height: HOUR_PX }}
                className="flex items-start justify-end pr-2 pt-1 border-b border-gray-50">
                <span className="text-xs text-gray-300 leading-none">{hourLabel(h)}</span>
              </div>
            ))}
          </div>

          {/* Day columns — relative positioned for activity blocks */}
          {weekDays.map((day, di) => {
            const isToday = day.toDateString() === today.toDateString()
            const dayBlocks = blocks.filter(b => b.dayIndex === di)
            return (
              <div key={di} className={`relative border-l border-gray-50 ${isToday ? 'bg-blue-50/20' : ''}`}
                style={{ height: HOUR_PX * 24 }}>
                {/* Hour grid lines */}
                {HOURS.map(h => (
                  <div key={h} style={{ height: HOUR_PX }}
                    className={`border-b ${h % 6 === 0 ? 'border-gray-100' : 'border-gray-50'}`} />
                ))}

                {/* Activity blocks */}
                {dayBlocks.map(({ act, topPx, heightPx, label }) => (
                  <Link key={`${act.id}-${di}`}
                    href={`${activityLinkBase}/${act.id}`}
                    className={`absolute left-0.5 right-0.5 rounded px-1 py-0.5 overflow-hidden text-xs font-medium leading-tight z-10 ${
                      STATUS_BLOCK[act.status] || 'bg-blue-500 text-white'
                    }`}
                    style={{ top: topPx, height: heightPx }}>
                    <span className="block truncate">{label}</span>
                    {heightPx > 32 && act.title !== label && (
                      <span className="block truncate opacity-75 text-[10px]">{act.title}</span>
                    )}
                  </Link>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
