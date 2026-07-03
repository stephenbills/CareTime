'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import Link from 'next/link'

const DAYS_SHORT = ['S','M','T','W','T','F','S']
const DAYS_FULL = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7) // 7am to 8pm

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-500 text-white',
  in_progress: 'bg-purple-500 text-white',
  awaiting_client_approval: 'bg-orange-400 text-white',
  awaiting_payment_approval: 'bg-indigo-400 text-white',
  paid: 'bg-gray-300 text-gray-700',
  rejected: 'bg-red-400 text-white',
  cancelled: 'bg-gray-200 text-gray-500',
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  awaiting_client_approval: 'Needs Approval',
  awaiting_payment_approval: 'Approved',
  paid: 'Paid',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function startOfWeek(date: Date) {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

export default function ClientCalendar() {
  const today = new Date()
  const [view, setView] = useState<'month' | 'week'>('month')
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [weekStart, setWeekStart] = useState(startOfWeek(today))
  const [activities, setActivities] = useState<any[]>([])
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate())
  const [workers, setWorkers] = useState<Record<string, string>>({})
  const [clientId, setClientId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: client } = await supabase
        .from('clients').select('id').eq('user_id', user.id).maybeSingle()
      if (!client) return
      setClientId(client.id)
      loadActivities(client.id, year, month, weekStart)
    }
    init()
  }, [])

  async function loadActivities(cid: string, y: number, m: number, ws: Date) {
    // Load a wider range to cover both month and week views
    const from = new Date(y, m - 1, 1).toISOString()
    const to = new Date(y, m + 2, 0, 23, 59, 59).toISOString()
    const [{ data: acts }, { data: wks }] = await Promise.all([
      supabase.from('activities').select('*')
        .eq('client_id', cid).gte('start_time', from).lte('start_time', to).order('start_time'),
      supabase.from('carers').select('id, name'),
    ])
    setActivities(acts || [])
    setWorkers(Object.fromEntries((wks || []).map((w: any) => [w.id, w.name])))
  }

  function prevMonth() {
    const nm = month === 0 ? 11 : month - 1
    const ny = month === 0 ? year - 1 : year
    setYear(ny); setMonth(nm); setSelectedDay(null)
    if (clientId) loadActivities(clientId, ny, nm, weekStart)
  }
  function nextMonth() {
    const nm = month === 11 ? 0 : month + 1
    const ny = month === 11 ? year + 1 : year
    setYear(ny); setMonth(nm); setSelectedDay(null)
    if (clientId) loadActivities(clientId, ny, nm, weekStart)
  }
  function prevWeek() {
    const ws = new Date(weekStart)
    ws.setDate(ws.getDate() - 7)
    setWeekStart(ws)
    setYear(ws.getFullYear()); setMonth(ws.getMonth())
    if (clientId) loadActivities(clientId, ws.getFullYear(), ws.getMonth(), ws)
  }
  function nextWeek() {
    const ws = new Date(weekStart)
    ws.setDate(ws.getDate() + 7)
    setWeekStart(ws)
    setYear(ws.getFullYear()); setMonth(ws.getMonth())
    if (clientId) loadActivities(clientId, ws.getFullYear(), ws.getMonth(), ws)
  }

  // Month view helpers
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()

  function actsForDay(date: Date) {
    return activities.filter(a => {
      const d = new Date(a.start_time)
      return d.getDate() === date.getDate() &&
        d.getMonth() === date.getMonth() &&
        d.getFullYear() === date.getFullYear()
    })
  }

  // Week view helpers
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  function actsForDayHour(date: Date, hour: number) {
    return activities.filter(a => {
      const start = new Date(a.start_time)
      return start.getDate() === date.getDate() &&
        start.getMonth() === date.getMonth() &&
        start.getFullYear() === date.getFullYear() &&
        start.getHours() === hour
    })
  }

  function weekRangeLabel() {
    const end = new Date(weekStart)
    end.setDate(end.getDate() + 6)
    if (weekStart.getMonth() === end.getMonth()) {
      return `${weekStart.getDate()}–${end.getDate()} ${MONTHS[weekStart.getMonth()]} ${weekStart.getFullYear()}`
    }
    return `${weekStart.getDate()} ${MONTHS[weekStart.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
  }

  const selectedActs = selectedDay
    ? actsForDay(new Date(year, month, selectedDay))
    : []

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-1">
        <h1 className="text-xl font-bold text-gray-900">My Calendar</h1>
        <Link href="/client/activities/new"
          className="flex items-center gap-1 bg-blue-600 text-white px-3 py-2 rounded-xl text-xs font-semibold active:bg-blue-700">
          <Plus size={14} /> Request
        </Link>
      </div>

      {/* View toggle */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setView('month')}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            view === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}>Month</button>
        <button onClick={() => setView('week')}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            view === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}>Week</button>
      </div>

      {/* MONTH VIEW */}
      {view === 'month' && (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <button onClick={prevMonth} className="p-1.5 rounded-lg active:bg-gray-100">
                <ChevronLeft size={18} className="text-gray-500" />
              </button>
              <span className="font-semibold text-gray-900 text-sm">{MONTHS[month]} {year}</span>
              <button onClick={nextMonth} className="p-1.5 rounded-lg active:bg-gray-100">
                <ChevronRight size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="grid grid-cols-7">
              {DAYS_SHORT.map((d, i) => (
                <div key={i} className="py-2 text-center text-xs font-medium text-gray-400">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} className="h-12" />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const date = new Date(year, month, day)
                const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
                const isSelected = day === selectedDay
                const dayActs = actsForDay(date)
                const needsApproval = dayActs.some(a => a.status === 'awaiting_client_approval')
                return (
                  <div key={day} onClick={() => setSelectedDay(day)}
                    className={`h-12 flex flex-col items-center justify-start pt-1.5 cursor-pointer rounded-lg mx-0.5 transition-colors ${
                      isSelected ? 'bg-blue-50' : 'active:bg-gray-50'
                    }`}>
                    <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium ${
                      isToday ? 'bg-blue-600 text-white' : isSelected ? 'text-blue-600' : 'text-gray-700'
                    }`}>{day}</span>
                    {dayActs.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5">
                        {dayActs.slice(0, 3).map((a, idx) => (
                          <div key={idx} className={`w-1.5 h-1.5 rounded-full ${
                            needsApproval ? 'bg-orange-400' : 'bg-blue-400'
                          }`} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {selectedDay && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">{MONTHS[month]} {selectedDay}</h2>
              {selectedActs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
                  <p className="text-gray-400 text-sm">No activities on this day</p>
                  <Link href="/client/activities/new"
                    className="text-blue-600 text-xs mt-2 block hover:underline">
                    + Request an activity
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedActs.map(act => (
                    <Link key={act.id} href={`/client/activities/${act.id}`}
                      className={`block rounded-2xl border shadow-sm p-4 active:opacity-80 ${
                        act.status === 'awaiting_client_approval'
                          ? 'bg-orange-50 border-orange-200'
                          : 'bg-white border-gray-100'
                      }`}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-semibold text-gray-900 text-sm">{act.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                          act.status === 'awaiting_client_approval'
                            ? 'bg-orange-100 text-orange-800 font-medium'
                            : 'bg-gray-100 text-gray-500'
                        }`}>{STATUS_LABELS[act.status] || act.status}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {formatTime(act.start_time)} – {formatTime(act.end_time)}
                      </p>
                      {act.carer_id && (
                        <p className="text-xs text-gray-400 mt-0.5">{workers[act.carer_id] || '—'}</p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* WEEK VIEW */}
      {view === 'week' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <button onClick={prevWeek} className="p-1.5 rounded-lg active:bg-gray-100">
              <ChevronLeft size={18} className="text-gray-500" />
            </button>
            <span className="font-semibold text-gray-900 text-xs">{weekRangeLabel()}</span>
            <button onClick={nextWeek} className="p-1.5 rounded-lg active:bg-gray-100">
              <ChevronRight size={18} className="text-gray-500" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-8 border-b border-gray-50">
            <div className="py-2" /> {/* time column */}
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

          {/* Hour rows */}
          <div className="overflow-y-auto max-h-[60vh]">
            {HOURS.map(hour => (
              <div key={hour} className="grid grid-cols-8 border-b border-gray-50 min-h-[48px]">
                <div className="px-2 py-1 text-xs text-gray-300 text-right pt-1.5">
                  {hour === 12 ? '12pm' : hour < 12 ? `${hour}am` : `${hour-12}pm`}
                </div>
                {weekDays.map((d, di) => {
                  const dayActs = actsForDayHour(d, hour)
                  return (
                    <div key={di} className={`border-l border-gray-50 px-0.5 py-0.5 ${
                      d.toDateString() === today.toDateString() ? 'bg-blue-50/30' : ''
                    }`}>
                      {dayActs.map(act => (
                        <Link key={act.id} href={`/client/activities/${act.id}`}
                          className={`block text-xs rounded px-1 py-0.5 mb-0.5 leading-tight truncate ${
                            STATUS_COLORS[act.status] || 'bg-blue-100 text-blue-800'
                          }`}>
                          {formatTime(act.start_time)} {act.title}
                        </Link>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
