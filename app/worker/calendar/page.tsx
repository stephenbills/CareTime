'use client'
import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import WeekView from '@/components/WeekView'
import { useSearchParams, useRouter } from 'next/navigation'

const DAYS = ['S','M','T','W','T','F','S']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const STATUS_DOT: Record<string, string> = {
  awaiting_acceptance: 'bg-yellow-400',
  scheduled: 'bg-blue-500',
  in_progress: 'bg-purple-500',
  awaiting_client_approval: 'bg-orange-400',
  awaiting_payment_approval: 'bg-indigo-400',
  paid: 'bg-gray-300',
  rejected: 'bg-red-400',
  cancelled: 'bg-gray-200',
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function WorkerCalendarInner() {
  const today = new Date()
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialView = (searchParams?.get('view') as 'month' | 'week') || 'month'
  const [view, setView] = useState<'month' | 'week'>(initialView)

  // Restore year/month/selectedDay from the URL so navigating to an activity and
  // back (via router.back()) lands on the same day instead of resetting to today.
  const initialDateParam = searchParams?.get('date')
  const initialDate = initialDateParam ? new Date(`${initialDateParam}T00:00:00`) : today

  const [year, setYear] = useState(initialDate.getFullYear())
  const [month, setMonth] = useState(initialDate.getMonth())
  const [activities, setActivities] = useState<any[]>([])
  const [selectedDay, setSelectedDay] = useState<number | null>(initialDate.getDate())
  const [clients, setClients] = useState<Record<string, string>>({})
  const [carerId, setCarerId] = useState<string | null>(null)
  const supabase = createClient()

  function updateUrl(v: 'month' | 'week', y: number, m: number, day: number | null) {
    const params = new URLSearchParams()
    params.set('view', v)
    if (day) params.set('date', `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
    router.replace(`/worker/calendar?${params.toString()}`)
  }

  function switchView(v: 'month' | 'week') {
    setView(v)
    updateUrl(v, year, month, selectedDay)
  }

  function selectDay(day: number) {
    setSelectedDay(day)
    updateUrl(view, year, month, day)
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: carer } = await supabase
        .from('carers').select('id').eq('user_id', user.id).maybeSingle()
      if (!carer) return
      setCarerId(carer.id)
      loadMonth(carer.id, year, month)
    }
    init()
  }, [])

  async function loadMonth(cid: string, y: number, m: number) {
    const from = new Date(y, m - 1, 1).toISOString()
    const to = new Date(y, m + 2, 0, 23, 59, 59).toISOString()
    const [{ data: acts }, { data: cls }] = await Promise.all([
      supabase.from('activities').select('*')
        .eq('carer_id', cid).gte('start_time', from).lte('start_time', to).order('start_time'),
      supabase.from('clients').select('id, name'),
    ])
    setActivities(acts || [])
    setClients(Object.fromEntries((cls || []).map((c: any) => [c.id, c.name])))
  }

  function prevMonth() {
    const nm = month === 0 ? 11 : month - 1
    const ny = month === 0 ? year - 1 : year
    setYear(ny); setMonth(nm); setSelectedDay(null)
    updateUrl(view, ny, nm, null)
    if (carerId) loadMonth(carerId, ny, nm)
  }
  function nextMonth() {
    const nm = month === 11 ? 0 : month + 1
    const ny = month === 11 ? year + 1 : year
    setYear(ny); setMonth(nm); setSelectedDay(null)
    updateUrl(view, ny, nm, null)
    if (carerId) loadMonth(carerId, ny, nm)
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
      <div className="flex items-center justify-between pt-1">
        <h1 className="text-xl font-bold text-gray-900">My Calendar</h1>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(['month', 'week'] as const).map(v => (
            <button key={v} onClick={() => switchView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}>{v}</button>
          ))}
        </div>
      </div>

      {/* WEEK VIEW */}
      {view === 'week' && (
        <WeekView
          activities={activities}
          labelField="client"
          clients={clients}
          activityLinkBase="/worker/activities"
        />
      )}

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
              {DAYS.map((d, i) => <div key={i} className="py-2 text-center text-xs font-medium text-gray-400">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} className="h-12" />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
                const isSelected = day === selectedDay
                const dayActs = actsForDay(day)
                return (
                  <div key={day} onClick={() => selectDay(day)}
                    className={`h-12 flex flex-col items-center justify-start pt-1.5 cursor-pointer rounded-lg mx-0.5 ${
                      isSelected ? 'bg-blue-50' : 'active:bg-gray-50'
                    }`}>
                    <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium ${
                      isToday ? 'bg-blue-600 text-white' : isSelected ? 'text-blue-600' : 'text-gray-700'
                    }`}>{day}</span>
                    {dayActs.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5">
                        {dayActs.slice(0, 3).map((a, idx) => (
                          <div key={idx} className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[a.status] || 'bg-gray-300'}`} />
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
                    <Link key={act.id} href={`/worker/activities/${act.id}`}
                      className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-4 active:bg-gray-50">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-semibold text-gray-900 text-sm">{act.title}</p>
                        <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${STATUS_DOT[act.status] || 'bg-gray-300'}`} />
                      </div>
                      <p className="text-xs text-gray-500">{formatTime(act.start_time)} – {formatTime(act.end_time)}</p>
                      {act.client_id && <p className="text-xs text-gray-400 mt-0.5">{clients[act.client_id] || '—'}</p>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function WorkerCalendar() {
  return (
    <Suspense fallback={<div className="p-4 text-gray-400 text-sm">Loading…</div>}>
      <WorkerCalendarInner />
    </Suspense>
  )
}
