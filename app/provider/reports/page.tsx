'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronRight, Mail, AlertCircle, Clock, Pill } from 'lucide-react'
import Link from 'next/link'
import { useProviderId } from '@/lib/hooks/useProvider'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })
}
function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

export default function ReportsPage() {
  const [activities, setActivities] = useState<any[]>([])
  const [clients, setClients] = useState<Record<string, any>>({})
  const [workers, setWorkers] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState<string | null>(null)
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())
  const [filterClient, setFilterClient] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [reportType, setReportType] = useState<'approval' | 'compliance'>('approval')
  const [complianceData, setComplianceData] = useState<{ activities: any[]; attached: any[]; counterValues: any[] } | null>(null)
  const [complianceLoading, setComplianceLoading] = useState(false)
  const supabase = createClient()
  const { providerId } = useProviderId()

  useEffect(() => {
    if (providerId) load()
  }, [providerId])

  useEffect(() => {
    if (reportType === 'compliance' && !complianceData && providerId) loadCompliance()
  }, [reportType, providerId])

  async function loadCompliance() {
    setComplianceLoading(true)
    const { data: acts } = await supabase
      .from('activities')
      .select('*')
      .eq('provider_id', providerId)
      .not('actual_start_time', 'is', null)
      .order('actual_start_time', { ascending: false })

    const ids = (acts || []).map((a: any) => a.id)
    const [{ data: attached }, { data: counterValues }] = ids.length > 0
      ? await Promise.all([
          supabase.from('activity_medical_instructions')
            .select('activity_id, completed, medical_instructions(id, title)')
            .in('activity_id', ids),
          supabase.from('activity_counter_values')
            .select('activity_id, value, client_counters(id, title)')
            .in('activity_id', ids),
        ])
      : [{ data: [] }, { data: [] }]

    setComplianceData({ activities: acts || [], attached: attached || [], counterValues: counterValues || [] })
    setComplianceLoading(false)
  }

  async function load() {
    setLoading(true)
    const [{ data: acts }, { data: clientLinks }, { data: carerLinks }] = await Promise.all([
      supabase
        .from('activities')
        .select('*')
        .eq('provider_id', providerId)
        .eq('status', 'awaiting_client_approval')
        .order('actual_end_time', { ascending: true }),
      supabase.from('provider_clients')
        .select('client_id, clients(id, name, email)')
        .eq('provider_id', providerId),
      supabase.from('provider_carers')
        .select('carer_id, carers(id, name, email)')
        .eq('provider_id', providerId),
    ])
    const cls = (clientLinks || []).map((l: any) => l.clients).filter(Boolean)
    const wks = (carerLinks || []).map((l: any) => l.carers).filter(Boolean)
    setActivities(acts || [])
    setClients(Object.fromEntries(cls.map((c: any) => [c.id, c])))
    setWorkers(Object.fromEntries(wks.map((w: any) => [w.id, w])))
    setLoading(false)
  }

  async function sendReminder(activity: any) {
    const client = clients[activity.client_id]
    if (!client?.email) return
    setSending(activity.id)

    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'shift_submitted',
        to: client.email,
        data: {
          recipientName: client.name,
          carerName: workers[activity.carer_id]?.name || 'Your worker',
          activityTitle: activity.title,
          startTime: activity.actual_start_time
            ? `${formatDate(activity.actual_start_time)} ${formatTime(activity.actual_start_time)}`
            : formatDate(activity.start_time),
          endTime: activity.actual_end_time
            ? `${formatDate(activity.actual_end_time)} ${formatTime(activity.actual_end_time)}`
            : '—',
          totalCost: activity.total_cost ? `$${Number(activity.total_cost).toFixed(2)}` : 'See activity for details',
          activityId: activity.id,
        },
      }),
    })

    setSentIds(prev => new Set([...prev, activity.id]))
    setSending(null)
  }

  async function sendAllReminders() {
    const toSend = filtered.filter(a => clients[a.client_id]?.email && !sentIds.has(a.id))
    for (const act of toSend) {
      await sendReminder(act)
    }
  }

  const filtered = activities.filter(a => {
    if (filterClient && a.client_id !== filterClient) return false
    if (dateFrom && new Date(a.actual_end_time || a.end_time) < new Date(dateFrom)) return false
    if (dateTo && new Date(a.actual_end_time || a.end_time) > new Date(dateTo + 'T23:59:59')) return false
    return true
  })

  // Group by client for the report
  const grouped = filtered.reduce((acc, act) => {
    const cid = act.client_id || 'unknown'
    if (!acc[cid]) acc[cid] = []
    acc[cid].push(act)
    return acc
  }, {} as Record<string, any[]>)

  const overdue = filtered.filter(a => {
    const submitted = a.actual_end_time || a.end_time
    return submitted && daysSince(submitted) >= 7
  })

  // Compliance report — filter by the same client/date controls, keyed on actual_start_time
  const complianceFiltered = (complianceData?.activities || []).filter((a: any) => {
    if (filterClient && a.client_id !== filterClient) return false
    if (dateFrom && new Date(a.actual_start_time) < new Date(dateFrom)) return false
    if (dateTo && new Date(a.actual_start_time) > new Date(dateTo + 'T23:59:59')) return false
    return true
  })
  const complianceActivityIds = new Set(complianceFiltered.map((a: any) => a.id))
  const actClientMap = new Map(complianceFiltered.map((a: any) => [a.id, a.client_id]))

  function bucketFor(map: Record<string, any>, cid: string) {
    if (!map[cid]) map[cid] = { instructions: {} as Record<string, any>, counters: {} as Record<string, any> }
    return map[cid]
  }

  const complianceByClient: Record<string, any> = {}
  for (const row of complianceData?.attached || []) {
    if (!complianceActivityIds.has(row.activity_id)) continue
    const cid = actClientMap.get(row.activity_id)
    if (!cid) continue
    const b = bucketFor(complianceByClient, cid)
    const key = row.medical_instructions?.id || 'unknown'
    if (!b.instructions[key]) b.instructions[key] = { title: row.medical_instructions?.title || 'Unknown', given: 0, total: 0 }
    b.instructions[key].total += 1
    if (row.completed) b.instructions[key].given += 1
  }
  for (const row of complianceData?.counterValues || []) {
    if (!complianceActivityIds.has(row.activity_id)) continue
    const cid = actClientMap.get(row.activity_id)
    if (!cid) continue
    const b = bucketFor(complianceByClient, cid)
    const key = row.client_counters?.id || 'unknown'
    if (!b.counters[key]) b.counters[key] = { title: row.client_counters?.title || 'Unknown', total: 0 }
    b.counters[key].total += row.value || 0
  }

  let totalGiven = 0, totalDue = 0
  for (const c of Object.values(complianceByClient) as any[]) {
    for (const i of Object.values(c.instructions) as any[]) { totalGiven += i.given; totalDue += i.total }
  }

  if (loading) return (
    <div className="p-8 text-gray-400 text-sm">Loading…</div>
  )

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
      </div>

      {/* Report selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        <button type="button" onClick={() => setReportType('approval')}
          className={`text-left bg-white rounded-xl shadow-sm p-4 transition-colors ${
            reportType === 'approval' ? 'border-2 border-blue-500' : 'border border-gray-100 hover:border-blue-200'
          }`}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <Clock size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Awaiting Client Approval</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Completed shifts waiting for Client or Nominee to approve before payment can be processed
              </p>
            </div>
          </div>
        </button>
        <button type="button" onClick={() => setReportType('compliance')}
          className={`text-left bg-white rounded-xl shadow-sm p-4 transition-colors ${
            reportType === 'compliance' ? 'border-2 border-blue-500' : 'border border-gray-100 hover:border-blue-200'
          }`}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <Pill size={18} className="text-purple-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Medical Instructions & Counters</p>
              <p className="text-xs text-gray-400 mt-0.5">
                How Medical Instructions and Counters have been actioned across shifts
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Report content */}
      <div className="space-y-6">

        {/* Summary banner */}
        {reportType === 'approval' ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-400 mb-1">Awaiting Approval</p>
              <p className="text-3xl font-bold text-gray-900">{filtered.length}</p>
            </div>
            <div className={`rounded-xl border shadow-sm p-4 ${overdue.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
              <p className={`text-xs mb-1 ${overdue.length > 0 ? 'text-red-500' : 'text-gray-400'}`}>Overdue (7+ days)</p>
              <p className={`text-3xl font-bold ${overdue.length > 0 ? 'text-red-700' : 'text-gray-900'}`}>{overdue.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-400 mb-1">Clients Affected</p>
              <p className="text-3xl font-bold text-gray-900">{Object.keys(grouped).length}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-400 mb-1">Shifts in Range</p>
              <p className="text-3xl font-bold text-gray-900">{complianceFiltered.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-400 mb-1">Instructions Given</p>
              <p className="text-3xl font-bold text-gray-900">{totalGiven}/{totalDue}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-400 mb-1">Clients Covered</p>
              <p className="text-3xl font-bold text-gray-900">{Object.keys(complianceByClient).length}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={filterClient}
              onChange={e => setFilterClient(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">All Clients</option>
              {Object.values(clients).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">From</span>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">To</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {(filterClient || dateFrom || dateTo) && (
              <button
                onClick={() => { setFilterClient(''); setDateFrom(''); setDateTo('') }}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Clear filters
              </button>
            )}
            {reportType === 'approval' && (
              <div className="ml-auto">
                <button
                  onClick={sendAllReminders}
                  disabled={filtered.length === 0 || sending !== null}
                  className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Mail size={14} />
                  Send All Reminders
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        {reportType === 'compliance' ? (
          complianceLoading ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center text-gray-400 text-sm">
              Loading…
            </div>
          ) : Object.keys(complianceByClient).length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
              <p className="text-gray-600 font-medium text-sm">No Medical Instructions or Counters recorded</p>
              <p className="text-gray-400 text-xs mt-1">Nothing has been actioned in this range yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(complianceByClient).map(([clientId, bucket]: [string, any]) => {
                const client = clients[clientId]
                const instructions = Object.values(bucket.instructions) as any[]
                const counterRows = Object.values(bucket.counters) as any[]
                return (
                  <div key={clientId} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                      <p className="font-semibold text-gray-900 text-sm">{client?.name || 'Unknown Client'}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-gray-50">
                      {instructions.length > 0 && (
                        <div className="p-5">
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Medical Instructions</p>
                          <div className="space-y-2">
                            {instructions.map((i: any) => (
                              <div key={i.title} className="flex items-center justify-between text-sm">
                                <span className="text-gray-700">{i.title}</span>
                                <span className="text-gray-500 font-medium">
                                  {i.given}/{i.total} ({i.total > 0 ? Math.round((i.given / i.total) * 100) : 0}%)
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {counterRows.length > 0 && (
                        <div className="p-5">
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Counters</p>
                          <div className="space-y-2">
                            {counterRows.map((c: any) => (
                              <div key={c.title} className="flex items-center justify-between text-sm">
                                <span className="text-gray-700">{c.title}</span>
                                <span className="text-gray-500 font-medium">{c.total}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-green-600 text-xl">✓</span>
            </div>
            <p className="text-gray-600 font-medium text-sm">No activities awaiting approval</p>
            <p className="text-gray-400 text-xs mt-1">All submitted shifts have been approved</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped)
              .sort(([, a], [, b]) => {
                const aa = a as any[]
                const bb = b as any[]
                const oldestA = Math.min(...aa.map((x: any) => new Date(x.actual_end_time || x.end_time).getTime()))
                const oldestB = Math.min(...bb.map((x: any) => new Date(x.actual_end_time || x.end_time).getTime()))
                return oldestA - oldestB
              })
              .map(([clientId, actsRaw]) => {
                const acts = actsRaw as any[]
                const client = clients[clientId]
                const hasEmail = !!client?.email
                const allSent = acts.every((a: any) => sentIds.has(a.id))

                return (
                  <div key={clientId} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Client header */}
                    <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{client?.name || 'Unknown Client'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{client?.email || 'No email address'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">{acts.length} shift{acts.length !== 1 ? 's' : ''} pending</span>
                        {hasEmail && (
                          <button
                            onClick={() => acts.forEach((a: any) => !sentIds.has(a.id) && sendReminder(a))}
                            disabled={sending !== null || allSent}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              allSent
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50'
                            }`}
                          >
                            <Mail size={12} />
                            {allSent ? 'Reminder Sent' : 'Send Reminder'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Activity rows */}
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-50">
                          <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-400">Activity</th>
                          <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-400">Worker</th>
                          <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-400">Shift Date</th>
                          <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-400">Submitted</th>
                          <th className="px-5 py-2.5 text-center text-xs font-medium text-gray-400">Days Waiting</th>
                          <th className="px-5 py-2.5 text-right text-xs font-medium text-gray-400">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(acts as any[])
                          .sort((a, b) => new Date(a.actual_end_time || a.end_time).getTime() - new Date(b.actual_end_time || b.end_time).getTime())
                          .map((act, i) => {
                            const submittedDate = act.actual_end_time || act.end_time
                            const days = submittedDate ? daysSince(submittedDate) : 0
                            const isOverdue = days >= 7
                            const worker = workers[act.carer_id]

                            return (
                              <tr key={act.id} className={`${i < acts.length - 1 ? 'border-b border-gray-50' : ''}`}>
                                <td className="px-5 py-3">
                                  <p className="text-sm font-medium text-gray-900">{act.title}</p>
                                </td>
                                <td className="px-5 py-3 text-sm text-gray-500">
                                  {worker?.name || '—'}
                                </td>
                                <td className="px-5 py-3 text-sm text-gray-500">
                                  {act.actual_start_time
                                    ? formatDate(act.actual_start_time)
                                    : formatDate(act.start_time)}
                                </td>
                                <td className="px-5 py-3 text-sm text-gray-500">
                                  {submittedDate ? formatDate(submittedDate) : '—'}
                                </td>
                                <td className="px-5 py-3 text-center">
                                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                                    isOverdue
                                      ? 'bg-red-100 text-red-700'
                                      : days >= 4
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {isOverdue && <AlertCircle size={10} />}
                                    {days} day{days !== 1 ? 's' : ''}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-right">
                                  <Link
                                    href={`/provider/activities/${act.id}`}
                                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center justify-end gap-0.5"
                                  >
                                    View <ChevronRight size={13} />
                                  </Link>
                                </td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}
