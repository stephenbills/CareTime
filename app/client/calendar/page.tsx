'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

const DAYS = ['S','M','T','W','T','F','S']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-500',
  in_progress: 'bg-purple-500',
  awaiting_client_approval: 'bg-orange-400',
  awaiting_payment_approval: 'bg-indigo-400',
  paid: 'bg-gray-300',
  rejected: 'bg-red-400',
  cancelled: 'bg-gray-200',
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

export default function ClientCalendar() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
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
      loadMonth(client.id, year, month)
    }
    init()
  }, [])

  async function loadMonth(cid: string, y: number, m: number) {
    const from = new Date(y, m, 1).toISOString()
    const to = new Date(y, m + 1, 0, 23, 59, 59).toISOString()
    const [{ data: acts }, { data: wks }] = await Promise.all([
      supabase.from('activities').select('*')
        .eq('client_id', cid)
        .gte('start_time', from)
        .lte('start_time', to)
        .order('start_time'),
      supabase.from('carers').select('id, name'),
    ])
    setActivities(acts || [])
    setWorkers(Object.fromEntries((wks || []).map((w: any) => [w.id, w.name])))
  }

  function prevMonth() {
    const nm = month === 0 ? 11 : month - 1
    const ny = month === 0 ? year - 1 : year
    setYear(ny); setMonth(nm); setSelectedDay(null)
    if (clientId) loadMonth(clientId, ny, nm)
  }
  function nextMonth() {
    const nm = month === 11 ? 0 : month + 1
    const ny = month === 11 ? year + 1 : year
    setYear(ny); setMonth(nm); setSelectedDay(null)
    if (clientId) loadMonth(clientId, ny, nm)
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()

  function actsForDay(day: number) {
    return activities.filter(a => {
      const d = new Date(a.start_time)
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year
    })
  }

  const selectedActs = selectedDay ? actsForDay(selectedDay) : []

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-gray-900 pt-1">My Calendar</h1>

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
          {DAYS.map((d, i) => (
            <div key={i} className="py-2 text-center text-xs font-medium text-gray-400">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} className="h-12" />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
            const isSelected = day === selectedDay
            const dayActs = actsForDay(day)
            const needsApproval = dayActs.some(a => a.status === 'awaiting_client_approval')
            return (
              <div key={day} onClick={() => setSelectedDay(day)}
                className={`h-12 flex flex-col items-center justify-start pt-1.5 cursor-pointer transition-colors rounded-lg mx-0.5 ${
                  isSelected ? 'bg-blue-50' : 'active:bg-gray-50'
                }`}>
                <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium ${
                  isToday ? 'bg-blue-600 text-white' : isSelected ? 'text-blue-600' : 'text-gray-700'
                }`}>{day}</span>
                {dayActs.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {dayActs.slice(0, 3).map((a, idx) => (
                      <div key={idx} className={`w-1.5 h-1.5 rounded-full ${
                        needsApproval ? 'bg-orange-400' : STATUS_COLORS[a.status] || 'bg-gray-300'
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
            </div>
          ) : (
            <div className="space-y-2">
              {selectedActs.map(act => (
                <Link key={act.id} href={`/client/activities/${act.id}`}
                  className={`block rounded-2xl border shadow-sm p-4 active:opacity-80 transition-opacity ${
                    act.status === 'awaiting_client_approval'
                      ? 'bg-orange-50 border-orange-200'
                      : 'bg-white border-gray-100'
                  }`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-gray-900 text-sm">{act.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${
                      act.status === 'awaiting_client_approval'
                        ? 'bg-orange-100 text-orange-800 font-medium'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {STATUS_LABELS[act.status] || act.status}
                    </span>
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
    </div>
  )
}
