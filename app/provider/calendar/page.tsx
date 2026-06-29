'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import Link from 'next/link'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

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

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export default function CalendarPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [activities, setActivities] = useState<any[]>([])
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate())
  const [clients, setClients] = useState<Record<string, string>>({})
  const [carers, setCarers] = useState<Record<string, string>>({})
  const [filterClient, setFilterClient] = useState('')
  const [filterCarer, setFilterCarer] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const from = new Date(year, month, 1).toISOString()
      const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

      const [{ data: acts }, { data: cls }, { data: crs }] = await Promise.all([
        supabase.from('activities').select('*').gte('start_time', from).lte('start_time', to),
        supabase.from('clients').select('id, name').eq('active', true),
        supabase.from('carers').select('id, name').eq('active', true),
      ])

      setActivities(acts || [])
      setClients(Object.fromEntries((cls || []).map((c: any) => [c.id, c.name])))
      setCarers(Object.fromEntries((crs || []).map((c: any) => [c.id, c.name])))
    }
    load()
  }, [year, month])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelectedDay(null)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  function activitiesForDay(day: number) {
    return activities.filter(a => {
      const d = new Date(a.start_time)
      if (d.getDate() !== day) return false
      if (filterClient && a.client_id !== filterClient) return false
      if (filterCarer && a.carer_id !== filterCarer) return false
      return true
    })
  }

  const selectedActivities = selectedDay ? activitiesForDay(selectedDay) : []

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-500 text-sm mt-1">{activities.length} activities this month</p>
        </div>
        <Link
          href="/provider/activities/new"
          className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={15} /> Add Activity
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={filterClient}
          onChange={e => setFilterClient(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Clients</option>
          {Object.entries(clients).map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <select
          value={filterCarer}
          onChange={e => setFilterCarer(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Carers</option>
          {Object.entries(carers).map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Month header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <h2 className="font-semibold text-gray-900">{MONTHS[month]} {year}</h2>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronRight size={18} className="text-gray-600" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DAYS.map(d => (
              <div key={d} className="py-2 text-center text-xs font-medium text-gray-400">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-gray-50" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
              const isSelected = day === selectedDay
              const dayActs = activitiesForDay(day)
              return (
                <div
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`min-h-[80px] border-b border-r border-gray-50 p-1.5 cursor-pointer transition-colors
                    ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1
                    ${isToday ? 'bg-blue-600 text-white' : 'text-gray-700'}`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayActs.slice(0, 2).map(a => (
                      <div key={a.id} className={`text-xs px-1 py-0.5 rounded truncate ${STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'}`}>
                        {formatTime(a.start_time)} {a.title}
                      </div>
                    ))}
                    {dayActs.length > 2 && (
                      <div className="text-xs text-gray-400 px-1">+{dayActs.length - 2} more</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Day detail panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">
            {selectedDay
              ? `${MONTHS[month]} ${selectedDay}, ${year}`
              : 'Select a day'}
          </h3>

          {selectedDay && (
            <Link
              href={`/provider/activities/new?date=${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`}
              className="flex items-center gap-1.5 text-blue-600 text-sm hover:text-blue-700 mb-4"
            >
              <Plus size={14} /> Add activity this day
            </Link>
          )}

          {selectedActivities.length === 0 ? (
            <p className="text-sm text-gray-400">
              {selectedDay ? 'No activities on this day.' : 'Click a day to see activities.'}
            </p>
          ) : (
            <div className="space-y-3">
              {selectedActivities.map(a => (
                <Link
                  key={a.id}
                  href={`/provider/activities/${a.id}`}
                  className="block border border-gray-100 rounded-lg p-3 hover:border-blue-200 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="font-medium text-gray-900 text-sm">{a.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLORS[a.status]}`}>
                      {STATUS_LABELS[a.status]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {formatTime(a.start_time)} – {formatTime(a.end_time)}
                  </p>
                  {a.client_id && (
                    <p className="text-xs text-gray-400 mt-0.5">Client: {clients[a.client_id] || '—'}</p>
                  )}
                  {a.carer_id && (
                    <p className="text-xs text-gray-400">Carer: {carers[a.carer_id] || '—'}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status legend */}
      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <span key={key} className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[key]}`}>
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
